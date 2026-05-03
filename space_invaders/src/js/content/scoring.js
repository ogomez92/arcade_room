/**
 * SPACE INVADERS! — scoring + chain logic + life extends.
 *
 * Per the plan:
 *   right weapon kill: BASE × 1.5
 *   wrong weapon kill: BASE × 0.5
 *   far-range hit (z > 0.7): × 1.5
 *   point-blank hit (z < 0.2): × 0.75
 *   chain ×1, ×2, ×3, ×4 multiplier on top
 *   civilian: −500 + 1 life + chain reset
 *   wave clear: +1000 × wave; perfect chain: +2000 × wave extra
 *
 * Life extends: 20k, 60k, 120k, 200k, 300k... (interval grows by 40k
 * each time).
 */
content.scoring = (() => {
  const S = () => content.state
  const A = () => content.audio
  const E = () => content.enemies
  const W = () => content.weapons

  function multiplyByZ(z) {
    if (z > 0.7) return 1.5
    if (z < 0.2) return 0.75
    return 1.0
  }

  function awardScore(amount) {
    const s = S().get()
    if (!s) return
    s.score = Math.max(0, s.score + (amount | 0))
    // Extends — repeatedly to consume any over-shoot in one tick
    while (s.score >= s.nextExtendAt) {
      s.lives += 1
      s.nextExtendAt += s.nextExtendStep
      s.nextExtendStep += 40000
      A().enqueue({type: 'extraLife'})
      try { app.announce.assertive(app.i18n.t('ann.extraLife')) } catch (e) {}
    }
  }

  function onEnemyKill(enemy, weapon) {
    const s = S().get()
    if (!s) return
    const matchup = W().matchup(weapon, enemy.kind)
    const base = E().BASE_SCORE[enemy.kind] || 100
    const weaponMul = matchup === 'right' ? 1.5 : 0.5
    const zMul = multiplyByZ(enemy.z)
    let chainMul = 1
    // Chain logic: only relevant for tagged ships
    if (s.chainTaggingActive && enemy.chainIndex) {
      if (enemy.chainIndex === s.chainExpected && !s.chainBroken) {
        // In-order kill: advance chain. Cap at 5 — matches the
        // 5-note Close Encounters motif served from audio.CHAIN_NOTES.
        s.chainMult = Math.min(5, s.chainMult + 1)
        s.chainExpected = enemy.chainIndex + 1
        chainMul = s.chainMult
        if (s.chainMult > s.bestChainMult) s.bestChainMult = s.chainMult
      } else {
        // Out-of-order: reset chain
        breakChain()
      }
    }
    const points = Math.round(base * weaponMul * zMul * chainMul)
    awardScore(points)
    s.kills += 1
  }

  function onCivilianKill(_enemy) {
    const s = S().get()
    if (!s) return
    awardScore(-500)
    s.civiliansLost += 1
    s.lives -= 1
    breakChain()
    try { app.announce.assertive(app.i18n.flavor('civilianDown')) } catch (e) {}
    if (s.lives <= 0) {
      content.game.requestGameOver('ann.gameOver')
    }
  }

  function onLifeLost() {
    breakChain()
  }

  function breakChain() {
    const s = S().get()
    if (!s) return
    // Always flag the chain broken — even before any in-order kill —
    // so losing a tagged ship at chain[1] still disqualifies the
    // perfect-chain bonus. The auto-announce in game.js gates "Chain
    // broken" on chainMult having been > 1 previously, so this won't
    // produce spurious announces.
    s.chainBroken = true
    s.chainMult = 1
    s.chainExpected = 0  // a fresh chain head will be assigned next wave
  }

  function awardWaveClear(wave) {
    const s = S().get()
    if (!s) return
    // A wave is only "cleared" if the player killed every hostile ship
    // before it reached them. Hostile breakthroughs disqualify the bonus
    // and the celebratory sting — sitting still doesn't count as winning.
    const cleanClear = s.waveShipsReached === 0
    if (!cleanClear) {
      try {
        app.announce.assertive(app.i18n.t('ann.waveSurvived', {ships: s.waveShipsReached}))
      } catch (e) {}
      return false
    }
    const bonus = 1000 * wave
    awardScore(bonus)
    try { app.announce.polite(app.i18n.t('ann.waveClear', {bonus})) } catch (e) {}
    // Perfect chain ⇔ player killed every tagged ship (1..5) in order
    // and never broke. chainExpected advances to enemy.chainIndex+1, so
    // after killing chain[5] in order, chainExpected is 6.
    if (s.chainTaggingActive && !s.chainBroken && s.chainExpected > 5) {
      const perfect = 2000 * wave
      awardScore(perfect)
      try { app.announce.assertive(app.i18n.t('ann.perfectChain', {bonus: perfect})) } catch (e) {}
    }
    return true
  }

  function resetChainForWave() {
    const s = S().get()
    if (!s) return
    s.chainMult = 1
    s.chainExpected = s.chainTaggingActive ? 1 : 0
    s.chainBroken = false
  }

  return {
    awardScore,
    onEnemyKill,
    onCivilianKill,
    onLifeLost,
    breakChain,
    awardWaveClear,
    resetChainForWave,
    multiplyByZ,
  }
})()
