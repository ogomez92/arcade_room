/**
 * SPACE INVADERS! — game over.
 *
 * Snapshots the final session stats on enter (so transitions can fire
 * fresh game state without losing the figures shown here). Sting plays
 * via the breach SFX during the game-over delay; this screen layers
 * the assertive announce on top.
 */
app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    save: function () { /* in place */ },
    restart: function () { this.change('game') },
    menu: function () { this.change('menu') },
    highscores: function () { this.change('highscores') },
  },
  state: {
    entryFrames: 0,
    nameInput: null,
    saved: false,
    snapshot: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-gameover--name-input')
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      if (btn.dataset.action === 'save') this.handleSave()
      else if (btn.dataset.action === 'restart') app.screenManager.dispatch('restart')
      else if (btn.dataset.action === 'menu') app.screenManager.dispatch('menu')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.saved = false
    const s = content.state.get()
    this.state.snapshot = s ? {
      score: s.score,
      wave: s.wave,
      kills: s.kills,
      bestChain: s.bestChainMult,
    } : {score: 0, wave: 0, kills: 0, bestChain: 1}
    this.renderStats()
    if (this.state.nameInput) this.state.nameInput.value = ''
    app.announce.assertive(app.i18n.t('ann.gameOver'))
    // Play the somber sting before endRun's silenceAll. The dispatched
    // oscillators are already started/stop-scheduled by then, so silenceAll
    // (which only kills continuous voices) doesn't cut them off.
    try { content.audio.dispatch({type: 'gameOver'}) } catch (e) {}
    content.game.endRun()
  },
  onExit: function () {
    // Re-running the game is handled by the game screen's onEnter; nothing to do.
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      // Don't trap keystrokes meant for the name input.
      if (document.activeElement === this.state.nameInput) return
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) {
          if (f.dataset.action === 'save') this.handleSave()
          else app.screenManager.dispatch(f.dataset.action)
        }
      }
    } catch (e) { console.error(e) }
  },
  renderStats: function () {
    const s = this.state.snapshot
    const root = this.rootElement
    const fmt = (k, params) => app.i18n.t(k, params)
    root.querySelector('.a-gameover--score').textContent = fmt('gameover.score', {score: s.score})
    root.querySelector('.a-gameover--wave').textContent = fmt('gameover.wave', {wave: s.wave})
    root.querySelector('.a-gameover--kills').textContent = fmt('gameover.kills', {kills: s.kills})
    root.querySelector('.a-gameover--bestChain').textContent = fmt('gameover.bestChain', {mult: s.bestChain})
  },
  handleSave: function () {
    if (this.state.saved) return
    const s = this.state.snapshot
    const name = (this.state.nameInput && this.state.nameInput.value || '').trim() || 'Player'
    if (!app.highscores.qualifies(s.score)) {
      this.state.saved = true
      app.screenManager.dispatch('menu')
      return
    }
    app.highscores.add(name, s.score, s.wave, s.kills)
    this.state.saved = true
    app.screenManager.dispatch('highscores')
  },
})
