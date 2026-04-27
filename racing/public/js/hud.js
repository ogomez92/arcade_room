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
      const label = t === 'nitro' ? 'NITRO'
        : t === 'mine' ? 'MINE'
        : t === 'decoy' ? 'DECOY'
        : '—'
      el.item.textContent = car.nitroT > 0 ? `NITRO ${car.nitroT.toFixed(1)}s` : label
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
    el.finishTitle.textContent = place === 1 ? 'VICTORY' : 'RACE COMPLETE'
    el.finishDetail.textContent = `Finished ${ordinal(place)} of ${totalRacers} in ${time.toFixed(2)}s`
    el.finish.hidden = false
    setTimeout(() => {
      const retry = document.getElementById('finish-retry')
      if (retry) retry.focus()
    }, 50)
  }

  function hideFinish() { el.finish.hidden = true }

  function showGameOver(stats) {
    const rows = [
      ['Position',  `${ordinal(stats.position)} of ${stats.totalRacers}`],
      ['Lap',       `${stats.lap} of ${stats.totalLaps}`],
      ['Lap progress', `${Math.round(stats.lapPct)}%`],
      ['Race time', `${stats.time.toFixed(2)}s`],
      ['Top speed', `${Math.round(stats.topSpeed * 3.6)} km/h`],
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
