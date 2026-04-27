// Ball-speed difficulty. The "Hard" preset is the original tuning;
// Normal and Easy scale the rally/serve/smash speeds down so a player
// has more time to localise the ball and run. AI footwork and
// reaction lag are deliberately unchanged — only ball speed slows.
//
// In multiplayer the host runs the simulation, so the host's setting
// is the one that takes effect for both players.
app.settings.register('difficulty', {
  default: 'normal',
  compute: (raw) => (raw === 'easy' || raw === 'hard') ? raw : 'normal',
  update: (computedValue) => {
    if (!content || !content.court || !content.court.setSpeedScale) return
    const scale = computedValue === 'easy' ? 0.7
      : computedValue === 'hard' ? 1.0
      : 0.85
    content.court.setSpeedScale(scale)
  },
})
