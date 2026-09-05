/**
 * Spoken descriptions of the city, shared by the briefing screen (M) and
 * the driving screen (F3 / F5 / F6 / F7). Everything is rendered fresh
 * from content.world through app.i18n so a locale switch mid-run reads
 * correctly.
 */
app.cityText = (() => {
  const W = () => content.world
  const B = () => content.bike
  const TL = () => content.trafficLights
  const t = (k, p) => app.i18n.t(k, p)

  function joinList(items) {
    return items.map((s) => app.i18n.formatStreet(s)).join(', ')
  }

  // The whole map as a short list of sentences.
  function mapLines() {
    const w = W()
    if (!w.isStarted()) return []
    const edges = w.edges()
    const shop = w.restaurantPoint()
    return [
      t('ann.mapVertical', {list: joinList(w.vertNames())}),
      t('ann.mapHorizontal', {list: joinList(w.horizNames())}),
      t('ann.mapEdges', {
        north: edges.north.name, south: edges.south.name,
        east: edges.east.name, west: edges.west.name,
      }),
      t('ann.mapShop', {street: app.i18n.formatStreet(shop.addrStreet), cross: app.i18n.formatStreet(shop.northStreet)}),
      t('ann.mapNumbers'),
    ]
  }

  function whereAmI() {
    const w = W(), b = B()
    if (!w.isStarted()) return t('ann.whereUnknown')
    const d = w.describeLocation(b.state.x, b.state.y, b.state.dirX, b.state.dirY)
    if (!d) return t('ann.whereUnknown')
    const compass = t(d.compass)
    if (d.kind === 'corner') {
      const parts = [t('ann.whereCorner', {
        streetV: app.i18n.formatStreet(d.streetV),
        streetH: app.i18n.formatStreet(d.streetH),
        compass,
      })]
      for (const c of d.corners) {
        parts.push(t('ann.wherePlace', {label: t('place.' + c.label), place: app.i18n.formatPlace(c.place)}))
      }
      return parts.join(' ')
    }
    const parts = [t('ann.whereBlock', {
      street: app.i18n.formatStreet(d.street),
      compass,
      crossAhead: app.i18n.formatStreet(d.crossAhead),
      crossBehind: app.i18n.formatStreet(d.crossBehind),
      dist: Math.max(5, Math.round(d.distAhead / 5) * 5),
    })]
    if (d.left || d.right) {
      parts.push(t('ann.whereSides', {
        left: app.i18n.formatPlace(d.left) || '—',
        right: app.i18n.formatPlace(d.right) || '—',
      }))
    }
    return parts.join(' ')
  }

  function lightAhead() {
    const b = B(), tl = TL(), w = W()
    const leg = b.currentLeg ? b.currentLeg() : null
    if (!leg || !tl.isStarted()) return t('ann.lightStatusNone')
    const light = tl.lightAt(leg.forward)
    if (!light) return t('ann.lightStatusNone')
    const axis = tl.bikeAxis()
    const st = light.state[axis]
    const cross = (axis === 'h') ? w.vertNameOf(leg.forward.vIdx) : w.horizNameOf(leg.forward.hIdx)
    return t('ann.lightStatus', {
      street: app.i18n.formatStreet(cross),
      dist: Math.max(0, Math.round(leg.dF / 5) * 5),
      state: t(st === 'green' ? 'gps.lightGreen' : st === 'yellow' ? 'gps.lightYellow' : 'gps.lightRed'),
      sec: Math.max(1, Math.round(tl.timeToChange(light, axis))),
    })
  }

  function shopLine() {
    const r = content.game.distanceToRestaurant()
    return t('ann.restaurantDistance', {distance: Math.round(r.dist / 5) * 5, compass: t(r.compass)})
  }

  function briefingIntro() {
    const shop = W().restaurantPoint()
    return t('briefing.intro', {
      address: shop.address,
      north: app.i18n.formatStreet(shop.northStreet),
      south: app.i18n.formatStreet(shop.southStreet),
    })
  }

  return {mapLines, whereAmI, lightAhead, shopLine, briefingIntro}
})()
