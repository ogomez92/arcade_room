# Pong Audiogame — Design Spec
Date: 2026-04-25

## Context

Building a fully accessible 2-player pong audiogame on top of the syngen template. Blind players are the primary audience — accessibility is the single highest priority. Sighted users can play too but no visual rendering exists. The game is currently 1P vs AI, with the architecture prepared for a PeerJS online mode in a future iteration.

---

## Architecture

### File structure

```
src/js/
├── content.js              — namespace bootstrap; exports content.game.start/stop/update
├── content/
│   ├── table.js            — constants (WIDTH=12, LENGTH=20, PADDLE_HALF=1.5)
│   ├── audio.js            — syngen sound factory functions + ball 3D prop management
│   ├── ball.js             — ball state (pos, vel) + frame-step physics
│   ├── player.js           — player paddle: step movement, hold-repeat, swing, cooldown
│   ├── ai.js               — AI paddle: delayed-buffer tracking, randomised swing
│   ├── physics.js          — wall/paddle collision detection and resolution
│   └── scoring.js          — score, serving state machine, serve timer
│
└── app/screen/
    ├── splash.js           — modified to be main menu (Play Game / Learn Sounds)
    ├── game.js             — game lifecycle: delegates to content.game
    └── learnSounds.js      — new screen with demo buttons

src/css/app/
├── splash.css              — minor additions for menu button layout
├── game.css                — new: pre-game form, sr-only announcer
└── learnSounds.css         — new: list layout

public/index.html           — add HTML for game-screen and learn-sounds-screen sections
```

All modules use the existing IIFE pattern (`content.moduleName = (() => { … })()`).  
`screen/game.js` owns only DOM and lifecycle; all physics and audio live in `content/`.

---

## Physics & Mechanics

### Table

- Width: **12 units** (short side). Step positions 0–11; step `i` occupies x ∈ [i, i+1].
- Length: **20 units** (long side). Player 1 at Y=0, AI at Y=20.
- Coordinate origin: player 1's bottom-left corner.

### Ball

- Treated as a point mass; collision radius **0.15 units**.
- Updated each frame: `pos += vel * dt`
- Starting serve speed: **8 u/s** in the Y direction (plus lateral component from swing).

### Wall collisions (X=0 and X=12)

Coefficient of restitution **1.02** — very slightly elastic (ball gains 2% speed per bounce). A **max ball speed cap of 22 u/s** prevents runaway acceleration over long rallies.

### Paddle

- Center: `step + 0.5`; physical half-width **1.5 units** (covers 3 steps).
- **Passive hit:** Ball reaches player's end (Y≤0 or Y≥20) and `|ball.x − paddle.x| < 1.5` → reflect Y-velocity, restitution **0.85**. Ball exits with less energy than it arrived.
- **No paddle:** Ball exits play → goal for the other player.

### Swing mechanics (A / S / D)

Swing is only accepted when:
1. Ball is within **1.5 units** of the player's end (hit zone), AND
2. `|ball.x − paddle.x| < 1.5` (ball within paddle X coverage)

| Key | vx result | vy result |
|-----|-----------|-----------|
| S (straight) | unchanged | ±SWING_POWER (14 u/s) |
| A (left)     | −SWING_SIDE (4 u/s) | ±SWING_POWER × 0.85 |
| D (right)    | +SWING_SIDE (4 u/s) | ±SWING_POWER × 0.85 |

The ± sign is toward the opponent (positive for player 1, negative for AI).  
Missed swing (in hit zone but outside paddle coverage): play miss sound, apply cooldown.  
Out-of-zone swing: ignored silently.

**Cooldown:** 450 ms — player cannot move or swing during this window.

### Player paddle movement

- 12 discrete step positions (0–11).
- Arrow key **press** → move 1 step immediately + play step click.
- Arrow key **hold** → 150 ms initial delay, then repeat every 80 ms.
- Movement blocked during swing cooldown.

---

## Game State Machine (scoring.js)

```
pre_game
  → player clicks Start (with score limit set)
  → announce serve

serving  [serve_player, timer=3s]
  → player/AI presses A/S/D while in hit zone → playing
  → timer expires → serve transfers; reset ball; announce transfer; back to serving

playing
  → ball exits past end without paddle contact → goal_pause

goal_pause  [duration=2s, frozen]
  → score updated; announce score via ARIA live region
  → check score limit
    → not reached: non-scorer becomes server → serving
    → reached: game_over

game_over
  → announce winner
  → show "Return to menu" button
```

**Score limit:** editable `<input type="number">` in the pre-game DOM. Default: **7**. Range: 1–99.

---

## Audio Design

### Ball — 3D spatial prop

A continuous syngen prop placed in 3D space. Updated every frame:

```
syngen_x = ball.x − 6        // centres 12-unit table at 0
syngen_z = ball.y             // depth from player 1's end
syngen_y = 0                  // flat table plane
```

Listener remains at (0, 0, 0) — always player 1's perspective.  
Syngen's HRTF provides left/right panning and near/far depth cues automatically.

Ball oscillator: layered **sine + slight detuned sine** (~180 Hz base) for richness.  
Ball is silenced (gain → 0) during pre-game, goal pause, and game over.

### Impact sounds (short, synthesised, layered)

| Event | Recipe |
|-------|--------|
| Step click | Sine + noise, 20 ms, sharp attack, exponential decay |
| Wall bounce | Band-pass filtered noise burst, ~50 ms |
| Passive paddle hit | Sine click ~120 Hz + noise layer, ~80 ms |
| Swing hit | Sine ~350 Hz + noise, sharper attack, ~60 ms |
| Swing miss | Soft whoosh (high-pass noise sweep), ~60 ms |
| Goal (scorer) | Short ascending tone, ~400 ms |
| Goal (conceded) | Short descending tone, ~400 ms |

All sounds routed through the template's existing limiter/compressor chain. Specific frequencies, filter Q values, and envelope times are starting points — all tunable later.

### Serve countdown

- Begins at **1.5 s** remaining
- Short beep at 880 Hz, 80 ms, every 300 ms (≈ 5 beeps)
- Final beep at timeout is slightly louder

### Learn Sounds demos

**Ball rolling:** Spawn a temporary ball prop. Animate X position: left (x=0) → right (x=12) → left, over 3 s. Destroy prop on completion.

**Serve transfer warning:** Play the full countdown beep sequence as described above.

---

## UI & Screen Structure

### Main Menu (`splash.js` modified)

```html
<nav aria-label="Main menu">
  <button id="play-game">Play game</button>
  <button id="learn-sounds">Learn sounds</button>
</nav>
```

Standard Tab/Enter navigation. Screen reader reads button labels. Existing splash title and author text remain above the nav.

### Game Screen (`game.js`)

States control which DOM elements are visible:

| State | Visible elements |
|-------|-----------------|
| pre_game | Score limit label+input, Start button, Back button |
| serving / playing / goal_pause | Only the sr-only announcer div |
| game_over | Game over message (sr-only), Return to menu button |

**ARIA live region** (always in DOM, sr-only):
```html
<div role="status" aria-live="polite" aria-atomic="true" class="js-announcer sr-only"></div>
```

Example announcements (player 1 = "You", AI = "Computer"):
- `"You serve. You have 3 seconds."`
- `"Serve transferred to computer. Computer serves."`
- `"Goal! You score. Score: 3 to 2."`
- `"Goal! Computer scores. Score: 2 to 3."`
- `"Game over. You win 7 to 4."` / `"Game over. Computer wins 4 to 7."`

### Learn Sounds Screen (`learnSounds.js`)

```html
<h2>Learn sounds</h2>
<ul>
  <li><button id="demo-ball-rolling">Ball rolling</button></li>
  <li><button id="demo-serve-warning">Serve transfer warning</button></li>
  <li><button id="learn-back">Back to main menu</button></li>
</ul>
```

Demo buttons temporarily show "Playing…" (via aria-label update) while sound plays, then revert.

---

## AI Opponent

**Delayed position buffer:** Every frame, ball X is pushed to a ring buffer. When choosing a target, AI reads the value from `REACTION_DELAY` ms ago (default: **280 ms**). Tunable constant.

**Movement:** Same step system as player (max 1 step per 80 ms hold cycle). AI steps toward the delayed target X each frame that it can.

**Swing:** When ball enters AI's hit zone AND is within paddle coverage, AI picks randomly:
- 50% → straight (S equivalent)
- 25% → left (A equivalent)
- 25% → right (D equivalent)

**Cooldown:** Same 450 ms as player.

`REACTION_DELAY` is exported from `content/ai.js` for easy tuning and future difficulty presets.

---

## PeerJS Online Preparation

`content/ai.js` implements the same interface as a future `content/remote.js` will:

```javascript
// Both modules expose:
{
  update(dt, ballState) { … },   // called each frame
  getPosition() { … },           // returns current step (0–11)
  getSwing() { … },              // returns null | 'a' | 's' | 'd'
}
```

`content/physics.js` treats `ai` and `player` symmetrically — swapping AI for a remote opponent requires only changing which module is assigned to `content.opponent`.

---

## Verification Plan

1. **Build:** `npm run dev` → no errors in console
2. **Main menu:** Tab through Play Game / Learn Sounds. Screen reader reads labels.
3. **Learn Sounds:** Activate each demo button; ball rolling pans left→right→left; beeps countdown heard.
4. **Pre-game:** Score limit input editable; Tab to Start; game begins.
5. **Serving:** ARIA announces who serves. Beeps start at 1.5 s. Serve transfers on timeout.
6. **Ball audio:** Ball rolling sound moves in 3D space (left-right pan + depth). Impacts produce distinct sounds.
7. **Swing:** A/S/D applies correct directional force. Missed swing plays whoosh and locks movement for 450 ms.
8. **Goal:** 2 s pause; score announced correctly; non-scorer serves next.
9. **Game over:** Correct winner announced; Return to menu focusable.
10. **AI:** AI moves toward ball with slight delay; uses angled and straight swings.
