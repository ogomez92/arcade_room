# Mech Duel

An accessible audio-first 1v1 mech combat game for the browser, built on the [syngen](https://github.com/nicross/syngen) template.

- Five distinct mechs (Scout, Striker, Juggernaut, Phantom, Brawler) with different speed, size, health, mobility, and weapons.
- 400 × 400 m enclosed arena. Gravity, jumping, jetpacks, wall-collision damage, and mech-vs-mech ramming — including fall attacks.
- Eight weapons: pistol, machine gun, shotgun, rail cannon, homing missile, engine-disabling disruptor beam, melee strike with knockback, and ram boost.
- Parking-aid **radar** for walls — pitch buckets for front/side/rear, faster beeps when closer, stereo-panned toward the wall.
- Aim **sonar** for the opponent — beeps quieter and lower when facing away, louder and faster on target. Switch range with `Shift+F` / `Shift+R`.
- Online 1v1 via [PeerJS](https://peerjs.com/) (room codes) or offline against an NPC.
- Full accessibility via ARIA live regions and a dedicated **Learn game sounds** screen.

## Controls (keyboard)
| Action | Key |
|---|---|
| Speed up / down | Up / Down |
| Turn | Left / Right |
| Snap to nearest cardinal direction | Shift + Left / Right |
| Jump / jetpack | Space (hold for jetpack) |
| Primary weapon | F |
| Secondary weapon | R |
| Switch sonar to primary range | Shift + F |
| Switch sonar to secondary range | Shift + R |
| Report your status | H |
| Report opponent status | Q |
| Pause | Escape |

## Getting started
Install dependencies:
```sh
npm install
```

Build and play (Electron):
```sh
npx gulp electron-rebuild
```

### Common tasks
| Task | Command |
|---|---|
| Build once | `gulp build` |
| Build continuously | `gulp watch` |
| Serve locally on :8000 | `gulp serve` |
| Serve + watch | `gulp dev` |
| Open in Electron | `gulp electron` |
| Build + open in Electron | `gulp electron-rebuild` |
| Create distributables | `gulp dist` |

Pass `--debug` to any task to suppress minification.

## How it's built
- **`src/js/engine.js`** — alias for [syngen](https://syngen.shiftbacktick.io/).
- **`src/js/app/`** — screen manager, controls, settings, storage (the syngen template scaffolding).
- **`src/js/content/`** — game-specific code:
  - `mechs.js`, `weapons.js`, `constants.js` — data.
  - `player.js`, `opponent.js`, `ai.js`, `projectiles.js`, `combat.js`, `arena.js`, `game.js` — simulation.
  - `audio_engine.js`, `audio_radar.js`, `audio_sonar.js`, `audio_sfx.js`, `audio_music.js` — synthesized audio.
  - `net.js` — PeerJS online multiplayer.
  - `util.js` — math and live-region announcements.
- **`src/js/app/screen/*.js`** — each screen (splash, menu, mechSelect, multiplayer, game, pause, gameOver, learnSounds).

See `docs/GDD.md` for the full design document, `docs/ROADMAP.md` for planned work.

## License
Unlicense — public domain. See `LICENSE`.
