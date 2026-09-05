# Sow — Game Design Document

## One-line pitch

An audio-first, blind-accessible **Mancala (Kalah)** against an endless ladder of
ever-stronger AI opponents. Sow seeds around the pits and bank more than the
machine. A thinking game: nothing moves until you move.

## Fantasy & goal

You have six pits in front of you (four seeds each) and a store to your right; the
machine has six pits behind you and a store to its left. Sow a pit — its seeds
drop one per pit counterclockwise. Land your last seed in your store to go again;
land it in an empty pit on your side to capture the pit opposite. When a side
empties, each player banks their own remaining seeds; the larger store wins.

## Core loop

1. **Move** along your six pits (each announced with its seed count, sounding
   from its place in front of you).
2. **Sow** (Enter): seeds travel counterclockwise around the ring — you hear each
   one land, one pluck per pit, sweeping around your head.
3. Watch for the two payoffs: a seed in your **store** = extra turn (chain them);
   a seed in an **empty pit on your side** = capture the opposite pit.
4. **Read** the board any time: scan the ring (Space), count a pit (C), or query
   the stores / your pits / the machine's pits (F2–F4).
5. The machine answers (its sweep comes from behind you). First to strand a side
   triggers the bank-and-compare; the larger store wins.
6. Win → climb a level. Lose → −1 life. Tie → small points, replay. Out of lives →
   run ends.

## Audio model (the heart of it)

Screen-locked binaural — the listener never rotates. The 14 board cells ring the
listener: your six pits across the FRONT, your store to the RIGHT, the machine's
six pits across the BEHIND, its store to the LEFT.

- **The sow sweep** is the signature. Because sowing is counterclockwise, the
  dropped seeds trace a continuous loop around the head: front-left → front-right
  → right store → behind-right → behind-left → left store → back to front. One
  soft marimba pluck per pit; a warmer note when a seed drops in a store. Your
  sweeps start in front; the machine's start behind you (and are muffled).
- **Capture** is a scoop from the landing pit and the opposite pit, then a bright
  chime as the seeds bank. **Extra turn** is a quick rising tone.
- **Scan** sweeps the whole ring, each pit's pitch rising with its seed count.
  **Count** plays one tick per seed from the pit's position.

## Difficulty / progression

The board is always Kalah(6,4). Each level raises the OPPONENT, not the board:
`aiParams(level)` increases minimax depth (2 → 8 cap) and lowers a "mistake"
probability (0.5 → 0). The minimax threads Mancala's extra-turn rule (a sow into
your own store recurses as the same side), so it values chains and captures.
Tiers: Novice → Adept → Expert → Master → Grandmaster. You always move first.

## Scoring

- **Win:** `120 × level` plus a margin bonus (`5 ×` how many more seeds you
  banked).
- **Tie:** `round(120 × level × 0.3)`, replay the tier.
- **Loss:** no points, −1 life.
- Leaderboard meta is `level` = how high you climbed.

## Accessibility

Fully playable by ear. Polite/assertive `aria-live` regions narrate turns, sows,
captures, extra turns, and results; F1–F4 query state, stores, and both players'
pits; Space/C read the board. A hidden `#learn` screen auditions every cue;
`#test` verifies the ring (front/right/behind/left). The visual board is
`aria-hidden`.

## Out of scope (possible future work)

- Alternate rulesets (Oware capture rules, empty-capture variants).
- Online human-vs-human via the collection's PeerJS pattern.
- A deeper endgame search via a transposition table.
