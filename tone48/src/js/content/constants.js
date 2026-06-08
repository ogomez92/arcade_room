// Tunables for Meld (audio-first 2048-style slide-and-merge puzzle). One place
// for the board size, spawn odds, and timing.
//
// The board is a square grid of "tones". A move slides every tone toward one of
// the four compass directions; two equal tones that collide MELD into one of
// double the value (one step higher in pitch). After any move that changes the
// board, a new low tone appears. Build the highest tone you can; the run ends
// when the board is full and nothing can meld. A *thinking* (tactical) game.
content.constants = (() => {
  const SIZE = 4
  const FOUR_PROB = 0.1   // a new tone is the small one (2) 90% of the time, else 4

  return {
    SIZE,
    FOUR_PROB,
    OVER_DELAY: 1.6,      // seconds on the game-over sting before the screen
    MAX_SCORE: 1000000,
  }
})()
