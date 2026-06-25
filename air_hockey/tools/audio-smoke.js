// Headless audio smoke test. Loads REAL syngen against a fake Web Audio API,
// then the content modules, then exercises content.audio: every continuous
// voice, every event-driven cue, and every #learn sample. It can't judge how
// anything SOUNDS (that's the by-ear pass), but it executes the actual synth
// graph against real syngen, catching undefined-node-method / bad-param /
// wiring errors that the audio-stubbed pure sim can never see.
'use strict'
const fs = require('fs')
const path = require('path')

// ---- fake Web Audio API ----
function makeParam() {
  const p = { value: 0 }
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime',
    'setTargetAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime', 'setValueCurveAtTime',
    'connect', 'disconnect']) p[m] = () => p
  return p
}
const PARAM_NAMES = new Set(['gain', 'frequency', 'Q', 'detune', 'pan', 'delayTime',
  'playbackRate', 'threshold', 'knee', 'ratio', 'attack', 'release', 'reduction',
  'orientationX', 'orientationY', 'orientationZ', 'positionX', 'positionY', 'positionZ'])
function makeNode() {
  const store = {}
  const params = {}
  return new Proxy(store, {
    get(t, prop) {
      if (prop in t) return t[prop]
      if (typeof prop === 'symbol') return undefined
      if (PARAM_NAMES.has(prop)) return params[prop] || (params[prop] = makeParam())
      return (...args) => (prop === 'connect' ? (args[0] || store) : store)
    },
    set(t, prop, val) { t[prop] = val; return true },
  })
}
global.AudioBuffer = class AudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels
    this.length = length | 0
    this.sampleRate = sampleRate
    this.duration = (length | 0) / sampleRate
    this._chans = []
    for (let i = 0; i < Math.max(1, channels); i++) this._chans.push(new Float32Array(Math.max(1, length | 0)))
  }
  getChannelData(i) { return this._chans[i] || this._chans[0] }
}

function makeContext() {
  const base = {
    sampleRate: 44100, currentTime: 0, state: 'running',
    destination: makeNode(), listener: makeNode(),
    createBuffer(channels, length) {
      return new global.AudioBuffer(channels, length, 44100)
    },
    resume() { return Promise.resolve() }, suspend() { return Promise.resolve() },
    close() { return Promise.resolve() }, addEventListener() {},
  }
  return new Proxy(base, {
    get(t, prop) {
      if (prop in t) return t[prop]
      if (typeof prop === 'string' && prop.startsWith('create')) return () => makeNode()
      return undefined
    },
    set(t, prop, val) { t[prop] = val; return true },
  })
}
// `new AudioContext()` returns the Proxy (a constructor returning an object
// yields that object).
global.AudioContext = function () { return makeContext() }
global.OfflineAudioContext = global.AudioContext
global.self = global
global.window = global
global.addEventListener = () => {}
global.removeEventListener = () => {}
global.document = {
  addEventListener() {}, removeEventListener() {},
  createElement() { return makeNode() },
  querySelector() { return null }, querySelectorAll() { return [] },
  documentElement: {}, body: makeNode(),
}

// ---- load real syngen + engine alias + content ----
let failures = 0
function check(name, fn) {
  try { fn(); console.log('PASS  ' + name) }
  catch (e) { failures++; console.log('FAIL  ' + name + '  — ' + (e && e.stack || e)) }
}

eval(fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'syngen', 'dist', 'syngen.js'), 'utf8'))
global.engine = global.syngen
global.content = {}
const SRC = path.join(__dirname, '..', 'src', 'js', 'content')
for (const f of ['constants.js', 'events.js', 'table.js', 'puck.js', 'physics.js', 'mallet.js', 'ai.js', 'game.js', 'audio.js']) {
  const p = path.join(SRC, f)
  if (fs.existsSync(p)) eval(fs.readFileSync(p, 'utf8'))
}
const K = content.constants

check('audio.start() builds the continuous voices', () => {
  content.audio.start()
  if (!content.audio.isStarted()) throw new Error('not started')
})

check('audio.frame() drives listener + puck + bed (20 frames)', () => {
  content.mallet.reset()
  content.puck.reset()
  content.puck.setPosition(K.WIDTH / 2, K.LENGTH * 0.4)
  content.puck.setVelocity(1.5, -3)
  content.puck.setLive(true)
  for (let i = 0; i < 20; i++) content.audio.frame()
})

check('every sim event fires its cue without throwing', () => {
  const E = content.events
  E.emit('malletHit', { who: 'you', x: K.WIDTH / 2, y: K.LENGTH * 0.8, speed: 5, drive: 2 })
  E.emit('malletHit', { who: 'opp', x: K.WIDTH / 2, y: K.LENGTH * 0.2, speed: 4, drive: 1 })
  E.emit('puckWall', { wall: 'left', x: 0, y: 1, speed: 5 })
  E.emit('puckWall', { wall: 'top', x: 0.5, y: 0, speed: 6 })
  E.emit('puckPost', { x: 0.33, y: 0, speed: 4 })
  E.emit('serve', { who: 'you', scoreYou: 0, scoreOpp: 0 })
  E.emit('countdown', { stepsLeft: 2 })
  E.emit('countdown', { stepsLeft: 1 })
  E.emit('serveGo', { server: 'you' })
  E.emit('scored', { scorer: 'you', conceder: 'opp', you: 1, opp: 0, target: 7 })
  E.emit('threat', { level: 0.8, bucket: 4 })
  content.audio.frame()
  E.emit('threatClear', {})
  content.audio.frame()
  E.emit('matchOver', { winner: 'you', you: 7, opp: 3, difficulty: 'hard' })
})

check('every #learn cue samples without throwing', () => {
  content.audio.setStaticListener(Math.PI / 2)
  const cues = ['puck', 'aimPing', 'homeHum', 'blower', 'threat', 'yourHit', 'oppHit',
    'railLeft', 'railTop', 'malletBump', 'post', 'goalYou', 'goalOpp', 'serve', 'go', 'win', 'lose']
  for (const c of cues) content.audio.silenceAll(), content.audio.sample(c)
})

check('puck pans left/right (not stuck centre)', () => {
  // Listener rides the mallet (centre of its half by default). A puck to the
  // left of the mallet must pan left (negative), to the right positive, and a
  // puck at the same x must be ~centre.
  content.mallet.reset()
  const mx = content.mallet.getPosition().x
  const left = content.audio._calcPan(mx - 0.3)
  const right = content.audio._calcPan(mx + 0.3)
  const centre = content.audio._calcPan(mx)
  if (!(left < -0.2)) throw new Error('left source did not pan left: ' + left)
  if (!(right > 0.2)) throw new Error('right source did not pan right: ' + right)
  if (Math.abs(centre) > 0.01) throw new Error('centre source not centred: ' + centre)
})

check('silenceAll + stop tear down cleanly', () => {
  content.audio.silenceAll()
  content.audio.stop()
  content.audio.stop() // idempotent
})

console.log('\n' + (failures === 0 ? 'AUDIO SMOKE PASSED' : failures + ' AUDIO CHECK(S) FAILED'))
process.exit(failures === 0 ? 0 : 1)
