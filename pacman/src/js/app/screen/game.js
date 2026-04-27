app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null,
    livesEl: null,
    levelEl: null,
    dotsEl: null,
    f1Pressed: false,
    f2Pressed: false,
    f3Pressed: false,
    f4Pressed: false,
    arrowPressed: {ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false},
    ghostToggleDown: false,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.dotsEl = root.querySelector('.a-game--dots-value')
    this.refreshHud()

    // Chrome (and a few other browsers) hijack F1 for a built-in Help overlay,
    // and may steal F3 (find) or F4 too. Eat the default for F1–F4 globally so
    // the game's announcement keys actually fire.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1' || e.key === 'F2' || e.key === 'F3' || e.key === 'F4') {
        e.preventDefault()
      }
    })

    content.events.on('score-change', () => this.refreshHud())
    content.events.on('level-start', (e) => {
      this.refreshHud()
      app.announce.polite(`Level ${e.level}. Get ready!`)
    })
    content.events.on('level-clear', (e) => {
      app.announce.assertive(`Level ${e.level} cleared!`)
    })
    content.events.on('life-lost', () => {
      app.announce.assertive('Caught! Lives left: ' + Math.max(0, content.game.state.lives - 1))
      this.refreshHud()
    })
    content.events.on('extra-life', () => app.announce.polite('Extra life!'))
    content.events.on('eat-power', () => app.announce.polite('Power pellet! Ghosts vulnerable.'))
    content.events.on('ghost-eaten', (e) => app.announce.polite(`${e.name} eaten! +${e.points}`))
    content.events.on('fruit-spawn', (e) => app.announce.polite(`A ${e.name} appeared!`))
    content.events.on('fruit-eaten', (e) => app.announce.polite(`${e.name} +${e.points}`))
    content.events.on('game-over', () => {
      app.announce.assertive('Game over.')
      app.screenManager.dispatch('gameOver')
    })
    content.events.on('wall-hit', (e) => {
      content.sfx.wallHit()
      const opens = openDirections(e.x, e.y)
      if (opens.length === 0) app.announce.polite('no exits')
      else app.announce.polite(opens.join(' ') + ' open')
    })
  },
  onEnter: function () {
    content.audio.start()
    content.sfx.introJingle()
    app.announce.polite(`Level ${content.game.state.level}. Score ${content.game.state.score}. Lives ${content.game.state.lives}.`)
    this.refreshHud()
    this.state.f1Pressed = false
    this.state.f2Pressed = false
    this.state.f3Pressed = false
    this.state.f4Pressed = false
    this.state.arrowPressed = {ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false}
    this.state.ghostToggleDown = false
  },
  onExit: function () {
    // Silence all looping spatial audio so it doesn't bleed through pause/menu/game-over
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },
  onFrame: function (e) {
    if (content.game.isPaused()) return

    // Direct keyboard: arrows for movement, Esc for pause, F1 score, F2 dots, 1-9 speed
    const k = engine.input.keyboard
    let dir = null
    if (k.is('ArrowUp')) dir = {x: 0, y: -1}
    else if (k.is('ArrowDown')) dir = {x: 0, y: 1}
    else if (k.is('ArrowLeft')) dir = {x: -1, y: 0}
    else if (k.is('ArrowRight')) dir = {x: 1, y: 0}
    if (dir) content.pacman.setQueuedDirection(dir)

    // Rising-edge per-arrow check: if the player presses a direction and the
    // adjacent tile in that direction is a wall, fire wall-hit immediately so
    // they get audible feedback (sound + "X open" announcement) without having
    // to wait until Pac-Man bumps. Uses the same tile-ahead probe as
    // pacman.canMoveDir so behavior matches what the queued turn would do.
    const arrowDirs = {
      ArrowUp: {x: 0, y: -1},
      ArrowDown: {x: 0, y: 1},
      ArrowLeft: {x: -1, y: 0},
      ArrowRight: {x: 1, y: 0},
    }
    for (const key in arrowDirs) {
      const isDown = k.is(key)
      if (isDown && !this.state.arrowPressed[key]) {
        const ad = arrowDirs[key]
        const pos = content.pacman.getPosition()
        const tx = Math.floor(pos.x + ad.x * 0.51)
        const ty = Math.floor(pos.y + ad.y * 0.51)
        if (!content.maze.isPassableForPacman(tx, ty)) {
          content.events.emit('wall-hit', {
            x: Math.floor(pos.x),
            y: Math.floor(pos.y),
            facing: ad,
          })
        }
      }
      this.state.arrowPressed[key] = isDown
    }

    // Esc to pause (handled via app.controls.ui's pause delta)
    const ui = app.controls.ui()
    if (ui.pause || ui.back) {
      content.game.setPaused(true)
      app.screenManager.dispatch('pause')
      return
    }

    // F1 — score, F2 — nearest dot (path), F3 — dots remaining this level
    if (k.is('F1')) {
      if (!this.state.f1Pressed) {
        this.state.f1Pressed = true
        this.announceScore()
      }
    } else this.state.f1Pressed = false

    if (k.is('F2')) {
      if (!this.state.f2Pressed) {
        this.state.f2Pressed = true
        this.announceNearestTarget()
      }
    } else this.state.f2Pressed = false

    if (k.is('F3')) {
      if (!this.state.f3Pressed) {
        this.state.f3Pressed = true
        this.announceDotsRemaining()
      }
    } else this.state.f3Pressed = false

    if (k.is('F4')) {
      if (!this.state.f4Pressed) {
        this.state.f4Pressed = true
        this.announceCompletion()
      }
    } else this.state.f4Pressed = false

    // 1..9 to scale speed
    for (let i = 1; i <= 9; i++) {
      if (k.is('Digit' + i)) {
        const m = 0.5 + (i - 1) * 0.15
        content.pacman.setSpeedMultiplier(m)
        app.announce.polite('Speed ' + i)
      }
    }

    // Ctrl+Alt+D — toggle "ghosts off" debug mode. Edge-detected on D so a
    // held chord doesn't flap the toggle every frame.
    const ctrl = k.is('ControlLeft') || k.is('ControlRight')
    const alt  = k.is('AltLeft') || k.is('AltRight')
    const d    = k.is('KeyD')
    const chord = ctrl && alt && d
    if (chord && !this.state.ghostToggleDown) {
      const next = !content.ghosts.isDisabled()
      content.ghosts.setDisabled(next)
      app.announce.assertive(next ? 'Ghosts off.' : 'Ghosts on.')
    }
    this.state.ghostToggleDown = chord

    // Update game logic at frame rate
    const delta = (e && e.delta) || 1/60
    content.game.update(delta)
    content.audio.frame()

    this.refreshHud()
  },
  refreshHud: function () {
    if (!this.state.scoreEl) return
    this.state.scoreEl.textContent = String(content.game.state.score)
    this.state.livesEl.textContent = String(Math.max(0, content.game.state.lives))
    this.state.levelEl.textContent = String(content.game.state.level)
    this.state.dotsEl.textContent = String(content.maze.dotsRemaining())
  },
  announceScore: function () {
    const s = content.game.state
    app.announce.polite(`Score ${s.score}. Lives ${s.lives}. Level ${s.level}. ${content.maze.dotsRemaining()} dots remaining.`)
  },
  // F2: nearest target. Fruit (and any future special items) takes precedence
  // over dots — if a bonus is on the maze, the player should be heading for it.
  // Direction is always the BFS next-step (the actual move to make), in
  // integer tile coords so it lands cleanly on a cardinal (north/south/east/
  // west). Reporting straight-line bearing instead would point through walls,
  // which is unsafe in an accessibility-first game.
  announceNearestTarget: function () {
    const p = content.pacman.getPosition()

    if (content.fruit.isActive()) {
      const fp = content.fruit.getPosition()
      const path = content.maze.pathTo(p.x, p.y, fp.x, fp.y)
      if (path) {
        const label = nextStepDir(p, path.nextStepTile)
        const name = content.fruit.name() || 'fruit'
        app.announce.polite(`${name}: ${label}, ${path.distance} tiles.`)
        return
      }
    }

    const result = content.maze.nearestDotByPath(p.x, p.y)
    if (!result) {
      app.announce.polite('No dots remaining.')
      return
    }
    let bucket = 'far'
    if (result.distance < 4) bucket = 'close'
    else if (result.distance < 10) bucket = 'medium'
    const label = nextStepDir(p, result.nextStepTile)
    app.announce.polite(`Nearest dot: ${bucket}, ${label}, ${result.distance} tiles.`)
  },
  announceDotsRemaining: function () {
    const n = content.maze.dotsRemaining()
    if (n === 0) app.announce.polite('Level cleared.')
    else if (n === 1) app.announce.polite('1 dot left to clear the level.')
    else app.announce.polite(`${n} dots left to clear the level.`)
  },
  announceCompletion: function () {
    const total = content.game.state.totalDots
    const remaining = content.maze.dotsRemaining()
    if (!total) {
      app.announce.polite('Level not started.')
      return
    }
    const pct = Math.round(((total - remaining) / total) * 100)
    app.announce.polite(`${pct} percent complete.`)
  },
})

// Compass labels for adjacent open tiles. The audio is fixed top-down
// (north = front, east = right, south = behind, west = left), so direction
// announcements use absolute compass terms — they do not rotate with Pac-Man's
// facing.
function openDirections(tx, ty) {
  const offsets = [
    {dx: 0,  dy: -1, label: 'north'},
    {dx: 1,  dy: 0,  label: 'east'},
    {dx: 0,  dy: 1,  label: 'south'},
    {dx: -1, dy: 0,  label: 'west'},
  ]
  const opens = []
  for (const o of offsets) {
    if (content.maze.isPassableForPacman(tx + o.dx, ty + o.dy)) {
      opens.push(o.label)
    }
  }
  return opens
}

// Compass label for the BFS next-step from Pac-Man's current tile to an
// adjacent target tile. Working in integer tile coords keeps the result on a
// clean cardinal — Pac-Man's continuous position can sit on a tile edge (e.g.
// y=23 at spawn, where the tile center is y=23.5), and using continuous deltas
// would smear that 0.5-tile offset into a misleading diagonal label. Tunnel
// wrap on row 14 produces a |dx| of COLS-1 across the seam; collapse it back
// to a unit step in the wrapping direction.
function nextStepDir(pacPos, nextTile) {
  const px = Math.floor(pacPos.x), py = Math.floor(pacPos.y)
  let dx = nextTile.x - px
  const dy = nextTile.y - py
  const COLS = content.maze.COLS
  if (dx > COLS / 2) dx -= COLS
  else if (dx < -COLS / 2) dx += COLS
  return describeDir(dx, dy)
}

// 8-way compass label for an arbitrary delta. Screen coords: +y = south.
function describeDir(dx, dy) {
  if (dx === 0 && dy === 0) return 'here'
  // atan2 with -dy so 0° points north (up), 90° points east, etc.
  const deg = Math.atan2(dx, -dy) * 180 / Math.PI
  const a = ((deg % 360) + 360) % 360
  if (a < 22.5 || a >= 337.5) return 'north'
  if (a < 67.5)  return 'north-east'
  if (a < 112.5) return 'east'
  if (a < 157.5) return 'south-east'
  if (a < 202.5) return 'south'
  if (a < 247.5) return 'south-west'
  if (a < 292.5) return 'west'
  return 'north-west'
}
