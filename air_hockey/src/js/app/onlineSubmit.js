/**
 * Online submission UI helper. Drives a progressive UI:
 *   "Posting your streak…"  →  "Online rank: #N"  or  "Couldn't reach the leaderboard."
 *
 * Shared, game-agnostic: the gameover screen owns the DOM elements and the
 * onlineScores client; this just orchestrates the visible flow + i18n.
 */
app.onlineSubmit = (() => {
  async function run({ name, score, meta, statusEl, linkEl }) {
    if (!app.onlineScores) return null
    if (statusEl) {
      statusEl.textContent = app.i18n.t('online.posting')
      statusEl.dataset.state = 'posting'
      statusEl.hidden = false
    }
    if (linkEl) linkEl.hidden = true
    try {
      const res = await app.onlineScores.submit({ name: name, score: score, meta: meta || {} })
      if (statusEl) {
        statusEl.textContent = app.i18n.t('online.rank', { rank: res.rank })
        statusEl.dataset.state = 'ok'
        statusEl.hidden = false
      }
      if (linkEl) {
        linkEl.href = app.onlineScores.listUrl()
        linkEl.textContent = app.i18n.t('online.viewBoard')
        linkEl.hidden = false
      }
      try { if (app.announce && app.announce.polite) app.announce.polite(app.i18n.t('ann.onlineRank', { rank: res.rank })) } catch (e) {}
      return res
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = app.i18n.t('online.error')
        statusEl.dataset.state = 'error'
        statusEl.hidden = false
      }
      if (linkEl) {
        linkEl.href = app.onlineScores.siteUrl()
        linkEl.textContent = app.i18n.t('online.viewBoard')
        linkEl.hidden = false
      }
      try { if (app.announce && app.announce.polite) app.announce.polite(app.i18n.t('ann.onlineError')) } catch (e) {}
      return null
    }
  }
  return { run }
})()
