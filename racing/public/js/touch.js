/**
 * Touch controls for Wheels of Claudo (mobile).
 *
 * Standalone (this game has no build step and no shared app framework). Big
 * on-screen buttons dispatch synthetic keydown/keyup on `window`, which is
 * exactly what input.js listens for — so no game logic changes are needed.
 * Only appears on touch devices, and only while a race is on screen (detected
 * via the `#hud.active` class that HUD.showRace adds).
 */
;(() => {
  const isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
  if (!isTouch) return

  const held = {}
  function press(code) {
    if (!code) return
    held[code] = (held[code] || 0) + 1
    if (held[code] === 1) window.dispatchEvent(new KeyboardEvent('keydown', {code, key: code, bubbles: true, cancelable: true}))
  }
  function release(code) {
    if (!code || !held[code]) return
    held[code]--
    if (held[code] <= 0) { held[code] = 0; window.dispatchEvent(new KeyboardEvent('keyup', {code, key: code, bubbles: true, cancelable: true})) }
  }
  function buzz() { try { navigator.vibrate && navigator.vibrate(12) } catch (e) {} }

  const style = document.createElement('style')
  style.textContent = `
  .r-touch { position:fixed; inset:0; z-index:1000; pointer-events:none; opacity:0; visibility:hidden; transition:opacity .25s ease; }
  .r-touch.on { opacity:1; visibility:visible; }
  .r-touch .zone { position:absolute; display:flex; align-items:center; gap:.6em; pointer-events:none; }
  .r-touch .zone > * { pointer-events:auto; }
  .r-touch .left { left:calc(1em + env(safe-area-inset-left,0px)); bottom:calc(1.2em + env(safe-area-inset-bottom,0px)); }
  .r-touch .right { right:calc(1em + env(safe-area-inset-right,0px)); bottom:calc(1.2em + env(safe-area-inset-bottom,0px)); flex-direction:row-reverse; }
  .r-touch .center { left:50%; transform:translateX(-50%); bottom:calc(1.2em + env(safe-area-inset-bottom,0px)); }
  .r-touch button { -webkit-tap-highlight-color:transparent; touch-action:none; user-select:none;
    font-family:inherit; font-weight:800; color:#fff; background:rgba(255,255,255,.12);
    border:2px solid rgba(255,255,255,.6); border-radius:50%; width:4.4em; height:4.4em; min-width:60px; min-height:60px;
    font-size:1em; display:flex; align-items:center; justify-content:center; }
  .r-touch button.active { background:rgba(255,255,255,.45); transform:scale(.94); }
  .r-touch button.primary { width:5.4em; height:5.4em; background:rgba(60,160,255,.3); border-color:rgba(150,205,255,.9); }
  .r-touch button.primary.active { background:rgba(60,160,255,.62); }
  .r-touch button.sm { width:3.6em; height:3.6em; font-size:.85em; }
  .r-touch .banner { position:absolute; top:calc(.6em + env(safe-area-inset-top,0px)); left:50%; transform:translateX(-50%);
    background:rgba(0,0,0,.72); border:1px solid rgba(255,255,255,.25); border-radius:.6em; color:#fff; font-weight:700;
    padding:.45em .9em; max-width:88vw; text-align:center; opacity:0; transition:opacity .2s ease; pointer-events:none; }
  .r-touch .banner.on { opacity:1; }
  @media (max-height:26em){ .r-touch button{ width:3.7em; height:3.7em; } .r-touch button.primary{ width:4.4em; height:4.4em; } }
  `
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.className = 'r-touch'
  // Not aria-hidden: blind players on touch devices explore with VoiceOver and
  // must be able to find/activate these buttons.

  function hold(el, code) {
    const active = new Set()
    let lastPointer = -1e9
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      lastPointer = e.timeStamp
      if (active.size === 0) { press(code); el.classList.add('active'); buzz() }
      active.add(e.pointerId)
      try { el.setPointerCapture(e.pointerId) } catch (x) {}
    })
    const up = (e) => { lastPointer = e.timeStamp; if (active.has(e.pointerId)) { active.delete(e.pointerId); if (active.size === 0) { release(code); el.classList.remove('active') } } }
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
    // VoiceOver double-tap / keyboard activation fires a click without a
    // pointerdown/up hold — turn it into a momentary press (ignore the
    // compatibility click after a real touch).
    el.addEventListener('click', (e) => {
      if (e.timeStamp - lastPointer < 700) return
      press(code); setTimeout(() => release(code), 60)
    })
  }

  function btn(code, label, cls, aria) {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('aria-label', aria || label)   // spoken label for screen readers
    b.textContent = label
    if (cls) b.className = cls
    hold(b, code)
    return b
  }

  function zone(name, kids) {
    const z = document.createElement('div')
    z.className = 'zone ' + name
    kids.forEach(k => z.appendChild(k))
    root.appendChild(z)
  }

  // Left: steer + brake. Right: boost (primary) + item. Center: directional shoot.
  zone('left', [btn('ArrowLeft', '◀', null, 'Steer left'), btn('ArrowRight', '▶', null, 'Steer right'), btn('ArrowDown', 'BRK', 'sm', 'Brake')])
  zone('right', [btn('ShiftLeft', 'BOOST', 'primary', 'Boost'), btn('Space', 'ITEM', 'sm', 'Use item')])
  zone('center', [btn('KeyA', '◀', 'sm', 'Shoot left'), btn('KeyS', 'FIRE', null, 'Shoot forward'), btn('KeyD', '▶', 'sm', 'Shoot right')])

  const banner = document.createElement('div')
  banner.className = 'banner'
  banner.setAttribute('aria-hidden', 'true') // visual mirror; #announce already speaks to AT
  root.appendChild(banner)

  document.addEventListener('DOMContentLoaded', mount)
  if (document.readyState !== 'loading') mount()
  function mount() {
    if (root.parentNode) return
    document.body.appendChild(root)

    // Mirror the assertive announce region into a brief visible banner.
    const assert = document.getElementById('announce-assert')
    if (assert) {
      let t = null
      new MutationObserver(() => {
        const s = (assert.textContent || '').trim()
        if (!s) return
        banner.textContent = s; banner.classList.add('on')
        if (t) clearTimeout(t)
        t = setTimeout(() => banner.classList.remove('on'), 3200)
      }).observe(assert, {childList: true, characterData: true, subtree: true})
    }

    // Show only while a race is on screen.
    const hud = document.getElementById('hud')
    const finish = document.getElementById('finish')
    const gameover = document.getElementById('gameover')
    const splash = document.getElementById('splash')
    const inRace = () => !!(hud && hud.classList.contains('active')) &&
      !(finish && !finish.hidden) && !(gameover && !gameover.hidden) &&
      !(splash && splash.style.display !== 'none' && !splash.hidden)
    const sync = () => root.classList.toggle('on', inRace())
    setInterval(sync, 200)
    sync()

    window.addEventListener('blur', () => { for (const c in held) while (held[c] > 0) release(c) })
  }
})()
