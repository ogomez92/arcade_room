# TODO

Short-term follow-ups that are nice-to-have but not blockers for v2.0:

- [ ] Gamepad mapping for primary/secondary fire and sonar-range switch (currently keyboard-only in combat).
- [ ] Allow hold-to-fire on machine gun via gamepad trigger.
- [ ] Expose volume sliders (master, engine, radar, sonar, voice) in a Settings screen.
- [ ] Save last-picked mech per mode.
- [ ] Add haptic rumble hooks for gamepad users.
- [ ] Rebindable keys.
- [ ] Ensure PeerJS reconnection when a connection drops mid-match (currently announces "Disconnected.").
- [ ] Mech voice barks keyed to events (low health, weapon ready, stun, boost).
- [ ] Longer-term: arena obstacles / cover.

Known limitations:

- Combat damage is client-authoritative; two clients can disagree on a killing blow if packets arrive out of order. Acceptable for casual play; tighten if competitive play is ever a goal.
- The built-in music drone is intentionally minimal and uses simple oscillators. A proper syngen procedural track would be a nice upgrade.
