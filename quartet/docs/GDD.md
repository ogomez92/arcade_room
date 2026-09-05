# Quartet — Game Design Document

## One-line pitch

An audio-first, blind-accessible **four-in-a-row** (Connect Four) against an
endless ladder of ever-stronger AI opponents. A thinking game: nothing moves
until you move.

## Fantasy & goal

Seven columns stand left to right in front of you. Drop a sounding disc into a
column; it falls to the lowest free slot. Align four of your discs in a line —
horizontal, vertical, or diagonal — to win the game and climb to a tougher
opponent. The machine is trying to do the same to you. Climb as high as you can
before it beats you three times.

## Core loop

1. **Aim** left/right across the seven columns (each step previews the landing
   slot: panned to the column, pitched to its height).
2. **Read** the board when you need to — scan a column bottom-to-top, sweep the
   whole board's skyline, or ask for an immediate-threats analysis.
3. **Drop** a disc.
4. The opponent thinks for a beat and answers.
5. First to connect four wins the game. Win → climb a level. Lose → lose a life
   and replay the level. Draw → small points, replay the level.
6. Out of lives → run ends; save your score.

## Audio model (the heart of it)

- **Column → stereo pan.** Column 1 is hard left, column 4 dead centre, column 7
  hard right. The board never rotates, so left is always left.
- **Row → pitch (+ brightness).** A disc near the bottom is low; near the top it
  is high and bright. Lets you hear how full a column is.
- **Owner → timbre.** Your discs are a warm triangle+octave; the machine's are a
  darker filtered saw with a metallic partial.
- A **drop** glides from a high pitch down to its landing pitch and ends in an
  impact clack — you hear it fall and seat.

## Difficulty / progression

The board is always classic 7×6. Each level raises the OPPONENT, not the board:
`aiParams(level)` increases negamax search depth (1 → 6 cap) and lowers a
"mistake" probability (0.6 → 0). Early tiers blunder and are easy; high tiers
play near-optimally. Tiers are named Novice → Adept → Expert → Master →
Grandmaster. You always move first.

## Scoring

- **Win:** `100 × level` plus an efficiency bonus (the fewer of your own discs it
  took, the more it pays — a clean 4-disc win is best).
- **Draw:** `round(100 × level × 0.3)`, replay the level.
- **Loss:** no points, −1 life.
- Leaderboard meta is `level` = how high you climbed.

## Accessibility

Fully playable by ear. Polite/assertive `aria-live` regions narrate turns, drops,
wins/losses; status hotkeys F1–F4 query state at any time; F2 gives the audio
equivalent of glancing at the board (where you can win, where you must block). A
hidden `#learn` screen auditions every cue; `#test` verifies the stereo+pitch
mapping. The visual board is `aria-hidden` and exists only for sighted players.

## Out of scope (possible future work)

- Alternating who moves first per level (would make even levels a defensive
  survival test; needs an AI-first opening to stay fair).
- Online multiplayer (the collection's PeerJS pattern would fit a head-to-head
  variant).
- A "hard mode" that hides the F2 threats assist for a scoring multiplier.
