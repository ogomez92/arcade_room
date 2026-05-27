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
      const result = await app.onlineScores.submit({
        name,
        score,
        meta: meta || {},
      })

      if (statusEl) {
        statusEl.textContent = app.i18n.t('online.rank', {rank: result.rank})
        statusEl.dataset.state = 'ok'
        statusEl.hidden = false
      }
      if (linkEl) {
        linkEl.href = app.onlineScores.listUrl()
        linkEl.textContent = app.i18n.t('online.viewBoard')
        linkEl.hidden = false
      }
      try { app.announce.polite(app.i18n.t('ann.onlineRank', {rank: result.rank})) } catch (e) {}
      return result
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
      try { app.announce.polite(app.i18n.t('ann.onlineError')) } catch (err) {}
      return null
    }
  }

  return {run}
})()
