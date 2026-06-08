app.progress = (() => {
  const KEY = 'warehouseShift.progress.v1'

  let cache

  function defaultData() {
    return {
      bests: {},
      unlocked: 0,
    }
  }

  function levelId(index) {
    const level = content.levels && content.levels.get(index)
    return level ? level.id : String(index)
  }

  function load() {
    if (cache) return cache

    const stored = app.storage.get(KEY)
    cache = {
      ...defaultData(),
      ...(stored || {}),
    }

    if (!cache.bests || typeof cache.bests != 'object') {
      cache.bests = {}
    }

    cache.unlocked = Math.max(0, Math.min(cache.unlocked | 0, content.levels.count() - 1))

    while (cache.unlocked + 1 < content.levels.count() && cache.bests[levelId(cache.unlocked)]) {
      cache.unlocked++
    }

    return cache
  }

  function isBetter(next, best) {
    if (!best) return true
    if (next.moves !== best.moves) return next.moves < best.moves
    if (next.pushes !== best.pushes) return next.pushes < best.pushes
    if (next.undos !== best.undos) return next.undos < best.undos
    return next.seconds < best.seconds
  }

  function save() {
    app.storage.set(KEY, load())
  }

  return {
    best: function (index) {
      return load().bests[levelId(index)] || null
    },
    data: () => ({...load(), bests: {...load().bests}}),
    isUnlocked: function (index) {
      return index <= load().unlocked
    },
    nextLevel: function () {
      const data = load()

      for (let i = 0; i <= data.unlocked; i++) {
        if (!data.bests[levelId(i)]) return i
      }

      return data.unlocked
    },
    recordSolved: function (index, metrics) {
      const data = load(),
        id = levelId(index),
        next = {
          moves: metrics.moves | 0,
          pushes: metrics.pushes | 0,
          seconds: Math.max(0, Math.round(metrics.seconds || 0)),
          undos: metrics.undos | 0,
        },
        previous = data.bests[id]

      let newBest = false
      if (isBetter(next, previous)) {
        data.bests[id] = next
        newBest = true
      }

      if (index >= data.unlocked && index + 1 < content.levels.count()) {
        data.unlocked = index + 1
      }

      save()
      return {
        best: data.bests[id],
        isNewBest: newBest,
      }
    },
    reset: function () {
      cache = defaultData()
      save()
      return this
    },
    unlockAll: function () {
      load().unlocked = Math.max(0, content.levels.count() - 1)
      save()
      return this
    },
    unlocked: () => load().unlocked,
  }
})()
