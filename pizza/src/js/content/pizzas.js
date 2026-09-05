/**
 * Per-job pizza inventory and generator.
 *
 * Each pizza has a random ingredient set (cheese + 1–2 toppings, 25%
 * chance of one funny ingredient) and a delivery address drawn from the
 * city's deliverable addresses — every address faces a named block, so a
 * delivery reads as "the fire station at 42 Olive Lane". Within a job,
 * addresses are unique, landmarks are unique where possible, and nothing
 * is within MIN_DIST_FROM_SHOP of the shop.
 *
 * `selected` is the pizza that leaves the bag on Space. It is NOT the GPS
 * target — the GPS routes to the first active pizza in held order
 * (firstActivePizza), and selection never reveals an address. That gap is
 * the memorisation mechanic.
 */
content.pizzas = (() => {
  const W = () => content.world

  const TIPS_MIN = 4
  const TIPS_MAX = 12
  const MIN_DIST_FROM_SHOP = 70

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

  function makeIngredients() {
    const ingPool = app.i18n.pool('ingredients') || ['cheese', 'pepperoni', 'mushroom']
    const funnyPool = app.i18n.pool('funnyIngredients') || []
    const cheese = ingPool.find((x) => /cheese|queso/i.test(x)) || ingPool[0]
    const toppingsCount = Math.random() < 0.5 ? 1 : 2
    const toppings = pickRandomDistinct(ingPool.filter((x) => x !== cheese), toppingsCount)
    const ingredients = [cheese, ...toppings]
    if (Math.random() < 0.25 && funnyPool.length) ingredients.push(pickRandom(funnyPool))
    return ingredients
  }

  function makePizza(candidates, usedAddr, usedLandmarks) {
    let pick = null
    // Prefer an unused landmark; fall back to any unused address.
    const fresh = candidates.filter((c) => !usedAddr.has(c.street + '|' + c.n) && !usedLandmarks.has(c.point.place.landmark))
    const any = candidates.filter((c) => !usedAddr.has(c.street + '|' + c.n))
    pick = fresh.length ? pickRandom(fresh) : (any.length ? pickRandom(any) : null)
    if (!pick) return null
    const baseTip = TIPS_MIN + Math.floor(Math.random() * (TIPS_MAX - TIPS_MIN + 1))
    return {
      ingredients: makeIngredients(),
      addrN: pick.n,
      addrStreet: pick.street,
      building: pick.point.place.landmark,
      get address() { return app.i18n.formatDeliveryAddress(this.building, this.addrN, this.addrStreet) },
      point: pick.point,
      baseTip,
      delivered: false,
      lost: false,
    }
  }

  function generate(count) {
    held = []
    const w = W()
    const shop = w.restaurantPoint()
    const candidates = w.deliverableAddresses().filter((c) =>
      Math.hypot(c.point.x - shop.x, c.point.y - shop.y) >= MIN_DIST_FROM_SHOP)
    const usedAddr = new Set()
    const usedLandmarks = new Set()
    for (let i = 0; i < count; i++) {
      const p = makePizza(candidates, usedAddr, usedLandmarks)
      if (!p) break
      usedAddr.add(p.addrStreet + '|' + p.addrN)
      usedLandmarks.add(p.building)
      held.push(p)
    }
    selected = 0
    return held.slice()
  }

  function select(idx) {
    if (idx < 0 || idx >= held.length) return false
    if (held[idx].delivered || held[idx].lost) return false
    selected = idx
    return true
  }

  function autoSelect() {
    if (held[selected] && !held[selected].delivered && !held[selected].lost) return selected
    for (let i = 0; i < held.length; i++) {
      if (!held[i].delivered && !held[i].lost) { selected = i; return i }
    }
    selected = -1
    return -1
  }

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

  function activePizzas() {
    return held.filter((p) => !p.delivered && !p.lost)
  }

  function markDelivered(idx) { if (held[idx]) held[idx].delivered = true }
  function markLost(idx) { if (held[idx]) held[idx].lost = true }

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
    activePizzas,
    markDelivered,
    markLost,
    firstActivePizza,
    firstActiveIndex,
    clear,
  }
})()
