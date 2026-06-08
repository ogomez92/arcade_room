# Etch — Game Design Document

## One-line pitch

An audio-first, blind-accessible **nonogram (picross)**. Deduce a hidden grid
from row and column run-length clues, across an endless ladder of bigger boards.

## Fantasy & goal

Every row and column has a clue: the lengths, in order, of the runs of filled
cells (with a gap between runs). From the clues alone you can work out exactly
which cells are filled. Fill them all to complete the hidden picture and clear the
level. Climb as far as you can on three lives.

## Core loop

1. **Move** the cursor over the grid (each cell is named; its position tone pans
   to the column and pitches up toward the top).
2. **Read** a line: Space speaks the row clue and scans the row's current cells
   left-to-right; C does the column top-to-bottom. Combine the two constraints.
3. **Fill** (Enter) a cell you've deduced is filled. **Mark empty** (X) cells you
   know are blank — a free note.
4. A wrong fill is a mistake: it's auto-marked empty and costs a life.
5. Complete the picture → clear the level, climb to a bigger grid.
6. Out of lives → run ends; save your score.

## Audio model (the heart of it)

Stereo + pitch, a fixed frame that never rotates.

- **Column → stereo pan.** Leftmost column in the left ear, rightmost in the
  right; the cursor's position tone places you.
- **Row → pitch.** The top (north) row is high, the bottom low — so a column scan
  descends and you can place a cell vertically by ear.
- **Mark → timbre.** A filled cell is a warm triangle+sub tone; a crossed-off cell
  a short tick; an undecided cell a soft pip.
- **Clue rhythm.** Each run plays as that many quick beats at a rising pitch,
  runs separated by a low tick — an audio echo of the spoken numbers.

## Fair generation (the key invariant)

Wrong fills cost lives, so puzzles must be solvable without guessing. `board.js`:

1. Picks a random solution (≈55% fill).
2. Computes the row/column clues.
3. Runs a constraint-propagation **line solver** from the (initially empty)
   givens. While cells stay ambiguous, it reveals one more true cell as a locked
   "given" and re-solves.
4. Ships the puzzle once the line solver fully determines it — guaranteeing a
   unique, guess-free solution.

In practice 55%-density grids are almost always uniquely line-solvable with zero
givens, so puzzles are non-trivial. The line solver is unit-tested headlessly.

## Difficulty / progression

`levelConfig(level)` grows the grid from 5×5 to 10×10. Bigger grids mean more
lines to cross-reference. Density stays ≈55%.

## Scoring

- **Each correct fill:** `+5` (reverted on un-fill so toggling can't farm).
- **Clear a level:** `120 × level` + `3 × area` + `60 ×` lives remaining (clean,
  mistake-free solves of big boards score most).
- **Mistake:** −1 life, the cell is revealed empty.
- Leaderboard meta is `level` = how high you climbed.

## Accessibility

Fully playable by ear. Polite/assertive `aria-live` regions narrate cells, line
completions, mistakes, and clears; F1–F4 query state and replay clue rhythms; the
per-line read gives clue + current marks together. A hidden `#learn` screen
auditions every cue; `#test` verifies the stereo+pitch mapping. The visual grid is
`aria-hidden`.

## Out of scope (possible future work)

- Rectangular (non-square) boards and themed "pictures."
- An optional auto-cross of a completed line.
- A relaxed "no mistake penalty" practice mode.
