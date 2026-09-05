/**
 * Pipe — bonus round (manual section 8). Items drop into one of three stereo
 * slots (left/center/right). The player slides left/right to get under the
 * falling item; once lined up a looping beep plays, signalling it's time to
 * cycle up/down through the five sounds to match the item, then ctrl to grab.
 *
 * Audio carries everything: the item sound replays from its slot's pan, the
 * line-up beep confirms position, and cycling auditions each candidate sound.
 * Item value starts at scoring.bonusFirstItem and grows by bonusItemStep each
 * grab. Lasts ~30s; items fall faster as time runs out.
 *
 * content.game delegates onKey()/frame() here while its phase is 'bonus', and
 * we call the onDone(items, points) callback when the timer expires.
 */
content.bonus = (() => {
  const audio = () => content.audio
  const cfg = () => content.config
  const t = (k, p) => app.i18n.t(k, p)

  const NUM_SOUNDS = 5
  const SLOTS = 3
  const DURATION = 30

  const b = {}

  function panForSlot(slot) { return slot - 1 } // 0->-1, 1->0, 2->+1

  function start(diff, onDone) {
    b.diff = diff
    b.onDone = onDone
    b.timeLeft = DURATION
    b.playerSlot = 1
    b.itemsCollected = 0
    b.points = 0
    b.itemActive = false
    b.beeping = false
    b.replayT = 0
    b.intro = 2.0
    audio().bonusIntroJingle()
    app.announce.assertive(t('ann.bonusIntro'))
  }

  function spawnItem() {
    b.itemSlot = Math.floor(Math.random() * SLOTS)
    b.itemSound = Math.floor(Math.random() * NUM_SOUNDS)
    b.matchSound = 0
    b.itemActive = true
    // Fall time shrinks as the round progresses (faster late).
    const prog = 1 - b.timeLeft / DURATION
    b.fallT = engine.fn.lerp(4.5, 1.8, engine.fn.clamp(prog, 0, 1))
    b.replayT = 0
    playItem()
    updateLined()
  }

  function playItem() {
    audio().bonusSound(b.itemSound, panForSlot(b.itemSlot))
  }

  function updateLined() {
    const lined = b.itemActive && b.playerSlot === b.itemSlot
    if (lined && !b.beeping) { audio().startBeep(300, 760, 0); b.beeping = true }
    else if (!lined && b.beeping) { audio().stopBeep(); b.beeping = false }
  }

  function endItem(grabbed) {
    if (b.beeping) { audio().stopBeep(); b.beeping = false }
    b.itemActive = false
    if (grabbed) {
      const sc = cfg().scoring
      const value = sc.bonusFirstItem + sc.bonusItemStep * b.itemsCollected
      b.itemsCollected++
      b.points += value
      audio().bonusGot()
      app.announce.polite(t('ann.bonusGot', {items: b.itemsCollected}))
    }
  }

  function finish() {
    if (b.beeping) { audio().stopBeep(); b.beeping = false }
    b.itemActive = false
    const onDone = b.onDone
    b.onDone = null
    if (onDone) onDone(b.itemsCollected, b.points)
  }

  function onKey(action) {
    if (b.intro > 0) { if (action === 'hammer' || action === 'test') b.intro = 0; return }
    if (!b.itemActive) return
    switch (action) {
      case 'left':
        b.playerSlot = Math.max(0, b.playerSlot - 1)
        audio().cycleTick(1, 3); updateLined(); return
      case 'right':
        b.playerSlot = Math.min(SLOTS - 1, b.playerSlot + 1)
        audio().cycleTick(1, 3); updateLined(); return
      case 'up':
        b.matchSound = (b.matchSound - 1 + NUM_SOUNDS) % NUM_SOUNDS
        audio().bonusSound(b.matchSound, panForSlot(b.playerSlot)); return
      case 'down':
        b.matchSound = (b.matchSound + 1) % NUM_SOUNDS
        audio().bonusSound(b.matchSound, panForSlot(b.playerSlot)); return
      case 'hammer':
        if (b.playerSlot === b.itemSlot && b.matchSound === b.itemSound) endItem(true)
        else audio().testNoFit()
        return
    }
  }

  function frame() {
    const dt = engine.loop.delta()
    if (b.intro > 0) {
      b.intro -= dt
      if (b.intro <= 0) spawnItem()
      return
    }
    b.timeLeft -= dt
    if (b.timeLeft <= 0) return finish()

    if (b.itemActive) {
      b.fallT -= dt
      b.replayT -= dt
      if (b.replayT <= 0) { playItem(); b.replayT = 1.1 }
      if (b.fallT <= 0) { endItem(false); spawnItem() }
    } else {
      // brief gap, then next item
      b.gap = (b.gap || 0.3) - dt
      if (b.gap <= 0) { b.gap = 0.3; spawnItem() }
    }
  }

  return {start, onKey, frame, items: () => b.itemsCollected}
})()
