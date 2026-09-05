# DELVE — Game Design Document

## Pitch

An audio-first, blind-accessible **dungeon-crawl shooter** (Gauntlet lineage). You
crawl a dungeon floor, shoot the monster hordes streaming from GENERATORS, grab
FOOD to fight a continuously draining health clock, and race for the EXIT to
descend. Health *is* your life — when it hits zero the run ends. Endless descent;
score = how deep you get. Distinct from the collection's fixed shooter (salvo),
tank game (tread), and maze games via the **health-drain clock + generators +
descent** combo.

## The audio model (the whole game)

SCREEN-LOCKED, player-relative binaural: the listener rides you at a fixed yaw —
north always ahead, east right, south behind, west left — and never rotates.
Sources sit at their tile offset relative to you.

- **Exit beacon** — a bright tick from the *next BFS step* toward the way down
  (pathfound through the dungeon, like Pac-Man's radar). Follow it to descend.
- **Monsters** blip from their bearing (faster + louder as they near).
- **Generators** throb from their position (kill them to stem the stream).
- **Food** rings warm and stays audible at any range (`normalize` gain).
- **Your heartbeat** is the health bar — it races as your health falls.

## Controls

- **Arrow keys / WASD** — move and face (absolute: Up = north).
- **Space** — fire a bolt the way you face (kills the first monster, or chips a
  generator, in that line).
- `F1` status · `F2` exit direction · `F3` nearest monster · `F4` health + nearest
  generator/food · `Esc` pause.

## Rules & scoring

- **Health is your life.** It drains continuously (`drainRate`, rising per floor)
  and drops `CONTACT_DMG` whenever a monster is next to you (each on its own
  `CONTACT_CD`). FOOD restores `FOOD_HEAL`. At 0 health the run ends — there are
  no separate lives.
- Generators (`GEN_HP` bolts to destroy) spawn monsters forever up to `enemyCap`;
  destroy them to thin the horde, or just rush the exit.
- Score = `KILL_POINTS` per monster, `GEN_POINTS` per generator, `FOOD_POINTS` per
  food, plus `levelBonus(floor)` each descent. **Endless** — there is no winning,
  only how deep you delve.

## Difficulty curve (the balance knob — `content/constants.js`)

`levelConfig(level)` raises the generator count + spawn rate, the horde cap, the
monster speed, and — the bound — the **health drain rate**, while food per floor
stays flat. So the deeper you go, the harder it is to stay ahead of the clock; the
drain is the structural bound (it reliably overwhelms eventually regardless of
luck). Headless validation (`/tmp/delve-sim.js`, an AI that BFS-routes to the exit,
detours to food when low, shoots aligned monsters before they chip it + generators
when clear, with shot reliability + a small move-mistake rate scaled by skill):
runs are **bounded** (0/40 reach the cap — the drain always wins), **winnable**
(descends ~15 floors, ~70–80 s), with a monotonic **skill→score gradient** (~16.5k
→ 21k → 24k, ~1.45×; kills 18 → 20 → 23, floors 14.6 → 16.1 → 17.2). A dungeon
crawl is inherently run-variant (a great rush or an early swarm), so the spread is
wide; a human's skill range — routing, when to clear vs rush, food + health
management, accurate shooting — is wider than the sim's single shot-reliability knob.

### Design notes worth keeping (hard-won)

The first balance pass was bounded + winnable but **non-monotonic and very swingy**
(floor 1–35): score was dominated by floor-count, which a rush-the-exit strategy
makes luck-driven, and chip damage was too light for shooting-skill to register.
Three tunes fixed it: **(1)** gentler early floors + a cleaner maze
(`WALL_DENSITY` 0.06) so early deaths come from the *drain* not spawn-pin luck →
less variance; **(2)** a steeper drain so depth is drain-gated (consistent) rather
than chip-luck-gated; **(3)** heavier monster contact (`CONTACT_DMG` 13) so killing
the horde — the skill axis — clearly pays, sharpening the gradient from ~1.2× to
~1.45×. Weighting `levelBonus` down (120/floor) also keeps score reflecting
engagement, not just rush depth.

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — top-down 2D tile grid; move + face + shoot.
   Continuous loop via the game screen's `onFrame` → `game.update(delta)`.
2. **Audio listener — SCREEN-LOCKED, player-relative binaural (fixed yaw, never
   rotates).** `LISTENER_YAW = Math.PI/2` (north = audio-front); sources at tile
   offsets relative to you, screen→audio y-flip per the gotcha. Steering + audio
   both absolute (Up = north).
3. **Audio role — audio-first / blind-accessible.** Playable by ear via the
   BFS-routed exit beacon, monster blips, generator throbs, food beacons, the
   health heartbeat, and two `aria-live` regions. The grid viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless descent / score chase.** FSM screens: menu → game ↔
   pause, game → gameover → menu; plus help, highscores, language, hidden `#learn`
   / `#test` routes.
7. **Synth aesthetic — modern / realistic** (sawtooth/square monster blips, a
   throbbing generator, a bright homing exit beacon, highpassed bolt cracks, a
   sub-bass kill, a low-frequency heartbeat that races with danger, a dungeon
   drone bed). No retro waves.

## Possible future work

- **Monster types** (a fast one, a tanky one) with distinct timbres for target
  priority.
- **Potions / power-ups** (a screen-clear bomb, temporary rapid fire).
- **Locked exits** that only open once the floor's generators are destroyed, to
  push engagement over pure rushing.
