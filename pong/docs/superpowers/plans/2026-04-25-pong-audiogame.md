# Pong Audiogame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully accessible 1P-vs-AI pong audiogame on the syngen template, with 3D spatial ball audio, step-based paddle movement, swing mechanics, serving system, and a main menu with a learn-sounds screen.

**Architecture:** Multi-file IIFE module pattern. `content.js` is the game orchestrator; `content/*.js` modules cover table constants, audio, ball physics, player, AI, collision, and scoring. `app/screen/splash.js` becomes the main menu. New screens: `learnSounds.js`, updated `game.js`.

**Tech Stack:** Vanilla JS (ES5-compatible IIFE pattern), syngen v2.0.0-beta.3 (Web Audio), Gulp build, no test framework (browser-verified).

---

## Coordinate System Reference

- Table width: 12 units (X: 0–12, left→right from player's perspective)
- Table length: 20 units (Y: 0–20, player 1 at Y=0, AI at Y=20)
- Syngen 3D audio mapping (listener at origin facing +X):
  - `syngen_x = ball.tableY` (depth from listener)
  - `syngen_y = 6 - ball.tableX` (left/right: +Y=left, −Y=right)
  - `syngen_z = 0` (flat table plane)

---

## Task 1: HTML & CSS Scaffolding

**Files:**
- Modify: `public/index.html`
- Create: `src/css/app/game.css`
- Create: `src/css/app/learnSounds.css`
- Modify: `src/css/app/splash.css`

- [ ] **Step 1: Update `public/index.html`**

Replace the entire file content:

```html
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Pong</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/png" href="./favicon.png" />
    <link rel="stylesheet" type="text/css" href="./styles.min.css" />
  </head>
  <body role="application">
    <main class="a-app">
      <canvas class="a-app--overlaySupport"></canvas>

      <div class="a-app--screen a-app--game">
        <section class="c-screen a-game" tabindex="-1" aria-label="Game">
          <div role="status" aria-live="polite" aria-atomic="true" class="js-announcer sr-only"></div>

          <div class="a-game--pregame">
            <h2>New game</h2>
            <div class="a-game--field">
              <label for="a-game--score-limit">Score limit</label>
              <input type="number" id="a-game--score-limit" class="a-game--score-limit" value="7" min="1" max="99">
            </div>
            <button class="a-game--start">Start game</button>
            <button class="a-game--back-pregame">Back to menu</button>
          </div>

          <div class="a-game--gameover" hidden>
            <p class="a-game--gameover-msg sr-only"></p>
            <button class="a-game--return">Return to menu</button>
          </div>
        </section>
      </div>

      <div class="a-app--screen a-app--learn-sounds">
        <section class="c-screen a-learn-sounds" tabindex="-1" aria-label="Learn sounds">
          <h2>Learn sounds</h2>
          <ul class="a-learn-sounds--list">
            <li><button class="a-learn-sounds--ball-rolling">Ball rolling</button></li>
            <li><button class="a-learn-sounds--serve-warning">Serve transfer warning</button></li>
            <li><button class="a-learn-sounds--back">Back to main menu</button></li>
          </ul>
        </section>
      </div>

      <div class="a-app--screen a-app--splash">
        <section class="c-screen a-splash" tabindex="-1">
          <h1 class="a-splash--logo">Pong</h1>
          <div class="a-splash--details">
            <div class="a-splash--version"></div>
            <div class="a-splash--author">by guilevi</div>
          </div>
          <nav class="a-splash--menu" aria-label="Main menu">
            <button class="a-splash--play">Play game</button>
            <button class="a-splash--learn">Learn sounds</button>
          </nav>
        </section>
      </div>

    </main>
    <script src="./scripts.min.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/css/app/game.css`**

```css
.a-game--pregame {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 20rem;
}
  .a-game--field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .a-game--score-limit {
    font-size: 1rem;
    padding: 0.25rem 0.5rem;
    width: 5rem;
  }
  .a-game--pregame button,
  .a-game--return {
    font-size: 1rem;
    padding: 0.5rem 1rem;
  }

.a-game--gameover {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
```

- [ ] **Step 3: Create `src/css/app/learnSounds.css`**

```css
.a-learn-sounds--list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  list-style: none;
  padding: 0;
}
  .a-learn-sounds--list button {
    font-size: 1rem;
    padding: 0.5rem 1rem;
  }
```

- [ ] **Step 4: Update `src/css/app/splash.css` — add menu styles**

Append to the existing file:

```css
.a-splash--menu {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 2rem;
}
  .a-splash--menu button {
    font-size: 1rem;
    padding: 0.5rem 1.5rem;
  }
```

- [ ] **Step 5: Build and check for CSS errors**

```bash
cd /Users/guillem/src/pong && npm run build 2>&1 | head -30
```

Expected: build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add public/index.html src/css/app/game.css src/css/app/learnSounds.css src/css/app/splash.css
git commit -m "feat: add HTML structure and CSS for pong screens"
```

---

## Task 2: Table Constants

**Files:**
- Create: `src/js/content/table.js`

- [ ] **Step 1: Create `src/js/content/table.js`**

```javascript
content.table = {
  WIDTH: 12,
  LENGTH: 20,
  PADDLE_HALF: 1.5,
  NUM_STEPS: 12,
  STEP_SIZE: 1,

  WALL_RESTITUTION: 1.02,
  PADDLE_RESTITUTION: 0.85,
  MAX_BALL_SPEED: 22,

  SWING_POWER: 14,
  SWING_SIDE: 4,
  SWING_ZONE: 1.5,
  SWING_COOLDOWN: 0.45,

  SERVE_SPEED: 8,
  SERVE_TIMEOUT: 3.0,
  SERVE_WARN_THRESHOLDS: [1.5, 1.2, 0.9, 0.6, 0.3],

  MOVE_HOLD_DELAY: 0.15,
  MOVE_HOLD_REPEAT: 0.08,

  AI_REACTION_DELAY: 0.28,
  AI_SERVE_DELAY: 0.8,
}
```

- [ ] **Step 2: Build and verify constant is accessible**

```bash
cd /Users/guillem/src/pong && npm run build 2>&1 | tail -5
```

Expected: build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add src/js/content/table.js
git commit -m "feat: add table constants module"
```

---

## Task 3: Ball Module

**Files:**
- Create: `src/js/content/ball.js`

- [ ] **Step 1: Create `src/js/content/ball.js`**

```javascript
content.ball = (() => {
  let x = 6, y = 0
  let vx = 0, vy = 0

  return {
    getState: () => ({ x, y, vx, vy }),
    getX: () => x,
    getY: () => y,

    setPosition: (nx, ny) => { x = nx; y = ny },
    setVelocity: (nvx, nvy) => { vx = nvx; vy = nvy },

    reset: () => { x = 6; y = 0; vx = 0; vy = 0 },

    update: (dt) => {
      x += vx * dt
      y += vy * dt
    },
  }
})()
```

- [ ] **Step 2: Commit**

```bash
git add src/js/content/ball.js
git commit -m "feat: add ball physics module"
```

---

## Task 4: Player Module

**Files:**
- Create: `src/js/content/player.js`

- [ ] **Step 1: Create `src/js/content/player.js`**

```javascript
content.player = (() => {
  let step = 5
  let cooldown = 0
  let leftHeldTime = 0
  let rightHeldTime = 0
  let leftWasHeld = false
  let rightWasHeld = false

  function tryMove(dir) {
    const next = step + dir
    if (next < 0 || next >= content.table.NUM_STEPS) return
    step = next
    content.audio.playStepClick()
  }

  function processKey(held, wasHeld, heldTime, dir, dt) {
    if (!held) {
      return { wasHeld: false, heldTime: 0 }
    }
    if (!wasHeld) {
      tryMove(dir)
      return { wasHeld: true, heldTime: 0 }
    }
    const nextTime = heldTime + dt
    const DELAY = content.table.MOVE_HOLD_DELAY
    const REPEAT = content.table.MOVE_HOLD_REPEAT
    if (nextTime >= DELAY) {
      const prevRepeats = heldTime < DELAY ? 0 : Math.floor((heldTime - DELAY) / REPEAT)
      const nextRepeats = Math.floor((nextTime - DELAY) / REPEAT)
      if (nextRepeats > prevRepeats) tryMove(dir)
    }
    return { wasHeld: true, heldTime: nextTime }
  }

  return {
    getStep: () => step,
    getX: () => step + 0.5,

    reset: () => {
      step = 5
      cooldown = 0
      leftHeldTime = 0
      rightHeldTime = 0
      leftWasHeld = false
      rightWasHeld = false
    },

    startCooldown: () => { cooldown = content.table.SWING_COOLDOWN },
    isOnCooldown: () => cooldown > 0,

    update: (dt) => {
      if (cooldown > 0) {
        cooldown = Math.max(0, cooldown - dt)
        leftWasHeld = false
        rightWasHeld = false
        leftHeldTime = 0
        rightHeldTime = 0
        return
      }

      const keys = engine.input.keyboard.get()
      const leftHeld = !!keys['ArrowLeft']
      const rightHeld = !!keys['ArrowRight']

      const left = processKey(leftHeld, leftWasHeld, leftHeldTime, -1, dt)
      leftWasHeld = left.wasHeld
      leftHeldTime = left.heldTime

      const right = processKey(rightHeld, rightWasHeld, rightHeldTime, 1, dt)
      rightWasHeld = right.wasHeld
      rightHeldTime = right.heldTime
    },
  }
})()
```

- [ ] **Step 2: Commit**

```bash
git add src/js/content/player.js
git commit -m "feat: add player paddle module with step movement and cooldown"
```

---

## Task 5: AI Module

**Files:**
- Create: `src/js/content/ai.js`

- [ ] **Step 1: Create `src/js/content/ai.js`**

```javascript
content.ai = (() => {
  let step = 6
  let cooldown = 0
  let moveTimer = 0

  const BUFFER_SIZE = 180
  const xBuffer = new Array(BUFFER_SIZE).fill(6)
  let bufferHead = 0
  let bufferCount = 0

  function pushX(x) {
    xBuffer[bufferHead] = x
    bufferHead = (bufferHead + 1) % BUFFER_SIZE
    if (bufferCount < BUFFER_SIZE) bufferCount++
  }

  function getDelayedX() {
    if (bufferCount === 0) return 6
    const delayFrames = Math.min(
      Math.round(content.table.AI_REACTION_DELAY * 60),
      bufferCount - 1
    )
    const readIdx = (bufferHead - 1 - delayFrames + BUFFER_SIZE) % BUFFER_SIZE
    return xBuffer[readIdx]
  }

  return {
    getStep: () => step,
    getX: () => step + 0.5,

    reset: () => {
      step = 6
      cooldown = 0
      moveTimer = 0
      bufferHead = 0
      bufferCount = 0
      xBuffer.fill(6)
    },

    update: (dt, ballState) => {
      pushX(ballState.x)

      if (cooldown > 0) {
        cooldown = Math.max(0, cooldown - dt)
        return
      }

      const targetX = getDelayedX()
      const targetStep = Math.max(0, Math.min(
        content.table.NUM_STEPS - 1,
        Math.floor(targetX)
      ))

      if (targetStep !== step) {
        moveTimer += dt
        if (moveTimer >= content.table.MOVE_HOLD_REPEAT) {
          moveTimer -= content.table.MOVE_HOLD_REPEAT
          step += targetStep > step ? 1 : -1
        }
      } else {
        moveTimer = 0
      }

      // Check swing opportunity
      const aiX = step + 0.5
      const inRange = Math.abs(ballState.x - aiX) < content.table.PADDLE_HALF
      const inZone = ballState.y >= content.table.LENGTH - content.table.SWING_ZONE
      const ballApproaching = ballState.vy > 0

      if (inRange && inZone && ballApproaching) {
        cooldown = content.table.SWING_COOLDOWN
        const r = Math.random()
        const dir = r < 0.5 ? 's' : r < 0.75 ? 'a' : 'd'
        let vx = ballState.vx
        let vy = -content.table.SWING_POWER
        if (dir === 'a') vx = -content.table.SWING_SIDE
        if (dir === 'd') vx = content.table.SWING_SIDE
        content.ball.setVelocity(vx, vy)
        content.audio.playSwingHit()
      }
    },
  }
})()
```

- [ ] **Step 2: Commit**

```bash
git add src/js/content/ai.js
git commit -m "feat: add AI paddle module with delayed tracking and random swings"
```

---

## Task 6: Physics Module

**Files:**
- Create: `src/js/content/physics.js`

- [ ] **Step 1: Create `src/js/content/physics.js`**

```javascript
content.physics = (() => {
  return {
    resolve: () => {
      const ball = content.ball.getState()
      let { x, y, vx, vy } = ball

      // Wall collisions
      const R = content.table.WALL_RESTITUTION
      if (x < 0) {
        x = -x
        vx = -vx * R
        content.audio.playWallBounce()
      } else if (x > content.table.WIDTH) {
        x = 2 * content.table.WIDTH - x
        vx = -vx * R
        content.audio.playWallBounce()
      }

      // Clamp speed after wall bounce
      const speed = Math.sqrt(vx * vx + vy * vy)
      if (speed > content.table.MAX_BALL_SPEED) {
        const s = content.table.MAX_BALL_SPEED / speed
        vx *= s
        vy *= s
      }

      // Player end (y <= 0, ball moving toward player 1)
      if (y <= 0 && vy < 0) {
        const playerX = content.player.getX()
        if (Math.abs(x - playerX) < content.table.PADDLE_HALF) {
          y = -y
          vy = -vy * content.table.PADDLE_RESTITUTION
          content.audio.playPaddleHit()
        } else {
          content.scoring.onGoal('ai')
          return
        }
      }

      // AI end (y >= LENGTH, ball moving toward AI)
      if (y >= content.table.LENGTH && vy > 0) {
        const aiX = content.ai.getX()
        if (Math.abs(x - aiX) < content.table.PADDLE_HALF) {
          y = 2 * content.table.LENGTH - y
          vy = -vy * content.table.PADDLE_RESTITUTION
          content.audio.playPaddleHit()
        } else {
          content.scoring.onGoal('player')
          return
        }
      }

      content.ball.setPosition(x, y)
      content.ball.setVelocity(vx, vy)
    },
  }
})()
```

- [ ] **Step 2: Commit**

```bash
git add src/js/content/physics.js
git commit -m "feat: add physics collision resolution module"
```

---

## Task 7: Scoring Module

**Files:**
- Create: `src/js/content/scoring.js`

- [ ] **Step 1: Create `src/js/content/scoring.js`**

```javascript
content.scoring = (() => {
  let playerScore = 0
  let aiScore = 0
  let scoreLimit = 7
  let state = 'idle'
  let servingPlayer = 'player'
  let serveTimer = 0
  let goalPauseTimer = 0
  let nextBeepIndex = 0
  let lastScorer = null

  function announce(message) {
    const el = document.querySelector('.js-announcer')
    if (!el) return
    el.textContent = ''
    setTimeout(() => { el.textContent = message }, 50)
  }

  function startServe(who) {
    servingPlayer = who
    serveTimer = content.table.SERVE_TIMEOUT
    nextBeepIndex = 0
    content.ball.setVelocity(0, 0)
    if (who === 'player') {
      content.ball.setPosition(content.player.getX(), 0)
      announce('You serve. You have 3 seconds.')
    } else {
      content.ball.setPosition(content.ai.getX(), content.table.LENGTH)
      announce('Computer serves.')
    }
  }

  return {
    getState: () => state,
    setState: (s) => { state = s },
    getServingPlayer: () => servingPlayer,

    start: (limit) => {
      scoreLimit = limit
      playerScore = 0
      aiScore = 0
      state = 'serving'
      startServe(Math.random() < 0.5 ? 'player' : 'ai')
    },

    stop: () => { state = 'idle' },

    updateServeTimer: (dt) => {
      if (state !== 'serving') return
      serveTimer -= dt
      const thresholds = content.table.SERVE_WARN_THRESHOLDS
      while (nextBeepIndex < thresholds.length && serveTimer <= thresholds[nextBeepIndex]) {
        content.audio.playServeBeep()
        nextBeepIndex++
      }
      if (serveTimer <= 0) {
        const next = servingPlayer === 'player' ? 'ai' : 'player'
        startServe(next)
        announce(
          next === 'player'
            ? 'Serve transferred to you. You serve.'
            : 'Serve transferred to computer. Computer serves.'
        )
      }
    },

    confirmServe: () => {
      serveTimer = Infinity
    },

    onGoal: (scorer) => {
      if (scorer === 'player') playerScore++
      else aiScore++
      lastScorer = scorer
      state = 'goal_pause'
      goalPauseTimer = 2.0
      content.audio.playGoal(scorer)
      const msg = scorer === 'player'
        ? `Goal! You score. Score: ${playerScore} to ${aiScore}.`
        : `Goal! Computer scores. Score: ${playerScore} to ${aiScore}.`
      announce(msg)
    },

    updateGoalPause: (dt) => {
      goalPauseTimer -= dt
      if (goalPauseTimer > 0) return
      if (playerScore >= scoreLimit || aiScore >= scoreLimit) {
        state = 'game_over'
        const msg = playerScore >= scoreLimit
          ? `Game over. You win ${playerScore} to ${aiScore}.`
          : `Game over. Computer wins ${aiScore} to ${playerScore}.`
        announce(msg)
      } else {
        state = 'serving'
        const next = lastScorer === 'player' ? 'ai' : 'player'
        startServe(next)
      }
    },

    announce,
  }
})()
```

- [ ] **Step 2: Commit**

```bash
git add src/js/content/scoring.js
git commit -m "feat: add scoring and serving state machine"
```

---

## Task 8: Audio Module

**Files:**
- Create: `src/js/content/audio.js`

- [ ] **Step 1: Create `src/js/content/audio.js`**

```javascript
content.audio = (() => {
  let ballSound = null

  // Extend syngen.sound for the positioned rolling sound
  const BallSound = engine.sound.extend({
    relative: false,
    reverb: false,
    fadeInDuration: 0.1,
    fadeOutDuration: 0.15,
    onConstruct: function () {
      const ctx = engine.context()
      this.osc1 = ctx.createOscillator()
      this.osc2 = ctx.createOscillator()
      this.oscGain = ctx.createGain()
      this.osc1.type = 'sine'
      this.osc1.frequency.value = 180
      this.osc2.type = 'sine'
      this.osc2.frequency.value = 183
      this.oscGain.gain.value = 0.5
      this.osc1.connect(this.oscGain)
      this.osc2.connect(this.oscGain)
      this.oscGain.connect(this.output)
      this.osc1.start()
      this.osc2.start()
    },
    onDestroy: function () {
      this.osc1.stop()
      this.osc2.stop()
    },
  })

  function playBurst({ freq = 200, noiseRatio = 0.4, duration = 0.05, gain = 0.5, filterFreq = 0 }) {
    const ctx = engine.context()
    const bus = engine.mixer.createBus()
    const now = ctx.currentTime

    // Sine layer
    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    oscGain.gain.setValueAtTime(gain * (1 - noiseRatio), now)
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(oscGain)
    oscGain.connect(bus)
    osc.start(now)
    osc.stop(now + duration)

    // Noise layer
    if (noiseRatio > 0) {
      const buf = engine.buffer.whiteNoise({ channels: 1, duration: duration + 0.01 })
      const src = ctx.createBufferSource()
      const filt = ctx.createBiquadFilter()
      const ng = ctx.createGain()
      src.buffer = buf
      filt.type = 'bandpass'
      filt.frequency.value = filterFreq || freq * 2
      filt.Q.value = 2.5
      ng.gain.setValueAtTime(gain * noiseRatio, now)
      ng.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      src.connect(filt)
      filt.connect(ng)
      ng.connect(bus)
      src.start(now)
    }

    setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (duration + 0.2) * 1000)
  }

  return {
    startBall: () => {
      if (ballSound) { ballSound.destroy(); ballSound = null }
      ballSound = BallSound.instantiate({ x: 6, y: 0, z: 0 })
    },

    stopBall: () => {
      if (ballSound) { ballSound.destroy(); ballSound = null }
    },

    updateBall: (ballState) => {
      if (!ballSound) return
      ballSound.setVector({
        x: ballState.y,
        y: 6 - ballState.x,
        z: 0,
      })
    },

    playStepClick: () => {
      playBurst({ freq: 900, noiseRatio: 0.6, duration: 0.02, gain: 0.25, filterFreq: 1800 })
    },

    playWallBounce: () => {
      playBurst({ freq: 320, noiseRatio: 0.55, duration: 0.055, gain: 0.45, filterFreq: 640 })
    },

    playPaddleHit: () => {
      playBurst({ freq: 130, noiseRatio: 0.45, duration: 0.085, gain: 0.5, filterFreq: 260 })
    },

    playSwingHit: () => {
      playBurst({ freq: 360, noiseRatio: 0.5, duration: 0.065, gain: 0.65, filterFreq: 720 })
    },

    playSwingMiss: () => {
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const dur = 0.09
      const buf = engine.buffer.whiteNoise({ channels: 1, duration: dur + 0.01 })
      const src = ctx.createBufferSource()
      const filt = ctx.createBiquadFilter()
      const g = ctx.createGain()
      src.buffer = buf
      filt.type = 'highpass'
      filt.frequency.setValueAtTime(3500, now)
      filt.frequency.exponentialRampToValueAtTime(9000, now + dur)
      g.gain.setValueAtTime(0.3, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      src.connect(filt)
      filt.connect(g)
      g.connect(bus)
      src.start(now)
      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (dur + 0.2) * 1000)
    },

    playServeBeep: () => {
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const dur = 0.08
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      g.gain.setValueAtTime(0.55, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      osc.connect(g)
      g.connect(bus)
      osc.start(now)
      osc.stop(now + dur)
      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (dur + 0.2) * 1000)
    },

    playGoal: (scorer) => {
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const dur = 0.45
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      if (scorer === 'player') {
        osc.frequency.setValueAtTime(280, now)
        osc.frequency.exponentialRampToValueAtTime(560, now + dur)
      } else {
        osc.frequency.setValueAtTime(560, now)
        osc.frequency.exponentialRampToValueAtTime(280, now + dur)
      }
      g.gain.setValueAtTime(0.65, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      osc.connect(g)
      g.connect(bus)
      osc.start(now)
      osc.stop(now + dur)
      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (dur + 0.2) * 1000)
    },

    demoBallRolling: (onComplete) => {
      const tempSound = BallSound.instantiate({ x: 5, y: 0, z: 0 })
      let elapsed = 0
      const totalDur = 3.0

      function tick(e) {
        elapsed += e.delta
        if (elapsed >= totalDur) {
          engine.loop.off('frame', tick)
          tempSound.destroy()
          if (onComplete) onComplete()
          return
        }
        const t = elapsed / totalDur
        const ping = t < 0.5 ? t * 2 : (1 - t) * 2
        const tableX = ping * content.table.WIDTH
        tempSound.setVector({ x: 5, y: 6 - tableX, z: 0 })
      }

      engine.loop.on('frame', tick)
    },

    demoServeWarning: (onComplete) => {
      let elapsed = 0
      let nextBeep = 0
      const thresholds = content.table.SERVE_WARN_THRESHOLDS
      const totalDur = thresholds[0] + 0.2

      function tick(e) {
        elapsed += e.delta
        const remaining = totalDur - elapsed
        while (nextBeep < thresholds.length && remaining <= thresholds[nextBeep]) {
          content.audio.playServeBeep()
          nextBeep++
        }
        if (elapsed >= totalDur) {
          engine.loop.off('frame', tick)
          if (onComplete) onComplete()
        }
      }

      engine.loop.on('frame', tick)
    },
  }
})()
```

- [ ] **Step 2: Commit**

```bash
git add src/js/content/audio.js
git commit -m "feat: add audio module with spatial ball sound and impact effects"
```

---

## Task 9: Game Orchestrator

**Files:**
- Modify: `src/js/content.js` (rewrite)

`content.js` must define `const content = {}` (not an IIFE result) so that `content/*.js` files can add properties to it. The game orchestrator lives at `content.game` so that `game.js` can call `content.game.start()`, etc.

- [ ] **Step 1: Rewrite `src/js/content.js`**

```javascript
const content = {}

content.game = (() => {
  let aiServeTimer = 0

  function doAiServe() {
    const dir = Math.random() < 0.5 ? 's' : Math.random() < 0.5 ? 'a' : 'd'
    const aiX = content.ai.getX()
    content.ball.setPosition(aiX, content.table.LENGTH - 0.15)
    let vx = 0
    if (dir === 'a') vx = -content.table.SWING_SIDE
    if (dir === 'd') vx = content.table.SWING_SIDE
    content.ball.setVelocity(vx, -content.table.SERVE_SPEED)
    content.scoring.setState('playing')
    content.scoring.confirmServe()
  }

  return {
    start: (scoreLimit) => {
      content.ball.reset()
      content.player.reset()
      content.ai.reset()
      content.scoring.start(scoreLimit)
      content.audio.startBall()
      aiServeTimer = content.table.AI_SERVE_DELAY
    },

    stop: () => {
      content.audio.stopBall()
      content.scoring.stop()
    },

    playerAction: (dir) => {
      const state = content.scoring.getState()

      if (state === 'serving' && content.scoring.getServingPlayer() === 'player') {
        const playerX = content.player.getX()
        content.ball.setPosition(playerX, 0.15)
        let vx = 0
        if (dir === 'a') vx = -content.table.SWING_SIDE
        if (dir === 'd') vx = content.table.SWING_SIDE
        content.ball.setVelocity(vx, content.table.SERVE_SPEED)
        content.scoring.setState('playing')
        content.scoring.confirmServe()
        return
      }

      if (state !== 'playing') return

      const ball = content.ball.getState()
      const playerX = content.player.getX()
      const inRange = Math.abs(ball.x - playerX) < content.table.PADDLE_HALF
      const inZone = ball.y < content.table.SWING_ZONE

      if (!inZone) return

      if (inRange) {
        let vx = ball.vx
        if (dir === 'a') vx = -content.table.SWING_SIDE
        if (dir === 'd') vx = content.table.SWING_SIDE
        content.ball.setVelocity(vx, content.table.SWING_POWER)
        content.player.startCooldown()
        content.audio.playSwingHit()
      } else {
        content.player.startCooldown()
        content.audio.playSwingMiss()
      }
    },

    update: (e) => {
      const dt = e.delta
      const state = content.scoring.getState()

      if (state === 'serving') {
        content.player.update(dt)
        if (content.scoring.getServingPlayer() === 'ai') {
          aiServeTimer -= dt
          if (aiServeTimer <= 0) doAiServe()
        }
        content.scoring.updateServeTimer(dt)
        content.audio.updateBall(content.ball.getState())

      } else if (state === 'playing') {
        content.player.update(dt)
        content.ai.update(dt, content.ball.getState())
        content.ball.update(dt)
        content.physics.resolve()
        content.audio.updateBall(content.ball.getState())

      } else if (state === 'goal_pause') {
        const prevState = content.scoring.getState()
        content.scoring.updateGoalPause(dt)
        const newState = content.scoring.getState()
        if (prevState === 'goal_pause' && newState === 'serving' &&
            content.scoring.getServingPlayer() === 'ai') {
          aiServeTimer = content.table.AI_SERVE_DELAY
        }
      }
    },

    isGameOver: () => content.scoring.getState() === 'game_over',
  }
})()
```

- [ ] **Step 2: Build — verify no syntax errors**

```bash
cd /Users/guillem/src/pong && npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/js/content.js
git commit -m "feat: implement game orchestrator in content.js"
```

---

## Task 10: Main Menu Screen

**Files:**
- Modify: `src/js/app/screen/splash.js` (rewrite)

- [ ] **Step 1: Rewrite `src/js/app/screen/splash.js`**

```javascript
app.screen.splash = app.screenManager.invent({
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    play: function () { this.change('game') },
    learnSounds: function () { this.change('learnSounds') },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement

    root.querySelector('.a-splash--version').innerHTML = `v${app.version()}`

    root.querySelector('.a-splash--play').addEventListener('click', () => {
      app.screenManager.dispatch('play')
    })

    root.querySelector('.a-splash--learn').addEventListener('click', () => {
      app.screenManager.dispatch('learnSounds')
    })
  },
  onEnter: function () {},
  onFrame: function () {},
})
```

- [ ] **Step 2: Build**

```bash
cd /Users/guillem/src/pong && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/js/app/screen/splash.js
git commit -m "feat: convert splash screen to main menu with Play/Learn Sounds buttons"
```

---

## Task 11: Learn Sounds Screen

**Files:**
- Create: `src/js/app/screen/learnSounds.js`

- [ ] **Step 1: Create `src/js/app/screen/learnSounds.js`**

```javascript
app.screen.learnSounds = app.screenManager.invent({
  id: 'learnSounds',
  parentSelector: '.a-app--learn-sounds',
  rootSelector: '.a-learn-sounds',
  transitions: {
    back: function () { this.change('splash') },
  },
  state: {
    demoActive: false,
  },
  onReady: function () {
    const root = this.rootElement

    const ballBtn = root.querySelector('.a-learn-sounds--ball-rolling')
    const warnBtn = root.querySelector('.a-learn-sounds--serve-warning')
    const backBtn = root.querySelector('.a-learn-sounds--back')

    const withDemo = (btn, fn) => {
      btn.addEventListener('click', () => {
        if (this.state.demoActive) return
        this.state.demoActive = true
        const orig = btn.textContent
        btn.setAttribute('aria-label', 'Playing…')
        btn.textContent = 'Playing…'
        fn(() => {
          btn.textContent = orig
          btn.removeAttribute('aria-label')
          this.state.demoActive = false
          btn.focus()
        })
      })
    }

    withDemo(ballBtn, (done) => content.audio.demoBallRolling(done))
    withDemo(warnBtn, (done) => content.audio.demoServeWarning(done))

    backBtn.addEventListener('click', () => {
      app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.demoActive = false
  },
  onExit: function () {
    this.state.demoActive = false
  },
  onFrame: function () {},
})
```

- [ ] **Step 2: Build**

```bash
cd /Users/guillem/src/pong && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/js/app/screen/learnSounds.js
git commit -m "feat: add learn sounds screen with ball rolling and serve warning demos"
```

---

## Task 12: Game Screen

**Files:**
- Modify: `src/js/app/screen/game.js` (rewrite)

- [ ] **Step 1: Rewrite `src/js/app/screen/game.js`**

```javascript
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    back: function () { this.change('splash') },
  },
  state: {
    gameStarted: false,
    showingGameOver: false,
  },
  onReady: function () {
    const root = this.rootElement

    root.querySelector('.a-game--start').addEventListener('click', () => {
      if (this.state.gameStarted) return
      const input = root.querySelector('.a-game--score-limit')
      const limit = Math.max(1, Math.min(99, parseInt(input.value, 10) || 7))
      this._startGame(limit)
    })

    root.querySelector('.a-game--back-pregame').addEventListener('click', () => {
      app.screenManager.dispatch('back')
    })

    root.querySelector('.a-game--return').addEventListener('click', () => {
      app.screenManager.dispatch('back')
    })

    this._swingHandler = (e) => {
      if (!this.state.gameStarted) return
      if (e.code === 'KeyA') content.game.playerAction('a')
      else if (e.code === 'KeyS') content.game.playerAction('s')
      else if (e.code === 'KeyD') content.game.playerAction('d')
    }
  },
  onEnter: function () {
    this.state.gameStarted = false
    this.state.showingGameOver = false

    const root = this.rootElement
    root.querySelector('.a-game--pregame').hidden = false
    root.querySelector('.a-game--gameover').hidden = true

    const input = root.querySelector('.a-game--score-limit')
    input.value = 7

    engine.loop.resume()
    window.addEventListener('keydown', this._swingHandler)
  },
  onExit: function () {
    window.removeEventListener('keydown', this._swingHandler)
    if (this.state.gameStarted) {
      content.game.stop()
      this.state.gameStarted = false
    }
    engine.loop.pause()
  },
  onFrame: function (e) {
    if (!this.state.gameStarted) return

    content.game.update(e)

    if (!this.state.showingGameOver && content.game.isGameOver()) {
      this.state.showingGameOver = true
      this._showGameOver()
    }
  },
  _startGame: function (limit) {
    this.state.gameStarted = true
    this.state.showingGameOver = false

    const root = this.rootElement
    root.querySelector('.a-game--pregame').hidden = true
    root.querySelector('.a-game--gameover').hidden = true

    content.game.start(limit)
  },
  _showGameOver: function () {
    const root = this.rootElement
    root.querySelector('.a-game--gameover').hidden = false
    root.querySelector('.a-game--return').focus()
  },
})
```

Note: The `content.game` reference connects to the `content` object defined in `content.js`. Since game.js is loaded after all content/*.js files (it's in `getAppJs()`), all `content.*` modules are already defined.

- [ ] **Step 2: Build**

```bash
cd /Users/guillem/src/pong && npm run build 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/js/app/screen/game.js
git commit -m "feat: implement game screen with full lifecycle and swing key handling"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Start dev server**

```bash
cd /Users/guillem/src/pong && npm run dev
```

Open `http://localhost:3000` in a browser (or whatever port `gulp-serve` uses — check the output).

- [ ] **Step 2: Main menu**

Verify:
- Page title reads "Pong"
- Two buttons accessible via Tab: "Play game" and "Learn sounds"
- Screen reader reads button labels correctly

- [ ] **Step 3: Learn sounds screen**

Verify:
- Clicking "Learn sounds" navigates to learn sounds screen
- "Ball rolling" button: clicking plays a sound that pans left → right → left over ~3 seconds. Button shows "Playing…" during demo.
- "Serve transfer warning" button: clicking plays ~5 descending-interval beeps
- "Back to main menu" returns to main menu

- [ ] **Step 4: Pre-game UI**

Verify:
- Clicking "Play game" shows game screen with "New game" heading, score limit input, "Start game" and "Back to menu" buttons
- Score limit input accepts numbers 1–99
- "Back to menu" returns to main menu

- [ ] **Step 5: Serve announcement**

Verify:
- Clicking "Start game" hides pre-game UI
- Screen reader announces either "You serve. You have 3 seconds." or "Computer serves."
- If you serve: countdown beeps start at ~1.5s remaining
- If computer serves: computer serves after ~0.8s, ball sound begins moving

- [ ] **Step 6: Ball audio**

Verify:
- Ball rolling sound is audible and pans left/right as ball moves across table
- Sound is louder when ball approaches player end vs. opponent end

- [ ] **Step 7: Player movement**

Verify:
- Arrow Left/Right moves paddle (click sound each step)
- Holding arrow key repeats movement after ~150ms initial delay, every ~80ms
- During swing cooldown (~450ms), movement is blocked

- [ ] **Step 8: Swing mechanics**

Verify:
- Pressing A, S, or D when ball is near player end AND in range → ball launches strongly (swing hit sound)
- Pressing A/S/D when in zone but out of range → miss sound + cooldown
- A/S/D have different lateral effects on ball direction

- [ ] **Step 9: Serve by player**

Verify:
- During serve phase, pressing A/S/D launches ball immediately

- [ ] **Step 10: Serve timeout**

Verify:
- If player doesn't serve within 3 seconds, beeps play, then "Serve transferred to computer" announced
- Computer auto-serves

- [ ] **Step 11: Wall bounces**

Verify:
- Ball bounces off left and right walls with a brief noise sound
- Ball gradually increases speed over many wall bounces, but caps

- [ ] **Step 12: Goal and score**

Verify:
- When ball exits past player end (missed paddle): goal sound + score announced
- 2-second pause, then non-scorer serves
- Score text correct in announcements (e.g., "3 to 2")

- [ ] **Step 13: AI behavior**

Verify:
- AI paddle tracks ball with a slight delay
- AI occasionally uses angled shots

- [ ] **Step 14: Game over**

Verify:
- When score limit reached: "Game over. You win X to Y." or "Game over. Computer wins Y to X."
- "Return to menu" button appears and gets focus
- Clicking it returns to main menu; can start a new game

- [ ] **Step 15: Final build commit**

If all verified:

```bash
cd /Users/guillem/src/pong && npm run build
git add -A
git commit -m "feat: complete pong audiogame v1 - player vs AI with spatial audio"
```

---

## Notes for Implementation

**Syngen sound coordinate mapping:** Listener is at origin facing +X. Positive Y = left, negative Y = right. Therefore: `syngen_x = tableY` (depth), `syngen_y = 6 - tableX` (left/right).

**Build order:** `content.js` is loaded first (defines `const content`), then `content/ai.js` through `content/table.js` alphabetically (all add to `content`). Cross-module references inside method bodies work via late binding — safe even if modules reference each other.

**ARIA announcement pattern:** Always clear `.js-announcer` to empty string first, then set via `setTimeout(50ms)` to force screen reader re-reading of identical messages.

**Loop pause state:** `engine.loop.start().pause()` in main.js starts the loop paused. The frame event still fires with `e.delta` populated. Game screen's `onEnter` calls `engine.loop.resume()` and `onExit` calls `engine.loop.pause()`. All screen `onFrame` handlers fire regardless of pause state.

**AI swing check:** The AI checks for a swing opportunity inside `content.ai.update()` and calls `content.ball.setVelocity()` directly. This happens before `content.ball.update(dt)` in the same frame, so the velocity change is applied immediately on the same frame.
