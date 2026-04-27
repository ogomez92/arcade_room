/**
 * Wraps the two ARIA live regions (polite / assertive) and an optional
 * SpeechSynthesis fallback. Anywhere in the codebase wanting to say
 * something to the player calls `content.announcer.say(text, priority?)`.
 */
content.announcer = (() => {
  let politeNode,
    assertiveNode,
    useTts = false,
    lastSaid = '',
    lastSaidAt = 0

  // Swap the same text between two siblings so screen readers re-read repeats.
  const buffers = {
    polite: ['', ''],
    assertive: ['', ''],
  }
  const cursor = {polite: 0, assertive: 0}

  function ready() {
    politeNode = document.getElementById('a-announcer-polite')
    assertiveNode = document.getElementById('a-announcer-assertive')
  }

  function write(node, key, text) {
    if (!node) return
    const i = cursor[key]
    buffers[key][i] = ''
    buffers[key][1 - i] = text
    node.textContent = text
    cursor[key] = 1 - i
  }

  function speak(text) {
    if (!useTts || !window.speechSynthesis) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1.05
      u.volume = 1
      window.speechSynthesis.speak(u)
    } catch (e) {
      // ignore
    }
  }

  return {
    ready,
    setUseTts: (v) => { useTts = !!v },
    /**
     * @param {string} text
     * @param {'polite'|'assertive'} [priority]
     */
    say: function (text, priority = 'polite') {
      if (!text) return this
      const now = Date.now()
      if (text === lastSaid && (now - lastSaidAt) < 250) return this
      lastSaid = text
      lastSaidAt = now

      const node = priority === 'assertive' ? assertiveNode : politeNode
      write(node, priority, text)
      speak(text)
      return this
    },
    clear: function () {
      write(politeNode, 'polite', '')
      write(assertiveNode, 'assertive', '')
      lastSaid = ''
      return this
    },
  }
})()
