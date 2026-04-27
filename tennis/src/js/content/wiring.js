// Connects physics/match events to audio so bounces, net hits, and
// footsteps fire spatial one-shots. Kept separate from audio.js so
// audio.js can be reused (e.g. by a sound-test screen) without
// pulling in match-specific subscriptions.
content.wiring = (() => {
  let attached = false

  function attach() {
    if (attached) return
    attached = true

    content.events.on('bounce', (ev) => {
      content.audio.playBounce({x: ev.x, y: ev.y, z: 0}, content.ball.speed())
    })

    content.events.on('netHit', (ev) => {
      content.audio.playNetHit({x: ev.x, y: 0, z: ev.z})
    })

    content.events.on('footstep', (ev) => {
      content.audio.playFootstep({x: ev.x, y: ev.y, z: 0}, ev.by)
    })
  }

  return {attach}
})()
