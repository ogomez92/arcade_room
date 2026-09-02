/**
 * Touch controls + mobile HUD (shared framework module).
 *
 * WHY THIS WORKS FOR EVERY GAME
 * -----------------------------
 * Every game reads input through `engine.input.keyboard`, whose state is built
 * purely from real `keydown` / `keyup` window events, and each game screen adds
 * its own `window` key handlers. So a big on-screen button that DISPATCHES a
 * synthetic `KeyboardEvent` on `window` drives the exact same code paths as a
 * physical key — no game logic changes required. This module renders those
 * buttons from a small per-game config (`app.touch.config`, set in
 * `app/touch/config.js`) and also mirrors the off-screen `aria-live` regions
 * into a visible HUD banner so sighted mobile players get the same feedback
 * blind players get by ear.
 *
 * Only activates on touch / coarse-pointer devices; desktop is untouched.
 *
 * This file is IDENTICAL across all games. Per-game differences live entirely
 * in `app/touch/config.js`.
 */
app.touch = (() => {
  // Best-effort code -> key. syngen and the game screens only read `.code`,
  // so `.key` is cosmetic, but we fill common ones for completeness.
  const KEY_FOR_CODE = {
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
    Space: ' ', Enter: 'Enter', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace',
    ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Control', ControlRight: 'Control',
  }

  function keyFor(code) {
    if (KEY_FOR_CODE[code]) return KEY_FOR_CODE[code]
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase()
    if (/^Digit[0-9]$/.test(code)) return code.slice(5)
    return code
  }

  // Track how many pointers currently hold a given code so overlapping presses
  // (e.g. two buttons bound to the same key) don't release early.
  const held = {}

  function press(code) {
    if (!code) return
    held[code] = (held[code] || 0) + 1
    if (held[code] === 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        code, key: keyFor(code), bubbles: true, cancelable: true,
      }))
    }
  }

  function release(code) {
    if (!code || !held[code]) return
    held[code]--
    if (held[code] <= 0) {
      held[code] = 0
      window.dispatchEvent(new KeyboardEvent('keyup', {
        code, key: keyFor(code), bubbles: true, cancelable: true,
      }))
    }
  }

  function tap(code) {
    // A discrete press+release (for momentary actions where holding is pointless).
    press(code)
    window.setTimeout(() => release(code), 60)
  }

  function buzz(ms = 12) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms)
    } catch (e) { /* ignore */ }
  }

  const isTouch = () => {
    try {
      return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0)
    } catch (e) {
      return 'ontouchstart' in window
    }
  }

  let root = null          // overlay container (fixed, full screen, pointer-events: none)
  let hudEl = null         // announcement banner
  let controlsEl = null    // wrapper holding the zones
  let zones = {}           // zone name -> element
  let built = false
  let gameScreens = ['game']
  let hudEnabled = true

  // --- individual control builders -----------------------------------------

  // Wire a DOM element to hold `code` down while pressed. Uses pointer capture
  // so a finger that slides slightly off the button keeps holding it, and
  // multi-touch works because each pointer is tracked independently.
  function bindHold(el, code) {
    const active = new Set()
    let lastPointer = -1e9
    const down = (e) => {
      e.preventDefault()
      lastPointer = e.timeStamp
      if (active.size === 0) { press(code); el.classList.add('is-active'); buzz() }
      active.add(e.pointerId)
      try { el.setPointerCapture(e.pointerId) } catch (x) {}
    }
    const up = (e) => {
      lastPointer = e.timeStamp
      if (!active.has(e.pointerId)) return
      active.delete(e.pointerId)
      if (active.size === 0) { release(code); el.classList.remove('is-active') }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
    // A screen reader's activation gesture (VoiceOver/TalkBack double-tap) and
    // keyboard Enter/Space fire a `click` and do NOT deliver a pointerdown/up
    // hold. Turn that click into a momentary press. Ignore the compatibility
    // click that follows a real finger press so we don't fire twice.
    el.addEventListener('click', (e) => {
      if (e.timeStamp - lastPointer < 700) return
      buzz()
      tap(code)
    })
  }

  // A momentary button: fires code on press, releases on lift (works both as a
  // hold and as a tap — a quick tap is one keydown then keyup).
  function makeButton(spec) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'a-touch--btn' + (spec.variant ? ' a-touch--btn-' + spec.variant : '')
    // Discoverable + labelled for screen readers: on a phone a blind player
    // explores by swipe (VoiceOver/TalkBack) and must be able to find and hear
    // these controls. Give a spoken label; the visible text can be a glyph.
    el.setAttribute('aria-label', spec.aria || spec.hint || spec.label || 'Button')
    el.textContent = spec.label || ''
    if (spec.hint) el.title = spec.hint
    bindHold(el, spec.code)
    return el
  }

  // A directional pad. Any of up/down/left/right may be omitted, yielding a
  // 1D pad (left/right for paddles, up/down for climbers, etc.).
  function makeDpad(spec) {
    const el = document.createElement('div')
    el.className = 'a-touch--dpad'
    const cells = {
      up:    {row: 1, col: 2, glyph: '▲'},
      left:  {row: 2, col: 1, glyph: '◀'},
      right: {row: 2, col: 3, glyph: '▶'},
      down:  {row: 3, col: 2, glyph: '▼'},
    }
    const dirNames = {up: 'Up', down: 'Down', left: 'Left', right: 'Right'}
    const horizontalOnly = !spec.up && !spec.down
    const verticalOnly = !spec.left && !spec.right
    for (const dir of ['up', 'left', 'right', 'down']) {
      const code = spec[dir]
      if (!code) continue
      const b = document.createElement('button')
      b.type = 'button'
      // Screen-reader label (spoken direction name), not the arrow glyph.
      b.setAttribute('aria-label', (spec.aria && spec.aria[dir]) || dirNames[dir])
      b.className = 'a-touch--dbtn a-touch--dbtn-' + dir
      let row = cells[dir].row, col = cells[dir].col
      if (horizontalOnly) row = 1
      if (verticalOnly) col = 1
      b.style.gridRow = row
      b.style.gridColumn = col
      b.textContent = (spec.labels && spec.labels[dir]) || cells[dir].glyph
      bindHold(b, code)
      el.appendChild(b)
    }
    if (horizontalOnly) el.classList.add('a-touch--dpad-horizontal')
    if (verticalOnly) el.classList.add('a-touch--dpad-vertical')
    return el
  }

  // A drag surface that holds up to two direction keys based on the drag vector
  // (8-way, with a deadzone). Optional tap-without-drag fires `fire`. Suits
  // free-aim games that integrate held arrow keys into a cursor position.
  function makeAim(spec) {
    const el = document.createElement('div')
    el.className = 'a-touch--aim'
    el.setAttribute('role', 'button')
    el.setAttribute('aria-label', spec.aria || spec.label || 'Aim')
    el.textContent = spec.label || ''
    const state = {pointerId: null, ox: 0, oy: 0, moved: false, active: new Set(), lastPointer: -1e9}
    const clearDirs = () => { for (const d of ['up','down','left','right']) { if (spec[d] && state.active.has(d)) { release(spec[d]); state.active.delete(d) } } }
    const setDir = (dir, on) => {
      if (!spec[dir]) return
      if (on && !state.active.has(dir)) { press(spec[dir]); state.active.add(dir) }
      else if (!on && state.active.has(dir)) { release(spec[dir]); state.active.delete(dir) }
    }
    const down = (e) => {
      e.preventDefault()
      state.pointerId = e.pointerId
      state.lastPointer = e.timeStamp
      state.ox = e.clientX; state.oy = e.clientY; state.moved = false
      try { el.setPointerCapture(e.pointerId) } catch (x) {}
      el.classList.add('is-active')
    }
    const move = (e) => {
      if (e.pointerId !== state.pointerId) return
      const dx = e.clientX - state.ox, dy = e.clientY - state.oy
      const dead = 14
      if (Math.abs(dx) > dead || Math.abs(dy) > dead) state.moved = true
      setDir('left', dx < -dead)
      setDir('right', dx > dead)
      setDir('up', dy < -dead)
      setDir('down', dy > dead)
      // Re-centre the origin so it behaves like a relative joystick.
      state.ox = e.clientX; state.oy = e.clientY
    }
    const up = (e) => {
      state.lastPointer = e.timeStamp
      if (e.pointerId !== state.pointerId) return
      clearDirs()
      el.classList.remove('is-active')
      if (!state.moved && spec.fire) { tap(spec.fire); buzz() }
      state.pointerId = null
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
    // Screen-reader / keyboard activation can't drag; fire on activate.
    el.addEventListener('click', (e) => {
      if (e.timeStamp - state.lastPointer < 700) return
      if (spec.fire) { buzz(); tap(spec.fire) }
    })
    return el
  }

  function makeControl(spec) {
    switch (spec.type) {
      case 'dpad': return makeDpad(spec)
      case 'aim': return makeAim(spec)
      case 'button':
      default: return makeButton(spec)
    }
  }

  // --- HUD (announcement mirror) --------------------------------------------

  let hudTimer = null

  function showHud(text, urgent) {
    if (!hudEl || !text) return
    hudEl.textContent = text
    hudEl.classList.toggle('is-urgent', !!urgent)
    hudEl.classList.add('is-visible')
    if (hudTimer) window.clearTimeout(hudTimer)
    hudTimer = window.setTimeout(() => {
      if (hudEl) hudEl.classList.remove('is-visible')
    }, urgent ? 4000 : 2600)
  }

  function watchAnnouncements() {
    // Games use different class names for their aria-live regions
    // (.a-live--assertive, .a-live--urgent, .a-app--announce-assertive, ...),
    // so key off the aria-live attribute itself — that's universal. assertive
    // regions are treated as urgent (louder, longer-lived banner).
    const observe = (el) => {
      const urgent = (el.getAttribute('aria-live') || '').toLowerCase() === 'assertive'
      const mo = new MutationObserver(() => {
        const t = (el.textContent || '').trim()
        if (t) showHud(t, urgent)
      })
      mo.observe(el, {childList: true, characterData: true, subtree: true})
    }
    const regions = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]')
    regions.forEach(observe)
  }

  // --- layout / visibility ---------------------------------------------------

  function ensureZone(name) {
    if (zones[name]) return zones[name]
    const z = document.createElement('div')
    z.className = 'a-touch--zone a-touch--zone-' + name
    zones[name] = z
    controlsEl.appendChild(z)
    return z
  }

  function build() {
    if (built) return
    built = true

    const config = app.touch.config || {}
    gameScreens = config.gameScreens || ['game']
    hudEnabled = config.hud !== false

    root = document.createElement('div')
    root.className = 'a-touch'
    // NOTE: the root is NOT aria-hidden — the control buttons inside must be
    // discoverable by VoiceOver/TalkBack for blind players on touch devices.
    // (When a screen isn't a game screen the overlay is visibility:hidden, which
    // already removes it from the accessibility tree.)

    // HUD banner: visual mirror of the game's aria-live regions for SIGHTED
    // touch players. Hidden from the a11y tree so screen-reader users don't hear
    // it twice — the game's own aria-live regions already speak this text.
    if (hudEnabled) {
      hudEl = document.createElement('div')
      hudEl.className = 'a-touch--hud'
      hudEl.setAttribute('aria-hidden', 'true')
      root.appendChild(hudEl)
      watchAnnouncements()
    }

    // Controls layer
    controlsEl = document.createElement('div')
    controlsEl.className = 'a-touch--controls'
    root.appendChild(controlsEl)

    // Auto pause button (top-left) unless disabled. Escape pauses in every game.
    if (config.pause !== false) {
      const pz = ensureZone('topLeft')
      const pause = makeButton({code: config.pauseCode || 'Escape', label: config.pauseLabel || 'II', variant: 'pause', hint: 'Pause'})
      pause.classList.add('a-touch--pausebtn')
      pz.appendChild(pause)
    }

    for (const spec of (config.controls || [])) {
      const z = ensureZone(spec.zone || 'right')
      z.appendChild(makeControl(spec))
    }

    document.body.appendChild(root)
  }

  function setVisible(on) {
    if (root) root.classList.toggle('is-visible', on)
  }

  function onScreen(id) {
    setVisible(gameScreens.indexOf(id) !== -1)
  }

  function init() {
    if (!isTouch()) return
    build()

    // Follow screen changes so controls only show in-game.
    try {
      app.screenManager.on('enter', (e) => onScreen(e && e.currentState))
      const cur = app.screenManager.current()
      if (cur) onScreen(cur.id)
    } catch (x) { /* screenManager not ready yet — enter events will catch up */ }

    // Release everything if the tab loses focus (mirror syngen's blur reset).
    window.addEventListener('blur', () => {
      for (const code in held) {
        while (held[code] > 0) release(code)
      }
    })
  }

  return {
    // config is assigned by app/touch/config.js (loaded after this file)
    config: null,
    // exposed for niche per-game needs / tests
    press, release, tap,
    isTouch,
    init,
  }
})()

window.addEventListener('load', () => app.touch.init())
