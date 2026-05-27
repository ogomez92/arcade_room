app.announce = (() => {
  let polite, assertive, lastPolite = ''

  function ensure() {
    if (!polite) polite = document.querySelector('.a-app--announce')
    if (!assertive) assertive = document.querySelector('.a-app--announce-assertive')
  }

  return {
    polite: function (text) {
      ensure()
      if (!polite || !text) return this
      if (text === lastPolite) {
        polite.textContent = ''
        window.requestAnimationFrame(() => { polite.textContent = text })
      } else {
        polite.textContent = text
      }
      lastPolite = text
      return this
    },
    assertive: function (text) {
      ensure()
      if (!assertive || !text) return this
      assertive.textContent = ''
      window.requestAnimationFrame(() => { assertive.textContent = text })
      return this
    },
    clear: function () {
      ensure()
      if (polite) polite.textContent = ''
      if (assertive) assertive.textContent = ''
      lastPolite = ''
      return this
    },
  }
})()
