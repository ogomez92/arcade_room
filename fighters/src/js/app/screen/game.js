app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    end: function (data) { this.change('gameover', data) },
    pause: function () { this.change('menu') },
  },
  state: {hud: null, hotkeysBound: false},
  onReady: function () {
    const root = this.rootElement
    this.state.hud = {
      playerHp: root.querySelector('.js-player-hp'),
      playerHpNum: root.querySelector('.js-player-hp-num'),
      foeHp: root.querySelector('.js-foe-hp'),
      foeHpNum: root.querySelector('.js-foe-hp-num'),
      playerStam: root.querySelector('.js-player-stam'),
      playerStamNum: root.querySelector('.js-player-stam-num'),
      foeStam: root.querySelector('.js-foe-stam'),
      foeStamNum: root.querySelector('.js-foe-stam-num'),
      playerName: root.querySelector('.js-player-name'),
      foeName: root.querySelector('.js-foe-name'),
      round: root.querySelector('.js-round-num'),
      combo: root.querySelector('.js-combo'),
    }

    if (!this.state.hotkeysBound) {
      this.state.hotkeysBound = true
      window.addEventListener('keydown', (e) => {
        if (!this.isActive) return
        const code = e.code
        if (code === 'F1' || code === 'F2' || code === 'F3'
            || code === 'F4' || code === 'F5'
            || code === 'Digit0' || code === 'Digit9') {
          e.preventDefault()
          const g = content.game
          if (!g || !g.player) return
          if (code === 'Digit0') {
            g.debugHealPlayer()
            return
          }
          if (code === 'Digit9') {
            g.debugCripplFoe()
            return
          }
          if (code === 'F1') {
            content.announcer.say(app.i18n.t('ann.health', {
              name: app.i18n.t('ann.you'),
              hp: Math.round(g.player.hp),
            }), 'assertive')
          }
          if (code === 'F2') {
            content.announcer.say(app.i18n.t('ann.health', {
              name: app.i18n.t('ann.foe'),
              hp: Math.round(g.foe.hp),
            }), 'assertive')
          }
          if (code === 'F3') {
            const dx = g.foe.x - g.player.x
            const dy = g.foe.y - g.player.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const distTag = dist < 1.5 ? 'ann.dist.close'
              : dist < 3 ? 'ann.dist.mid'
              : 'ann.dist.far'
            // Compass direction for foe relative to player.
            const ang = Math.atan2(-dy, dx) // screen y → audio +y up
            const bearings = [
              {min: -Math.PI / 8, max: Math.PI / 8, key: 'ann.dir.east'},
              {min:  Math.PI / 8, max: 3 * Math.PI / 8, key: 'ann.dir.northeast'},
              {min: 3 * Math.PI / 8, max: 5 * Math.PI / 8, key: 'ann.dir.north'},
              {min: 5 * Math.PI / 8, max: 7 * Math.PI / 8, key: 'ann.dir.northwest'},
              {min: -3 * Math.PI / 8, max: -Math.PI / 8, key: 'ann.dir.southeast'},
              {min: -5 * Math.PI / 8, max: -3 * Math.PI / 8, key: 'ann.dir.south'},
              {min: -7 * Math.PI / 8, max: -5 * Math.PI / 8, key: 'ann.dir.southwest'},
            ]
            let dirKey = 'ann.dir.west'
            for (const b of bearings) {
              if (ang >= b.min && ang < b.max) { dirKey = b.key; break }
            }
            content.announcer.say(app.i18n.t('ann.distance', {
              dist: app.i18n.t(distTag),
              dir: app.i18n.t(dirKey),
              round: g.round,
            }), 'assertive')
          }
          if (code === 'F4') {
            const chain = g.player.chainLabels.join(', ')
            content.announcer.say(chain
              ? app.i18n.t('ann.comboChain', {chain})
              : app.i18n.t('ann.comboNone'), 'assertive')
          }
          if (code === 'F5') {
            const t = engine.time()
            const describe = (f) => {
              if (f.mountedOn) return app.i18n.t('ann.posture.mounted')
              if (f.mountedBy) return app.i18n.t('ann.posture.pinned')
              if (f.posture !== 'stand') return app.i18n.t(`ann.posture.${f.posture}`)
              if (f.blockUntil > t) return app.i18n.t('ann.posture.block')
              if (f.duckUntil  > t) return app.i18n.t('ann.posture.duck')
              if (f.jumpUntil  > t) return app.i18n.t('ann.posture.jump')
              return app.i18n.t('ann.posture.stand')
            }
            content.announcer.say(app.i18n.t('ann.posture', {
              you: describe(g.player),
              foe: describe(g.foe),
            }), 'assertive')
          }
        }
      }, true)
    }
  },
  setHud: function () {
    const g = content.game
    if (!g || !g.player) return
    const hud = this.state.hud
    if (!hud) return
    const ph = Math.max(0, Math.round(g.player.hp))
    const fh = Math.max(0, Math.round(g.foe.hp))
    hud.playerHp.style.width = `${(ph / g.player.maxHp) * 100}%`
    hud.foeHp.style.width = `${(fh / g.foe.maxHp) * 100}%`
    hud.playerHpNum.textContent = ph
    hud.foeHpNum.textContent = fh
    if (hud.playerStam) {
      const ps = Math.max(0, Math.min(1, g.player.stamina != null ? g.player.stamina : 1))
      const fs = Math.max(0, Math.min(1, g.foe.stamina != null ? g.foe.stamina : 1))
      hud.playerStam.style.width = `${ps * 100}%`
      hud.foeStam.style.width = `${fs * 100}%`
      hud.playerStamNum.textContent = Math.round(ps * 100)
      hud.foeStamNum.textContent = Math.round(fs * 100)
    }
    hud.round.textContent = g.round
    if (hud.playerName && g.player.character) {
      hud.playerName.textContent = app.i18n.t(g.player.character.nameKey)
    }
    if (hud.foeName && g.foe.character) {
      hud.foeName.textContent = app.i18n.t(g.foe.character.nameKey)
    }
    hud.combo.textContent = g.player.chainLabels.length
      ? g.player.chainLabels.join('-')
      : '—'
  },
  onEnter: function () {
    this.isActive = true
    content.game.startMatch(content.game.playerCharacterId)
  },
  onExit: function () {
    this.isActive = false
    content.game.stopMatch()
  },
  onFrame: function () {
    try {
      const ui = app.controls.ui()
      if (ui.back || ui.pause) {
        app.screenManager.dispatch('pause')
        return
      }
      const game = app.controls.game()
      content.game.update(game, ui)
      this.setHud()
    } catch (e) {
      console.error(e)
    }
  },
})
