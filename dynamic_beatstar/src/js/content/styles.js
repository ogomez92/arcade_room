// Style registry for beatstar's procedural music.
//
// Each style is a small bag of knobs that music.js (drums/bass/pad) and
// audio.js (lead voice for arrow hints/echoes) read to render the level's
// sound. Game.js picks one style + one meter per level from this table.
//
// Progressions are expressed as `{r, t}` chord descriptors (see
// content.theory) where r is the chord root in semitones from the
// active tonality root, and t is the chord type. The progression is
// the same shape regardless of key — content.theory.expand() turns it
// into Hz frequencies at scheduling time using the active tonality.
//
// Knobs:
//   bpmRange            hint range; level's BPM is clamped into this
//   meterPalette        integers, beats-per-measure (4/4=4, 3/4=3, 5/4=5)
//   progressions        list of 4-chord progressions for major mode
//   minorProgressions   list of 4-chord progressions for minor mode
//   drumKit             timbre branch in music.js drum voices
//   bassVoice           timbre branch in music.js bass voice
//   padVoice            timbre branch in music.js pad voice
//   leadVoice           timbre branch in audio.js hint/echo voices
//   pad                 pad volume multiplier (0 = off, 1 = full)
content.styles = (() => {
  const STYLES = {
    // Major-mode progressions are written relative to the C-major
    // frame: r is the semitone offset from the tonality root.
    // (I=0, ii=2, iii=4, IV=5, V=7, vi=9, vii=11). Minor-mode
    // progressions are relative to the natural-minor frame
    // (i=0, ii°=2, ♭III=3, iv=5, v=7, ♭VI=8, ♭VII=10).
    lounge: {
      id: 'lounge',
      bpmRange: [70, 100],
      meterPalette: [4, 3],
      progressions: [
        // Imaj7 - vi7 - ii7 - V7
        [{r:0,t:'maj7'}, {r:9,t:'min7'}, {r:2,t:'min7'}, {r:7,t:'dom7'}],
        // Imaj7 - iii7 - IV - V
        [{r:0,t:'maj7'}, {r:4,t:'min7'}, {r:5,t:'maj'},  {r:7,t:'maj'}],
      ],
      minorProgressions: [
        // i7 - VI7 - III - VII
        [{r:0,t:'min7'}, {r:8,t:'maj7'}, {r:3,t:'maj'}, {r:10,t:'maj'}],
        // i - iv - V - i  (harmonic-minor V)
        [{r:0,t:'min'},  {r:5,t:'min'},  {r:7,t:'maj'}, {r:0,t:'min'}],
      ],
      drumKit: 'brush',
      bassVoice: 'rounded',
      padVoice: 'rhodes',
      leadVoice: 'bell',
      pad: 0.55,
    },
    synthwave: {
      id: 'synthwave',
      bpmRange: [85, 120],
      meterPalette: [4],
      progressions: [
        // vi - IV - I - V  (sad-happy)
        [{r:9,t:'min'}, {r:5,t:'maj'}, {r:0,t:'maj'}, {r:7,t:'maj'}],
        // vi - iii - IV - V
        [{r:9,t:'min'}, {r:4,t:'min'}, {r:5,t:'maj'}, {r:7,t:'maj'}],
      ],
      minorProgressions: [
        // i - ♭VI - ♭III - ♭VII
        [{r:0,t:'min'}, {r:8,t:'maj'}, {r:3,t:'maj'}, {r:10,t:'maj'}],
        // i - iv - ♭VII - ♭III
        [{r:0,t:'min'}, {r:5,t:'min'}, {r:10,t:'maj'}, {r:3,t:'maj'}],
      ],
      drumKit: 'electro',
      bassVoice: 'sub',
      padVoice: 'saw',
      leadVoice: 'square',
      pad: 0.55,
    },
    house: {
      id: 'house',
      bpmRange: [115, 128],
      meterPalette: [4],
      progressions: [
        // I - vi - IV - V
        [{r:0,t:'maj'}, {r:9,t:'min'}, {r:5,t:'maj'}, {r:7,t:'maj'}],
        // vi - IV - I - V
        [{r:9,t:'min'}, {r:5,t:'maj'}, {r:0,t:'maj'}, {r:7,t:'maj'}],
      ],
      minorProgressions: [
        // i - ♭VII - ♭VI - V
        [{r:0,t:'min'}, {r:10,t:'maj'}, {r:8,t:'maj'}, {r:7,t:'maj'}],
        // i - iv - ♭VI - V
        [{r:0,t:'min'}, {r:5,t:'min'}, {r:8,t:'maj'}, {r:7,t:'maj'}],
      ],
      drumKit: 'fourFloor',
      bassVoice: 'pluck',
      padVoice: 'saw',
      leadVoice: 'pluck',
      pad: 0.5,
    },
    chiptune: {
      id: 'chiptune',
      bpmRange: [100, 140],
      meterPalette: [4, 3, 5],
      progressions: [
        // I - V - vi - IV
        [{r:0,t:'maj'}, {r:7,t:'maj'}, {r:9,t:'min'}, {r:5,t:'maj'}],
        // I - IV - V - V
        [{r:0,t:'maj'}, {r:5,t:'maj'}, {r:7,t:'maj'}, {r:7,t:'maj'}],
      ],
      minorProgressions: [
        // i - ♭VII - ♭VI - ♭VII
        [{r:0,t:'min'}, {r:10,t:'maj'}, {r:8,t:'maj'}, {r:10,t:'maj'}],
        // i - ♭VI - ♭III - ♭VII
        [{r:0,t:'min'}, {r:8,t:'maj'},  {r:3,t:'maj'}, {r:10,t:'maj'}],
      ],
      drumKit: 'chip',
      bassVoice: 'square',
      padVoice: 'arp',
      leadVoice: 'square',
      pad: 0.4,
    },
    rock: {
      id: 'rock',
      bpmRange: [95, 130],
      meterPalette: [4, 3],
      progressions: [
        // I - V - vi - IV
        [{r:0,t:'maj'}, {r:7,t:'maj'}, {r:9,t:'min'}, {r:5,t:'maj'}],
        // I - IV - V - V
        [{r:0,t:'maj'}, {r:5,t:'maj'}, {r:7,t:'maj'}, {r:7,t:'maj'}],
      ],
      minorProgressions: [
        // i - ♭VII - ♭VI - V
        [{r:0,t:'min'}, {r:10,t:'maj'}, {r:8,t:'maj'}, {r:7,t:'maj'}],
        // i - ♭VI - ♭VII - i
        [{r:0,t:'min'}, {r:8,t:'maj'},  {r:10,t:'maj'}, {r:0,t:'min'}],
      ],
      drumKit: 'rock',
      bassVoice: 'driving',
      padVoice: 'organ',
      leadVoice: 'pluck',
      pad: 0.5,
    },
    bossa: {
      id: 'bossa',
      bpmRange: [80, 110],
      meterPalette: [4],
      progressions: [
        // Imaj7 - ii7 - V7 - Imaj7
        [{r:0,t:'maj7'}, {r:2,t:'min7'}, {r:7,t:'dom7'}, {r:0,t:'maj7'}],
        // Imaj7 - VI7 - ii7 - V7  (secondary dominant pulls to ii)
        [{r:0,t:'maj7'}, {r:9,t:'dom7'}, {r:2,t:'min7'}, {r:7,t:'dom7'}],
      ],
      minorProgressions: [
        // i7 - iv7 - V7 - i7
        [{r:0,t:'min7'}, {r:5,t:'min7'}, {r:7,t:'dom7'}, {r:0,t:'min7'}],
      ],
      drumKit: 'bossa',
      bassVoice: 'upright',
      padVoice: 'rhodes',
      leadVoice: 'mellow',
      pad: 0.55,
    },
    waltz: {
      id: 'waltz',
      bpmRange: [70, 110],
      meterPalette: [3],
      progressions: [
        // I - IV - V - I
        [{r:0,t:'maj'}, {r:5,t:'maj'}, {r:7,t:'maj'}, {r:0,t:'maj'}],
        // I - vi - IV - V
        [{r:0,t:'maj'}, {r:9,t:'min'}, {r:5,t:'maj'}, {r:7,t:'maj'}],
      ],
      minorProgressions: [
        // i - ♭VI - iv - V
        [{r:0,t:'min'}, {r:8,t:'maj'}, {r:5,t:'min'}, {r:7,t:'maj'}],
      ],
      drumKit: 'brush',
      bassVoice: 'rounded',
      padVoice: 'soft',
      leadVoice: 'bell',
      pad: 0.6,
    },
  }

  function list() { return Object.values(STYLES) }
  function get(id) { return STYLES[id] || STYLES.lounge }

  // Pick a style at random from the whole pool, avoiding repeating the
  // previous level's style if possible. Style choice doesn't gate
  // difficulty — that's BPM / meter / subdivision's job — so every
  // style is in play from level 1.
  function pickFor(prevId) {
    const all = Object.keys(STYLES)
    const pool = prevId && all.length > 1 ? all.filter((id) => id !== prevId) : all
    return STYLES[pool[Math.floor(Math.random() * pool.length)]]
  }

  // Choose a meter from the style's palette. Below level 3 stick with
  // the style's first (canonical) meter so the player learns the
  // backbeat before odd meters are introduced.
  function pickMeter(style, level) {
    const palette = style.meterPalette
    if (level < 3 || palette.length === 1) return palette[0]
    if (level < 6) return Math.random() < 0.7 ? palette[0] : palette[1 % palette.length]
    return palette[Math.floor(Math.random() * palette.length)]
  }

  function pickProgression(style, mode) {
    const list = (mode === 'minor' && style.minorProgressions)
      ? style.minorProgressions
      : style.progressions
    return list[Math.floor(Math.random() * list.length)].slice()
  }

  // Subdivision probability table. Returns {q, e, s} that sum to 1 —
  // probability per beat of generating a quarter (1 note), an eighth
  // pair (2 notes), or a sixteenth quad (4 notes).
  function subdivisionProbs(level) {
    if (level <= 3) return {q: 1.00, e: 0.00, s: 0.00}
    if (level <= 5) return {q: 0.75, e: 0.25, s: 0.00}
    if (level <= 7) return {q: 0.55, e: 0.40, s: 0.05}
    if (level <= 9) return {q: 0.45, e: 0.40, s: 0.15}
    return            {q: 0.35, e: 0.45, s: 0.20}
  }

  return { list, get, pickFor, pickMeter, pickProgression, subdivisionProbs, STYLES }
})()
