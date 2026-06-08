# Decant — Game Design Document

## One-line

An audio-first, blind-accessible **water-sort puzzle**: pour coloured liquid
between vials until each vial is empty or holds a single colour — where every
"colour" is a distinct instrument timbre.

## Pillars

- **Think, don't react.** No timers, no twitch. The whole challenge is planning a
  sequence of pours. Information is always available (re-listen any time) and
  moves are reversible (undo), so failure is only ever a planning failure.
- **Playable purely by ear.** Position is carried by a world-fixed stereo pan;
  colour is carried by timbre. Nothing about a colour changes with where it is.
- **Fair by construction.** The move budget is derived from the board's true
  minimum solution, so every level is winnable by a perfect player.

## Core loop

1. Move the cursor along the row of vials (left/right).
2. Listen — scan a vial to hear its stack bottom→top; the top run is what you can
   pour.
3. Pick up a vial as the **source**, then choose a **destination**. A pour is
   legal if the destination is empty, or its top colour matches the source's top
   and it has room. The top contiguous run pours across (as much as fits).
4. Gather each colour into one vial. When a vial becomes full of one colour it is
   "finished" (a bright pop).
5. Sort every vial before the move budget runs out → level clear, advance.
   Run out first → game over.

Undo takes back the last pour and refunds the move, so experimentation is free of
permanent cost (but costs you nothing-gained if you redo the same thing).

## Difficulty

| Level | Colours | Spare vials | Budget slack (spare moves) |
|------:|--------:|------------:|---------------------------:|
| 1     | 3       | 2           | 9 |
| 2     | 4       | 2           | 8 |
| 3     | 5       | 2           | 7 |
| 4     | 6       | 2           | 6 |
| 5     | 6       | 2           | 5 |
| 6     | 6       | 1           | 4 |
| 7     | 6       | 1           | 3 |
| 8+    | 6       | 1           | 2 |

Colours cap at 6 — six instrument families that are clearly distinguishable by
ear; more would be unfair audio. Past level 4, difficulty comes from one fewer
spare vial and a tighter budget, not more colours. Capacity is always 4.

Budget = `minSolution(board) + slack(level)`. `minSolution` is a BFS over
canonical states computed at level start; because the budget is anchored to a
*real* minimum, every level is always winnable, and the shrinking slack is what
eventually ends a run.

## Audio design

- **Colours = instruments** (fixed pitch each): bell, pluck, marimba, glass, reed,
  bass. The same colour always sounds identical.
- **Position = world-fixed pan.** Vial *i* of *n* pans to `i/(n-1)*2-1`. Leftmost
  is hard left, rightmost hard right, forever. There is no listener rotation.
- **Scan** plays a vial's segments bottom→top, ~140 ms apart, top emphasised.
- **Pour** is the only travelling sound: a liquid whoosh whose pan ramps from the
  source vial to the destination, then the landed colour speaks at the
  destination — so you hear the direction the liquid moved.
- **Finished vial** = a bright two-note pop at that vial's pan.
- Soft sub-bass pad ambience; gentle menu ticks.

## Scoring

- Finishing a colour: `40 × level`.
- Clearing a level: `250 × level + movesLeft × 8` (rewards efficiency — leftover
  moves are worth points).

## Accessibility

- Two `aria-live` regions (polite for routine readouts, assertive for state
  changes). The visual vial row is `aria-hidden`.
- F1 status (score/level/moves), F2 locate (which vial), F3 vials sorted.
- Keyboard and gamepad; no mouse dependency; no colour dependency (colour is
  timbre, and the visual is a redundant convenience).
- `#learn` route to audition the colours and cues; `#test` route to confirm the
  left/right pan.

## Out of scope (for now)

- More than 6 colours, variable capacity, "trap" generators, daily seeds,
  multiplayer. See ROADMAP.
