// Music theory helpers — used by game.js (tonality picker), music.js
// (chord expansion at scheduling time), and audio.js (arrow note
// frequencies that follow the active scale).
//
// Tonality is `{rootSemitone, mode}`:
//   rootSemitone   integer 0..11; offset from C in semitones
//                    (0=C, 2=D, 5=F, 7=G, 9=A, etc.)
//   mode           'major' | 'minor'
//
// Chord descriptors are `{r, t}`:
//   r   integer; semitone offset of the chord's root from the
//        tonality's root (e.g. r=7 in C major → G)
//   t   chord-type key (see CHORD_TYPES). Quality is independent of
//        mode — a {r:0,t:'min'} works in major mode too.
content.theory = (() => {
  // Bass-octave reference (C2). Chord voicings start here so they sit
  // below the C4-C5 arrow band.
  const BASS_C = 65.4064
  // Lead-octave reference (C4). Arrow notes start from here.
  const LEAD_C = 261.6256

  function semiToHz(semitones, base) {
    return (base != null ? base : BASS_C) * Math.pow(2, semitones / 12)
  }

  // Chord interval recipes. third/fifth/seventh are semitones from the
  // chord's root.
  const CHORD_TYPES = {
    maj:     {third: 4, fifth: 7, seventh: null, minor: false},
    min:     {third: 3, fifth: 7, seventh: null, minor: true},
    maj7:    {third: 4, fifth: 7, seventh: 11,   minor: false},
    min7:    {third: 3, fifth: 7, seventh: 10,   minor: true},
    dom7:    {third: 4, fifth: 7, seventh: 10,   minor: false},
    dim:     {third: 3, fifth: 6, seventh: null, minor: true},
    halfdim: {third: 3, fifth: 6, seventh: 10,   minor: true},
  }

  // Build a chord at (rootSemitone) with the given type, in the bass
  // register (C2 base). Music.js voices the pad an octave above; bass
  // plays the root directly.
  function buildChord(rootSemitone, type) {
    const t = CHORD_TYPES[type] || CHORD_TYPES.maj
    return {
      root:    semiToHz(rootSemitone),
      third:   semiToHz(rootSemitone + t.third),
      fifth:   semiToHz(rootSemitone + t.fifth),
      seventh: t.seventh != null ? semiToHz(rootSemitone + t.seventh) : null,
      minor:   t.minor,
    }
  }

  // Expand a chord descriptor against the active tonality.
  function expand(descriptor, tonality) {
    const r = (tonality.rootSemitone + descriptor.r) % 12
    return buildChord(r, descriptor.t)
  }

  // Major scale (root, M2, M3, P4, P5, M6, M7) in semitones.
  const SCALE_MAJOR = [0, 2, 4, 5, 7, 9, 11]
  // Natural minor scale (root, M2, m3, P4, P5, m6, m7) in semitones.
  const SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10]

  // The four arrow notes are scale degrees 1, 3, 5 (from the active
  // scale) plus an octave above the root. So the 3rd is the major or
  // minor 3rd depending on mode — that's how the player hears the
  // tonality switch.
  function arrowSemitones(mode) {
    const s = mode === 'minor' ? SCALE_MINOR : SCALE_MAJOR
    return [s[0], s[2], s[4], 12]
  }

  // Frequencies for the four arrow keys at the C4 register.
  function arrowFreqs(tonality) {
    const offsets = arrowSemitones(tonality.mode)
    const baseC4 = LEAD_C * Math.pow(2, tonality.rootSemitone / 12)
    return {
      down:  baseC4 * Math.pow(2, offsets[0] / 12),
      left:  baseC4 * Math.pow(2, offsets[1] / 12),
      right: baseC4 * Math.pow(2, offsets[2] / 12),
      up:    baseC4 * Math.pow(2, offsets[3] / 12),
    }
  }

  // The 12 chromatic root names. Used for accessibility announcements.
  const KEY_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  function keyName(rootSemitone, mode) {
    const root = KEY_NAMES[((rootSemitone % 12) + 12) % 12]
    return mode === 'minor' ? root + ' minor' : root + ' major'
  }

  return {
    semiToHz,
    buildChord,
    expand,
    arrowSemitones,
    arrowFreqs,
    keyName,
    CHORD_TYPES,
    SCALE_MAJOR,
    SCALE_MINOR,
    BASS_C,
    LEAD_C,
  }
})()
