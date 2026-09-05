// The Sigil: a hidden code of P tones laid out on the compass ring, plus the
// feedback rule and the attempt history. Each ring position is one of the eight
// compass points (north … north-west); the active set for a given P is chosen so
// the simplest sigils use the four cardinals, then fill in the diagonals. The
// board owns the secret, the exact/partial scoring, and the log of past tries;
// game.js owns the player's current guess and the run.
content.board = (() => {
  // The eight compass points: screen offset (north = up = dy-1) + clockwise
  // index (for ring order) + an i18n direction key.
  const POINTS = [
    {key: 'n', dx: 0, dy: -1, cw: 0},
    {key: 'ne', dx: 1, dy: -1, cw: 1},
    {key: 'e', dx: 1, dy: 0, cw: 2},
    {key: 'se', dx: 1, dy: 1, cw: 3},
    {key: 's', dx: 0, dy: 1, cw: 4},
    {key: 'sw', dx: -1, dy: 1, cw: 5},
    {key: 'w', dx: -1, dy: 0, cw: 6},
    {key: 'nw', dx: -1, dy: -1, cw: 7},
  ]
  // Activation priority: cardinals first, then diagonals.
  const PRIORITY = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw']

  let ring = []        // active points, in clockwise ring order
  let P = 0, C = 0
  let code = []        // tone per ring index
  let attempts = []    // [{guess:[...], exact, partial}]

  function init(positions, colors) {
    P = positions
    C = colors
    const active = PRIORITY.slice(0, P).map((k) => POINTS.find((p) => p.key === k))
    active.sort((a, b) => a.cw - b.cw)
    ring = active
    code = []
    for (let i = 0; i < P; i++) code.push(Math.floor(Math.random() * C))
    attempts = []
  }

  // Mastermind scoring with repeats handled correctly:
  //   exact   = positions whose tone matches the code exactly
  //   partial = right tone, wrong point (sum of per-tone min, minus exact)
  function feedback(guess) {
    let exact = 0
    const codeCount = new Array(C).fill(0)
    const guessCount = new Array(C).fill(0)
    for (let i = 0; i < P; i++) {
      if (guess[i] === code[i]) exact++
      codeCount[code[i]]++
      guessCount[guess[i]]++
    }
    let colourMatches = 0
    for (let c = 0; c < C; c++) colourMatches += Math.min(codeCount[c], guessCount[c])
    return {exact, partial: colourMatches - exact}
  }

  function submit(guess) {
    const fb = feedback(guess)
    attempts.push({guess: guess.slice(), exact: fb.exact, partial: fb.partial})
    return fb
  }

  return {
    init,
    feedback,
    submit,
    isWin: (guess) => feedback(guess).exact === P,
    dirOf: (pos) => ({dx: ring[pos].dx, dy: ring[pos].dy}),
    nameOf: (pos) => ring[pos].key,
    positions: () => P,
    colors: () => C,
    attemptCount: () => attempts.length,
    attemptAt: (i) => attempts[i],
    // Diagnostics / headless testing only — never revealed to the player mid-run.
    code: () => code.slice(),
  }
})()
