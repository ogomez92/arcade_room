# Vault — Game Design Document

## One-line pitch

An audio-first, blind-accessible **peg solitaire** puzzle. Vault pegs over one
another to thin the board to a single peg, across an endless ladder of larger,
fuller boards.

## Fantasy & goal

A board of pegs and empty holes. A peg jumps over an orthogonally-adjacent peg
into the empty hole two cells beyond (north / east / south / west); the jumped
peg is removed. Reduce the board to one peg to clear the level. Climb as far as
you can before three boards defeat you.

## Core loop

1. **Aim** the cursor across the board (position tone pans to the column, pitches
   up toward the north; each cell is named as you pass).
2. **Scan** (Space) the four neighbours to hear pegs, holes, the edge, and which
   directions you can jump.
3. **Jump**: select a peg (Enter) then press a direction — or Shift+direction in
   one step. The peg hops toward that compass bearing; the captured peg pops.
4. **Undo** (U) walks back mistakes, within a limited budget.
5. Reduce to one peg → clear the level, climb to a bigger board. Get stuck with no
   undos left → board failed, −1 life.
6. Out of lives → run ends; save your score.

## Audio model (the heart of it)

Screen-locked binaural compass — the listener never rotates. North is always in
front, south behind, east right, west left.

- **Peg solitaire is directional**, so the audio is too. The neighbour scan and
  the jump's hop emit from their true compass bearing. A "jumpable" ping in the
  scan tells you, by direction, where a legal move lies.
- **Cell timbre.** A peg is a warm triangle+sub; an empty hole a soft sine pip;
  the board edge a dull thud. The cursor's position tone pans to its column and
  rises in pitch toward the north.
- A **jump** is a rising pitched arc toward the bearing plus a capture pop for the
  removed peg. Sounds behind you (south) are muffled.

## Solvable boards (no dead ends by construction)

`board.generate` runs the puzzle **backwards**: start from a single seed peg, then
repeatedly un-jump (the exact inverse of a legal jump — peg→empty, and the two
cells in a line become pegs). Reversing that sequence solves the board to one peg,
so every generated board is guaranteed solvable. Difficulty scales the board size
(5×5 → 7×7) and the peg count.

## Difficulty / progression

`levelConfig(level)` grows the board and the number of seeded pegs, and sets the
undo budget (≈ 0.8 × pegs). More pegs on a bigger board = more look-ahead. Undo is
limited so the puzzle keeps stakes; getting stuck with no undos fails the board.

## Scoring

- **Clear a level:** `150 × level`, plus `12 ×` unused undos, plus a centred-last-
  peg bonus of `100 × level`.
- **Each peg removed:** `+10` (reverted on undo, so undo-spam can't farm points).
- **Board failed:** −1 life, retry a fresh board of the same level.
- Leaderboard meta is `level` = how high you climbed.

## Accessibility

Fully playable by ear. Polite/assertive `aria-live` regions narrate moves, undos,
stuck/clear/fail; F1–F4 query state; F2 lists every legal jump (the audio "glance
at the board"). Selection announces the directions a peg can jump. A hidden
`#learn` screen auditions every cue; `#test` verifies the compass. The visual
board is `aria-hidden`.

## Out of scope (possible future work)

- Classic cross-shaped (English 33-hole) board option alongside the rectangle.
- A "no undo" hard mode for a scoring multiplier.
- Daily seeded board shared via the leaderboard.
