// Minimal visual HUD. Audio-first game — keep it small and unobtrusive.
content.hud = (() => {
  const els = {score: null, lives: null, wave: null, asteroids: null}

  function bind(root) {
    if (!root) return
    els.score     = root.querySelector('.a-game--score')
    els.lives     = root.querySelector('.a-game--lives')
    els.wave      = root.querySelector('.a-game--wave')
    els.asteroids = root.querySelector('.a-game--asteroids')
  }

  function refresh() {
    if (!els.score) return
    const s = content.game.state
    els.score.textContent     = app.i18n.t('hud.score', {score: s.score})
    els.lives.textContent     = app.i18n.t('hud.lives', {lives: Math.max(0, s.lives)})
    els.wave.textContent      = app.i18n.t('hud.wave',  {wave: s.wave || 0})
    els.asteroids.textContent = app.i18n.t('hud.asteroids', {count: content.asteroids.count()})
  }

  return {bind, refresh}
})()
