content.sfx = (() => {
  function tone(frequency, gain, pan = 0) {
    if (content.audio && content.audio.playTone) {
      content.audio.playTone({
        frequency,
        gain,
        hold: 0.035,
        pan,
        release: 0.12,
        type: 'triangle',
      })
    }
  }

  return {
    menuBack: function () {
      tone(220, 0.07, -0.15)
      return this
    },
    menuMove: function () {
      tone(330, 0.045, 0)
      return this
    },
    menuSelect: function () {
      tone(440, 0.065, 0)
      setTimeout(() => tone(660, 0.055, 0), 55)
      return this
    },
  }
})()
