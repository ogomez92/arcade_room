app.announce = (() => {
  let polite,
    assertive,
    lastPolite = ''

  function ensure() {
    if (!polite) polite = document.querySelector('.a-app--announce')
    if (!assertive) assertive = document.querySelector('.a-app--announce-assertive')
  }

  return {
    assertive: function (text) {
      ensure()
      if (!assertive) return this
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
    polite: function (text) {
      ensure()
      if (!polite) return this
      if (text === lastPolite) {
        polite.textContent = ''
        window.requestAnimationFrame(() => { polite.textContent = text })
      } else {
        polite.textContent = text
      }
      lastPolite = text
      return this
    },
  }
})()
