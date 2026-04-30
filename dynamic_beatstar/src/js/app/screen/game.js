// Game screen — drives content.game and renders a small HUD.
//
// Inputs are intentionally edge-triggered via window keydown rather than
// app.controls.ui(): in a rhythm game we want zero added latency between
// keypress and audition, so the keypress timestamp is what content.game
// uses to judge timing windows.
//
// F1–F4 read out level/score/lives/phase for screen-reader users mid-round.
// preventDefault() on F1/F3/F5 keeps the browser from opening Help/Reload.
//
// Multiplayer: the screen accepts an optional transition payload
// `{role, players, selfPeerId}`. When present, content/mp.js drives the
// round; only the active player's local arrow keys forward to handleArrow
// (host) or sendInput (client). Other peers' presses are silently
// dropped. Eliminated players keep watching — their keys still drop.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    end: function () { this.change('gameover') },
    menu: function () { this.change('menu') },
  },
  state: {
    onKeydown: null,
    onKeydownCapture: null,
    unsubAnnounce: null,
    unsubPhase: null,
    unsubRoster: null,
    pendingEnd: false,
    mp: null,           // {role, players, selfPeerId} when multiplayer; null otherwise
  },
  onReady: function () {
    // Prevent browser default for F1/F3/F5 in capture phase so they
    // don't open Help/Find/Reload while focus is in our app.
    this.state.onKeydownCapture = (e) => {
      if (e.code === 'F1' || e.code === 'F3' || e.code === 'F5') {
        e.preventDefault()
      }
    }

    this.state.onKeydown = (e) => {
      if (this.state.pendingEnd) return
      // Suspend when this screen isn't on top.
      if (this.parentElement.hidden) return

      switch (e.code) {
        case 'ArrowUp':    case 'KeyW': this.dispatchArrow('up');    e.preventDefault(); return
        case 'ArrowDown':  case 'KeyS': this.dispatchArrow('down');  e.preventDefault(); return
        case 'ArrowLeft':  case 'KeyA': this.dispatchArrow('left');  e.preventDefault(); return
        case 'ArrowRight': case 'KeyD': this.dispatchArrow('right'); e.preventDefault(); return

        case 'F1': app.announce.assertive(app.i18n.t('ann.statusLevel', {level: content.game.state.level})); e.preventDefault(); return
        case 'F2': app.announce.assertive(app.i18n.t('ann.statusScore', {score: content.game.state.score})); e.preventDefault(); return
        case 'F3': app.announce.assertive(app.i18n.t('ann.statusLives', {lives: content.game.state.lives})); e.preventDefault(); return
        case 'F4': app.announce.assertive(app.i18n.t('ann.statusPhase', {phase: app.i18n.t('game.hudPhase.' + content.game.state.phase)})); e.preventDefault(); return

        case 'Escape': case 'Backspace':
          app.screenManager.dispatch('menu')
          return
      }
    }
  },
  onEnter: function (payload) {
    // payload (when present) comes from app.screen.multiplayer's "play"
    // dispatch and contains {role, players, selfPeerId}.
    this.state.mp = payload && payload.role ? payload : null

    window.addEventListener('keydown', this.state.onKeydownCapture, true)
    window.addEventListener('keydown', this.state.onKeydown)

    this.state.unsubAnnounce = content.game.onAnnounce((key, params, level) => {
      // Resolve any param ending in 'Key' as an i18n key, exposing it to
      // the template under its un-suffixed name. Keeps content/game.js
      // locale-agnostic — the screen translates at the moment of
      // announcement so a language switch mid-game still reads in the
      // current locale.
      const resolved = {...(params || {})}
      for (const k of Object.keys(params || {})) {
        if (k.endsWith('Key') && typeof params[k] === 'string') {
          resolved[k.slice(0, -3)] = app.i18n.t(params[k])
        }
      }
      // Special-case: prevStats is an object {percent, level} or
      // {percent, level, name} from the previous level / turn.
      if (params && params.prevStats && typeof params.prevStats === 'object') {
        const tmpl = params.prevStats.name ? 'ann.prevStatsNamed' : 'ann.prevStats'
        resolved.prevStats = app.i18n.t(tmpl, params.prevStats)
      } else {
        resolved.prevStats = ''
      }
      const text = app.i18n.t(key, resolved)
      if (level === 'assertive') app.announce.assertive(text)
      else app.announce.polite(text)
    })

    this.state.unsubPhase = content.game.onPhaseChange((phase) => {
      this.renderHud()
      if (phase === 'gameover') {
        // Defer so the gameOver cue gets a beat to play before the
        // screen swap clears focus / aria states.
        this.state.pendingEnd = true
        setTimeout(() => {
          if (this.state.pendingEnd) {
            this.state.pendingEnd = false
            app.screenManager.dispatch('end')
          }
        }, 1200)
      }
    })

    this.state.unsubRoster = content.game.onMpRoster(() => this.renderHud())

    this.state.pendingEnd = false

    if (this.state.mp) {
      // Multiplayer: hand off to content.mp which initialises
      // content.game.startMulti and wires net events. The first round
      // begins immediately on the host (its broadcast triggers the
      // intro on each peer); on a client the first round begins on
      // receipt of the first mpPatternStart broadcast.
      content.mp.start({
        role:       this.state.mp.role,
        players:    this.state.mp.players,
        selfPeerId: this.state.mp.selfPeerId,
      })
    } else {
      content.game.start()
    }
    this.renderHud()
  },
  onExit: function () {
    window.removeEventListener('keydown', this.state.onKeydownCapture, true)
    window.removeEventListener('keydown', this.state.onKeydown)
    if (this.state.unsubAnnounce) this.state.unsubAnnounce()
    if (this.state.unsubPhase) this.state.unsubPhase()
    if (this.state.unsubRoster) this.state.unsubRoster()
    this.state.unsubAnnounce = null
    this.state.unsubPhase = null
    this.state.unsubRoster = null

    if (this.state.mp) {
      try { content.mp.tearDown() } catch (e) {}
    }
    content.game.stop()
  },
  onFrame: function () {
    try {
      // In multi-mode, only the host ticks the simulation. The frame()
      // call itself bails on clients but is still cheap to invoke.
      content.game.frame()
      this.renderHud()
    } catch (e) {
      console.error(e)
    }
  },

  // Route an arrow press according to mode and active-player status.
  // Single-player: always dispatch. Multi-player: only the active
  // player's keys count; host runs handleArrow locally, client sends
  // input over the wire (and plays its own echo for zero-latency).
  dispatchArrow: function (dir) {
    if (!this.state.mp) {
      content.game.handleArrow(dir)
      return
    }
    if (!content.mp.amActive()) return
    if (this.state.mp.role === 'host') {
      content.game.handleArrow(dir)
    } else {
      // Client active: play echo immediately, forward to host for
      // judging. The mpEcho broadcast back to clients filters out the
      // origin so we don't double-play.
      content.audio.echo(dir)
      content.mp.sendInput(dir)
    }
  },

  renderHud: function () {
    const s = content.game.state
    const root = this.rootElement
    const setText = (sel, text) => {
      const el = root.querySelector(sel)
      if (el) el.textContent = text
    }
    const styleName = s.style ? app.i18n.t('style.' + s.style.id) : ''
    const meterName = s.meter ? app.i18n.t('meter.' + s.meter) : ''
    const ctx = styleName ? ' — ' + styleName + (meterName ? ' (' + meterName + ')' : '') : ''
    const progress = s.patternsRequired > 0
      ? ' [' + s.patternsCleared + '/' + s.patternsRequired + ']'
      : ''
    setText('.a-game--level', app.i18n.t('game.hudLevel', {level: s.level}) + progress + ctx)
    setText('.a-game--score', app.i18n.t('game.hudScore', {score: s.score}))
    setText('.a-game--lives', app.i18n.t('game.hudLives', {lives: s.lives}))
    setText('.a-game--phase', app.i18n.t('game.hudPhase.' + s.phase))

    // MP-only roster line.
    const rosterEl = root.querySelector('.a-game--mpRoster')
    if (rosterEl) {
      if (s.mode !== 'multi') {
        rosterEl.textContent = ''
      } else {
        const parts = s.mp.players.map((p, i) => {
          const tag = (i === s.mp.activeIndex) ? '▶ ' : ''
          const elim = p.eliminated ? ' (out)' : ` (${p.lives}♥)`
          return `${tag}${p.name}${elim}`
        })
        rosterEl.textContent = parts.join('  ·  ')
      }
    }
  },
})
