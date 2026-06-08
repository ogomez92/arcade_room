// CADENCE — the campaign. Each entry drives both the chart generator
// (content.sequence) and the music engine (content.music). The story is told
// across the briefings (see i18n story.* keys); difficulty climbs through tempo,
// density, tighter timing windows, and new threat kinds (drones arrive midway,
// OFFBEATS arrive in Act II).
//
// ACT I (sectors 1–10) is the original infiltration that ends by silencing
// MAESTRO at the Core. ACT II (sectors 11–15) is the reprise: a buried backup
// conductor — RONDO — reboots the broadcast, now SYNCOPATED to slip past your
// trained ear, and you descend again to kill it for good. Offbeats (threats on
// the "and") are RONDO's signature and live only in Act II (`mech.off`).
//
// Music note: the kick lands on EVERY gameplay beat (the metronome you move to),
// so the four-on-the-floor pulse is guaranteed regardless of a level's `style`.
// `style` only layers extra colour on top.
content.levels = (() => {
  // Scales as semitone sets, for the arpeggio / lead note pools.
  const SCALES = {
    minor:         [0, 2, 3, 5, 7, 8, 10],
    dorian:        [0, 2, 3, 5, 7, 9, 10],
    phrygian:      [0, 1, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    major:         [0, 2, 4, 5, 7, 9, 11],
  }

  // A chord is {r: semitone offset from the key root, q: quality}. One per bar.
  // Qualities: 'min' 'maj' 'dim' 'sus2'.
  const LEVELS = [
    // ===== ACT I — infiltration, ending at the Core =========================
    {
      id: 1, nameKey: 'level.1.name', storyKey: 'story.1', tutorialKey: 'tut.1',
      mech: {enemy: false, hurdle: false, beam: false, drone: false, off: false},
      bpm: 88, length: 44, density: 0.0, minGap: 3,
      mix: {enemy: 1, hurdle: 0, beam: 0}, droneShare: 0, offShare: 0,
      hitWindow: 0.20, perfectWindow: 0.085,
      // The opener: an easy, steps-only ease-in, but a proper groove now — a
      // bouncing octave sub-bass, 8th-note hats, a gentle arp + a sparse noir
      // hook, and dorian's bright major-IV for colour. Still relaxed (88 bpm),
      // and the kick stays well on top so the pulse to step on is unmistakable.
      music: {
        root: 45, scale: 'dorian',
        prog: [{r: 0, q: 'min'}, {r: 0, q: 'min'}, {r: 5, q: 'maj'}, {r: 3, q: 'maj'}],
        style: {snare: '2and4', hats: 2, bass: 'octave', pad: true, arp: true, lead: true, stab: false},
        timbre: {bass: 'sub', lead: 'triangle', pad: 'saw'}, swing: 0.06, intensity: 0.85,
      },
    },
    {
      id: 2, nameKey: 'level.2.name', storyKey: 'story.2', tutorialKey: 'tut.2',
      mech: {enemy: true, hurdle: false, beam: false, drone: false, off: false},
      bpm: 96, length: 46, density: 0.32, minGap: 2,
      mix: {enemy: 1, hurdle: 0, beam: 0}, droneShare: 0, offShare: 0,
      hitWindow: 0.19, perfectWindow: 0.08,
      music: {
        root: 43, scale: 'minor',
        prog: [{r: 0, q: 'min'}, {r: 8, q: 'maj'}, {r: 10, q: 'maj'}, {r: 0, q: 'min'}],
        style: {snare: '2and4', hats: 2, bass: 'octave', pad: true, arp: false, lead: false, stab: true},
        timbre: {bass: 'saw', lead: 'triangle', pad: 'saw'}, swing: 0.05, intensity: 0.8,
      },
    },
    {
      id: 3, nameKey: 'level.3.name', storyKey: 'story.3', tutorialKey: 'tut.3',
      mech: {enemy: true, hurdle: true, beam: false, drone: false, off: false},
      bpm: 104, length: 48, density: 0.36, minGap: 2,
      mix: {enemy: 0.6, hurdle: 0.4, beam: 0}, droneShare: 0, offShare: 0,
      hitWindow: 0.18, perfectWindow: 0.075,
      music: {
        root: 41, scale: 'dorian',
        prog: [{r: 0, q: 'min'}, {r: 3, q: 'maj'}, {r: 5, q: 'min'}, {r: 7, q: 'maj'}],
        style: {snare: 'backbeat', hats: 2, bass: 'driving', pad: true, arp: true, lead: false, stab: true},
        timbre: {bass: 'saw', lead: 'square', pad: 'saw'}, swing: 0.03, intensity: 0.9,
      },
    },
    {
      id: 4, nameKey: 'level.4.name', storyKey: 'story.4', tutorialKey: 'tut.4',
      mech: {enemy: true, hurdle: true, beam: true, drone: false, off: false},
      bpm: 112, length: 50, density: 0.40, minGap: 2,
      mix: {enemy: 0.5, hurdle: 0.25, beam: 0.25}, droneShare: 0, offShare: 0,
      hitWindow: 0.17, perfectWindow: 0.07,
      music: {
        root: 44, scale: 'minor',
        prog: [{r: 0, q: 'min'}, {r: 7, q: 'min'}, {r: 8, q: 'maj'}, {r: 5, q: 'min'}],
        style: {snare: 'backbeat', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true},
        timbre: {bass: 'saw', lead: 'fm', pad: 'saw'}, swing: 0.0, intensity: 1.0,
      },
    },
    {
      id: 5, nameKey: 'level.5.name', storyKey: 'story.5', tutorialKey: 'tut.5',
      mech: {enemy: true, hurdle: true, beam: true, drone: false, off: false},
      bpm: 119, length: 52, density: 0.46, minGap: 1,
      mix: {enemy: 0.5, hurdle: 0.25, beam: 0.25}, droneShare: 0, offShare: 0,
      hitWindow: 0.16, perfectWindow: 0.065,
      music: {
        root: 40, scale: 'phrygian',
        prog: [{r: 0, q: 'min'}, {r: 1, q: 'maj'}, {r: 0, q: 'min'}, {r: 5, q: 'min'}],
        style: {snare: 'backbeat', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true},
        timbre: {bass: 'square', lead: 'square', pad: 'saw'}, swing: 0.0, intensity: 1.1,
      },
    },
    {
      id: 6, nameKey: 'level.6.name', storyKey: 'story.6', tutorialKey: 'tut.6',
      mech: {enemy: true, hurdle: true, beam: true, drone: true, off: false},
      bpm: 126, length: 48, density: 0.50, minGap: 1,
      mix: {enemy: 0.5, hurdle: 0.25, beam: 0.25}, droneShare: 0.22, offShare: 0,
      hitWindow: 0.155, perfectWindow: 0.06,
      music: {
        root: 42, scale: 'harmonicMinor',
        prog: [{r: 0, q: 'min'}, {r: 8, q: 'maj'}, {r: 7, q: 'maj'}, {r: 0, q: 'min'}],
        style: {snare: 'backbeat', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true},
        timbre: {bass: 'saw', lead: 'fm', pad: 'saw'}, swing: 0.0, intensity: 1.2,
      },
    },
    {
      id: 7, nameKey: 'level.7.name', storyKey: 'story.7', tutorialKey: 'tut.7',
      mech: {enemy: true, hurdle: true, beam: true, drone: true, off: false},
      bpm: 132, length: 52, density: 0.55, minGap: 1,
      mix: {enemy: 0.52, hurdle: 0.24, beam: 0.24}, droneShare: 0.35, offShare: 0,
      hitWindow: 0.15, perfectWindow: 0.06,
      music: {
        root: 39, scale: 'phrygian',
        prog: [{r: 0, q: 'min'}, {r: 1, q: 'maj'}, {r: 3, q: 'maj'}, {r: 0, q: 'min'}],
        style: {snare: 'driving', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true},
        timbre: {bass: 'square', lead: 'square', pad: 'saw'}, swing: 0.0, intensity: 1.3,
      },
    },
    {
      id: 8, nameKey: 'level.8.name', storyKey: 'story.8', tutorialKey: 'tut.8',
      mech: {enemy: true, hurdle: true, beam: true, drone: true, off: false},
      bpm: 138, length: 56, density: 0.60, minGap: 1,
      mix: {enemy: 0.52, hurdle: 0.24, beam: 0.24}, droneShare: 0.45, offShare: 0,
      hitWindow: 0.14, perfectWindow: 0.055,
      music: {
        root: 41, scale: 'harmonicMinor',
        prog: [{r: 0, q: 'min'}, {r: 5, q: 'min'}, {r: 8, q: 'maj'}, {r: 7, q: 'maj'}],
        style: {snare: 'driving', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true},
        timbre: {bass: 'saw', lead: 'fm', pad: 'saw'}, swing: 0.0, intensity: 1.4,
      },
    },
    {
      id: 9, nameKey: 'level.9.name', storyKey: 'story.9', tutorialKey: 'tut.9',
      mech: {enemy: true, hurdle: true, beam: true, drone: true, off: false},
      bpm: 144, length: 60, density: 0.66, minGap: 1,
      mix: {enemy: 0.54, hurdle: 0.23, beam: 0.23}, droneShare: 0.55, offShare: 0,
      hitWindow: 0.13, perfectWindow: 0.05,
      music: {
        root: 38, scale: 'phrygian',
        prog: [{r: 0, q: 'min'}, {r: 1, q: 'maj'}, {r: 0, q: 'min'}, {r: 11, q: 'maj'}],
        style: {snare: 'driving', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true},
        timbre: {bass: 'square', lead: 'square', pad: 'saw'}, swing: 0.0, intensity: 1.5,
      },
    },
    {
      id: 10, nameKey: 'level.10.name', storyKey: 'story.10', tutorialKey: 'tut.10',
      mech: {enemy: true, hurdle: true, beam: true, drone: true, off: false},
      bpm: 150, length: 72, density: 0.70, minGap: 1,
      mix: {enemy: 0.56, hurdle: 0.22, beam: 0.22}, droneShare: 0.62, offShare: 0,
      hitWindow: 0.125, perfectWindow: 0.05,
      music: {
        root: 45, scale: 'harmonicMinor',
        prog: [{r: 0, q: 'min'}, {r: 8, q: 'maj'}, {r: 10, q: 'maj'}, {r: 0, q: 'min'}],
        style: {snare: 'driving', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true},
        timbre: {bass: 'saw', lead: 'fm', pad: 'saw'}, swing: 0.0, intensity: 1.6,
      },
    },

    // ===== ACT II — the reprise (RONDO reboots, now syncopated) =============
    {
      id: 11, nameKey: 'level.11.name', storyKey: 'story.11', tutorialKey: 'tut.11',
      mech: {enemy: true, hurdle: true, beam: true, drone: true, off: true},
      bpm: 152, length: 64, density: 0.46, minGap: 1,
      mix: {enemy: 0.54, hurdle: 0.23, beam: 0.23}, droneShare: 0.40, offShare: 0.65,
      hitWindow: 0.096, perfectWindow: 0.040,
      music: {
        root: 38, scale: 'phrygian',
        prog: [{r: 0, q: 'min'}, {r: 1, q: 'maj'}, {r: 0, q: 'min'}, {r: 11, q: 'maj'}],
        style: {snare: 'driving', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true, arp16: true, leadBusy: true, offStab: true, bassOff: true},
        timbre: {bass: 'square', lead: 'fm', pad: 'saw'}, swing: 0.0, intensity: 1.55,
      },
    },
    {
      id: 12, nameKey: 'level.12.name', storyKey: 'story.12', tutorialKey: 'tut.12',
      mech: {enemy: true, hurdle: true, beam: true, drone: true, off: true},
      bpm: 157, length: 68, density: 0.42, minGap: 1,
      mix: {enemy: 0.54, hurdle: 0.23, beam: 0.23}, droneShare: 0.46, offShare: 0.85,
      hitWindow: 0.092, perfectWindow: 0.038,
      music: {
        root: 41, scale: 'harmonicMinor',
        prog: [{r: 0, q: 'min'}, {r: 5, q: 'min'}, {r: 8, q: 'maj'}, {r: 7, q: 'maj'}],
        style: {snare: 'driving', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true, arp16: true, leadBusy: true, offStab: true, bassOff: true},
        timbre: {bass: 'saw', lead: 'fm', pad: 'saw'}, swing: 0.0, intensity: 1.6,
      },
    },
    {
      id: 13, nameKey: 'level.13.name', storyKey: 'story.13', tutorialKey: 'tut.13',
      mech: {enemy: true, hurdle: true, beam: true, drone: true, off: true},
      bpm: 162, length: 72, density: 0.38, minGap: 1,
      mix: {enemy: 0.56, hurdle: 0.22, beam: 0.22}, droneShare: 0.52, offShare: 1.05,
      hitWindow: 0.089, perfectWindow: 0.037,
      music: {
        root: 40, scale: 'phrygian',
        prog: [{r: 0, q: 'min'}, {r: 1, q: 'maj'}, {r: 3, q: 'maj'}, {r: 0, q: 'min'}],
        style: {snare: 'driving', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true, arp16: true, leadBusy: true, offStab: true, bassOff: true},
        timbre: {bass: 'square', lead: 'square', pad: 'saw'}, swing: 0.0, intensity: 1.65,
      },
    },
    {
      id: 14, nameKey: 'level.14.name', storyKey: 'story.14', tutorialKey: 'tut.14',
      mech: {enemy: true, hurdle: true, beam: true, drone: true, off: true},
      bpm: 167, length: 76, density: 0.34, minGap: 1,
      mix: {enemy: 0.56, hurdle: 0.22, beam: 0.22}, droneShare: 0.56, offShare: 1.30,
      hitWindow: 0.086, perfectWindow: 0.036,
      music: {
        root: 43, scale: 'harmonicMinor',
        prog: [{r: 0, q: 'min'}, {r: 8, q: 'maj'}, {r: 7, q: 'maj'}, {r: 0, q: 'min'}],
        style: {snare: 'driving', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true, arp16: true, leadBusy: true, offStab: true, bassOff: true},
        timbre: {bass: 'saw', lead: 'fm', pad: 'saw'}, swing: 0.0, intensity: 1.7,
      },
    },
    {
      id: 15, nameKey: 'level.15.name', storyKey: 'story.15', tutorialKey: 'tut.15',
      mech: {enemy: true, hurdle: true, beam: true, drone: true, off: true},
      bpm: 172, length: 88, density: 0.30, minGap: 1,
      mix: {enemy: 0.58, hurdle: 0.21, beam: 0.21}, droneShare: 0.60, offShare: 1.60,
      hitWindow: 0.083, perfectWindow: 0.035,
      music: {
        root: 45, scale: 'harmonicMinor',
        prog: [{r: 0, q: 'min'}, {r: 8, q: 'maj'}, {r: 10, q: 'maj'}, {r: 0, q: 'min'}],
        style: {snare: 'driving', hats: 3, bass: 'driving', pad: true, arp: true, lead: true, stab: true, arp16: true, leadBusy: true, offStab: true, bassOff: true},
        timbre: {bass: 'square', lead: 'fm', pad: 'saw'}, swing: 0.0, intensity: 1.8,
      },
    },
  ]

  function get(level) {
    const i = Math.max(1, Math.min(LEVELS.length, level | 0))
    return LEVELS[i - 1]
  }

  return {
    SCALES,
    LEVELS,
    get,
    count: () => LEVELS.length,
    beatDur: (level) => 60 / get(level).bpm,
  }
})()
