# TODO

## Now (v0.1)
- [x] HTML scaffolding for all screens + ARIA live region
- [x] content.announcer (live-region + optional TTS)
- [x] content.physics (vector helpers, integration)
- [x] content.arena (walls, spawn points)
- [x] content.car (entity)
- [x] content.ai (FSM controller)
- [x] content.sounds (collisions, walls, UI, etc.)
- [x] content.carEngine (per-car distinct synth)
- [x] content.targeting (proximity beeps + Q-sweep)
- [x] content.game (round lifecycle)
- [x] Menu / setup / game / gameOver / learnSounds / help screens
- [x] Wire splash → menu transition
- [x] Score persistence

## Next
- [ ] Manual testing pass with a screen reader
- [ ] Tune per-car timbres so they're truly distinguishable
- [ ] Settings screen + masterVolume/hapticsSensitivity wiring
- [ ] Speech-synth fallback for announcer (`useTts`)
- [ ] Pause overlay with resume / quit
