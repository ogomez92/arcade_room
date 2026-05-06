/**
 * Per-job pizza inventory and generator.
 *
 * Generates a list of pizzas at briefing-time: each has a random
 * ingredient set (cheese always + 1–2 toppings, plus 25% chance of
 * one funny ingredient) and a delivery address (street name + house
 * number), drawn from the active locale's pools.
 *
 * Inventory exposes `held`, a `selected` index, and methods to select
 * by index, throw the selected pizza at a target address, and report
 * how many remain.
 */
content.pizzas = (() => {
  const W = () => content.world

  const TIPS_MIN = 4
  const TIPS_MAX = 12

  let held = []
  let selected = 0

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  function pickRandomDistinct(arr, n) {
    const copy = arr.slice()
    const out = []
    for (let i = 0; i < n && copy.length; i++) {
      const idx = Math.floor(Math.random() * copy.length)
      out.push(copy.splice(idx, 1)[0])
    }
    return out
  }

  // Generate one pizza with random ingredients (cheese + 1–2 toppings, +25% funny).
  function makePizza(addressForbidden) {
    const ingPool = app.i18n.pool('ingredients') || ['cheese', 'pepperoni', 'mushroom']
    const funnyPool = app.i18n.pool('funnyIngredients') || ['regrets']

    const cheese = ingPool.find((x) => /cheese|queso/i.test(x)) || 'cheese'
    const toppingsCount = Math.random() < 0.5 ? 1 : 2
    const otherToppings = ingPool.filter((x) => x !== cheese)
    const toppings = pickRandomDistinct(otherToppings, toppingsCount)
    const ingredients = [cheese, ...toppings]
    if (Math.random() < 0.25 && funnyPool.length) {
      ingredients.push(pickRandom(funnyPool))
    }

    // Pick a delivery address — random non-Pizza street, random house number.
    const world = W()
    const candidateNames = []
    for (let v = 0; v < world.COLS; v++) {
      const n = world.vertNameOf(v)
      if (n && n !== 'Pizza') candidateNames.push(n)
    }
    for (let h = 0; h < world.ROWS; h++) {
      const n = world.horizNameOf(h)
      if (n) candidateNames.push(n)
    }

    let addrN = null, addrStreet = null, point = null, attempts = 0
    while (!point && attempts++ < 32) {
      const street = pickRandom(candidateNames)
      // Plan: 2..120 (even) or 1..119 (odd). Pick a side, then a number.
      const side = Math.random() < 0.5 ? 'even' : 'odd'
      const slot = Math.floor(Math.random() * 60)  // 0..59 → 60 slots per side
      const n = side === 'even' ? (slot * 2 + 2) : (slot * 2 + 1)
      const dedupKey = n + '|' + street
      if (addressForbidden && addressForbidden.has(dedupKey)) continue
      const p = world.addressToPoint(street, n)
      if (!p) continue
      addrN = n
      addrStreet = street
      point = p
    }

    const baseTip = TIPS_MIN + Math.floor(Math.random() * (TIPS_MAX - TIPS_MIN + 1))
    // Building label drawn from the active locale's pool. Stored as the
    // rendered string (acceptable trade-off: a mid-run locale switch
    // leaves building names in the original locale, but they're flavour,
    // not gameplay-critical).
    const building = app.i18n.pickFromPool('buildings') || ''
    return {
      ingredients,
      addrN,
      addrStreet,
      building,
      get address() { return app.i18n.formatDeliveryAddress(this.building, this.addrN, this.addrStreet) },
      point,
      baseTip,
      delivered: false,
      lost: false,
    }
  }

  function dedupKey(p) { return p && (p.addrN + '|' + p.addrStreet) }

  function generate(count) {
    held = []
    const used = new Set()
    for (let i = 0; i < count; i++) {
      const p = makePizza(used)
      if (p && p.addrN != null) {
        used.add(dedupKey(p))
        held.push(p)
      }
    }
    selected = 0
    return held.slice()
  }

  function select(idx) {
    if (idx < 0 || idx >= held.length) return false
    // Skip past delivered/lost pizzas — they're inert
    if (held[idx].delivered || held[idx].lost) return false
    selected = idx
    return true
  }

  // Choose the first non-delivered pizza if the current one is gone.
  function autoSelect() {
    if (held[selected] && !held[selected].delivered && !held[selected].lost) return selected
    for (let i = 0; i < held.length; i++) {
      if (!held[i].delivered && !held[i].lost) {
        selected = i
        return i
      }
    }
    selected = -1
    return -1
  }

  // Pick a uniformly random non-delivered, non-lost pizza. Used at the
  // start of each job so the player can't trivially press Space — they
  // have to verify the auto-selection matches the GPS destination.
  function selectRandomActive() {
    const active = []
    for (let i = 0; i < held.length; i++) {
      if (!held[i].delivered && !held[i].lost) active.push(i)
    }
    if (!active.length) { selected = -1; return -1 }
    selected = active[Math.floor(Math.random() * active.length)]
    return selected
  }

  function selectedPizza() {
    if (selected < 0 || selected >= held.length) return null
    const p = held[selected]
    if (!p || p.delivered || p.lost) return null
    return p
  }

  function activeCount() {
    let n = 0
    for (const p of held) if (!p.delivered && !p.lost) n++
    return n
  }

  function markDelivered(idx) {
    if (held[idx]) held[idx].delivered = true
    // Intentionally do NOT autoSelect: forcing the player to re-select
    // for each delivery is the memorization mechanic. selectedPizza()
    // will return null until they pick the next one explicitly.
  }
  function markLost(idx) {
    if (held[idx]) held[idx].lost = true
  }

  // The next pizza the GPS should route to — first held slot that is
  // neither delivered nor lost. Independent of `selected` (which is the
  // throw target chosen by the player).
  function firstActivePizza() {
    for (let i = 0; i < held.length; i++) {
      if (!held[i].delivered && !held[i].lost) return held[i]
    }
    return null
  }
  function firstActiveIndex() {
    for (let i = 0; i < held.length; i++) {
      if (!held[i].delivered && !held[i].lost) return i
    }
    return -1
  }

  function clear() {
    held = []
    selected = 0
  }

  return {
    generate,
    held: () => held,
    selectedIndex: () => selected,
    selectedPizza,
    select,
    autoSelect,
    selectRandomActive,
    activeCount,
    markDelivered,
    markLost,
    firstActivePizza,
    firstActiveIndex,
    clear,
  }
})()
