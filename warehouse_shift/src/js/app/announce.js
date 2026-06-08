app.announce = (() => {
  let assertive,
    lastAssertive = '',
    lastPolite = '',
    polite

  function ensure() {
    if (!polite) polite = document.querySelector('.a-app--announce')
    if (!assertive) assertive = document.querySelector('.a-app--announce-assertive')
  }

  function write(el, text, last) {
    if (!el) return text

    if (text === last) {
      el.textContent = ''
      window.requestAnimationFrame(() => { el.textContent = text })
    } else {
      el.textContent = text
    }

    return text
  }

  return {
    assertive: function (text) {
      ensure()
      lastAssertive = write(assertive, text, lastAssertive)
      return this
    },
    clear: function () {
      ensure()
      if (polite) polite.textContent = ''
      if (assertive) assertive.textContent = ''
      lastAssertive = ''
      lastPolite = ''
      return this
    },
    polite: function (text) {
      ensure()
      lastPolite = write(polite, text, lastPolite)
      return this
    },
  }
})()
