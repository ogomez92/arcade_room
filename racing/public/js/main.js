// @ts-nocheck — cross-file globals (Car, AI, Track, HUD, Audio, Input, Render,
// Pickups, Bullets, Net, syngen) are attached at script-tag load order, not
// visible to the TS language server in a no-build project.

;(async () => {
  await syngen.ready()

  HUD.init()
  Render.init()

  const TOTAL_LAPS = 3
  const NET_INPUT_HZ = 20          // client → host
  const NET_SNAP_HZ = 15           // host → clients

  let car = Car.create()
  let ais = AI.createAll()

  let phase = 'splash' // splash | lobby | countdown | race | finish | gameover
  let countdown = 0
  let raceTime = 0
  let announceCooldown = 0
  let topSpeed = 0

  // ============ Online state ============
  // When null → single-player. When an object → host or client race.
  //   online.role: 'host' | 'client'
  //   online.selfId, online.selfSlot, online.selfName
  //   online.players: Map<peerId, remotePlayer>   (does not include self)
  //   online.startAt: epoch ms to start countdown (on 'start' message)
  //   online.eventQ: transient events queued for the current frame
  let online = null
  let netInputAcc = 0
  let netSnapAcc = 0
  let pendingShoot = null
  // Single-player: periodic check to inject more AI when the player has
  // lapped the entire field and is effectively alone on the track.
  const SP_BOT_CHECK = 2.0
  const SP_BOT_MAX = 6
  let spBotCheckT = 0

  function isOnline() { return !!online }

  // ============ Remote-player model ============
  // Shaped to work with existing Render.drawOpponent(), HUD.computePosition(),
  // and Audio.updateAiVoices() — so remote players slot straight into the
  // `ais` array with no special case.
  const LANES = [-0.55, 0.55, -0.2, 0.35, -0.4, 0.1]
  function makeRemotePlayer(id, name, slot) {
    return {
      id,
      name: name || `P${slot + 1}`,
      slot,
      color: Net.pickColor(slot),
      index: slot % 3,                    // audio voice slot (0..2)
      x: LANES[slot % LANES.length],
      z: 0,                               // monotonic absolute (like AI)
      zWrap: 0,                           // wrapped 0..Track.length (for host collision test)
      lap: 1,
      speed: 115,
      health: Car.HEALTH_MAX,
      bullets: 0,
      boosting: false,
      offroad: false,
      finished: false,
      finishTime: 0,
      baseLane: LANES[slot % LANES.length],
      _slowT: 0,
    }
  }

  function remoteAsShooter(p) {
    // Host shooter adapter: zAbs is absolute
    return { id: p.id, x: p.x, zAbs: p.z, speed: p.speed }
  }

  function carAsShooter(c) {
    return { id: 'host', x: c.x, zAbs: (c.lap - 1) * Track.length + c.z, speed: c.speed }
  }

  // Create a host-side AI-controlled bot that plugs into the ais array and
  // the network snapshot alongside human players. Bots don't shoot or collect
  // pickups; they drive the track and can be shot/bumped like any target.
  function makeBot(slot) {
    const baseLane = LANES[slot % LANES.length]
    const startZ = 250 + (slot - 1) * 200    // stagger ahead of player
    return {
      id: `bot-${slot}`,
      name: `CPU ${slot}`,
      isBot: true,
      slot,
      color: Net.pickColor(slot),
      index: slot,
      x: baseLane,
      z: startZ,
      zWrap: startZ % Track.length,
      lap: 1,
      speed: 115,
      bullets: 0,
      health: Car.HEALTH_MAX,
      boosting: false,
      offroad: false,
      finished: false,
      finishTime: 0,
      // AI.update state
      baseLane,
      targetX: baseLane,
      weaveT: Math.random() * Math.PI * 2,
      prevZ: 0,
      _slowT: 0,
    }
  }

  function rebuildAis() {
    if (!isOnline()) {
      ais = AI.createAll()
      return
    }
    const humans = Array.from(online.players.values())
    const bots = online.bots || []
    ais = [...humans, ...bots]
  }

  // ============ Single-player setup ============
  function resetRace() {
    car = Car.create()
    if (!isOnline()) {
      ais = AI.createAll()
    } else {
      // Host fills empty slots with bots so there are always 6 racers.
      // Clients auto-discover bots from the first snapshot.
      if (online.role === 'host') {
        const takenSlots = new Set([online.selfSlot])
        for (const p of online.players.values()) takenSlots.add(p.slot)
        const bots = []
        for (let s = 0; s < Net.MAX_PLAYERS; s++) {
          if (!takenSlots.has(s)) bots.push(makeBot(s))
        }
        online.bots = bots
      } else if (!online.bots) {
        online.bots = []
      }
      // Starting positions
      car.x = LANES[online.selfSlot % LANES.length]
      car.z = 40 * (online.selfSlot)
      for (const p of online.players.values()) {
        p.x = LANES[p.slot % LANES.length]
        p.z = 40 * p.slot
        p.zWrap = p.z % Track.length
        p.lap = 1
        p.speed = 115
        p.health = Car.HEALTH_MAX
        p.bullets = 0
        p.finished = false
        p.finishTime = 0
      }
      rebuildAis()
    }
    raceTime = 0
    topSpeed = 0
    spBotCheckT = 0
    Pickups.reset()
    Bullets.reset()
    Mines.reset()
    HUD.hideFinish()
    HUD.hideGameOver()
    Audio.stopDoom()
    Audio.unsilenceCar()
  }

  function itemLabel(t) {
    if (t === 'nitro') return I18n.t('item.nitro')
    if (t === 'mine')  return I18n.t('item.mine')
    if (t === 'decoy') return I18n.t('item.decoy')
    return t
  }

  function onPickupCollected(p) {
    if (p.type === 'health') {
      car.health = Math.min(Car.HEALTH_MAX, car.health + 30)
      HUD.announce(I18n.t('ann.healthPack'))
    } else if (p.type === 'shooter') {
      car.bullets += 3
      HUD.announce(I18n.t('ann.shooter', { n: car.bullets }))
    } else {
      // Item pickups (nitro / mine / decoy) fill a single slot. If the slot
      // is already occupied we refuse the pickup so the player isn't forced
      // to overwrite an item they're saving — but the audio still fires to
      // acknowledge the passthrough.
      if (car.item) {
        HUD.announce(I18n.t('ann.cantCarry', { item: itemLabel(p.type), held: itemLabel(car.item) }))
      } else {
        car.item = p.type
        HUD.announce(I18n.t('ann.acquired', { item: itemLabel(p.type) }))
      }
    }
    Audio.playPickup(p.type)
  }

  function tryUseItem() {
    if (!car.item) return
    const item = car.item
    car.item = null
    if (item === 'nitro') {
      car.nitroT = 2.0
      Audio.playItemActivate('nitro')
      HUD.announce(I18n.t('ann.nitro'), true)
    } else if (item === 'mine') {
      const selfAbs = (car.lap - 1) * Track.length + car.z
      const ownerId = isOnline() ? (online.role === 'host' ? 'host' : online.selfId) : 'local'
      Mines.dropAt(ownerId, car.x, selfAbs)
      Audio.playItemActivate('mine')
      HUD.announce(I18n.t('ann.mineDrop'), true)
      if (isOnline()) {
        if (online.role === 'host') {
          // Already dropped on host's own list.
        } else {
          // Client tells host to drop one at our current position
          Net.send({ t: 'item-mine', x: car.x, zAbs: selfAbs })
        }
      }
    } else if (item === 'decoy') {
      Audio.playItemActivate('decoy')
      HUD.announce(I18n.t('ann.decoyRelease'), true)
      if (!isOnline()) {
        // SP: nothing to dodge (AI doesn't shoot), but play the confirmation
        // so practicing the sound still works.
        Audio.playDecoyClear()
      } else if (online.role === 'host') {
        // Host clears any bullet targeting 'host'
        let cleared = 0
        for (const b of Bullets.getList()) {
          if (b.targetId === 'host') { b.targetId = null; cleared++ }
        }
        if (cleared > 0) Audio.playDecoyClear()
        Net.broadcast({ t: 'event', ev: 'decoy', by: online.selfId })
      } else {
        // Client tells host to clear locks on us and broadcast
        Net.send({ t: 'item-decoy' })
      }
    }
  }

  function tryShoot(direction) {
    if (car.bullets <= 0) return
    if (isOnline()) {
      // Deduct locally (optimistic), queue send; host applies & broadcasts.
      car.bullets -= 1
      pendingShoot = direction
      const panInit = direction === 'left' ? -0.7 : direction === 'right' ? 0.7 : 0
      Audio.playBulletFire(panInit)
      HUD.announce(I18n.t('ann.fired', { dir: I18n.t('dir.' + direction), n: car.bullets }))
      if (online.role === 'host') {
        // Host fires directly in its own sim
        hostFireFromSelf(direction)
        pendingShoot = null
      }
      return
    }
    const ok = Bullets.fire(car, ais, direction)
    if (ok) HUD.announce(I18n.t('ann.fired', { dir: I18n.t('dir.' + direction), n: car.bullets }))
  }

  function startCountdown() {
    phase = 'countdown'
    countdown = 0
    HUD.hideSplash()
    HUD.activate()
    Audio.init()
    Audio.resume()
    HUD.announce(I18n.t('ann.three'), true)
    Audio.playCountdown(3)
    Input.clear()
  }

  function beginRace() {
    phase = 'race'
    Audio.resetCues()
    HUD.announce(I18n.t('ann.go'), true)
  }

  function triggerGameOver() {
    phase = 'gameover'
    Input.clear()
    if (!isOnline()) {
      Pickups.reset()
      Bullets.reset()
      Mines.reset()
    }
    Audio.silenceCar()
    Audio.playDoom()
    const place = HUD.computePosition(car, ais)
    const racers = ais.length + 1
    const lap = Math.min(car.lap, TOTAL_LAPS)
    const lapPct = (car.z / Track.length) * 100
    HUD.showGameOver({
      position: place,
      totalRacers: racers,
      lap,
      totalLaps: TOTAL_LAPS,
      lapPct,
      time: raceTime,
      topSpeed,
    })
    HUD.announce(
      I18n.t('gameover.announce', {
        ordinal: HUD.ordinal(place),
        lap, totalLaps: TOTAL_LAPS,
        pct: Math.round(lapPct),
      }),
      true
    )
  }

  function finishRace() {
    phase = 'finish'
    Input.clear()
    car.finished = true
    car.finishTime = raceTime
    const place = HUD.computePosition(car, ais)
    const racers = ais.length + 1
    HUD.showFinish(place, racers, raceTime)
    HUD.announce(
      I18n.t('finish.announce', {
        ordinal: HUD.ordinal(place),
        total: racers,
        time: raceTime.toFixed(2),
      }),
      true
    )
    Audio.playFinish()
  }

  function handleAnnounceKeys(car, ais) {
    if (Input.wasPressed('F1')) {
      const pos = HUD.computePosition(car, ais)
      HUD.announce(I18n.t('ann.position', { n: pos, total: ais.length + 1 }), true)
    }
    if (Input.wasPressed('F2')) {
      HUD.announce(I18n.t('ann.lapStatus', { n: Math.min(car.lap, TOTAL_LAPS), total: TOTAL_LAPS }), true)
    }
    if (Input.wasPressed('F3')) {
      HUD.announce(I18n.t('ann.speedStatus', { kmh: Math.round(car.speed * 3.6), gear: car.gear }), true)
    }
    if (Input.wasPressed('F4')) {
      HUD.announce(I18n.t('ann.healthStatus', { pct: Math.round(car.health) }), true)
    }
    if (Input.wasPressed('KeyM')) {
      const ctx = syngen.context()
      if (ctx.state === 'running') ctx.suspend(); else ctx.resume()
      HUD.announce(I18n.t(ctx.state === 'running' ? 'ann.muted' : 'ann.unmuted'), true)
    }
  }

  // ============================================================================
  // Online helpers — messages & tick integration
  // ============================================================================

  function hostFireFromSelf(direction) {
    // Caller (tryShoot) has already deducted the bullet and played local SFX.
    const self = carAsShooter(car)
    self._others = Array.from(online.players.values()).map(remoteAsShooter)
    Bullets.fireHost(self, direction)
    Net.broadcast({ t: 'event', ev: 'fire', by: 'host', dir: direction, x: self.x, zAbs: self.zAbs })
  }

  function hostReceiveInput(fromId, msg) {
    const p = online.players.get(fromId)
    if (!p) return
    // Positional & health state (trusted — no anti-cheat)
    if (typeof msg.x === 'number') p.x = msg.x
    if (typeof msg.z === 'number') p.z = msg.z
    if (typeof msg.zWrap === 'number') p.zWrap = msg.zWrap
    if (typeof msg.lap === 'number') p.lap = msg.lap
    if (typeof msg.speed === 'number') p.speed = msg.speed
    if (typeof msg.health === 'number') p.health = msg.health
    if (typeof msg.bullets === 'number') p.bullets = msg.bullets
    p.boosting = !!msg.boosting
    p.offroad = !!msg.offroad

    if (msg.shoot && p.bullets >= 0) {
      // Host simulates the shot for this player
      const shooter = remoteAsShooter(p)
      const others = [carAsShooter(car), ...Array.from(online.players.values())
        .filter(q => q.id !== p.id)
        .map(remoteAsShooter)]
      shooter._others = others
      Bullets.fireHost(shooter, msg.shoot)
      // Audio for everyone: fire sound attributed to this shooter
      Net.broadcast({ t: 'event', ev: 'fire', by: p.id, dir: msg.shoot, x: p.x, zAbs: p.z })
      // Local host plays it too
      applyFireAudio(p.x, p.z, msg.shoot)
    }
  }

  function applyFireAudio(sxAbs, szAbs, dir) {
    // Local car's abs z & x are the listener. Pan by lateral delta.
    const pa = (car.lap - 1) * Track.length + car.z
    const dz = szAbs - pa
    const prox = Math.max(0, 1 - Math.abs(dz) / 2500)
    // Directional offset
    const dirPan = dir === 'left' ? -0.3 : dir === 'right' ? 0.3 : 0
    let pan = (sxAbs - car.x) + dirPan
    pan = Math.max(-1, Math.min(1, pan))
    Audio.playBulletFire(pan * prox)
  }

  function applyHitAudio(targetX, targetZabs) {
    const pa = (car.lap - 1) * Track.length + car.z
    const dz = targetZabs - pa
    const prox = Math.max(0, 1 - Math.abs(dz) / 2500)
    const pan = Math.max(-1, Math.min(1, (targetX - car.x) * prox))
    Audio.playExplosion(pan)
  }

  function applyMissAudio(bx, bzAbs) {
    const pa = (car.lap - 1) * Track.length + car.z
    const dz = bzAbs - pa
    const prox = Math.max(0, 1 - Math.abs(dz) / 2500)
    const pan = Math.max(-1, Math.min(1, (bx - car.x) * prox))
    Audio.playMiss(pan)
  }

  function clientApplySnap(snap) {
    if (!online) return
    const mySelfId = online.selfId
    let gained = false
    for (const sp of snap.players || []) {
      if (sp.id === mySelfId) {
        if (typeof sp.health === 'number') car.health = sp.health
        if (typeof sp.bullets === 'number') car.bullets = sp.bullets
        continue
      }
      let p = online.players.get(sp.id)
      if (!p) {
        // Unknown id — most likely a bot the host filled in at race start.
        p = makeRemotePlayer(sp.id, sp.name || sp.id, sp.slot || 0)
        p.isBot = !!sp.isBot
        online.players.set(sp.id, p)
        gained = true
      }
      p.x = sp.x
      p.z = sp.z
      p.zWrap = sp.zWrap
      p.lap = sp.lap
      p.speed = sp.speed
      p.health = sp.health
      p.bullets = sp.bullets
      p.boosting = !!sp.boosting
      p.offroad = !!sp.offroad
      p.finished = !!sp.finished
    }
    if (gained) rebuildAis()
    Pickups.netApply(snap.pickups || [], car)
    Bullets.netApply(snap.bullets || [], car)
    Mines.netApply(snap.mines || [], car)
  }

  function handleEvent(msg) {
    const ev = msg.ev
    if (ev === 'fire') {
      if (msg.by === online.selfId) return   // don't double-play our own
      applyFireAudio(msg.x, msg.zAbs, msg.dir)
    } else if (ev === 'hit') {
      applyHitAudio(msg.tx, msg.tzAbs)
      if (msg.targetId === online.selfId) {
        const dmg = msg.quality > 0.7 ? 35 : msg.quality > 0.35 ? 18 : 10
        car.health = Math.max(0, car.health - dmg)
        HUD.announce(I18n.t(msg.quality > 0.7 ? 'ann.directHit' : msg.quality > 0.35 ? 'ann.hit' : 'ann.clipped'), true)
      }
    } else if (ev === 'miss') {
      applyMissAudio(msg.x, msg.zAbs)
    } else if (ev === 'pickup') {
      Audio.playPickup(msg.type)
      if (msg.targetId === online.selfId) {
        if (msg.type === 'health') {
          car.health = Math.min(Car.HEALTH_MAX, car.health + 30)
          HUD.announce(I18n.t('ann.healthPack'))
        } else if (msg.type === 'shooter') {
          car.bullets += 3
          HUD.announce(I18n.t('ann.shooter', { n: car.bullets }))
        } else {
          // Item pickup — fill slot if free
          if (car.item) {
            HUD.announce(I18n.t('ann.cantCarry', { item: itemLabel(msg.type), held: itemLabel(car.item) }))
          } else {
            car.item = msg.type
            HUD.announce(I18n.t('ann.acquired', { item: itemLabel(msg.type) }))
          }
        }
      }
    } else if (ev === 'mine-trigger') {
      // Pan from victim's position relative to our car. If we are the victim,
      // apply damage + slow + loud blast.
      const pa = (car.lap - 1) * Track.length + car.z
      const pan = Math.max(-1, Math.min(1, (msg.x - car.x)))
      const prox = Math.max(0, 1 - Math.abs(msg.zAbs - pa) / 2500)
      Audio.playMineExplosion(pan * prox)
      if (msg.victimId === online.selfId) {
        car.health = Math.max(0, car.health - 35)
        car.speed = Math.max(60, car.speed * 0.4)
        HUD.announce(I18n.t('ann.mineTriggered'), true)
      }
    } else if (ev === 'decoy') {
      // Ghost sound: a ghostly descending sweep, played spatially from the
      // activator (if we can locate them). We don't have their exact position
      // in the event, so just play a centered cue — the visual/aural flag is
      // enough to signal "someone released a decoy".
      Audio.playItemActivate('decoy', 0)
      if (msg.by === online.selfId) Audio.playDecoyClear()
    } else if (ev === 'bump') {
      // Play collision sound; if we're one of the two, take a bit of damage
      if (msg.a === online.selfId || msg.b === online.selfId) {
        if (!car._hitCooldown || car._hitCooldown <= 0) {
          car.health -= 6
          car._hitCooldown = 0.5
        }
        Audio.playHit()
      }
    } else if (ev === 'finish') {
      if (msg.id === online.selfId) {
        // Host says we finished — enter finish phase if not already
        if (phase === 'race') {
          car.lap = TOTAL_LAPS + 1
          finishRace()
        }
      }
    } else if (ev === 'gameover') {
      if (msg.id === online.selfId && phase === 'race') {
        car.health = 0
        triggerGameOver()
      }
    } else if (ev === 'start') {
      if (phase === 'lobby') {
        hideLobbyScreens()
        startCountdown()
      }
    } else if (ev === 'peer-leave') {
      // Host lost a client mid-race
      if (msg.id) {
        online.players.delete(msg.id)
        rebuildAis()
      }
    }
  }

  function hostBroadcastSnap() {
    if (!online) return
    const players = [
      {
        id: online.selfId,
        name: online.selfName,
        slot: online.selfSlot,
        x: car.x,
        z: (car.lap - 1) * Track.length + car.z,
        zWrap: car.z,
        lap: car.lap,
        speed: car.speed,
        health: car.health,
        bullets: car.bullets,
        boosting: !!car.boosting,
        offroad: !!car.offroad,
        finished: !!car.finished,
      },
    ]
    for (const p of online.players.values()) {
      players.push({
        id: p.id, name: p.name, slot: p.slot,
        x: p.x, z: p.z, zWrap: p.zWrap, lap: p.lap, speed: p.speed,
        health: p.health, bullets: p.bullets,
        boosting: !!p.boosting, offroad: !!p.offroad,
        finished: !!p.finished,
      })
    }
    for (const b of (online.bots || [])) {
      players.push({
        id: b.id, name: b.name, slot: b.slot, isBot: true,
        x: b.x, z: b.z, zWrap: b.zWrap, lap: b.lap, speed: b.speed,
        health: b.health, bullets: 0,
        boosting: false, offroad: false,
        finished: !!b.finished,
      })
    }
    const snap = {
      t: 'snap',
      time: raceTime,
      phase,
      players,
      pickups: Pickups.snapshot(),
      bullets: Bullets.snapshot(),
      mines: Mines.snapshot(),
    }
    Net.broadcast(snap)
  }

  function sendClientInput() {
    if (!online || online.role !== 'client') return
    const msg = {
      t: 'input',
      x: car.x,
      z: (car.lap - 1) * Track.length + car.z,
      zWrap: car.z,
      lap: car.lap,
      speed: car.speed,
      health: car.health,
      bullets: car.bullets,
      boosting: !!car.boosting,
      offroad: !!car.offroad,
      shoot: pendingShoot || null,
    }
    pendingShoot = null
    Net.send(msg)
  }

  // Host runs pickups/bullets against unified player list + per-frame collision
  function hostSimStep(dt) {
    const bots = online.bots || []
    const selfAbs = (car.lap - 1) * Track.length + car.z

    // Drive bots — classic AI update; they chase the player's z.
    for (const b of bots) {
      AI.update(b, dt, selfAbs)
      // AI.update doesn't maintain zWrap; derive it for collision/audio.
      b.zWrap = ((b.z % Track.length) + Track.length) % Track.length
    }

    // Build shooter list for bullets host update — all targets: humans + bots
    const shooters = [carAsShooter(car)]
    for (const p of online.players.values()) shooters.push(remoteAsShooter(p))
    for (const b of bots) shooters.push(remoteAsShooter(b))

    // Pickups — only humans (+ host) compete for them. Bots don't collect.
    const playerStubs = []
    for (const p of online.players.values()) {
      playerStubs.push({ id: p.id, x: p.x, zAbs: p.z })
    }
    Pickups.updateHost(dt, car, playerStubs, (pickup, who) => {
      const targetId = who.local ? online.selfId : who.id
      if (who.local) {
        if (pickup.type === 'health') car.health = Math.min(Car.HEALTH_MAX, car.health + 30)
        else car.bullets += 3
        HUD.announce(pickup.type === 'health' ? I18n.t('ann.healthPack') : I18n.t('ann.shooter', { n: car.bullets }))
      }
      Audio.playPickup(pickup.type)
      Net.broadcast({ t: 'event', ev: 'pickup', targetId, type: pickup.type })
    })

    // Mines — tested vs. host + every remote
    const remoteCars = []
    for (const p of online.players.values()) remoteCars.push({ id: p.id, x: p.x, zAbs: p.z })
    for (const b of bots) remoteCars.push({ id: b.id, x: b.x, zAbs: b.z })
    Mines.updateHost(dt, car, remoteCars, (mine, victimId) => {
      const pan = (() => {
        if (victimId === 'host') return 0
        const p = online.players.get(victimId) || bots.find(b => b.id === victimId)
        return p ? Math.max(-1, Math.min(1, p.x - car.x)) : 0
      })()
      Audio.playMineExplosion(pan)
      if (victimId === 'host') {
        car.health = Math.max(0, car.health - 35)
        car.speed = Math.max(60, car.speed * 0.4)
        HUD.announce(I18n.t('ann.mineTriggered'), true)
      } else {
        const botVictim = bots.find(b => b.id === victimId)
        if (botVictim) {
          botVictim.health = Math.max(0, botVictim.health - 35)
          botVictim.speed = Math.max(60, botVictim.speed * 0.4)
        }
      }
      const broadcastVictim = victimId === 'host' ? online.selfId : victimId
      Net.broadcast({ t: 'event', ev: 'mine-trigger', victimId: broadcastVictim, x: mine.x, zAbs: mine.zAbs })
    })

    Bullets.updateHost(dt, shooters, selfAbs, {
      onHit: (_b, targetId, quality) => {
        let tx = 0, tzAbs = 0
        if (targetId === 'host') {
          const dmg = quality > 0.7 ? 35 : quality > 0.35 ? 18 : 10
          car.health = Math.max(0, car.health - dmg)
          tx = car.x; tzAbs = selfAbs
          if (quality > 0.7) HUD.announce(I18n.t('ann.directHitTaken'), true)
          else HUD.announce(I18n.t('ann.hitTaken'), true)
        } else {
          const p = online.players.get(targetId)
          if (p) {
            // Human targets: visual flash only; health comes back via client report.
            p._slowT = 2.0 - quality * 1.2
            tx = p.x; tzAbs = p.z
          } else {
            // Bot target — host owns their state, apply damage + slow directly.
            const bot = bots.find(x => x.id === targetId)
            if (bot) {
              const dmg = quality > 0.7 ? 35 : quality > 0.35 ? 18 : 10
              bot.health = Math.max(0, bot.health - dmg)
              bot.speed = Math.max(60, bot.speed * (0.35 + (1 - quality) * 0.5))
              bot._slowT = 2.0 - quality * 1.2
              tx = bot.x; tzAbs = bot.z
            }
          }
        }
        const broadcastTargetId = targetId === 'host' ? online.selfId : targetId
        Net.broadcast({ t: 'event', ev: 'hit', targetId: broadcastTargetId, quality, tx, tzAbs })
        applyHitAudio(tx, tzAbs)
      },
      onMiss: (b) => {
        Net.broadcast({ t: 'event', ev: 'miss', x: b.x, zAbs: b.zAbs })
        applyMissAudio(b.x, b.zAbs)
      },
    })

    // Host-car vs. every other racer (human + bot) — bumps.
    for (const other of ais) {
      const dz = Math.abs(other.z - selfAbs)
      if (dz < 50 && Math.abs(other.x - car.x) < 0.22) {
        const dir = Math.sign(car.x - other.x) || (Math.random() > 0.5 ? 1 : -1)
        car.x += dir * 0.015
        car.speed *= 0.985
        other.speed *= 0.99
        if (!car._hitCooldown || car._hitCooldown <= 0) {
          car.health -= 6
          car._hitCooldown = 0.5
          Audio.playHit()
          HUD.announce(I18n.t('ann.impact'))
        }
        Net.broadcast({ t: 'event', ev: 'bump', a: online.selfId, b: other.id })
      }
    }
    if (car._hitCooldown > 0) car._hitCooldown -= dt

    // Finish / gameover triggers — humans get events, bots handled locally.
    for (const p of online.players.values()) {
      if (!p.finished && p.lap > TOTAL_LAPS) {
        p.finished = true
        p.finishTime = raceTime
        Net.broadcast({ t: 'event', ev: 'finish', id: p.id })
      }
      if (p.health <= 0 && !p._gameover) {
        p._gameover = true
        Net.broadcast({ t: 'event', ev: 'gameover', id: p.id })
      }
    }
    for (const b of bots) {
      if (!b.finished && b.lap > TOTAL_LAPS) {
        b.finished = true
        b.finishTime = raceTime
      }
    }
  }

  // ============================================================================
  // Tick
  // ============================================================================

  const lastT = { t: performance.now() }

  function tick() {
    const now = performance.now()
    let dt = (now - lastT.t) / 1000
    lastT.t = now
    if (dt > 0.1) dt = 0.1
    if (dt < 0) dt = 0

    if (phase === 'splash' || phase === 'lobby') {
      // Menu/lobby handled via DOM.
    } else if (phase === 'countdown') {
      const prev = countdown
      countdown += dt
      if (prev < 1 && countdown >= 1) { HUD.announce(I18n.t('ann.two'), true); Audio.playCountdown(2) }
      if (prev < 2 && countdown >= 2) { HUD.announce(I18n.t('ann.one'), true); Audio.playCountdown(1) }
      if (prev < 3 && countdown >= 3) { Audio.playCountdown(0); beginRace() }
      Render.render(car, ais, Pickups.getList(), Bullets.getList())
      HUD.update(car, ais, TOTAL_LAPS)
      Audio.update(car, dt, ais)
    } else if (phase === 'race') {
      raceTime += dt

      const steer = Input.steer()
      const accel = Input.accel()
      const brake = Input.brake()
      const boost = Input.boost()

      const prevZ = car.z
      const prevCheckpoint = car.checkpoint
      const prevOffroad = car.offroad
      const prevNitroT = car.nitroT

      Car.update(car, dt, steer, accel, brake, boost)

      if (prevNitroT > 0 && car.nitroT === 0) {
        Audio.playNitroEnd(0)
        HUD.announce(I18n.t('ann.nitroSpent'))
      }

      if (car.speed > topSpeed) topSpeed = car.speed

      if (car.health <= 0) {
        triggerGameOver()
      }

      if (!prevOffroad && car.offroad) {
        const side = car.x > 0 ? 'right' : 'left'
        HUD.announce(I18n.t('ann.offTrack', { side: I18n.t('side.' + side) }), true)
      } else if (prevOffroad && !car.offroad) {
        HUD.announce(I18n.t('ann.backOnTrack'))
      }

      const wrapped = prevZ > car.z + Track.length / 2
      if (wrapped) {
        car.lap++
        if (car.lap > TOTAL_LAPS) {
          finishRace()
        } else {
          Audio.playLap()
          HUD.announce(I18n.t('ann.lapDone', { n: car.lap, total: TOTAL_LAPS }))
        }
      }

      const cp = Track.checkpointIndex(car.z)
      if (cp !== prevCheckpoint && !wrapped) {
        car.checkpoint = cp
        Audio.playCheckpoint()
      } else if (wrapped) {
        car.checkpoint = Track.checkpointIndex(car.z)
      }

      if (!isOnline()) {
        // Single-player: AI, classic pickups + bullets
        for (const ai of ais) AI.update(ai, dt, car.z)

        for (const ai of ais) {
          const dz = Track.wrap((ai.z % Track.length) - car.z)
          const near = dz < 50 || dz > Track.length - 50
          if (!near) continue
          if (Math.abs(ai.x - car.x) < 0.22) {
            const dir = Math.sign(car.x - ai.x) || (Math.random() > 0.5 ? 1 : -1)
            car.x += dir * 0.015
            car.speed *= 0.985
            ai.speed *= 0.99
            if (!car._hitCooldown || car._hitCooldown <= 0) {
              car.health -= 6
              car._hitCooldown = 0.5
              Audio.playHit()
              const side = (ai.x - car.x) < 0 ? 'left' : 'right'
              HUD.announce(I18n.t('ann.impactSide', { side: I18n.t('side.' + side) }))
            }
          }
        }
        if (car._hitCooldown > 0) car._hitCooldown -= dt

        Pickups.update(dt, car, onPickupCollected)
        Bullets.update(dt, car, ais,
          (_hitAi, quality) => {
            if (quality > 0.7) HUD.announce(I18n.t('ann.directHit'))
            else if (quality > 0.35) HUD.announce(I18n.t('ann.hit'))
            else HUD.announce(I18n.t('ann.clipped'))
          },
          (b) => {
            HUD.announce(I18n.t('ann.missedSide', { side: I18n.t('dir.' + b.direction) }))
          }
        )
        Mines.update(dt, car, (_mine, victim) => {
          if (victim === 'local') {
            car.health = Math.max(0, car.health - 35)
            car.speed = Math.max(60, car.speed * 0.4)
            Audio.playMineExplosion(0)
            HUD.announce(I18n.t('ann.mineTriggered'), true)
          }
        })

        // Player laps everyone → spawn a fresh bot ahead so the race isn't empty.
        spBotCheckT += dt
        if (spBotCheckT >= SP_BOT_CHECK && ais.length < SP_BOT_MAX) {
          spBotCheckT = 0
          const playerAbsZ = (car.lap - 1) * Track.length + car.z
          // Find the AI with the highest absolute z
          let maxAiZ = -Infinity
          for (const ai of ais) if (ai.z > maxAiZ) maxAiZ = ai.z
          const gap = playerAbsZ - maxAiZ
          // "Super ahead" = about half a track length past every AI. The
          // empty-track feeling kicks in well before a full lap; spawning at
          // half-a-lap keeps the field lively without waiting forever.
          if (gap > Track.length * 0.5) {
            const idx = ais.length
            const newZ = playerAbsZ + 500 + Math.random() * 300
            const newAi = AI.create(idx, {
              startZ: newZ,
              baseLane: AI.LANES ? AI.LANES[idx % 6] : ([-0.55, 0.55, -0.2, 0.35, -0.4, 0.1])[idx % 6],
              speed: 180,
              trackLength: Track.length,
            })
            ais.push(newAi)
            HUD.announce(I18n.t('ann.newChallenger', { n: ais.length + 1 }))
          }
        }

        if (Input.wasPressed('KeyA')) tryShoot('left')
        if (Input.wasPressed('KeyS')) tryShoot('forward')
        if (Input.wasPressed('KeyD')) tryShoot('right')
        if (Input.wasPressed('Space')) tryUseItem()
      } else {
        // ONLINE mode
        // Shoot keys detected here; host fires directly, client sends intent.
        if (Input.wasPressed('KeyA')) tryShoot('left')
        if (Input.wasPressed('KeyS')) tryShoot('forward')
        if (Input.wasPressed('KeyD')) tryShoot('right')
        if (Input.wasPressed('Space')) tryUseItem()

        if (online.role === 'host') {
          hostSimStep(dt)
          // Broadcast snap at NET_SNAP_HZ
          netSnapAcc += dt
          const period = 1 / NET_SNAP_HZ
          if (netSnapAcc >= period) {
            netSnapAcc -= period
            hostBroadcastSnap()
          }
        } else {
          // Client: throttle input sends to NET_INPUT_HZ
          netInputAcc += dt
          const period = 1 / NET_INPUT_HZ
          if (netInputAcc >= period) {
            netInputAcc -= period
            sendClientInput()
          }
          if (car._hitCooldown > 0) car._hitCooldown -= dt
        }

        // Ranking uses `ais` (remote list) — nothing else to do.
      }

      announceCooldown -= dt
      if (announceCooldown <= 0) {
        announceCooldown = 12
      }

      Render.render(car, ais, Pickups.getList(), Bullets.getList())
      HUD.update(car, ais, TOTAL_LAPS)
      Audio.update(car, dt, ais)
      handleAnnounceKeys(car, ais)
    } else if (phase === 'finish') {
      Render.render(car, ais, Pickups.getList(), Bullets.getList())
      HUD.update(car, ais, TOTAL_LAPS)
      Audio.update(car, dt, ais)
      handleAnnounceKeys(car, ais)
    } else if (phase === 'gameover') {
      Render.render(car, ais, Pickups.getList(), Bullets.getList())
      HUD.update(car, ais, TOTAL_LAPS)
    }

    requestAnimationFrame(tick)
  }

  // ============================================================================
  // Net event wiring
  // ============================================================================

  Net.on('peer-join', ({ id, name }) => {
    if (!online || online.role !== 'host') return
    const slot = nextFreeSlot()
    const p = makeRemotePlayer(id, name, slot)
    online.players.set(id, p)
    rebuildAis()
    // Send welcome with player list
    Net.send({
      t: 'welcome',
      id,
      code: online.code,
      selfSlot: slot,
      players: buildLobbyList(),
    }, id)
    // Tell everyone
    Net.broadcast({ t: 'lobby', players: buildLobbyList() })
    refreshLobbyUI()
    HUD.announce(I18n.t('lobby.joined', { name: name || 'Racer' }))
  })

  Net.on('peer-leave', ({ id }) => {
    if (!online) return
    if (online.role === 'host') {
      online.players.delete(id)
      rebuildAis()
      Net.broadcast({ t: 'lobby', players: buildLobbyList() })
      refreshLobbyUI()
      HUD.announce(I18n.t('lobby.left'))
    }
  })

  Net.on('disconnected', () => {
    if (!online) return
    HUD.announce(I18n.t('lobby.disconnected'), true)
    leaveOnline()
  })

  Net.on('error', (err) => {
    console.error('Net error', err)
    const status = document.getElementById('online-join-status')
    if (status) status.textContent = (err && err.message) || I18n.t('lobby.netError')
  })

  Net.on('msg', ({ from, msg }) => {
    if (!online) return
    if (online.role === 'host') {
      if (msg.t === 'hello') {
        // Update the stored name for this peer
        const p = online.players.get(from)
        if (p && msg.name) {
          p.name = String(msg.name).slice(0, 16)
          Net.broadcast({ t: 'lobby', players: buildLobbyList() })
          refreshLobbyUI()
        }
      } else if (msg.t === 'input') {
        hostReceiveInput(from, msg)
      } else if (msg.t === 'item-mine') {
        // Client dropped a mine at their reported position.
        if (typeof msg.x === 'number' && typeof msg.zAbs === 'number') {
          Mines.dropAt(from, msg.x, msg.zAbs)
        }
      } else if (msg.t === 'item-decoy') {
        // Client activated a decoy — clear every bullet locked onto them and
        // tell everybody to play the ghost sound.
        for (const b of Bullets.getList()) {
          if (b.targetId === from) b.targetId = null
        }
        Net.broadcast({ t: 'event', ev: 'decoy', by: from })
      } else if (msg.t === 'bye') {
        online.players.delete(from)
        rebuildAis()
        Net.broadcast({ t: 'lobby', players: buildLobbyList() })
        refreshLobbyUI()
      }
    } else {
      // CLIENT receives from host
      if (msg.t === 'welcome') {
        online.selfSlot = msg.selfSlot
        online.code = msg.code
        // Build remote list from msg.players (excluding self)
        online.players = new Map()
        for (const entry of msg.players) {
          if (entry.id === online.selfId) continue
          online.players.set(entry.id, makeRemotePlayer(entry.id, entry.name, entry.slot))
        }
        rebuildAis()
        refreshLobbyUI()
      } else if (msg.t === 'lobby') {
        // Reconcile player list
        const existing = online.players
        const next = new Map()
        for (const entry of msg.players) {
          if (entry.id === online.selfId) continue
          const p = existing.get(entry.id) || makeRemotePlayer(entry.id, entry.name, entry.slot)
          p.name = entry.name
          p.slot = entry.slot
          p.color = Net.pickColor(entry.slot)
          p.index = entry.slot % 3
          next.set(entry.id, p)
        }
        online.players = next
        rebuildAis()
        refreshLobbyUI()
      } else if (msg.t === 'start') {
        if (phase === 'lobby') {
          resetRace()
          hideLobbyScreens()
          startCountdown()
        }
      } else if (msg.t === 'snap') {
        clientApplySnap(msg)
      } else if (msg.t === 'event') {
        handleEvent(msg)
      }
    }
  })

  function nextFreeSlot() {
    const taken = new Set([online.selfSlot])
    for (const p of online.players.values()) taken.add(p.slot)
    for (let i = 0; i < Net.MAX_PLAYERS; i++) if (!taken.has(i)) return i
    return 0
  }

  function buildLobbyList() {
    const list = [{ id: online.selfId, name: online.selfName, slot: online.selfSlot, isHost: true }]
    for (const p of online.players.values()) {
      list.push({ id: p.id, name: p.name, slot: p.slot, isHost: false })
    }
    return list
  }

  function refreshLobbyUI() {
    const ul = document.getElementById('online-lobby-players')
    if (!ul) return
    const codeEl = document.getElementById('online-lobby-code')
    const title = document.getElementById('online-lobby-title')
    const hint = document.getElementById('online-lobby-hint')
    const startBtn = document.getElementById('online-lobby-start')
    if (online && online.role === 'host') {
      title.textContent = I18n.t('lobby.titleHost')
      codeEl.textContent = I18n.t('lobby.code', { code: online.code })
      const free = Net.MAX_PLAYERS - 1 - online.players.size
      hint.textContent = free > 0
        ? I18n.t('lobby.hintHost', { free })
        : I18n.t('lobby.hintFull')
      startBtn.hidden = false
    } else if (online) {
      title.textContent = I18n.t('lobby.title')
      codeEl.textContent = I18n.t('lobby.code', { code: online.code })
      hint.textContent = I18n.t('lobby.hintClient')
      startBtn.hidden = true
    }
    // Build player rows
    if (online) {
      const rows = []
      const youTag = ' ' + I18n.t('lobby.youTag')
      const hostTag = ' ' + I18n.t('lobby.hostTag')
      const list = online.role === 'host'
        ? buildLobbyList()
        : [
            { id: 'host', name: I18n.t('lobby.host'), slot: 0, isHost: true },
            { id: online.selfId, name: online.selfName + youTag, slot: online.selfSlot, isHost: false },
            ...Array.from(online.players.values()).map(p => ({ id: p.id, name: p.name, slot: p.slot, isHost: false })),
          ]
      for (const entry of list) {
        const label = entry.isHost ? `${entry.name}${hostTag}` : entry.name
        rows.push(`<li>${escapeHtml(label)}<strong>${escapeHtml(I18n.t('lobby.slot', { n: entry.slot + 1 }))}</strong></li>`)
      }
      ul.innerHTML = rows.join('')
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]))
  }

  function leaveOnline() {
    const wasOnline = !!online
    online = null
    ais = AI.createAll()
    Pickups.reset()
    Bullets.reset()
    Mines.reset()
    Net.destroy()
    hideLobbyScreens()
    if (wasOnline) HUD.showSplash()
    phase = 'splash'
    // Focus main menu first item
    const menu = document.getElementById('menu')
    setTimeout(() => {
      const first = menu && menu.querySelector('.menu-item')
      if (first) first.focus()
    }, 30)
  }

  function hideLobbyScreens() {
    for (const id of ['online-name', 'online-join', 'online-lobby']) {
      const el = document.getElementById(id)
      if (el) el.hidden = true
    }
  }

  // Retry buttons on finish/gameover screens
  document.getElementById('gameover-retry').addEventListener('click', () => {
    if (phase !== 'gameover') return
    if (isOnline()) {
      leaveOnline()
    } else {
      resetRace(); startCountdown()
    }
  })
  document.getElementById('finish-retry').addEventListener('click', () => {
    if (phase !== 'finish') return
    if (isOnline()) {
      leaveOnline()
    } else {
      resetRace(); startCountdown()
    }
  })

  // ============ Accessible menu ============
  setupMenu()

  function setupMenu() {
    const splash = document.getElementById('splash')
    const helpDlg = document.getElementById('help')
    const learnDlg = document.getElementById('learn')
    const menu = document.getElementById('menu')
    const learnList = document.getElementById('learn-list')
    const learnDesc = document.getElementById('learn-desc')

    I18n.onChange(() => {
      // Re-render anything dynamic that doesn't carry data-i18n attributes.
      if (!learnDlg.hidden) buildLearnList()
      if (!document.getElementById('online-lobby').hidden) refreshLobbyUI()
      HUD.announce(I18n.t('splash.lang'))
    })
    const nameDlg = document.getElementById('online-name')
    const joinDlg = document.getElementById('online-join')
    const lobbyDlg = document.getElementById('online-lobby')
    const nameInput = document.getElementById('online-name-input')
    const nameMode = document.getElementById('online-name-mode')
    const nameStatus = document.getElementById('online-name-status')
    const codeInput = document.getElementById('online-code-input')
    const joinStatus = document.getElementById('online-join-status')
    const lobbyStartBtn = document.getElementById('online-lobby-start')
    const lobbyLeaveBtn = document.getElementById('online-lobby-leave')

    let pendingNameMode = null   // 'host' | 'join'

    const SOUNDS = [
      { key: 'engine' },
      { key: 'exhaust' },
      { key: 'wind' },
      { key: 'center' },
      { key: 'railLeft' },
      { key: 'railRight' },
      { key: 'offroad' },
      { key: 'aiEngine' },
      { key: 'pickupHealth' },
      { key: 'pickupShooter' },
      { key: 'pickupNitro' },
      { key: 'pickupMine' },
      { key: 'pickupDecoy' },
      { key: 'mineArmed' },
      { key: 'travel' },
      { action: 'edgeTick' },
      { action: 'gearUp' },
      { action: 'gearDown' },
      { action: 'curveLeft' },
      { action: 'curveRight' },
      { action: 'straight' },
      { action: 'checkpoint' },
      { action: 'lap' },
      { action: 'finish' },
      { action: 'countdown3' },
      { action: 'countdown0' },
      { action: 'hit' },
      { action: 'alarm' },
      { action: 'fire' },
      { action: 'explosion' },
      { action: 'miss' },
      { action: 'pickupHealthFx' },
      { action: 'pickupShooterFx' },
      { action: 'pickupNitroFx' },
      { action: 'pickupMineFx' },
      { action: 'pickupDecoyFx' },
      { action: 'nitroActivate' },
      { action: 'nitroEnd' },
      { action: 'mineActivate' },
      { action: 'mineExplode' },
      { action: 'decoyActivate' },
      { action: 'decoyClear' },
    ]
    const soundName = (s) => I18n.t('sound.' + (s.key || s.action))

    let currentDemo = null
    function stopCurrentDemo() {
      if (currentDemo) { try { currentDemo.stop() } catch (_) {} ; currentDemo = null }
    }

    function playSound(s) {
      stopCurrentDemo()
      if (s.key) {
        currentDemo = Audio.playDemo(s.key)
      } else {
        switch (s.action) {
          case 'edgeTick':         Audio.playEdgeTick(0, 0.8); break
          case 'gearUp':           Audio.playGearShift(true); break
          case 'gearDown':         Audio.playGearShift(false); break
          case 'curveLeft':        Audio.playCurveSlide('left'); break
          case 'curveRight':       Audio.playCurveSlide('right'); break
          case 'straight':         Audio.playStraightDoubleBeep(); break
          case 'checkpoint':       Audio.playCheckpoint(); break
          case 'lap':              Audio.playLap(); break
          case 'finish':           Audio.playFinish(); break
          case 'countdown3':       Audio.playCountdown(3); break
          case 'countdown0':       Audio.playCountdown(0); break
          case 'hit':              Audio.playHit(); break
          case 'alarm':            Audio.playAlarm(); break
          case 'fire':             Audio.playBulletFire(0); break
          case 'explosion':        Audio.playExplosion(0); break
          case 'miss':             Audio.playMiss(0); break
          case 'pickupHealthFx':   Audio.playPickup('health'); break
          case 'pickupShooterFx':  Audio.playPickup('shooter'); break
          case 'pickupNitroFx':    Audio.playPickup('nitro'); break
          case 'pickupMineFx':     Audio.playPickup('mine'); break
          case 'pickupDecoyFx':    Audio.playPickup('decoy'); break
          case 'nitroActivate':    Audio.playItemActivate('nitro'); break
          case 'nitroEnd':         Audio.playNitroEnd(0); break
          case 'mineActivate':     Audio.playItemActivate('mine'); break
          case 'mineExplode':      Audio.playMineExplosion(0); break
          case 'decoyActivate':    Audio.playItemActivate('decoy'); break
          case 'decoyClear':       Audio.playDecoyClear(); break
        }
      }
    }

    function buildLearnList() {
      learnList.innerHTML = ''
      SOUNDS.forEach((s, i) => {
        const btn = document.createElement('button')
        btn.className = 'menu-item'
        btn.setAttribute('role', 'option')
        const name = soundName(s)
        btn.setAttribute('aria-label', name)
        btn.textContent = name
        btn.dataset.idx = i
        btn.addEventListener('focus', () => {
          learnDesc.textContent = I18n.t('learn.replay', { name: soundName(s) })
        })
        btn.addEventListener('click', () => playSound(s))
        learnList.appendChild(btn)
      })
    }

    function hideAllOverlays() {
      helpDlg.hidden = true
      learnDlg.hidden = true
      nameDlg.hidden = true
      joinDlg.hidden = true
      lobbyDlg.hidden = true
    }

    function showMenu() {
      stopCurrentDemo()
      hideAllOverlays()
      splash.hidden = false
      splash.style.display = ''
      setTimeout(() => {
        const first = menu.querySelector('.menu-item')
        if (first) first.focus()
      }, 30)
    }
    function showHelp() {
      splash.style.display = 'none'
      helpDlg.hidden = false
      setTimeout(() => helpDlg.focus(), 30)
    }
    function showLearn() {
      splash.style.display = 'none'
      learnDlg.hidden = false
      buildLearnList()
      setTimeout(() => {
        const first = learnList.querySelector('.menu-item')
        if (first) first.focus()
      }, 30)
    }

    function showNameEntry(mode) {
      pendingNameMode = mode
      splash.style.display = 'none'
      hideAllOverlays()
      nameDlg.hidden = false
      nameMode.textContent = I18n.t(mode === 'host' ? 'name.modeHost' : 'name.modeJoin')
      nameStatus.textContent = ''
      const saved = (window.localStorage && localStorage.getItem('woc-name')) || ''
      nameInput.value = saved
      setTimeout(() => nameInput.focus(), 30)
    }

    function showJoinCodeEntry() {
      hideAllOverlays()
      joinDlg.hidden = false
      codeInput.value = ''
      joinStatus.textContent = ''
      setTimeout(() => codeInput.focus(), 30)
    }

    function showLobby() {
      hideAllOverlays()
      lobbyDlg.hidden = false
      refreshLobbyUI()
      setTimeout(() => {
        const focusBtn = online && online.role === 'host' ? lobbyStartBtn : lobbyLeaveBtn
        if (focusBtn) focusBtn.focus()
      }, 30)
    }

    async function submitName() {
      const name = (nameInput.value || '').trim().slice(0, 16) || 'Racer'
      try { localStorage.setItem('woc-name', name) } catch (_) {}
      try { Audio.init(); Audio.resume() } catch (_) {}
      if (pendingNameMode === 'host') {
        nameStatus.textContent = I18n.t('name.creating')
        try {
          const { code } = await Net.hostRoom(name)
          online = {
            role: 'host',
            selfId: Net.myId,
            selfName: name,
            selfSlot: 0,
            code,
            players: new Map(),
          }
          phase = 'lobby'
          HUD.hideSplash()
          showLobby()
          HUD.announce(I18n.t('lobby.created', { code: code.split('').join(' ') }), true)
        } catch (e) {
          nameStatus.textContent = I18n.t('name.cantCreate') + ' ' + ((e && e.message) || I18n.t('name.tryAgain'))
        }
      } else {
        // Ask for code next
        showJoinCodeEntry()
      }
    }

    async function submitJoinCode() {
      const code = (codeInput.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (code.length !== 6) {
        joinStatus.textContent = I18n.t('join.codeLength')
        return
      }
      const name = (nameInput.value || '').trim().slice(0, 16) || 'Racer'
      joinStatus.textContent = I18n.t('join.connecting')
      try { Audio.init(); Audio.resume() } catch (_) {}
      try {
        await Net.joinRoom(code, name)
        online = {
          role: 'client',
          selfId: Net.myId,
          selfName: name,
          selfSlot: 0,
          code,
          players: new Map(),
        }
        phase = 'lobby'
        HUD.hideSplash()
        showLobby()
        HUD.announce(I18n.t('join.joined'))
      } catch (e) {
        joinStatus.textContent = (e && e.message) || I18n.t('join.cantJoin')
      }
    }

    function activateMenuItem(action) {
      try { Audio.init(); Audio.resume() } catch (_) {}
      if (action === 'start') startCountdown()
      else if (action === 'learn') showLearn()
      else if (action === 'help') showHelp()
      else if (action === 'host') showNameEntry('host')
      else if (action === 'join') showNameEntry('join')
      else if (action === 'lang') I18n.toggle()
    }

    menu.querySelectorAll('.menu-item').forEach(btn => {
      btn.addEventListener('click', () => activateMenuItem(btn.dataset.action))
    })

    lobbyStartBtn.addEventListener('click', () => {
      if (!online || online.role !== 'host') return
      Net.broadcast({ t: 'start' })
      resetRace()
      hideAllOverlays()
      startCountdown()
    })
    lobbyLeaveBtn.addEventListener('click', () => {
      leaveOnline()
      showMenu()
    })

    document.addEventListener('keydown', (e) => {
      const menuVis = !splash.hidden && splash.style.display !== 'none'
      const helpVis = !helpDlg.hidden
      const learnVis = !learnDlg.hidden
      const nameVis = !nameDlg.hidden
      const joinVis = !joinDlg.hidden
      const lobbyVis = !lobbyDlg.hidden

      if (helpVis) {
        if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault()
          showMenu()
        }
        return
      }
      if (learnVis) {
        if (e.code === 'Escape') {
          e.preventDefault()
          showMenu()
          return
        }
        const items = Array.from(learnList.querySelectorAll('.menu-item'))
        const idx = items.indexOf(document.activeElement)
        if (e.code === 'ArrowDown') {
          e.preventDefault()
          items[(idx + 1 + items.length) % items.length].focus()
        } else if (e.code === 'ArrowUp') {
          e.preventDefault()
          items[(idx - 1 + items.length) % items.length].focus()
        } else if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault()
          if (idx >= 0) playSound(SOUNDS[idx])
        }
        return
      }
      if (nameVis) {
        if (e.code === 'Escape') {
          e.preventDefault()
          showMenu()
          return
        }
        if (e.code === 'Enter') {
          e.preventDefault()
          submitName()
        }
        return
      }
      if (joinVis) {
        if (e.code === 'Escape') {
          e.preventDefault()
          showMenu()
          return
        }
        if (e.code === 'Enter') {
          e.preventDefault()
          submitJoinCode()
        }
        return
      }
      if (lobbyVis) {
        if (e.code === 'Escape') {
          e.preventDefault()
          leaveOnline()
          showMenu()
          return
        }
        const actions = document.getElementById('online-lobby-actions')
        const items = Array.from(actions.querySelectorAll('.menu-item')).filter(b => !b.hidden)
        const idx = items.indexOf(document.activeElement)
        if (e.code === 'ArrowDown') {
          e.preventDefault()
          if (items.length) items[(idx + 1 + items.length) % items.length].focus()
        } else if (e.code === 'ArrowUp') {
          e.preventDefault()
          if (items.length) items[(idx - 1 + items.length) % items.length].focus()
        } else if (e.code === 'Enter' || e.code === 'Space') {
          if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
            // let button's own click handler fire
            return
          }
        }
        return
      }
      if (menuVis) {
        const items = Array.from(menu.querySelectorAll('.menu-item'))
        const idx = items.indexOf(document.activeElement)
        if (e.code === 'ArrowDown') {
          e.preventDefault()
          items[(idx + 1 + items.length) % items.length].focus()
        } else if (e.code === 'ArrowUp') {
          e.preventDefault()
          items[(idx - 1 + items.length) % items.length].focus()
        } else if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault()
          if (idx >= 0) activateMenuItem(items[idx].dataset.action)
        }
      }
    })

    // Uppercase the code input as user types
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    })

    showMenu()
  }

  requestAnimationFrame(tick)
})()
