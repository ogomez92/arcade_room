// Entity classes for Villains from Beyond.
//
// Entities use the original game's grid: x in [0..10] (lateral), ey is the
// forward position in the world (player at content.state.session.y). When
// `dead` flips true, the engine sweeps the entity out at the end of the tick.

content.entities = (() => {
  const audio = () => content.audio
  const S = () => content.state.session

  function rand(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1))
  }

  function lvl() { return content.state.session.level }

  // ---- Base enemy ----
  class Enemy {
    constructor(ex, ey, ground, isStatic, movetime, loopName, hitName, deathName) {
      this.ex = ex
      this.ey = ey
      this.ground = ground
      this.static = isStatic
      this.movetime = movetime
      this.loopName = loopName
      this.hitName = hitName
      this.deathName = deathName
      this.hp = 1
      this.scoreMult = 15
      this.dead = false
      this.noburst = false
      this.shoottime = Math.max(800, 5000 - 100 * lvl())
      this.shootElapsed = 0
      this.prepareshot = false
      this.moveElapsed = 0
      // Spawn an audible loop on the entity's grid position.
      this.loopRef = audio().loop({
        freq: this._loopFreq(),
        type: this._loopType(),
        peak: 0.35,
        ex: this.ex,
        ey: this.ey,
        py: S().y,
      })
    }

    _loopFreq() {
      // Different timbres per loop name so the player can identify enemies.
      const map = {
        enemy_1_lp: 440,
        enemy_2_lp: 330,
        enemy_3_lp: 220,
        enemy_4_lp: 165,
        enemy_5_lp: 360,
        enemy_6_lp: 280,
        enemy_7_lp: 200,
        enemy_8_lp: 150,
        towerlp: 110,
        itemlp: 600,
        genesis_lp: 60,
      }
      return map[this.loopName] || 300
    }

    _loopType() {
      const map = {
        enemy_1_lp: 'square',
        enemy_2_lp: 'sawtooth',
        enemy_3_lp: 'triangle',
        enemy_4_lp: 'sawtooth',
        enemy_5_lp: 'square',
        enemy_6_lp: 'square',
        enemy_7_lp: 'sawtooth',
        enemy_8_lp: 'sawtooth',
        towerlp: 'sawtooth',
        itemlp: 'triangle',
        genesis_lp: 'sawtooth',
      }
      return map[this.loopName] || 'square'
    }

    updateLoop() {
      if (this.loopRef && !this.dead) {
        this.loopRef.setPos(this.ex, this.ey, S().y)
      }
    }

    shoot(dt) {
      if (this.dead) return
      if (this.ey > S().y) {
        if (!this.prepareshot) {
          this.shootElapsed += dt
          if (this.shootElapsed >= this.shoottime) {
            this.shootElapsed = 0
            this.prepareshot = true
            audio().enemyShootWarn(this.ex, this.ey, S().y)
          }
        } else {
          this.shootElapsed += dt
          if (this.shootElapsed >= 731) {
            this.shootElapsed = 0
            this.prepareshot = false
            const movetime = 90 - 3 * lvl()
            content.world.spawnEnemyShot(this.ex, this.ey, true, movetime, false)
          }
        }
      }
    }

    didWeaponCollide(insta = false) {
      if (insta && !this.noburst) {
        audio().shieldExp()
        content.world.clearScreenNoisily()
      }
      this.hp -= 1
      if (this.hp >= 1) {
        if (this.hitName) audio().beamHit(this.ex, this.ey, S().y)
        this.hitAct()
      }
      if (this.hp <= 0 || (insta && !this.noburst)) {
        audio().beamHit(this.ex, this.ey, S().y)
        if (this.ground) {
          content.state.addScore(this.scoreMult * lvl())
        } else {
          content.state.addScore(this.scoreMult * Math.abs(this.ey - S().y) * lvl())
        }
        this.dead = true
        this.deathAct()
      }
    }

    deathAct() {
      content.world.combo()
    }

    hitAct() {}

    loopAct(dt) {
      if (this.ey < S().y - 25) {
        this.dead = true
      }
    }

    onDestroy() {
      if (this.loopRef) {
        this.loopRef.stop()
        this.loopRef = null
      }
    }
  }

  // ---- Tower (ground checkpoint) ----
  class Tower extends Enemy {
    constructor(ex, ey) {
      super(ex, ey, true, true, 0, 'towerlp', '', 'towerdestroy')
      this.scoreMult = 0
    }
    didWeaponCollide() {
      content.state.addScore(3000)
      audio().towerDestroy(this.ex, this.ey, S().y)
      this.dead = true
      S().checky = S().y
      content.world.announce('Tower destroyed - checkpoint set')
    }
  }

  // ---- Scorpion ----
  class Scorpion extends Enemy {
    constructor(ex, ey) {
      super(ex, ey, false, true, 0, 'itemlp', '', 'itemappear')
      this.scoreMult = 0
    }
    didWeaponCollide() {
      content.state.addScore(500)
      audio().itemAppear(this.ex, this.ey, S().y)
      this.dead = true
      // Spawn the falling item where the scorpion was.
      const itm = new Item(rand(0, 10), this.ey + 10)
      content.world.eshots.push(itm)
    }
  }

  // ---- Item (floating powerup, behaves like an enemy shot) ----
  class Item {
    constructor(ex, ey) {
      this.ex = ex
      this.ey = ey
      this.dead = false
      this.type = rand(1, 5)
      this.movetime = 90
      this.movetimer = 0
      this.moves = 30
      this.boom = false
      this.item = true
      this.guided = false
      // Distinct pitch per item type so each is recognizable.
      const baseFreq = [0, 660, 880, 990, 740, 550][this.type] || 600
      this.loopRef = audio().loop({
        freq: baseFreq,
        type: 'triangle',
        peak: 0.4,
        ex: this.ex,
        ey: this.ey,
        py: S().y,
      })
      this.itemFreq = baseFreq
    }

    cycle(dt) {
      this.movetimer += dt
      while (this.movetimer >= this.movetime) {
        this.movetimer -= this.movetime
        this.ey -= 1
        // Falling item glides downward in pitch as it gets closer.
        this.itemFreq = Math.max(120, this.itemFreq - 8)
        if (this.loopRef) this.loopRef.setFreq(this.itemFreq)
      }
      if (this.loopRef) this.loopRef.setPos(this.ex, this.ey, S().y)
      const px = S().x, py = S().y
      if (this.ex >= px - 1 && this.ex <= px + 1 && this.ey <= py) {
        content.world.obtainItem(this.type)
        this.dead = true
      }
      if (this.ey < py && !this.dead) {
        audio().itemPop()
        this.dead = true
      }
    }

    onDestroy() {
      if (this.loopRef) { this.loopRef.stop(); this.loopRef = null }
    }
  }

  // ---- Sphere shooter ----
  class SphereShooter extends Enemy {
    constructor(ex, ey) {
      super(ex, ey, false, true, 0, 'enemy_3_lp', '', 'enemy_3_die')
      this.scoreMult = 30
      this.shoottime = lvl() < 11 ? Math.max(800, 3000 - 200 * lvl()) : 800
    }
    shoot(dt) {
      if (this.dead) return
      if (this.ey > S().y) {
        if (!this.prepareshot) {
          this.shootElapsed += dt
          if (this.shootElapsed >= this.shoottime) {
            this.shootElapsed = 0
            this.prepareshot = true
            audio().sphereWarn(this.ex, this.ey, S().y)
          }
        } else {
          this.shootElapsed += dt
          if (this.shootElapsed >= 731) {
            this.shootElapsed = 0
            this.prepareshot = false
            // Sphere offsets to the side
            let lx
            do {
              lx = Math.random() < 0.5 ? -1 : 1
            } while ((lx == -1 && this.ex == 0) || (lx == 1 && this.ex == 10))
            const movetime = 110 - 3 * lvl()
            content.world.spawnEnemyShot(this.ex + lx, this.ey, false, movetime, true)
          }
        }
      }
    }
  }

  // ---- Porter ----
  class Porter extends Enemy {
    constructor(ex, ey) {
      super(ex, ey, false, true, 0, 'enemy_5_lp', '', 'enemy_5_die')
      this.scoreMult = 25
      this.porttime = 2700
      this.portElapsed = 0
    }
    loopAct(dt) {
      super.loopAct(dt)
      if (this.dead) return
      this.portElapsed += dt
      if (this.portElapsed >= this.porttime && this.ey >= S().y) {
        this.portElapsed = 0
        this.ex = rand(0, 10)
        if (this.loopRef) this.loopRef.setPos(this.ex, this.ey, S().y)
        audio().tone({freq: 700, type: 'square', duration: 0.15, peak: 0.3, ex: this.ex, ey: this.ey, py: S().y})
        if (this.porttime > 300) this.porttime -= 250
      }
    }
  }

  // ---- Bouncer ----
  class Bouncer extends Enemy {
    constructor(ex, ey) {
      super(ex, ey, false, true, 0, 'enemy_7_lp', 'enemy_7_hit', 'enemy_7_die')
      this.scoreMult = 30
      this.hp = 2
    }
    hitAct() {
      if (this.hp >= 1) this.ex = rand(0, 10)
      if (this.loopRef) this.loopRef.setPos(this.ex, this.ey, S().y)
    }
  }

  // ---- Slider/Turret (mvt) ----
  class Mvt extends Enemy {
    constructor(ex, ey, ground) {
      const esn = ground ? '8' : '6'
      super(ex, ey, ground, true, 0, 'enemy_' + esn + '_lp', '', 'enemy_' + esn + '_die')
      this.scoreMult = 45
      this.right = true
      this.mSpeed = 300
      this.mElapsed = 0
    }
    loopAct(dt) {
      super.loopAct(dt)
      if (this.dead) return
      this.mElapsed += dt
      if (this.mElapsed >= this.mSpeed) {
        this.mElapsed = 0
        if (this.ex == 10 || this.ex == 0) this.mSpeed = 900
        else this.mSpeed = 300
        if (this.ex == 10) this.right = false
        if (this.ex == 0) this.right = true
        if (this.right) this.ex += 1; else this.ex -= 1
      }
    }
  }

  // ---- Genesis (boss) ----
  class Genesis extends Enemy {
    constructor(ex, ey, hp) {
      super(ex, ey, false, true, 0, 'genesis_lp', 'genesis_hit', '')
      this.hp = hp
      this.noburst = true
      this.scoreMult = 0
    }
    hitAct() {
      if (this.hp != 0) {
        this.ey += 5
        this.ex = rand(0, 10)
        if (this.loopRef) this.loopRef.setPos(this.ex, this.ey, S().y)
        if (S().dangerLoopRef) S().dangerLoopRef.setPos(this.ex, this.ey, S().y)
        if (this.hp == 2) {
          S().dangerLoopRef = audio().genesisDanger(this.ex, this.ey, S().y)
          S().inDanger = true
        }
      }
    }
    loopAct(dt) {
      if (S().y >= this.ey && !this.dead) {
        // Player passed: forcefield kills you and clears shieldbits.
        S().shieldbits = 0
        audio().diegenesis()
        content.world.die()
      }
    }
    deathAct() {
      content.world.combo()
      content.state.addScore(5000 * Math.floor(lvl() / 3))
      content.state.addCash(1 * Math.floor(lvl() / 3))
      content.state.addCash(10 * lvl())
      if (S().dangerLoopRef) { S().dangerLoopRef.stop(); S().dangerLoopRef = null }
      S().genesisActive = false
      audio().genesisDie()
      S().y = S().maxlev
      S().destroyedGenesis = true
      S().inDanger = false
    }
  }

  // ---- Player projectiles ----
  class BeamShot {
    constructor(ex, ey, opts = {}) {
      this.ex = ex
      this.ey = ey
      this.dead = false
      this.movetime = opts.movetime || S().beamvel
      this.moves = 30
      this.insta = !!opts.insta
      this.elapsed = 0
    }
    move(dt) {
      this.elapsed += dt
      while (this.elapsed >= this.movetime) {
        this.elapsed -= this.movetime
        this.ey += 1
        // Beam-enemy collisions
        for (const en of content.world.enemies) {
          if (!en || en.dead) continue
          if (en.ground) continue
          if (en.ex == this.ex && en.ey == this.ey) {
            en.didWeaponCollide(this.insta)
            this.dead = true
            return
          }
        }
        // Beam-enemyshot collisions
        for (const sh of content.world.eshots) {
          if (!sh || sh.dead) continue
          if (sh.item) continue
          if (sh.ex == this.ex && sh.ey == this.ey) {
            sh.dead = true
            if (sh.boom) {
              audio().sphereExp(sh.ex, sh.ey, S().y)
              content.world.die()
            } else {
              audio().beamHit(sh.ex, sh.ey, S().y)
            }
            this.dead = true
            return
          }
        }
        this.moves -= 1
        if (this.moves <= 0) this.dead = true
      }
    }
  }

  class Bomb {
    constructor(ex, ey) {
      this.ex = ex
      this.ey = ey
      this.dead = false
      this.elapsed = 0
    }
    cycle(dt) {
      this.elapsed += dt
      if (this.elapsed >= 500) {
        if (S().toweractive && S().towerWindow > 0) {
          // Reveal a tower behind the player.
          content.state.addScore(1500)
          audio().towerAppear(this.ex, this.ey, S().y)
          let rx = rand(0, 10)
          while (rx > S().x - 2 && rx < S().x + 2) {
            rx = rand(0, 10)
          }
          const ry = rand(S().y - 1, S().y + 3)
          content.world.enemies.push(new Tower(rx, ry))
          S().toweractive = false
          S().towerWindow = 0
        }
        const area = S().bombarea
        for (const en of content.world.enemies) {
          if (!en || en.dead || !en.ground) continue
          const xCondition = (en.ex == this.ex)
            || (en.ex > this.ex - 2 && en.ex < this.ex + 2)
          const yCondition = (en.ey == this.ey)
            || (en.ey > this.ey - area && en.ey < this.ey + area)
          if (xCondition && yCondition) {
            en.didWeaponCollide()
          }
        }
        audio().bombHit(this.ex, this.ey, S().y)
        this.dead = true
      }
    }
  }

  class BitShot extends BeamShot {
    constructor() {
      super(S().x, S().y, {movetime: 20, insta: true})
    }
  }

  // ---- Enemy projectiles ----
  class EnemyShot {
    constructor(ex, ey, guided, movetime, sphere = false) {
      this.ex = ex
      this.ey = ey
      this.guided = guided
      this.movetime = movetime
      this.elapsed = 0
      this.moves = 30
      this.dead = false
      this.avoided = false
      this.boom = sphere
      this.item = false
      const freq = sphere ? 130 : 500
      const type = sphere ? 'sawtooth' : 'square'
      this.loopRef = audio().loop({freq, type, peak: 0.25, ex: this.ex, ey: this.ey, py: S().y})
    }
    cycle(dt) {
      this.elapsed += dt
      while (this.elapsed >= this.movetime) {
        this.elapsed -= this.movetime
        this.ey -= 1
        if (this.moves % 4 == 0 && this.guided) {
          if (S().x < this.ex) this.ex -= 1
          else if (S().x > this.ex) this.ex += 1
        }
        this.moves -= 1
      }
      if (this.loopRef) this.loopRef.setPos(this.ex, this.ey, S().y)
      if (this.ex == S().x && this.ey == S().y) {
        if (this.boom) audio().sphereExp(this.ex, this.ey, S().y)
        content.world.die()
        this.dead = true
        return
      }
      if (this.ey < S().y && !this.avoided) {
        this.avoided = true
        content.state.addScore(10 * lvl())
        audio().avoid()
      }
      if (this.moves <= 0) this.dead = true
    }
    onDestroy() {
      if (this.loopRef) { this.loopRef.stop(); this.loopRef = null }
    }
  }

  return {
    Enemy, Tower, Scorpion, Item,
    SphereShooter, Porter, Bouncer, Mvt, Genesis,
    BeamShot, Bomb, BitShot, EnemyShot,
    rand,
  }
})()
