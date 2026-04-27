// Bonus fruits — appear at classic dot counts (70 and 170 remaining-eaten thresholds).
content.fruit = (() => {
  // Classic per-level fruit and points
  const FRUIT_TABLE = [
    {name: 'cherry',     points: 100},
    {name: 'strawberry', points: 300},
    {name: 'orange',     points: 500},
    {name: 'orange',     points: 500},
    {name: 'apple',      points: 700},
    {name: 'apple',      points: 700},
    {name: 'melon',      points: 1000},
    {name: 'melon',      points: 1000},
    {name: 'galaxian',   points: 2000},
    {name: 'galaxian',   points: 2000},
    {name: 'bell',       points: 3000},
    {name: 'bell',       points: 3000},
    {name: 'key',        points: 5000},
  ]

  const state = {
    active: false,
    name: null,
    points: 0,
    x: 13.5, // classic spawn at center under house
    y: 17,
    timer: 0,
    spawnsRemaining: 2,
    eatenSinceSpawn: 0,
  }

  function fruitForLevel(level) {
    const idx = Math.min(level - 1, FRUIT_TABLE.length - 1)
    return FRUIT_TABLE[idx]
  }

  function reset() {
    state.active = false
    state.name = null
    state.points = 0
    state.timer = 0
    state.spawnsRemaining = 2
    state.eatenSinceSpawn = 0
  }

  function tryTriggerSpawn(level, totalDots, dotsRemaining) {
    // Trigger when 70 or 170 dots have been eaten
    const eaten = totalDots - dotsRemaining
    if (state.spawnsRemaining === 2 && eaten >= 70) {
      spawn(level)
      state.spawnsRemaining = 1
    } else if (state.spawnsRemaining === 1 && eaten >= 170) {
      spawn(level)
      state.spawnsRemaining = 0
    }
  }

  function spawn(level) {
    const f = fruitForLevel(level)
    state.active = true
    state.name = f.name
    state.points = f.points
    state.x = 13.5
    state.y = 17.5
    state.timer = 10 // visible for 10 seconds
    content.events.emit('fruit-spawn', {name: f.name, x: state.x, y: state.y})
  }

  function update(delta) {
    if (!state.active) return
    state.timer -= delta
    if (state.timer <= 0) {
      state.active = false
      state.name = null
      content.events.emit('fruit-expire')
    }
  }

  function consume() {
    if (!state.active) return null
    const result = {name: state.name, points: state.points}
    state.active = false
    state.name = null
    content.events.emit('fruit-eaten', result)
    return result
  }

  return {
    state,
    reset,
    update,
    tryTriggerSpawn,
    consume,
    getPosition: () => state.active ? {x: state.x, y: state.y} : null,
    isActive: () => state.active,
    name: () => state.name,
  }
})()
