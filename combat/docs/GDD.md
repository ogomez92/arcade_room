# Mech Duel — Game Design Document

## Overview
Mech Duel is an accessible 1v1 audio combat game built on the [syngen](https://github.com/nicross/syngen) engine. Two pilots fight inside a walled arena — either against the computer or online via PeerJS — using distinct mechs with different movement and weapon profiles. All gameplay information is conveyed through spatialized sound and speech cues; no visuals are required to play.

## Design pillars
1. **Audio-first.** Every piece of information needed for combat (location, facing, damage, weapon state, walls) reaches the player as sound or speech.
2. **Short, high-intensity duels.** Matches last 30–120 seconds and end the moment one mech hits zero health.
3. **Asymmetry through mechs.** Each mech fills a different role so the choice matters before the match begins.
4. **Physical combat.** Collisions, ramming, jumping, and falling attacks are first-class — not only projectile exchanges.

## Core loop
1. From the main menu, pick **Play vs computer**, **Host an online duel**, or **Join an online duel**.
2. Choose one of the five mechs. Preview the engine sound before committing.
3. Spawn at a random point in the arena, at least 200 meters from the opponent.
4. Use movement, radar, sonar, and weapons to destroy the opponent mech.
5. Win or lose → **Rematch** or back to the main menu.

## Arena
- Square, enclosed arena, 400 × 400 meters.
- Flat ground. Gravity is 24 m/s². Players can jump or jetpack depending on their mech.
- Four walls, each with a parking-aid radar cue when approached within 20 meters.

## Mechs
Five mechs, each defined by speed/acceleration/turn rate/mass/size/health and two weapons:

| Mech | Size | Health | Top speed | Turn rate | Mobility | Primary | Secondary |
|------|------|--------|-----------|-----------|----------|---------|-----------|
| Scout | 1.2 m | 80 | 22 m/s | 2.6 rad/s | Jetpack | Machine gun | Homing missile |
| Striker | 1.6 m | 120 | 16 m/s | 1.9 rad/s | Jump | Pistol | Melee strike |
| Juggernaut | 2.4 m | 200 | 10 m/s | 1.1 rad/s | Ground | Rail cannon | Shotgun |
| Phantom | 1.4 m | 100 | 18 m/s | 2.2 rad/s | Jetpack | Disruptor beam | Homing missile |
| Brawler | 1.8 m | 150 | 14 m/s | 1.7 rad/s | Jump | Melee strike | Ram boost |

## Weapons
| Weapon | Behavior | Damage | Cooldown |
|--------|----------|--------|----------|
| Pistol | Straight shot, moderate damage | 8 | 0.45 s |
| Machine gun | Hold to fire, short range | 2.5/bullet | 0.08 s |
| Shotgun | Spread of six pellets | 3/pellet | 1.1 s |
| Rail cannon | Very fast, long-range slug | 30 | 2.8 s |
| Homing missile | Slow, tracks target | 22 | 3.5 s |
| Disruptor beam | Short range, stuns enemy engine | 4 + 1.8 s stun | 2.0 s |
| Melee | Close-range swing with knockback | 25 | 1.3 s |
| Ram boost | Self-buff: +120% speed for 1.2 s | 0 | 4.0 s |

## Physics & collisions
- Mechs have mass; ramming damage scales with the closing speed of both mechs and the mass ratio (lighter mech takes more damage).
- Landing on another mech from the air triggers a fall-attack damage multiplier (×2).
- Hitting a wall while moving damages the mech proportional to speed and stops it instantly.
- Stunned mechs (from the disruptor) cannot steer or accelerate for the stun duration.

## Audio cues
| Cue | Purpose |
|-----|---------|
| Engine hum | Persistent, spatialized per mech; throttle bends pitch. Opponent's engine audible across the arena. |
| Footsteps | Legged mechs emit footstep thuds scaled by speed. |
| Radar | Parking-aid beeping — high pitch for front walls, mid for sides, low for rear walls; rate rises with proximity. Stereo-panned toward the wall. |
| Sonar | Sine beeps whose pitch, rate, and volume scale with how accurately the player is aimed at the opponent. Range is set by the selected weapon (switch with Shift+F / Shift+R). |
| Weapon fire / impacts | Distinct spatialized one-shots per weapon. |
| Damage / wall hit | Sawtooth buzz when taking damage; low thump when hitting a wall. |
| Jump / land | Chirp on takeoff, thud on landing. |
| Voice (ARIA live) | Event announcements: "Opponent 42 meters to your right", "Boost engaged", "Wall impact, 18 damage", etc. |

## Controls (keyboard)
| Action | Key |
|--------|-----|
| Speed up / down | Up / Down arrow |
| Turn | Left / Right arrow |
| Snap to nearest cardinal | Shift + Left or Right |
| Jump / jetpack | Space (hold for jetpack) |
| Primary weapon | F (hold if autofire) |
| Secondary weapon | R |
| Switch sonar to primary range | Shift + F |
| Switch sonar to secondary range | Shift + R |
| Report own status | H |
| Report opponent status | Q |
| Pause | Escape |

## Screens
- **Splash** — entry screen. Press Enter / click to continue.
- **Main menu** — play vs computer, host online, join online, learn sounds, how to play.
- **Mech select** — cycle through mechs; preview engine sound; confirm choice.
- **Multiplayer** — host generates a room code; joiner enters it; status is announced live.
- **Game** — live combat with live-region HUD and audio cues.
- **Pause** — resume or quit to menu.
- **Game over** — victory/defeat announcement with rematch option.
- **Learn sounds** — standalone menu for auditioning every distinct sound in the game.

## Multiplayer model
Online play uses [PeerJS](https://peerjs.com/) browser peer-to-peer WebRTC. Each client owns its own projectile simulation and damage; snapshots (position, velocity, yaw, health) sync at 20 Hz and fire events are exchanged as discrete messages. The simpler client-authoritative model keeps latency-sensitive cues (engine throttle, step sounds) locally crisp.

## Win/lose condition
A match ends the instant either player's health reaches 0. The game announces the outcome, plays an explosion at the loser's position, and transitions to the Game Over screen after a short beat.
