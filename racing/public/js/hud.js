const HUD = (() => {
  const el = {}

  function init() {
    el.hud = document.getElementById('hud')
    el.pos = document.getElementById('hud-pos')
    el.lap = document.getElementById('hud-lap')
    el.speed = document.getElementById('hud-speed')
    el.gear = document.getElementById('hud-gear')
    el.healthBar = document.getElementById('hud-health-bar')
    el.ammo = document.getElementById('hud-ammo')
    el.item = document.getElementById('hud-item')
    el.announce = document.getElementById('announce')
    el.assert = document.getElementById('announce-assert')
    el.splash = document.getElementById('splash')
    el.finish = document.getElementById('finish')
    el.finishDetail = document.getElementById('finish-detail')
    el.finishTitle = document.getElementById('finish-title')
    el.gameover = document.getElementById('gameover')
    el.gameoverStats = document.getElementById('gameover-stats')
    el.canvas = document.getElementById('canvas')
    el.app = document.querySelector('.app')
  }

  function activate() {
    el.hud.classList.add('active')
    el.hud.setAttribute('aria-hidden', 'false')
    el.canvas.setAttribute('aria-hidden', 'false')
  }

  function update(car, ais, totalLaps) {
    const pos = computePosition(car, ais)
    el.pos.textContent = `${pos}/${ais.length + 1}`
    el.lap.textContent = `${Math.min(car.lap, totalLaps)}/${totalLaps}`
    el.speed.textContent = Math.round(car.speed * 3.6) // m/s → km/h
    el.gear.textContent = car.gear
    const pct = Math.max(0, Math.min(100, (car.health / Car.HEALTH_MAX) * 100))
    el.healthBar.style.width = pct + '%'
    el.healthBar.classList.toggle('low', pct < 25)
    if (el.ammo) el.ammo.textContent = car.bullets || 0
    if (el.item) {
      const t = car.item
      const label = t === 'nitro' ? I18n.t('hud.itemNitro')
        : t === 'mine' ? I18n.t('hud.itemMine')
        : t === 'decoy' ? I18n.t('hud.itemDecoy')
        : I18n.t('hud.itemNone')
      el.item.textContent = car.nitroT > 0
        ? I18n.t('hud.itemNitroActive', { sec: car.nitroT.toFixed(1) })
        : label
    }

    // Visual cues
    el.app.classList.toggle('boost', car.boosting)
    el.app.classList.toggle('damage', car.health < 15)
  }

  function computePosition(car, ais) {
    const carDist = (car.lap - 1) * Track.length + car.z
    let pos = 1
    for (const ai of ais) {
      if (ai.z > carDist) pos++
    }
    return pos
  }

  function announce(msg, assertive = false) {
    const node = assertive ? el.assert : el.announce
    // Clear then set after tick so screen readers re-read
    node.textContent = ''
    setTimeout(() => { node.textContent = msg }, 30)
  }

  function showFinish(place, totalRacers, time) {
    el.finishTitle.textContent = I18n.t(place === 1 ? 'finish.victory' : 'finish.complete')
    el.finishDetail.textContent = I18n.t('finish.detail', {
      ordinal: ordinal(place),
      total: totalRacers,
      time: time.toFixed(2),
    })
    el.finish.hidden = false
    setTimeout(() => {
      const retry = document.getElementById('finish-retry')
      if (retry) retry.focus()
    }, 50)
  }

  function hideFinish() { el.finish.hidden = true }

  function showGameOver(stats) {
    const ofTotal = (n, total) => I18n.t('gameover.ofTotal', { n, total })
    const rows = [
      [I18n.t('gameover.position'), ofTotal(ordinal(stats.position), stats.totalRacers)],
      [I18n.t('gameover.lap'),      ofTotal(stats.lap, stats.totalLaps)],
      [I18n.t('gameover.lapPct'),   `${Math.round(stats.lapPct)}%`],
      [I18n.t('gameover.time'),     `${stats.time.toFixed(2)}s`],
      [I18n.t('gameover.topSpeed'), `${Math.round(stats.topSpeed * 3.6)} ${I18n.t('hud.unitKmh')}`],
    ]
    el.gameoverStats.innerHTML = rows
      .map(([k, v]) => `<li>${k}<strong>${v}</strong></li>`)
      .join('')
    el.gameover.hidden = false
    setTimeout(() => {
      const retry = document.getElementById('gameover-retry')
      if (retry) retry.focus()
    }, 50)
  }

  function hideGameOver() { el.gameover.hidden = true }
  function showSplash() { el.splash.hidden = false; el.splash.style.display = '' }
  function hideSplash() { el.splash.style.display = 'none' }

  function ordinal(n) {
    if (typeof I18n !== 'undefined') {
      const key = 'ord.' + n
      const v = I18n.t(key)
      if (v !== key) return v
      // Spanish fallback for n>8: keep the ordinal-mark suffix.
      if (I18n.get && I18n.get() === 'es') return n + '.º'
    }
    const s = ['th','st','nd','rd'], v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  return {
    init,
    activate,
    update,
    announce,
    computePosition,
    showFinish,
    hideFinish,
    showGameOver,
    hideGameOver,
    showSplash,
    hideSplash,
    ordinal,
  }
})()
