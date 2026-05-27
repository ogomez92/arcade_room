content.hud = (() => {
  const els = {
    score: null,
    lives: null,
    sector: null,
    threats: null,
  }

  return {
    bind: function (root) {
      if (!root) return this
      els.score = root.querySelector('.a-game--score')
      els.lives = root.querySelector('.a-game--lives')
      els.sector = root.querySelector('.a-game--sector')
      els.threats = root.querySelector('.a-game--threats')
      return this
    },
    refresh: function () {
      if (!els.score) return this
      const state = content.game.state
      els.score.textContent = app.i18n.t('hud.score', {score: state.score})
      els.lives.textContent = app.i18n.t('hud.lives', {lives: state.lives})
      els.sector.textContent = app.i18n.t('hud.sector', {sector: content.game.sector()})
      els.threats.textContent = app.i18n.t('hud.threats', {count: state.enemies.length})
      return this
    },
  }
})()
