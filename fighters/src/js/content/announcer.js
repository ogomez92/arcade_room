/**
 * ARIA live region wrapper. Polite for routine status (hits, dodges,
 * combos); assertive for state changes (round start, KO, low HP). Matches
 * the pattern shared across the game collection — see CLAUDE.md "Two
 * regions, polite and assertive."
 *
 * The two-buffer ping-pong below is what lets identical strings re-fire
 * (otherwise a screen reader swallows back-to-back duplicates).
 */
content.announcer = (() => {
  let politeNode, assertiveNode
  let lastSaid = '', lastSaidAt = 0
  const buffers = {polite: ['', ''], assertive: ['', '']}
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

  return {
    ready,
    say: function (text, priority) {
      if (!politeNode) ready()
      if (!text) return
      priority = priority || 'polite'
      const t = Date.now()
      if (text === lastSaid && (t - lastSaidAt) < 200) return
      lastSaid = text
      lastSaidAt = t
      const node = priority === 'assertive' ? assertiveNode : politeNode
      write(node, priority, text)
    },
    clear: function () {
      if (politeNode) write(politeNode, 'polite', '')
      if (assertiveNode) write(assertiveNode, 'assertive', '')
      lastSaid = ''
    },
  }
})()
