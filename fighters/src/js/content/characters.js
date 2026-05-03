/**
 * Character roster. The player picks one of these at fight start; the AI
 * cycles through the rest as opponents in increasing difficulty order.
 *
 * Each entry carries:
 *   - `gender`: 'm' | 'f' — drives the voice timbre family in content.voice.
 *   - `voice`:  per-voice tuning offsets (base pitch, formant centre,
 *     character/grit) so two same-gender fighters still sound different.
 *   - `style`:  AI bias hint — 'boxer' favors punches, 'kicker' favors
 *     kicks, 'mixer' alternates. The player isn't constrained by this.
 *   - `aggression`, `preferredDist`: AI default knobs the AI brain reads
 *     when this character is the foe; randomized further per round.
 */
content.characters = (() => {
  const ROSTER = [
    {
      id: 'roxy', nameKey: 'char.roxy', gender: 'f',
      voice: {basePitch: 290, formant: 1200, grit: 0.20},
      style: 'mixer', aggression: 0.55, preferredDist: 1.5,
    },
    {
      id: 'lola', nameKey: 'char.lola', gender: 'f',
      voice: {basePitch: 320, formant: 1380, grit: 0.10},
      style: 'boxer', aggression: 0.65, preferredDist: 1.2,
    },
    {
      id: 'mira', nameKey: 'char.mira', gender: 'f',
      voice: {basePitch: 260, formant: 1100, grit: 0.30},
      style: 'kicker', aggression: 0.50, preferredDist: 1.85,
    },
    {
      id: 'bruno', nameKey: 'char.bruno', gender: 'm',
      voice: {basePitch: 135, formant: 720, grit: 0.40},
      style: 'boxer', aggression: 0.70, preferredDist: 1.15,
    },
    {
      id: 'kenji', nameKey: 'char.kenji', gender: 'm',
      voice: {basePitch: 165, formant: 880, grit: 0.20},
      style: 'kicker', aggression: 0.55, preferredDist: 1.95,
    },
    {
      id: 'rocco', nameKey: 'char.rocco', gender: 'm',
      voice: {basePitch: 115, formant: 640, grit: 0.55},
      style: 'mixer', aggression: 0.78, preferredDist: 1.4,
    },
  ]

  function byId(id) {
    return ROSTER.find((c) => c.id === id) || ROSTER[0]
  }

  /**
   * Pick the AI opponent for `roundIndex` (1-based) given the player's
   * choice. Skips the player's own character and rotates through the rest
   * in roster order; once exhausted, wraps back with harder personality.
   */
  function opponentFor(playerId, roundIndex) {
    const pool = ROSTER.filter((c) => c.id !== playerId)
    return pool[(roundIndex - 1) % pool.length]
  }

  return {ROSTER, byId, opponentFor}
})()
