// Wires content events to one-shot SFX. Loaded last in content/.
content.wiring = (() => {
  let chompFlip = false
  return {
    init: function () {
      content.events.on('eat-pellet', () => {
        chompFlip = !chompFlip
        if (chompFlip) content.sfx.chompA()
        else content.sfx.chompB()
      })
      content.events.on('pacman-step', () => content.sfx.footstep())
      content.events.on('eat-power', () => content.sfx.eatPower())
      content.events.on('ghost-eaten', () => content.sfx.eatGhost())
      content.events.on('fruit-eaten', () => content.sfx.eatFruit())
      content.events.on('fruit-spawn', () => {
        // Subtle blip on appear (spatial prop fades in too)
        content.sfx.menuSelect()
      })
      content.events.on('extra-life', () => content.sfx.extraLife())
      content.events.on('life-lost', () => content.sfx.death())
      content.events.on('level-clear', () => content.sfx.levelClear())
      return this
    },
  }
})()
