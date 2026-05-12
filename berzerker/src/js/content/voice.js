// Robot voice synthesis. The fighters game's `voice.js::buildVoice` is the
// formant base — sawtooth carrier through a 3-bandpass formant bank. On
// top of that we run a robotization layer (ring-mod + bit-crush + comb
// delay) that gives the voice its overtly mechanical timbre. Phrases are
// built by tokenising the text into 5-vowel + small-consonant frames; each
// vowel/consonant becomes a short scheduled segment of the synth bus.
//
// Per-locale phrase pools (`robotbarks.pools.*` in i18n.js) are AUTHORED
// independently — the Spanish robots don't say translated English. The
// voice module is locale-agnostic; it just speaks whatever the i18n key
// resolves to in the current locale.
content.voice = (() => {
  const A = () => content.audio
  const ctxFn = () => engine.context()

  let busGain = 1
  function setBusGain(g) { busGain = g }

  // 5-vowel formant table (F1, F2 in Hz) — Spanish cardinal vowels.
  // Used as the default; English path uses the richer EN_VOWELS below.
  const VOWELS = {
    a: {f1: 700, f2: 1100},
    e: {f1: 500, f2: 1800},
    i: {f1: 320, f2: 2400},
    o: {f1: 500, f2:  900},
    u: {f1: 320, f2:  800},
  }

  // Extended vowel inventory used when locale is English. Lax (/æ ɛ ɪ ɒ ʌ/)
  // and tense (/iː uː/) versions of the cardinal five, plus schwa.
  // Diphthongs are rendered as glides between two of these (see EN_DIGRAPHS).
  const EN_VOWELS = {
    ae:    {f1: 720, f2: 1700}, // /æ/  cat, attack
    eh:    {f1: 600, f2: 1900}, // /ɛ/  bed, fear
    ih:    {f1: 420, f2: 2000}, // /ɪ/  bit, intruder
    aw:    {f1: 600, f2:  900}, // /ɔ/  law, robot (final o)
    uh:    {f1: 600, f2: 1200}, // /ʌ/  cut, must, humanoid
    ee:    {f1: 280, f2: 2500}, // /iː/ see, machine
    oo:    {f1: 300, f2:  750}, // /uː/ moon, futile-end
    schwa: {f1: 500, f2: 1500}, // /ə/  about, the
  }

  // English digraph table — vowel digraphs become diphthong glides; consonant
  // digraphs become single fricative/affricate frames distinct from t+h etc.
  const EN_DIGRAPHS = {
    // Vowel diphthongs / long vowels.
    ee: {kind: 'vg', from: 'ee',    to: 'ee',    dur: 0.17},
    ea: {kind: 'vg', from: 'ee',    to: 'ee',    dur: 0.17},
    ie: {kind: 'vg', from: 'ee',    to: 'ee',    dur: 0.17},
    oo: {kind: 'vg', from: 'oo',    to: 'oo',    dur: 0.17},
    ai: {kind: 'vg', from: 'eh',    to: 'ee',    dur: 0.19}, // /eɪ/ rain
    ay: {kind: 'vg', from: 'eh',    to: 'ee',    dur: 0.19},
    ey: {kind: 'vg', from: 'eh',    to: 'ee',    dur: 0.19},
    oa: {kind: 'vg', from: 'aw',    to: 'oo',    dur: 0.19}, // /oʊ/ boat
    ow: {kind: 'vg', from: 'aw',    to: 'oo',    dur: 0.19},
    ou: {kind: 'vg', from: 'ae',    to: 'oo',    dur: 0.19}, // /aʊ/ out, down
    oi: {kind: 'vg', from: 'aw',    to: 'ee',    dur: 0.19}, // /ɔɪ/ destroy
    oy: {kind: 'vg', from: 'aw',    to: 'ee',    dur: 0.19},
    // Consonant digraphs.
    th: {kind: 'cc', f: 7000, q: 0.8, dur: 0.08, gain: 0.45},
    sh: {kind: 'cc', f: 2400, q: 1.4, dur: 0.085, gain: 0.55},
    ch: {kind: 'cc', f: 2700, q: 1.0, dur: 0.075, gain: 0.60},
    ph: {kind: 'cc', f: 5200, q: 1.2, dur: 0.075, gain: 0.45}, // /f/
    ck: {kind: 'cc', f: 2400, q: 0.9, dur: 0.055, gain: 0.55}, // /k/
    ng: {kind: 'cc', f: 1100, q: 1.4, dur: 0.075, gain: 0.45},
  }

  // Bare-letter vowel mapping for English (closed-syllable defaults).
  const EN_BASE_VOWEL = {
    a: 'ae',
    e: 'eh',
    i: 'ih',
    o: 'aw',
    u: 'uh',
    y: 'ee',
  }

  // Long-vowel renderings used when "magic e" promotes a closed-syllable
  // vowel (LIKE, ESCAPE, FUTILE, …). Each is a glide.
  const EN_LONG_VOWEL = {
    a: {kind: 'vg', from: 'eh', to: 'ee', dur: 0.20}, // /eɪ/
    e: {kind: 'vg', from: 'ee', to: 'ee', dur: 0.20}, // /iː/
    i: {kind: 'vg', from: 'ae', to: 'ee', dur: 0.20}, // /aɪ/
    o: {kind: 'vg', from: 'aw', to: 'oo', dur: 0.20}, // /oʊ/
    u: {kind: 'vg', from: 'oo', to: 'oo', dur: 0.20}, // /uː/
  }

  // Consonants we approximate. Each is a short noise burst with a
  // bandpass centre. Anything not in this set or VOWELS becomes a 60ms
  // silent gap (pacing).
  const CONSONANTS = {
    s: {f: 5800, q: 1.6, dur: 0.075, gain: 0.55},
    t: {f: 3800, q: 0.9, dur: 0.055, gain: 0.65},
    k: {f: 2400, q: 0.9, dur: 0.055, gain: 0.55},
    p: {f: 1200, q: 1.0, dur: 0.055, gain: 0.55},
    m: {f:  280, q: 1.4, dur: 0.075, gain: 0.45},
    n: {f:  500, q: 1.4, dur: 0.075, gain: 0.45},
    r: {f:  900, q: 2.4, dur: 0.075, gain: 0.50},
    l: {f:  650, q: 1.6, dur: 0.075, gain: 0.45},
    h: {f: 4200, q: 0.7, dur: 0.065, gain: 0.40},
    f: {f: 5200, q: 1.2, dur: 0.075, gain: 0.45},
    v: {f:  900, q: 1.4, dur: 0.075, gain: 0.45},
    z: {f: 4400, q: 1.2, dur: 0.075, gain: 0.50},
    j: {f: 2200, q: 1.4, dur: 0.065, gain: 0.50},
    g: {f: 1400, q: 1.0, dur: 0.065, gain: 0.50},
    d: {f: 1600, q: 0.9, dur: 0.055, gain: 0.55},
    b: {f:  700, q: 1.0, dur: 0.055, gain: 0.55},
  }

  // Map any input character to a phoneme key, normalising accents.
  function normChar(ch) {
    const c = ch.toLowerCase()
    if (c === 'á' || c === 'à' || c === 'ä') return 'a'
    if (c === 'é' || c === 'è' || c === 'ë') return 'e'
    if (c === 'í' || c === 'ì' || c === 'ï') return 'i'
    if (c === 'ó' || c === 'ò' || c === 'ö') return 'o'
    if (c === 'ú' || c === 'ù' || c === 'ü') return 'u'
    if (c === 'ñ') return 'n'
    if (c === 'ç') return 's'
    return c
  }

  // Tokenise a phrase into a sequence of {kind, key, dur} frames.
  // Vowels = 'v', consonants = 'c', gaps = 'gap'. Whitespace yields a longer
  // silence; punctuation yields a brief pause and a slight pitch dip.
  function tokenize(phrase) {
    const tokens = []
    for (const raw of phrase) {
      const c = normChar(raw)
      if (VOWELS[c]) tokens.push({kind: 'v', key: c, dur: 0.135})
      else if (CONSONANTS[c]) tokens.push({kind: 'c', key: c, dur: CONSONANTS[c].dur})
      else if (c === ' ') tokens.push({kind: 'gap', dur: 0.13})
      else if (c === ',' || c === ';' || c === ':') tokens.push({kind: 'gap', dur: 0.22})
      else if (c === '.' || c === '!' || c === '?') tokens.push({kind: 'gap', dur: 0.32})
      else tokens.push({kind: 'gap', dur: 0.05})
    }
    return tokens
  }

  // English tokenizer: lowercases, marks magic-e (V-C-e at word end → long
  // vowel + silent e) and silent word-final e (long words ending in -<C>e),
  // then walks the string with digraph lookahead. The result is a stream
  // of {kind, ...} tokens compatible with the same scheduler the Spanish
  // path uses, plus 'vg' (vowel glide) and 'cc' (inline consonant).
  function tokenizeEn(phrase) {
    const tokens = []
    const s = phrase.toLowerCase()
    const N = s.length
    const flags = new Array(N).fill(null)
    const isVowel = (ch) => 'aeiou'.indexOf(ch) >= 0
    const isCons  = (ch) => 'bcdfghjklmnpqrstvwxz'.indexOf(ch) >= 0
    const isLetter = (ch) => /[a-z]/.test(ch)
    // Pass 1 — magic-e (V C e <word boundary>).
    for (let i = 0; i + 2 < N; i++) {
      const v = s[i], c1 = s[i + 1], e = s[i + 2]
      const after = i + 3 < N ? s[i + 3] : ' '
      if (isVowel(v) && isCons(c1) && e === 'e' && !isLetter(after)) {
        flags[i] = 'long'
        flags[i + 2] = 'silent'
      }
    }
    // Pass 2 — silent word-final 'e' in words of 4+ letters (RESISTANCE,
    // AVENGE). Skip short words like THE / BE so they stay voiced.
    for (let i = 0; i < N; i++) {
      if (flags[i]) continue
      if (s[i] !== 'e') continue
      if (i + 1 < N && isLetter(s[i + 1])) continue
      let start = i
      while (start > 0 && isLetter(s[start - 1])) start--
      if (i - start < 3) continue
      if (i > 0 && isCons(s[i - 1])) flags[i] = 'silent'
    }
    let i = 0
    while (i < N) {
      if (flags[i] === 'silent') { i++; continue }
      if (flags[i] === 'long') {
        const c = normChar(s[i])
        const long = EN_LONG_VOWEL[c]
        if (long) { tokens.push({...long}); i++; continue }
      }
      const c2 = s.substr(i, 2)
      if (i + 1 < N && EN_DIGRAPHS[c2]) {
        tokens.push({...EN_DIGRAPHS[c2]})
        i += 2
        continue
      }
      const c = normChar(s[i])
      if (EN_BASE_VOWEL[c]) {
        tokens.push({kind: 'v', vowelKey: EN_BASE_VOWEL[c], dur: 0.135, useEn: true})
      } else if (CONSONANTS[c]) {
        tokens.push({kind: 'c', key: c, dur: CONSONANTS[c].dur})
      } else if (c === ' ') tokens.push({kind: 'gap', dur: 0.13})
      else if (c === ',' || c === ';' || c === ':') tokens.push({kind: 'gap', dur: 0.22})
      else if (c === '.' || c === '!' || c === '?') tokens.push({kind: 'gap', dur: 0.32})
      else tokens.push({kind: 'gap', dur: 0.05})
      i++
    }
    return tokens
  }

  // Bit-crush: 6-bit quantization. Precomputed Float32 LUT, reused.
  const CRUSH_LUT = (() => {
    const N = 4096
    const STEPS = 64 // 2^6 levels
    const lut = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1
      lut[i] = Math.round(x * (STEPS / 2)) / (STEPS / 2)
    }
    return lut
  })()

  function makeRobotizationBus() {
    const ctx = ctxFn()
    const input = ctx.createGain()
    input.gain.value = 1
    const output = ctx.createGain()
    output.gain.value = 1

    // Ring modulator: multiply the signal by a 75 Hz square LFO carrier.
    // Implemented as input → ringGain.gain controlled by a square oscillator
    // (range -1..+1 mapped to gain range via DC-blocking trick).
    const ringGain = ctx.createGain()
    ringGain.gain.value = 0
    const ringLfo = ctx.createOscillator()
    ringLfo.type = 'square'
    ringLfo.frequency.value = 75
    // Map the oscillator (-1..+1) directly onto an a-rate gain. We also add
    // a small DC bias so the modulation doesn't pure-zero out the signal —
    // lower depth + higher bias = more of the dry formant comes through.
    const bias = ctx.createConstantSource()
    bias.offset.value = 0.7
    const ringMix = ctx.createGain()
    ringMix.gain.value = 0.3
    ringLfo.connect(ringMix).connect(ringGain.gain)
    bias.connect(ringGain.gain)
    input.connect(ringGain)

    // Bit-crush waveshaper.
    const shaper = ctx.createWaveShaper()
    shaper.curve = CRUSH_LUT
    shaper.oversample = '2x'
    ringGain.connect(shaper)

    // Comb delay (7 ms, light feedback) — metallic ring without smearing.
    const delay = ctx.createDelay(0.05)
    delay.delayTime.value = 0.007
    const fb = ctx.createGain()
    fb.gain.value = 0.25
    shaper.connect(delay)
    delay.connect(fb).connect(delay)

    // Mix dry + delayed; favour dry so consonants stay legible.
    const dry = ctx.createGain()
    dry.gain.value = 0.85
    shaper.connect(dry).connect(output)
    const wet = ctx.createGain()
    wet.gain.value = 0.3
    delay.connect(wet).connect(output)

    ringLfo.start()
    bias.start()

    return {
      input, output,
      stop() {
        try { ringLfo.stop() } catch (_) {}
        try { bias.stop() } catch (_) {}
        try { input.disconnect() } catch (_) {}
        try { ringGain.disconnect() } catch (_) {}
        try { shaper.disconnect() } catch (_) {}
        try { delay.disconnect() } catch (_) {}
        try { fb.disconnect() } catch (_) {}
        try { dry.disconnect() } catch (_) {}
        try { wet.disconnect() } catch (_) {}
        try { output.disconnect() } catch (_) {}
      },
    }
  }

  // Schedule a vowel frame (saw + 3 bandpass formants). When `opts.glideTo`
  // is set, F1/F2 ramp from `vowelKey` to that target across the duration —
  // this is how English diphthongs (oy, ow, ai, …) are rendered.
  function scheduleVowel(out, t0, dur, basePitch, vowelKey, opts = {}) {
    const ctx = ctxFn()
    const table = opts.useEn ? EN_VOWELS : VOWELS
    const v = table[vowelKey] || VOWELS.a
    const v2 = opts.glideTo ? (table[opts.glideTo] || v) : null
    const bus = ctx.createGain()
    bus.gain.value = 0
    A().envelope(bus.gain, t0, 0.015, dur - 0.04, 0.025, 0.85)

    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(basePitch, t0)
    // Slight downward inflection per syllable so it doesn't sound flat.
    o.frequency.linearRampToValueAtTime(basePitch * 0.97, t0 + dur)

    const f1 = ctx.createBiquadFilter()
    f1.type = 'bandpass'; f1.Q.value = 9
    const f2 = ctx.createBiquadFilter()
    f2.type = 'bandpass'; f2.Q.value = 11
    const f3 = ctx.createBiquadFilter()
    f3.type = 'bandpass'; f3.frequency.value = 2800; f3.Q.value = 8

    if (v2) {
      f1.frequency.setValueAtTime(v.f1, t0)
      f1.frequency.linearRampToValueAtTime(v2.f1, t0 + dur)
      f2.frequency.setValueAtTime(v.f2, t0)
      f2.frequency.linearRampToValueAtTime(v2.f2, t0 + dur)
    } else {
      f1.frequency.value = v.f1
      f2.frequency.value = v.f2
    }

    const g1 = ctx.createGain(); g1.gain.value = 0.9
    const g2 = ctx.createGain(); g2.gain.value = 0.6
    const g3 = ctx.createGain(); g3.gain.value = 0.3

    o.connect(f1).connect(g1).connect(bus)
    o.connect(f2).connect(g2).connect(bus)
    o.connect(f3).connect(g3).connect(bus)
    bus.connect(out)

    o.start(t0); o.stop(t0 + dur + 0.02)
    return o
  }

  // Schedule a consonant noise burst. `keyOrCfg` is either a CONSONANTS key
  // or an inline config `{f, q, gain}` (used by English digraphs th/sh/ch).
  function scheduleConsonant(out, t0, dur, keyOrCfg) {
    const ctx = ctxFn()
    const c = typeof keyOrCfg === 'string' ? CONSONANTS[keyOrCfg] : keyOrCfg
    if (!c) return null
    const n = ctx.createBufferSource()
    n.buffer = engine.buffer.whiteNoise({channels: 1, duration: dur + 0.05})
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = c.f
    bp.Q.value = c.q
    const g = ctx.createGain()
    g.gain.value = 0
    A().envelope(g.gain, t0, 0.004, dur - 0.02, 0.018, c.gain)
    n.connect(bp).connect(g).connect(out)
    n.start(t0); n.stop(t0 + dur + 0.04)
    return n
  }

  // Speak a phrase at world position (sx, sy). Returns the total duration
  // so the caller can chain follow-up cues. Positional audio inherits the
  // standard binaural + behind-muffle from `playSpatial`.
  function say(phraseOrKey, sx, sy, opts = {}) {
    const phrase = (typeof phraseOrKey === 'string' && phraseOrKey.indexOf('.') !== -1)
      ? app.i18n.t(phraseOrKey) : phraseOrKey
    if (!phrase) return 0
    const locale = (app.i18n && app.i18n.locale && app.i18n.locale()) || 'en'
    const tokens = locale === 'en' ? tokenizeEn(String(phrase)) : tokenize(String(phrase))
    let total = 0
    for (const tok of tokens) total += tok.dur
    if (total <= 0) return 0

    const basePitch = opts.basePitch || 110

    A().playSpatial(sx, sy, (out, mod) => {
      const pm = (mod && mod.pitchMul) || 1
      const robot = makeRobotizationBus()
      const post = ctxFn().createGain()
      post.gain.value = (opts.gain != null ? opts.gain : 1) * busGain
      robot.output.connect(post).connect(out)

      const t0 = engine.time() + 0.01
      let t = t0
      const stops = []
      for (const tok of tokens) {
        if (tok.kind === 'v') {
          stops.push(scheduleVowel(robot.input, t, tok.dur, basePitch * pm, tok.vowelKey || tok.key, {useEn: !!tok.useEn}))
        } else if (tok.kind === 'vg') {
          stops.push(scheduleVowel(robot.input, t, tok.dur, basePitch * pm, tok.from, {useEn: true, glideTo: tok.to}))
        } else if (tok.kind === 'c') {
          const n = scheduleConsonant(robot.input, t, tok.dur, tok.key)
          if (n) stops.push(n)
        } else if (tok.kind === 'cc') {
          const n = scheduleConsonant(robot.input, t, tok.dur, tok)
          if (n) stops.push(n)
        }
        t += tok.dur
      }
      const endAt = t + 0.2
      setTimeout(() => {
        for (const s of stops) { try { s.stop() } catch (_) {} }
        try { robot.stop() } catch (_) {}
        try { post.disconnect() } catch (_) {}
      }, Math.max(0, (endAt - engine.time()) * 1000))
      return () => {
        for (const s of stops) { try { s.stop() } catch (_) {} }
        try { robot.stop() } catch (_) {}
      }
    }, {gain: 1.0, near: opts.near || 5, pow: opts.pow || 1.3, stereoGain: 0.85, binauralGain: 0.55})

    return total
  }

  // Pick a phrase key from an i18n pool (`robotbarks.pools.<category>`).
  // Returns the picked phrase key; caller passes that to `say`.
  function pickPool(category) {
    const pool = app.i18n.t('robotbarks.pools.' + category)
    if (!Array.isArray(pool) || pool.length === 0) return null
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function barkRandom(category, sx, sy, opts) {
    const key = pickPool(category)
    if (!key) return 0
    return say(key, sx, sy, opts)
  }

  // Robot bark: per-robot cooldown so a chase doesn't spam the announcer.
  // The robot object is expected to expose `lastBarkAt`.
  function bark(category, robot) {
    if (!robot) return 0
    const now = engine.time()
    if (robot.lastBarkAt && now - robot.lastBarkAt < 4) return 0
    robot.lastBarkAt = now
    return barkRandom(category, robot.x, robot.y, {basePitch: robot.voicePitch || 110})
  }

  return {
    setBusGain,
    busGain: () => busGain,
    say,
    bark,
    barkRandom,
    pickPool,
  }
})()
