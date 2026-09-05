# Span — Game Design Document

## One-line pitch

An audio-first, blind-accessible **Hashiwokakero ("Bridges")** logic puzzle.
Connect numbered islands with the right bridges, across an endless ladder of
bigger boards.

## Fantasy & goal

Islands sit on a grid, each showing a number. Build bridges — straight,
horizontal or vertical, one or two between a pair — so that every island carries
exactly its number of bridges, no two bridges cross, and all the islands join
into one connected network. Solve the board to climb to a larger one.

## Core loop

1. **Hop** the cursor island-to-island (each island's tone pans to its column and
   pitches up toward the north; it's announced with its number and current count).
2. **Scan** the compass (Space): each of N/E/S/W plays a cue — open water, a
   reachable island with no bridge yet, or 1–2 existing bridges.
3. **Build** bridges: select (Enter) then press a direction to cycle 0→1→2→0, or
   Shift+direction as a shortcut. Each bridge sounds from its true bearing.
4. **Check** F2 to hear which islands still don't carry their number.
5. Match every island's number with all islands connected → solve, climb a level.
6. Overspend the move budget → puzzle failed, −1 life. Out of lives → run ends.

## Audio model (the heart of it)

Screen-locked binaural compass — the listener never rotates. North is always in
front, south behind, east right, west left.

- **Bridges are directional**, so the audio is too. The compass scan and each
  bridge you build emit from their true bearing; the direction a bridge runs is
  the move's meaning, and that is what binaural azimuth encodes.
- **Scan cues per direction:** near-silence (open water, no island), a soft pip
  (a reachable island, no bridge yet), a taut tone (one bridge), a doubled tone
  (two bridges).
- A **bridge** is a taut gliding "cable" toward its direction (doubled for a
  double bridge); removing it slackens downward.
- An island's **position tone** pans to its column and rises in pitch toward the
  top; a soft shimmer on arrival means it already carries exactly its number.

## Solvable boards (the key invariant)

`board.generate` builds a real solution first: seed an island, then repeatedly
attach a new island along a clear line (no crossing, no adjacency) with 1–2
bridges, then add a few extra bridges between aligned islands for cycles. Island
numbers are derived from that network, so a valid solution always exists. Win is
checked against the constraints (every island matches its number AND all
connected), and crossings are prevented at input time — so the player can always
reach a solution, and there is no unfair hidden-solution penalty. The smoke test
applies the stored solution to 144 generated boards and confirms every one clears.

## Difficulty / progression

`levelConfig(level)` grows the grid (7×7 → 11×11) and the island count. More
islands and a denser network mean deeper deduction. The move budget is generous
(`4 ×` the solution's bridge units plus slack) so normal exploration never bites;
only sustained flailing — or a board too hard to crack — exhausts it.

## Scoring

- **Solve a board:** `140 × level` + `8 ×` islands + `5 ×` unused moves (efficient
  solves of bigger boards score most).
- **Fail (out of moves):** −1 life, retry a fresh board of the same level.
- Leaderboard meta is `level` = how high you climbed.

## Accessibility

Fully playable by ear. Polite/assertive `aria-live` regions narrate islands,
bridges, satisfied islands, clears and fails; F1–F4 query state, list unsolved
islands, and describe the current island's surroundings. A hidden `#learn` screen
auditions every cue; `#test` verifies the compass. The visual board is
`aria-hidden`.

## Out of scope (possible future work)

- A solver to guarantee *unique* solutions (currently solvable but possibly
  ambiguous — fine, since win is constraint-based with no hidden-solution penalty).
- A "no move budget" zen mode.
- Larger hand-authored puzzle packs.
