/**
 * content/commentator.js — bilingual fairground barker driving aria-live.
 *
 * Stores {categoryKey, params} events, NEVER rendered strings, so a mid-race
 * locale switch produces the next line in the new locale's own register.
 *
 * Two output regions:
 *   .a-live--polite     — filler, threshold crossings, stamina warnings
 *   .a-live--assertive  — state flips: lead change, finish, photo finish
 *
 * Per CLAUDE.md "re-read identical strings": if the same line wins the random
 * draw twice in a row, we clear the region to '' on a rAF then re-set it so
 * screen readers re-read.
 */
content.commentator = (() => {
  const SILENCE_WINDOW = 0.6        // don't emit two polite lines closer than this
  const FILLER_INTERVAL = 4.0       // if nothing happens for this long, drop filler
  const CATEGORY_COOLDOWN = {       // per-category minimum re-emit gap (s)
    bullseye: 1.2,
    streak: 2.0,
    coldStreak: 4.0,
    tired: 6.0,
    exhausted: 6.0,
    recovering: 6.0,
    gassed: 8.0,
    crowdReact: 5.0,
    suspense: 6.0,
    silly: 12.0,
    weather: 14.0,
    shoutout: 10.0,
    midRace: 9.0,
    lastStretch: 6.0,
    runaway: 5.0,
    bunched: 5.0,
    fightForLead: 4.0,
    leadGrows: 4.0,
    fallsBack: 3.5,
    passes: 1.0,
    takesLead: 1.0,
    win: 0.0,
    photoFinish: 0.0,
    photoFinishCall: 0.0,
    danceOnTheLine: 0.0,
    runnerUp: 0.0,
  }

  let politeEl = null
  let assertiveEl = null
  let lastPoliteAt = -1
  let lastAnyAt = -1
  let lastEmittedByCategory = {}
  let lastRenderedPolite = ''
  let lastRenderedAssertive = ''
  // Per-horse threshold trackers; reset on race reset.
  const horseTrack = new Map()
  let raceProgressNoted = {midRace: false, lastStretch: false}
  let aboutToWinNoted = new Set()
  let lastFiller = null

  function init() {
    politeEl = document.querySelector('.a-live--polite')
    assertiveEl = document.querySelector('.a-live--assertive')
  }

  function reset() {
    horseTrack.clear()
    raceProgressNoted = {midRace: false, lastStretch: false}
    aboutToWinNoted = new Set()
    lastFiller = null
    lastPoliteAt = -1
    lastAnyAt = -1
    lastEmittedByCategory = {}
    if (politeEl) politeEl.textContent = ''
    if (assertiveEl) assertiveEl.textContent = ''
    lastRenderedPolite = ''
    lastRenderedAssertive = ''
  }

  // External event hook: anything in the game that *knows* a state changed
  // can fire a commentator event with category + params.
  function event(category, opts = {}) {
    if (!politeEl) init()
    const tone = opts.tone || 'polite'
    const params = opts.params || extractParams(opts)
    const cooldown = CATEGORY_COOLDOWN[category] != null ? CATEGORY_COOLDOWN[category] : 1.0
    const t = engine.time()
    const lastAt = lastEmittedByCategory[category] || -Infinity
    if (cooldown > 0 && t - lastAt < cooldown) {
      return
    }
    if (tone === 'polite' && t - lastPoliteAt < SILENCE_WINDOW) {
      return
    }
    speak(category, params, tone)
    // Relay to MP clients: piggy-back on the race's pendingEvents queue.
    // __replay flag set by client-side replayEvent prevents the relay from
    // re-pushing on the receiving side.
    if (!opts.__replay) {
      try {
        if (content.race && typeof content.race.pushEvent === 'function') {
          content.race.pushEvent({
            kind: 'commentary',
            category,
            params: Object.assign({}, params),
            tone,
          })
        }
      } catch (e) {}
    }
  }

  // Per-frame scheduler. Watches race state for threshold crossings and
  // schedules filler when nothing important has happened recently.
  function frame() {
    if (!politeEl) init()
    const race = content.race
    if (!race) return
    const status = race.getStatus()
    if (!status || status.state !== 'running') return

    const t = engine.time()

    // Stamina thresholds and streaks per horse.
    for (const h of status.horses) {
      const tr = trackerFor(h)
      const stam = h.stamina
      // Bucket: fresh / mid / low / empty, with hysteresis bands so a horse
      // hovering on a threshold doesn't ping-pong "tired"/"recovering" lines.
      const cur = tr.lastStaminaBucket
      let bucket = cur
      if (cur === 'fresh') {
        if (stam <= 0.55) bucket = 'mid'
      } else if (cur === 'mid') {
        if (stam >= 0.65) bucket = 'fresh'
        else if (stam <= 0.25) bucket = 'low'
      } else if (cur === 'low') {
        if (stam >= 0.35) bucket = 'mid'
        else if (stam <= 0.08) bucket = 'empty'
      } else if (cur === 'empty') {
        if (stam >= 0.18) bucket = 'low'
      }

      if (bucket !== tr.lastStaminaBucket) {
        if (bucket === 'low') {
          event('tired', {tone: 'polite', name: race.nameOf(h)})
        } else if (bucket === 'empty') {
          event('exhausted', {tone: 'polite', name: race.nameOf(h)})
        } else if (tr.lastStaminaBucket === 'low' || tr.lastStaminaBucket === 'empty') {
          if (bucket === 'mid' || bucket === 'fresh') {
            event('recovering', {tone: 'polite', name: race.nameOf(h)})
          }
        }
        tr.lastStaminaBucket = bucket
      }

      if (h.streak >= 8 && tr.lastStreakNoted < 8) {
        event('streak', {tone: 'polite', name: race.nameOf(h), n: 8})
        tr.lastStreakNoted = 8
      } else if (h.streak >= 5 && tr.lastStreakNoted < 5) {
        event('streak', {tone: 'polite', name: race.nameOf(h), n: 5})
        tr.lastStreakNoted = 5
      } else if (h.streak >= 3 && tr.lastStreakNoted < 3) {
        event('streak', {tone: 'polite', name: race.nameOf(h), n: 3})
        tr.lastStreakNoted = 3
      } else if (h.streak === 0 && tr.lastStreakNoted >= 3) {
        event('streakBreak', {tone: 'polite', name: race.nameOf(h)})
        tr.lastStreakNoted = 0
      }

      // Bullseye: any hit on lane 4 (value 8). Throttle by per-horse cooldown.
      if (h.lastHitValue >= 8 && tr.lastBullseyeAt + 1.5 < t) {
        event('bullseye', {tone: 'polite', name: race.nameOf(h)})
        tr.lastBullseyeAt = t
      }
    }

    // Race-progress filler.
    if (!raceProgressNoted.midRace && status.progress > 0.45 && status.progress < 0.55) {
      event('midRace', {tone: 'polite'})
      raceProgressNoted.midRace = true
    }
    if (!raceProgressNoted.lastStretch && status.progress > 0.78) {
      event('lastStretch', {tone: 'polite'})
      raceProgressNoted.lastStretch = true
    }

    // About-to-win on the leader within 5% of the finish. Track per-horse so
    // a late lead change still gets its dramatic call.
    const ranked = status.horses.slice().sort((a, b) => b.distance - a.distance)
    const leader = ranked[0]
    if (leader && !aboutToWinNoted.has(leader.id)
        && leader.distance > status.trackLength * 0.95
        && leader.finishedAt == null) {
      event('aboutToWin', {tone: 'assertive', name: race.nameOf(leader)})
      aboutToWinNoted.add(leader.id)
    }

    // Bunched / runaway detection.
    if (ranked.length >= 2 && leader.finishedAt == null) {
      const gap = ranked[0].distance - ranked[1].distance
      if (gap > status.trackLength * 0.18) {
        event('runaway', {tone: 'polite', name: race.nameOf(leader)})
      } else if (gap < status.trackLength * 0.04 && ranked.length >= 3
        && (ranked[2].distance > ranked[0].distance - status.trackLength * 0.05)) {
        event('bunched', {tone: 'polite'})
      } else if (gap < status.trackLength * 0.03) {
        event('fightForLead', {tone: 'polite', name: race.nameOf(ranked[0]), other: race.nameOf(ranked[1])})
      }
    }

    // Filler when quiet.
    if (t - lastAnyAt > FILLER_INTERVAL) {
      const choice = pickFiller(status)
      if (choice) event(choice, {tone: 'polite'})
    }
  }

  function pickFiller(status) {
    if (status.progress > 0.78) return Math.random() < 0.5 ? 'lastStretch' : 'crowdReact'
    if (status.progress > 0.45 && status.progress < 0.55) return 'midRace'
    const base = ['crowdReact', 'suspense', 'silly', 'weather', 'shoutout']
    // Drop the most-recent filler so consecutive draws don't pick it again
    // and get silently swallowed by the per-category cooldown.
    const pool = base.filter((c) => c !== lastFiller)
    const pick = pool[Math.floor(Math.random() * pool.length)]
    lastFiller = pick
    if (pick === 'shoutout') {
      const horses = status.horses
      const h = horses[Math.floor(Math.random() * horses.length)]
      // Mutate caller params via setShoutoutTarget — done inline:
      lastShoutoutHorse = h
    }
    return pick
  }

  let lastShoutoutHorse = null

  // --- speak ----------------------------------------------------------------

  function speak(category, params, tone) {
    if (!politeEl) init()
    const t = engine.time()
    let p = Object.assign({}, params || {})
    // For shoutouts picked by filler, fill in the random horse name.
    if (category === 'shoutout' && p.name == null && lastShoutoutHorse) {
      p.name = content.race.nameOf(lastShoutoutHorse)
    }
    const text = app.i18n.pick('commentary.' + category, p) || ''
    const region = (tone === 'assertive') ? assertiveEl : politeEl
    if (!region || !text) return

    if (tone === 'assertive') {
      writeWithReread(region, text, 'assertive')
    } else {
      writeWithReread(region, text, 'polite')
      lastPoliteAt = t
    }
    lastEmittedByCategory[category] = t
    lastAnyAt = t
  }

  function writeWithReread(el, text, tone) {
    const last = (tone === 'assertive') ? lastRenderedAssertive : lastRenderedPolite
    const apply = () => {
      el.textContent = text
      if (tone === 'assertive') lastRenderedAssertive = text
      else lastRenderedPolite = text
    }
    if (text === last) {
      // Force re-read.
      el.textContent = ''
      requestAnimationFrame(apply)
    } else {
      apply()
    }
  }

  function trackerFor(horse) {
    let tr = horseTrack.get(horse.id)
    if (!tr) {
      tr = {
        lastStaminaBucket: 'fresh',
        lastStreakNoted: 0,
        lastBullseyeAt: -Infinity,
      }
      horseTrack.set(horse.id, tr)
    }
    return tr
  }

  function extractParams(opts) {
    const p = {}
    for (const key of Object.keys(opts)) {
      if (key === 'tone' || key === 'params') continue
      p[key] = opts[key]
    }
    return p
  }

  // Direct-write API for non-commentary cues (status hotkeys, menu echoes).
  function announce(text, tone) {
    if (!politeEl) init()
    const region = (tone === 'assertive') ? assertiveEl : politeEl
    if (!region) return
    writeWithReread(region, text, tone || 'polite')
  }

  return {
    init,
    reset,
    event,
    frame,
    announce,
  }
})()
