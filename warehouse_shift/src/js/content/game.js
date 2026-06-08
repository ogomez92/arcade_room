content.game = (() => {
  const DIRECTIONS = [
    {key: 'north', x: 0, y: -1},
    {key: 'east', x: 1, y: 0},
    {key: 'south', x: 0, y: 1},
    {key: 'west', x: -1, y: 0},
  ]

  const state = {
    active: false,
    crates: [],
    focusIndex: 0,
    goals: [],
    height: 0,
    history: [],
    lastResult: null,
    level: null,
    levelIndex: 0,
    moves: 0,
    player: {x: 0, y: 0},
    pushes: 0,
    seconds: 0,
    solved: false,
    undos: 0,
    walls: {},
    width: 0,
  }

  function cellKey(x, y) {
    return x + ',' + y
  }

  function cloneCrates() {
    return state.crates.map((crate) => ({...crate}))
  }

  function crateAt(x, y, crates = state.crates) {
    return crates.find((crate) => crate.x == x && crate.y == y) || null
  }

  function directionName(dx, dy) {
    if (dx == 0 && dy < 0) return app.i18n.t('dir.north')
    if (dx == 0 && dy > 0) return app.i18n.t('dir.south')
    if (dx > 0 && dy == 0) return app.i18n.t('dir.east')
    if (dx < 0 && dy == 0) return app.i18n.t('dir.west')

    const vertical = dy < 0 ? app.i18n.t('dir.north') : app.i18n.t('dir.south'),
      horizontal = dx > 0 ? app.i18n.t('dir.east') : app.i18n.t('dir.west')

    return vertical + ' ' + horizontal
  }

  // Per-axis steps, e.g. "north 1 east 2", so the player knows exactly how far
  // to move on each axis instead of a single combined Manhattan distance.
  function directionSteps(dx, dy) {
    const parts = []

    if (dy < 0) parts.push(app.i18n.t('ann.stepAxis', {dir: app.i18n.t('dir.north'), count: -dy}))
    else if (dy > 0) parts.push(app.i18n.t('ann.stepAxis', {dir: app.i18n.t('dir.south'), count: dy}))

    if (dx > 0) parts.push(app.i18n.t('ann.stepAxis', {dir: app.i18n.t('dir.east'), count: dx}))
    else if (dx < 0) parts.push(app.i18n.t('ann.stepAxis', {dir: app.i18n.t('dir.west'), count: -dx}))

    if (!parts.length) return app.i18n.t('ann.here')

    return parts.join(' ')
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.round(seconds || 0))

    const minutes = Math.floor(seconds / 60),
      rest = seconds % 60

    return minutes + ':' + String(rest).padStart(2, '0')
  }

  function hasWall(x, y) {
    return Boolean(state.walls[cellKey(x, y)])
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < state.width && y < state.height
  }

  function isFloor(x, y) {
    return inBounds(x, y) && !hasWall(x, y)
  }

  function isGoal(x, y) {
    return state.goals.some((goal) => goal.x == x && goal.y == y)
  }

  function isBlockedForCrate(x, y) {
    return !isFloor(x, y) || Boolean(crateAt(x, y))
  }

  function isSolved() {
    return state.crates.length > 0 && state.crates.every((crate) => isGoal(crate.x, crate.y))
  }

  function parseLevel(level) {
    const width = level.map.reduce((max, row) => Math.max(max, row.length), 0),
      walls = {}

    state.crates = []
    state.goals = []
    state.height = level.map.length
    state.level = level
    state.player = {x: 0, y: 0}
    state.walls = walls
    state.width = width

    level.map.forEach((row, y) => {
      for (let x = 0; x < width; x++) {
        const ch = row[x] || '#'

        if (ch == '#') walls[cellKey(x, y)] = true
        if (ch == '.' || ch == '*' || ch == '+') state.goals.push({x, y})
        if (ch == '$' || ch == '*') state.crates.push({id: state.crates.length, x, y})
        if (ch == '@' || ch == '+') state.player = {x, y}
      }
    })
  }

  function pushHistory() {
    state.history.push({
      crates: cloneCrates(),
      moves: state.moves,
      player: {...state.player},
      pushes: state.pushes,
      seconds: state.seconds,
    })

    if (state.history.length > 250) state.history.shift()
  }

  function resetCounters() {
    state.active = true
    state.focusIndex = 0
    state.history = []
    state.lastResult = null
    state.moves = 0
    state.pushes = 0
    state.seconds = 0
    state.solved = false
    state.undos = 0
  }

  function crateLabel(crate) {
    return app.i18n.t(isGoal(crate.x, crate.y) ? 'ann.crateOnGoal' : 'ann.crate')
  }

  function targetLabel(target) {
    if (!target) return app.i18n.t('ann.noTarget')
    if (target.type == 'goal') return app.i18n.t('ann.emptyGoal')
    if (target.type == 'crate') return crateLabel(target.crate)
    return app.i18n.t('ann.target')
  }

  function targets() {
    const result = []

    state.crates.forEach((crate) => {
      if (!isGoal(crate.x, crate.y)) {
        result.push({crate, type: 'crate', x: crate.x, y: crate.y})
      }
    })

    state.goals.forEach((goal) => {
      if (!crateAt(goal.x, goal.y)) {
        result.push({type: 'goal', x: goal.x, y: goal.y})
      }
    })

    if (result.length) return result

    state.crates.forEach((crate) => result.push({crate, type: 'crate', x: crate.x, y: crate.y}))
    return result
  }

  function currentTarget() {
    const list = targets()
    if (!list.length) return null
    state.focusIndex = ((state.focusIndex % list.length) + list.length) % list.length
    return list[state.focusIndex]
  }

  function blockedByCorner(crate) {
    if (isGoal(crate.x, crate.y)) return false

    const left = isBlockedForCrate(crate.x - 1, crate.y),
      right = isBlockedForCrate(crate.x + 1, crate.y),
      up = isBlockedForCrate(crate.x, crate.y - 1),
      down = isBlockedForCrate(crate.x, crate.y + 1)

    return (left || right) && (up || down)
  }

  function scan(dx, dy) {
    let distance = 0,
      first = null,
      x = state.player.x,
      y = state.player.y

    while (true) {
      x += dx
      y += dy
      distance++

      if (!isFloor(x, y)) {
        return {
          distance,
          first,
          type: 'wall',
          x,
          y,
        }
      }

      const crate = crateAt(x, y)
      if (!first && crate) {
        first = {
          crate,
          distance,
          type: isGoal(x, y) ? 'crateGoal' : 'crate',
          x,
          y,
        }
      } else if (!first && isGoal(x, y)) {
        first = {
          distance,
          type: 'goal',
          x,
          y,
        }
      }
    }
  }

  function lineDescription(direction) {
    const result = scan(direction.x, direction.y),
      dir = app.i18n.t('dir.' + direction.key)

    if (result.first) {
      const item = result.first
      if (item.type == 'crateGoal') {
        return app.i18n.t('ann.scanCrateGoal', {dir, distance: item.distance})
      }
      if (item.type == 'crate') {
        return app.i18n.t('ann.scanCrate', {dir, distance: item.distance})
      }
      return app.i18n.t('ann.scanGoal', {dir, distance: item.distance})
    }

    return app.i18n.t('ann.scanWall', {dir, distance: result.distance})
  }

  function validMove(dx, dy) {
    const tx = state.player.x + dx,
      ty = state.player.y + dy,
      crate = crateAt(tx, ty)

    if (!isFloor(tx, ty)) return false
    if (!crate) return true

    return isFloor(tx + dx, ty + dy) && !crateAt(tx + dx, ty + dy)
  }

  function availableDirections() {
    return DIRECTIONS.filter((dir) => validMove(dir.x, dir.y))
  }

  function solveCheck() {
    if (!isSolved()) return false

    state.solved = true
    state.active = false
    state.lastResult = app.progress.recordSolved(state.levelIndex, state)
    content.events.emit('level-solved', {
      index: state.levelIndex,
      result: state.lastResult,
      state,
    })

    return true
  }

  return {
    state,
    availableDirections,
    canMove: validMove,
    currentTarget,
    directionName,
    directionSteps,
    formatTime,
    getCrateAt: crateAt,
    getGoals: () => state.goals.map((goal) => ({...goal})),
    getPlayer: () => ({...state.player}),
    getTargets: targets,
    hasNextLevel: () => state.levelIndex + 1 < content.levels.count(),
    isActive: () => state.active,
    isFloor,
    isGoal,
    isSolved: () => state.solved,
    move: function (dx, dy) {
      if (!state.active || state.solved) return false

      const tx = state.player.x + dx,
        ty = state.player.y + dy,
        crate = crateAt(tx, ty)

      if (!isFloor(tx, ty)) {
        content.events.emit('blocked', {reason: 'wall', x: tx, y: ty})
        return false
      }

      if (crate) {
        const bx = tx + dx,
          by = ty + dy

        if (!isFloor(bx, by) || crateAt(bx, by)) {
          content.events.emit('blocked', {reason: 'crate', x: tx, y: ty})
          return false
        }

        pushHistory()
        state.player = {x: tx, y: ty}
        crate.x = bx
        crate.y = by
        state.moves++
        state.pushes++

        content.events.emit('crate-pushed', {
          crate,
          direction: {x: dx, y: dy},
          onGoal: isGoal(crate.x, crate.y),
          x: crate.x,
          y: crate.y,
        })

        if (blockedByCorner(crate)) {
          content.events.emit('deadlock-warning', {crate})
        }

        solveCheck()
        return true
      }

      pushHistory()
      state.player = {x: tx, y: ty}
      state.moves++
      content.events.emit('moved', {x: tx, y: ty})
      return true
    },
    openSummary: function () {
      const dirs = availableDirections().map((dir) => app.i18n.t('dir.' + dir.key))
      return dirs.length ? dirs.join(', ') : app.i18n.t('ann.none')
    },
    restart: function () {
      this.start(state.levelIndex)
      return this
    },
    scanAll: function () {
      return DIRECTIONS.map(lineDescription)
    },
    scanDirection: function (key) {
      const dir = DIRECTIONS.find((item) => item.key == key)
      return dir ? lineDescription(dir) : ''
    },
    scanRaw: function (key) {
      const dir = DIRECTIONS.find((item) => item.key == key)
      return dir ? scan(dir.x, dir.y) : null
    },
    start: function (index) {
      state.levelIndex = Math.max(0, Math.min(content.levels.count() - 1, index | 0))
      parseLevel(content.levels.get(state.levelIndex))
      resetCounters()
      content.events.emit('level-start', {index: state.levelIndex, level: state.level})
      return this
    },
    targetAnnouncement: function () {
      const target = currentTarget()
      if (!target) return app.i18n.t('ann.noTarget')

      const dx = target.x - state.player.x,
        dy = target.y - state.player.y

      return app.i18n.t('ann.targetStatus', {
        steps: directionSteps(dx, dy),
        target: targetLabel(target),
      })
    },
    tick: function (delta) {
      if (state.active && !state.solved) {
        state.seconds += Math.max(0, delta || 0)
      }

      return this
    },
    undo: function () {
      if (!state.active || !state.history.length) {
        content.events.emit('undo-empty')
        return false
      }

      const previous = state.history.pop()
      state.crates = previous.crates
      state.player = previous.player
      state.moves = previous.moves
      state.pushes = previous.pushes
      state.seconds = previous.seconds
      state.undos++
      state.solved = false
      content.events.emit('undo', {state})
      return true
    },
    cycleTarget: function () {
      const list = targets()
      if (!list.length) return null
      state.focusIndex = (state.focusIndex + 1) % list.length
      const target = currentTarget()
      content.events.emit('target-change', {target})
      return target
    },
  }
})()
