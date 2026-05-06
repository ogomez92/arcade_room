// Authoritative game state. Every other module mutates this through
// content.game's transitions (or reads it directly).
content.state = (() => {
  return {
    // Score / progression
    score: 0,
    nextBonusAt: 10000,    // single rolling extra-city threshold
    wave: 0,

    // FSM phase: see content.game STATE_*
    phase: 'idle',
    phaseTimer: 0,

    // Pause flag
    paused: false,

    // Wave-clear stash (for the bonus formula)
    surviving: {missiles: 0, cities: 0},

    // Reset to a fresh game (called from menu → start).
    resetForNewGame() {
      this.score = 0
      this.nextBonusAt = 10000
      this.wave = 0
      this.phase = 'idle'
      this.phaseTimer = 0
      this.paused = false
    },
  }
})()
