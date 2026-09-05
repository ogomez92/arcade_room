content.hud = (() => {
  const state = {
    root: null,
    score: null,
    contract: null,
    loot: null,
    heat: null,
    jammers: null,
    status: null,
  }

  function percent(value) {
    return Math.round(value * 100)
  }

  return {
    bind: function (root) {
      state.root = root
      state.score = root.querySelector('.a-game--score')
      state.contract = root.querySelector('.a-game--contract')
      state.loot = root.querySelector('.a-game--loot')
      state.heat = root.querySelector('.a-game--heat')
      state.jammers = root.querySelector('.a-game--jammers')
      state.status = root.querySelector('.a-game--status')
      return this
    },
    refresh: function () {
      const game = content.game.state
      if (!state.root || !game.contract) return this

      if (state.score) state.score.textContent = app.i18n.t('hud.score', {score: game.score})
      if (state.contract) {
        state.contract.textContent = app.i18n.t('hud.contract', {
          number: game.contractIndex + 1,
          name: content.game.contractLabel(),
        })
      }
      if (state.loot) {
        state.loot.textContent = app.i18n.t('hud.loot', {
          taken: game.cachesTaken,
          total: game.totalCaches,
        })
      }
      if (state.heat) state.heat.textContent = app.i18n.t('hud.heat', {heat: percent(game.heat)})
      if (state.jammers) state.jammers.textContent = app.i18n.t('hud.jammers', {jammers: game.jammers})
      if (state.status) {
        state.status.textContent = app.i18n.t('hud.status', {
          time: Math.ceil(content.game.timeRemaining()),
          stamina: percent(game.stamina),
        })
      }

      return this
    },
  }
})()
