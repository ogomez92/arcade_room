// How many sets the match runs for. Standard tennis is best-of-3 (the
// default — first to 2 sets wins). Best-of-1 is a quick demo, best-of-5
// matches the men's grand-slam length. Only takes effect at the start
// of a new match. In multiplayer the host's value is what governs the
// match length, since the host runs scoring.
app.settings.register('bestOfSets', {
  default: 3,
  compute: (raw) => {
    const n = Number(raw)
    return n === 1 || n === 5 ? n : 3
  },
  update: (computedValue) => {
    if (!content || !content.scoring || !content.scoring.setBestOf) return
    content.scoring.setBestOf(computedValue)
  },
})
