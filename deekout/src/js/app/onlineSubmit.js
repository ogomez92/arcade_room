// Thin UI wrapper around app.onlineScores.submit that drives a status line
// and a "view leaderboard" link, and falls back gracefully (local-only)
// when the service is unreachable or the game id is not yet registered.
app.onlineSubmit = (() => {
  async function run({name, score, meta, statusEl, linkEl}) {
    if (!app.onlineScores) return null
    if (statusEl) {
      statusEl.textContent = app.i18n.t('online.posting')
      statusEl.dataset.state = 'posting'
      statusEl.hidden = false
    }
    if (linkEl) linkEl.hidden = true
    try {
      const res = await app.onlineScores.submit({name, score, meta: meta || {}})
      if (statusEl) {
        statusEl.textContent = app.i18n.t('online.rank', {rank: res.rank})
        statusEl.dataset.state = 'ok'
        statusEl.hidden = false
      }
      if (linkEl) {
        linkEl.href = app.onlineScores.listUrl()
        linkEl.textContent = app.i18n.t('online.viewBoard')
        linkEl.hidden = false
      }
      app.announce.polite(app.i18n.t('ann.onlineRank', {rank: res.rank}))
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
      app.announce.polite(app.i18n.t('ann.onlineError'))
      return null
    }
  }
  return {run}
})()
