// Real-time run logic for COIL (audio Snake).
//
// You steer a serpent around a walled board, eating food to grow and speed up.
// Your own body is the hazard: run the head into a wall or into yourself and you
// crash. Each step the game reports which neighbours are blocked so the screen can
// tick a "cage" around you (absolute directions, never rotating) and a beacon
// toward the food. Three lives, endless, score = food eaten (worth more as you go).
//
// SCREEN-LOCKED, non-rotating: Up = north, and audio-north is always ahead. This
// module owns state and emits events; the screen turns them into audio +
// announcements. No DOM/audio refs, so it runs headless under /tmp/coil-sim.js.
content.game = (() => {
  const K = () => content.constants

  const state = {
    phase: 'play', // ready | play | dying | gameover-pending | gameover
    score: 0,
    lives: 0,
    eaten: 0,
    length: 0,
    elapsed: 0,
  }

  let snake = []          // [head, ..., tail]; each {x, y}
  let occ = new Set()     // "x,y" of every body cell
  let heading = 'e'
  let queued = null
  let food = {x: 0, y: 0}
  let stepTimer = 0
  let phaseTimer = 0
  let overDone = false

  function E() { return content.events }
  const W = () => K().W
  const H = () => K().H

  function key(x, y) { return x + ',' + y }
  function isWall(x, y) { return x <= 0 || x >= W() - 1 || y <= 0 || y >= H() - 1 }
  function occupied(x, y) { return occ.has(key(x, y)) }

  function rebuildOcc() {
    occ = new Set()
    for (const c of snake) occ.add(key(c.x, c.y))
  }

  function reset() {
    state.phase = 'ready' // wait stationary for the first chosen heading
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.eaten = 0
    state.elapsed = 0
    overDone = false
    spawnSnake()
    spawnFood()
    stepTimer = K().stepFor(0)
    E().emit('run-start', {lives: state.lives})
    emitStep('start')
    E().emit('ready', {})
  }

  function spawnSnake() {
    const cx = Math.floor(W() / 2)
    const cy = Math.floor(H() / 2)
    heading = 'e'
    queued = null
    snake = []
    for (let i = 0; i < K().START_LEN; i++) snake.push({x: cx - i, y: cy}) // head at cx, tail to the left
    state.length = snake.length
    rebuildOcc()
  }

  function spawnFood() {
    const open = []
    for (let y = 1; y < H() - 1; y++) for (let x = 1; x < W() - 1; x++) if (!occupied(x, y)) open.push({x, y})
    if (!open.length) { food = null; return }
    food = open[Math.floor(Math.random() * open.length)]
  }

  // ---- input ----
  // Returns true if the turn was accepted, false if it was refused (unknown dir, or
  // a 180° reversal straight back into your own neck). The screen turns a refusal
  // into a short "can't" cue so a rejected key is never silent.
  //
  // In the 'ready' phase (fresh run / just respawned) the snake sits still until you
  // pick a heading: the first valid direction launches the run. A reversal into your
  // own body is still refused (the body lies behind you at spawn), so you can begin in
  // any of the three non-rear directions.
  function setDir(dir) {
    if (!K().DIRS[dir]) return false
    if (state.phase === 'ready') {
      if (dir === K().DIRS[heading].opp) return false // can't launch straight into your neck
      heading = dir
      queued = null
      stepTimer = K().stepFor(state.eaten)
      state.phase = 'play'
      E().emit('go', {heading})
      return true
    }
    if (state.phase !== 'play') return false // ignore input during the death / game-over gap
    if (dir === K().DIRS[heading].opp) return false // no 180° reversal
    queued = dir
    return true
  }

  function foodVector() {
    if (!food) return {dx: 0, dy: 0, dist: 0}
    const h = snake[0]
    return {dx: food.x - h.x, dy: food.y - h.y, dist: Math.abs(food.x - h.x) + Math.abs(food.y - h.y)}
  }

  // blocked non-rear neighbours of the head, in absolute directions (the imminent
  // ones, dist 1) — used by the F3 "which sides are blocked" readout.
  function warns() {
    const h = snake[0]
    const rear = K().DIRS[heading].opp
    const out = []
    for (const d of K().DIR_LIST) {
      if (d.id === rear) continue
      const nx = h.x + d.dx, ny = h.y + d.dy
      if (isWall(nx, ny) || occupied(nx, ny)) out.push(d.id)
    }
    return out
  }

  // For each non-rear direction, the distance (1..CAGE_SCAN) to the nearest blocker
  // along that ray and what KIND it is ('wall' or 'body'); omitted if nothing is in
  // range. Drives the graded clearance beacons — closer = louder + faster, dist 1 =
  // the last warning — and the kind lets the screen voice your own body (tail) with a
  // different timbre than the arena wall, so you can hear which is closing you in.
  function scanCage() {
    const h = snake[0]
    const rear = K().DIRS[heading].opp
    const max = K().CAGE_SCAN
    const out = []
    for (const d of K().DIR_LIST) {
      if (d.id === rear) continue
      let x = h.x, y = h.y
      for (let i = 1; i <= max; i++) {
        x += d.dx; y += d.dy
        if (isWall(x, y)) { out.push({dir: d.id, dist: i, kind: 'wall'}); break }
        if (occupied(x, y)) { out.push({dir: d.id, dist: i, kind: 'body'}); break }
      }
    }
    return out
  }

  // The tail cell vacates as the snake advances, so a corridor you can follow stays
  // open even though the tail currently occupies it. Treat the tail tip as passable
  // for exit/flood reasoning (it is, unless you're about to grow into it).
  function passable(x, y) {
    if (isWall(x, y)) return false
    if (!occupied(x, y)) return true
    const tail = snake[snake.length - 1]
    return tail && x === tail.x && y === tail.y
  }

  // Count of open cells reachable from (sx, sy), flood-filled and capped. Used to rate
  // how much room lies beyond each open exit — a real way out vs a near dead-end.
  function floodRoom(sx, sy, cap) {
    if (!passable(sx, sy)) return 0
    const seen = new Set([key(sx, sy)])
    const stack = [[sx, sy]]
    let n = 0
    while (stack.length && n < cap) {
      const [x, y] = stack.pop()
      n++
      for (const d of K().DIR_LIST) {
        const nx = x + d.dx, ny = y + d.dy
        const kk = key(nx, ny)
        if (seen.has(kk)) continue
        if (!passable(nx, ny)) continue
        seen.add(kk); stack.push([nx, ny])
      }
    }
    return n
  }

  // Each open non-rear neighbour of the head and how much room lies beyond it. The
  // screen sounds a soft beacon from each (louder the roomier), so a coiling snake
  // hears its way out — and a route that only leads into a trap stays faint.
  function openExits() {
    const h = snake[0]
    const rear = K().DIRS[heading].opp
    const cap = (W() - 2) * (H() - 2)
    const out = []
    for (const d of K().DIR_LIST) {
      if (d.id === rear) continue
      const nx = h.x + d.dx, ny = h.y + d.dy
      if (!passable(nx, ny)) continue
      out.push({dir: d.id, room: floodRoom(nx, ny, cap)})
    }
    return out
  }

  function emitStep(kind) {
    const fv = foodVector()
    E().emit('step', {kind, heading, cage: scanCage(), exits: openExits(), foodDx: fv.dx, foodDy: fv.dy, foodDist: fv.dist, length: state.length})
  }

  function advance() {
    // apply buffered turn
    if (queued && queued !== K().DIRS[heading].opp) heading = queued
    queued = null
    const d = K().DIRS[heading]
    const h = snake[0]
    const nx = h.x + d.dx, ny = h.y + d.dy

    const willEat = food && nx === food.x && ny === food.y
    // collision: wall, or body (excluding the tail cell that will vacate when not growing)
    const tail = snake[snake.length - 1]
    const hitsTail = nx === tail.x && ny === tail.y
    if (isWall(nx, ny) || (occupied(nx, ny) && !(hitsTail && !willEat))) { crash(); return }

    snake.unshift({x: nx, y: ny})
    if (willEat) {
      state.eaten++
      state.score += K().foodPoints(state.eaten)
      state.length = snake.length
      rebuildOcc()
      spawnFood()
      stepTimer = K().stepFor(state.eaten)
      E().emit('eat', {eaten: state.eaten, length: state.length})
      E().emit('score-change')
      emitStep('eat')
    } else {
      snake.pop()
      state.length = snake.length
      rebuildOcc()
      emitStep('move')
    }
  }

  function crash() {
    state.lives--
    E().emit('crash', {lives: state.lives})
    if (state.lives <= 0) { state.phase = 'gameover-pending'; phaseTimer = 1.3; overDone = false }
    else { state.phase = 'dying'; phaseTimer = 0.9 }
  }

  function respawn() {
    spawnSnake()
    if (food && occupied(food.x, food.y)) spawnFood()
    stepTimer = K().stepFor(state.eaten)
    state.phase = 'ready' // sit still after respawn until the player picks a heading
    E().emit('respawn', {lives: state.lives})
    emitStep('respawn')
    E().emit('ready', {})
  }

  function update(delta) {
    if (state.phase === 'play') {
      state.elapsed += delta
      stepTimer -= delta
      if (stepTimer <= 0) {
        stepTimer += K().stepFor(state.eaten)
        advance()
      }
      return
    }
    if (state.phase === 'dying') {
      phaseTimer -= delta
      if (phaseTimer <= 0) respawn()
      return
    }
    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) { overDone = true; state.phase = 'gameover'; E().emit('game-over', {score: state.score, eaten: state.eaten}) }
    }
  }

  return {
    state,
    reset,
    update,
    setDir,
    isPlaying: () => state.phase === 'play',
    isReady: () => state.phase === 'ready',
    phase: () => state.phase,
    heading: () => heading,
    food: foodVector,
    warns,
    openExits,
    // For the aria-hidden viz: the board, snake and food.
    snapshot: () => ({
      W: W(), H: H(),
      head: snake[0] ? {x: snake[0].x, y: snake[0].y} : null,
      body: snake.map((c) => ({x: c.x, y: c.y})),
      food: food ? {x: food.x, y: food.y} : null,
      heading,
    }),
  }
})()
