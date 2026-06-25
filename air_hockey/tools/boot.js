// Headless bundle-boot harness. Loads the REAL built bundle into a jsdom
// document (the real index.html) against a fake Web Audio API, boots it like a
// browser would, then drives the screen FSM: menu → pick difficulty/target →
// Start → play a full (idle) match to game over → rematch / menu, plus the
// #learn route. Any error a screen swallows into console.error fails the run.
//
// Requires the --debug bundle (no IIFE wrap) so app/content/engine are reachable.
//   pnpx gulp build --debug && node tools/boot.js
'use strict'
const fs = require('fs')
const path = require('path')
const { JSDOM, VirtualConsole } = require('jsdom')

// ---- fake Web Audio ----
function makeParam() {
  const p = { value: 0 }
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime',
    'setTargetAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime', 'setValueCurveAtTime',
    'connect', 'disconnect']) p[m] = () => p
  return p
}
const PARAMS = new Set(['gain', 'frequency', 'Q', 'detune', 'pan', 'delayTime', 'playbackRate',
  'threshold', 'knee', 'ratio', 'attack', 'release', 'reduction'])
function makeNode() {
  const store = {}, params = {}
  return new Proxy(store, {
    get(t, prop) {
      if (prop in t) return t[prop]
      if (typeof prop === 'symbol') return undefined
      if (PARAMS.has(prop)) return params[prop] || (params[prop] = makeParam())
      return (...a) => (prop === 'connect' ? (a[0] || store) : store)
    },
    set(t, prop, v) { t[prop] = v; return true },
  })
}
class FakeAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels; this.length = length | 0; this.sampleRate = sampleRate
    this.duration = (length | 0) / sampleRate
    this._c = []
    for (let i = 0; i < Math.max(1, channels); i++) this._c.push(new Float32Array(Math.max(1, length | 0)))
  }
  getChannelData(i) { return this._c[i] || this._c[0] }
}
function makeContext() {
  const base = {
    sampleRate: 44100, currentTime: 0, state: 'running', destination: makeNode(), listener: makeNode(),
    createBuffer: (c, l) => new FakeAudioBuffer(c, l, 44100),
    resume: () => Promise.resolve(), suspend: () => Promise.resolve(), close: () => Promise.resolve(),
    addEventListener() {},
  }
  return new Proxy(base, {
    get(t, p) {
      if (p in t) return t[p]
      if (typeof p === 'string' && p.startsWith('create')) return () => makeNode()
      return undefined
    },
    set(t, p, v) { t[p] = v; return true },
  })
}

// ---- jsdom ----
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8')
  .replace(/<script[^>]*><\/script>/g, '') // we eval the bundle ourselves, after stubbing audio
const errors = []
const vc = new VirtualConsole()
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message || e)))
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc })
const { window } = dom

window.AudioContext = function () { return makeContext() }
window.OfflineAudioContext = window.AudioContext
window.AudioBuffer = FakeAudioBuffer
window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} })
if (!window.navigator.getGamepads) window.navigator.getGamepads = () => []
// Capture errors the screens swallow into console.error.
window.console.error = (...a) => errors.push(a.map(String).join(' '))
window.console.warn = () => {}

const debugBundle = fs.readFileSync(path.join(__dirname, '..', 'public', 'scripts.min.js'), 'utf8')
window.eval(debugBundle + '\n;window.__engine=engine;window.__app=app;window.__content=content;')
// Fire DOMContentLoaded so syngen's engine.ready() promise resolves.
window.document.dispatchEvent(new window.Event('DOMContentLoaded'))

let failures = 0
function check(name, cond, detail) {
  const ok = !!cond
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}

;(async () => {
  const app = window.__app, engine = window.__engine, content = window.__content
  // Let the async main() boot finish.
  await new Promise((r) => setTimeout(r, 150))

  check('exposes app/content/engine', app && content && engine)
  check('boots to the menu', app.screenManager.is('menu'), 'state=' + (app.screenManager.is('menu') ? 'menu' : '?'))

  const doc = window.document
  function click(sel) {
    const el = doc.querySelector(sel)
    if (!el) throw new Error('no element: ' + sel)
    el.click()
    return el
  }

  // Pick difficulty + target.
  click('.a-menu button[data-action="difficulty"][data-value="hard"]')
  click('.a-menu button[data-action="target"][data-value="11"]')
  const hardBtn = doc.querySelector('.a-menu button[data-value="hard"]')
  const t11 = doc.querySelector('.a-menu button[data-value="11"]')
  check('difficulty/target selection sets aria-pressed',
    hardBtn.getAttribute('aria-pressed') === 'true' && t11.getAttribute('aria-pressed') === 'true')

  // Learn route + sample a cue, then back.
  click('.a-menu button[data-action="learn"]')
  check('Learn the sounds screen opens', app.screenManager.is('learn'))
  const cueBtn = doc.querySelector('.a-learn--list button[data-cue]')
  check('learn list rendered cue buttons', !!cueBtn)
  if (cueBtn) cueBtn.click()
  click('.a-learn button[data-action="back"]')
  check('returns to menu from learn', app.screenManager.is('menu'))

  // Start the match.
  click('.a-menu button[data-action="start"]')
  check('Start enters the game screen', app.screenManager.is('game'))
  check('match is in progress', content.game.getPhase() !== 'idle' && content.game.getPhase() !== 'over')

  // Drive a few frames so the puck goes live, then exercise the F1–F4 status
  // hotkeys (bearing/position helpers + their i18n templates).
  const screen = () => app.screenManager.current()
  for (let i = 0; i < 120; i++) screen().onFrame({ delta: 1 / 60 })
  const assertive = doc.querySelector('.a-app--announce-assertive')
  for (const code of ['F1', 'F2', 'F3', 'F4']) {
    assertive.textContent = ''
    window.dispatchEvent(new window.KeyboardEvent('keydown', { code, bubbles: true }))
    // The assertive region clears then re-sets on rAF; run pending timers/raf.
    await new Promise((r) => setTimeout(r, 0))
    check('F-key ' + code + ' announces without error', errors.length === 0)
  }

  // Drive frames (idle player → the CPU wins) until game over.
  let frames = 0
  while (!app.screenManager.is('gameover') && frames < 30000) {
    screen().onFrame({ delta: 1 / 60, paused: false })
    frames++
  }
  check('a full match reaches game over', app.screenManager.is('gameover'), frames + ' frames')
  const title = doc.querySelector('.a-gameover--title')
  check('game over shows a result', title && title.textContent.length > 0, title && JSON.stringify(title.textContent))

  // Rematch → back into the game.
  click('.a-gameover button[data-action="rematch"]')
  check('rematch re-enters the game', app.screenManager.is('game'))

  // Leave to menu.
  // (drive a couple frames first so the game screen is settled)
  screen().onFrame({ delta: 1 / 60 })
  app.screenManager.dispatch('back')
  check('Escape/back returns to menu', app.screenManager.is('menu'))

  check('no screen threw during the run', errors.length === 0, errors.slice(0, 3).join(' | '))

  console.log('\n' + (failures === 0 ? 'BOOT HARNESS PASSED' : failures + ' BOOT CHECK(S) FAILED'))
  process.exit(failures === 0 ? 0 : 1)
})()
