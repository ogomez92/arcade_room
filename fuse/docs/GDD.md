# FUSE — Game Design Document

## Pitch

An audio-first, blind-accessible **Bomberman** (Hudson Soft lineage). You roam a
tile maze, plant bombs that burst in a + cross after a ticking fuse, blow up soft
walls and roaming enemies — and FLEE your own cross-blast before it catches you.
Clear every enemy on a level to descend to the next, harder one. The signature
mechanic — *you are your own deadliest threat* — exists in no other game in the
collection. Endless, escalating, score chase.

## The audio model (the whole game)

Screen-LOCKED listener on the player's tile, fixed yaw, never rotating: north is
always ahead, east right, south behind, west left. Every source is placed at its
tile offset RELATIVE to you, so as you move the maze re-pans around you.

- **Enemies** each tick a low, menacing "stalk" blip from their direction — louder
  and higher the closer they are. Touching one costs a life, so you track them by
  ear and trap them with bombs.
- **A bomb's fuse** ticks from the tile where it sits, accelerating as it nears
  detonation — so you always hear where the danger is and when it will blow.
- **The danger alarm** — a harsh, rising central klaxon — fires whenever a live
  cross covers YOUR tile. Get off that row or column before it ends. The faster
  the alarm, the closer the blast. This is the core safety cue.
- A detonation booms from its tile; soft walls crumble; enemies pop; a wall-bump
  thud tells you a direction is blocked; power-ups chime.

## Controls

- **Move** — `Arrow keys` / `W A S D` (gamepad dpad): step through the maze.
- **Plant bomb** — `Space` / `Enter` (gamepad A): drop a bomb on your tile.
- `F1` status · `F2` nearest enemy (direction + distance) · `F3` open exits
  around you · `F4` your bomb count + blast size · `Esc` pause.

## Rules & scoring

- **3 lives.** A flame on your tile (your own or a chained bomb's) or an enemy
  touching you costs a life; you respawn at the start corner with brief i-frames.
- **Bombs** detonate after `FUSE_TIME`; the blast is a + cross of `radius` tiles
  per arm, stopped by hard pillars (block) and soft walls (destroyed). A bomb
  caught in a blast chains instantly.
- **Power-ups** hide under some soft walls: extra bomb (capacity), bigger blast
  (radius), more speed. A bigger blast clears more — but reaches you from further.
- **Score:** soft wall 5, enemy 50, power-up 25, a multi-kill bonus for catching
  several enemies in one blast, plus a `100 × level` clear bonus.
- **Clear all enemies** on a level to descend to the next: more enemies, faster
  and more aggressive, in a denser maze. Endless.

## Difficulty curve (the balance knob — `content/constants.js`)

The player moves ~4× faster than base enemies, so early levels are about
manoeuvring and trapping slow, mostly-random enemies; later levels add more
enemies, shrink their step interval, raise their chase aggression, and thicken
the soft-wall fill, until the maze closes in faster than you can out-bomb it.
Headless validation (`/tmp/fuse-sim.js`, a BFS-flee AI that keeps a buffer from
enemies): no crashes, the run is bounded (the AI always eventually dies, 0/24
reach the cap), and progression is winnable — that modest AI clears ~1 level,
kills ~4 enemies, and reaches level 2–4 before dying. A skilled human who
deliberately traps enemies and manages power-ups goes considerably further.

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — top-down 2D, tile-stepped grid movement (queued
   held direction). Continuous real-time loop via the game screen's `onFrame` →
   `content.game.update(delta)`. No continuous physics — everything is tile-exact,
   which keeps blast/collision deterministic and headless-simulatable.
2. **Audio listener — SCREEN-LOCKED (fixed yaw), player-relative.** The listener
   sits on the player's tile with `LISTENER_YAW = Math.PI/2`; every source is
   placed at its tile offset relative to the player, so the maze re-pans as you
   move but never rotates. Screen→audio y-flip per the template gotcha. (Same
   listener mechanics as pacman.)
3. **Audio role — audio-first / blind-accessible.** Playable by ear via enemy
   blips, fuse ticks, the danger alarm, wall-bump feedback, an F-key exit scan,
   and two `aria-live` regions. The maze grid viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless score chase with escalating levels.** FSM screens:
   menu → game ↔ pause, game → gameover → menu; plus help, highscores, language,
   and the hidden `#learn` / `#test` diagnostic routes.
7. **Synth aesthetic — modern / realistic** (menacing enemy stalk-blips, a
   ticking fuse, a harsh rising danger klaxon, a sub-bass detonation, soft-wall
   crumble, enemy-death pop, power-up chimes, a low tense dungeon bed). No retro.

## Possible future work

- **Kick / throw bombs** (a power-up that lets you punt a live bomb down a
  corridor), and **remote detonators** — classic Bomberman depth.
- **A reachable exit** hidden under a soft wall, so a level ends by finding the
  exit after clearing enemies (currently clearing enemies ends the level directly).
