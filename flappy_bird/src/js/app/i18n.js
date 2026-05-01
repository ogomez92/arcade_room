/**
 * Lightweight i18n for accessible audio games.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
 * 2-letter prefix → fallback ('en').
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'flappy.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Audio Flappy',

      // Splash
      'splash.author': 'an audio-first arcade',
      'splash.instruction': 'Press any key to begin',
      'splash.subtitle': 'A pure-audio Flappy Bird. Listen, flap, survive.',

      // Main menu
      'menu.aria': 'Main menu',
      'menu.title': 'Audio Flappy',
      'menu.subtitle': 'Choose an option below.',
      'menu.play': 'Play',
      'menu.tutorial': 'Tutorial',
      'menu.help': 'How to play',
      'menu.learn': 'Learn the sounds',
      'menu.highscores': 'High scores',
      'menu.language': 'Language',

      // Tutorial
      'tutorial.aria': 'Tutorial',
      'tutorial.title': 'Tutorial',
      'tutorial.hint': 'Press Enter to continue, Space to replay the sound, Escape to skip.',
      'tutorial.progress': 'Step {n} of {total}',
      'tutorial.replay': 'Replay sound',
      'tutorial.next': 'Next',
      'tutorial.skip': 'Skip to menu',
      'tutorial.finished': 'Tutorial complete. Good luck!',
      // 12 steps
      'tutorial.s1.title': 'Welcome',
      'tutorial.s1.body': 'This is an audio-first Flappy Bird. The whole game can be played by ear. We will walk through every sound you need.',
      'tutorial.s2.title': 'Your altitude tone',
      'tutorial.s2.body': 'A continuous tone tells you how high your bird is. You will hear three tones now: low altitude, middle, then high. Higher pitch means higher position.',
      'tutorial.s3.title': 'A wide pipe gap',
      'tutorial.s3.body': 'Each pipe is voiced by two tones — the lower edge of the gap and the upper edge. The space between them is the gap. Listen to a wide gap.',
      'tutorial.s4.title': 'A narrow pipe gap',
      'tutorial.s4.body': 'Now a narrow gap. The two tones are close in pitch, leaving little room. The harder the run gets, the narrower the gaps.',
      'tutorial.s5.title': 'Pipes pan as they pass',
      'tutorial.s5.body': 'A pipe enters from the right, panning towards the center as it reaches you, then to the left as it passes behind. Listen to one fly past.',
      'tutorial.s6.title': 'Aimed at the gap',
      'tutorial.s6.body': 'When your altitude tone sits between the two pipe tones, you are lined up with the gap. This is the sound of being aimed correctly.',
      'tutorial.s7.title': 'Aimed too low',
      'tutorial.s7.body': 'If your altitude tone is below both pipe tones, you are too low. Flap to climb. This is what too low sounds like.',
      'tutorial.s8.title': 'Aimed too high',
      'tutorial.s8.body': 'If your altitude tone is above both pipe tones, you are too high. Stop flapping and let gravity bring you down.',
      'tutorial.s9.title': 'Crash warning klaxon',
      'tutorial.s9.body': 'When a pipe is close and you are still outside the gap, a pulsing klaxon rises. Adjust altitude until it stops.',
      'tutorial.s10.title': 'Rhythm metronome',
      'tutorial.s10.body': 'The metronome ticks at the cadence of level flight: flap on every tick and you stay roughly at the same altitude. Flap between ticks to climb. Skip a tick to dip down.',
      'tutorial.s11.title': 'Status hotkeys',
      'tutorial.s11.body': 'During play, F1 reads your score, F2 reads the distance to the next pipe, F3 reads your altitude, F4 reads your best score.',
      'tutorial.s12.title': 'Ready to fly!',
      'tutorial.s12.body': 'That is the whole audio language. Press Enter to return to the menu, then choose Play. Good luck.',

      // Game HUD
      'game.aria': 'Flappy Bird game',
      'game.scoreLabel': 'Score',
      'game.bestLabel': 'Best',
      'game.altitudeLabel': 'Altitude',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.intro': 'Flap to keep the bird airborne and pass through the gaps in incoming pipes. Each pipe you clear scores one point. Hitting a pipe, the floor, or the ceiling ends the run.',
      'help.controlsTitle': 'Controls',
      'help.flap': '<kbd>Space</kbd> or <kbd>↑</kbd> — flap',
      'help.menuNav': '<kbd>↑</kbd> <kbd>↓</kbd> — move focus, <kbd>Enter</kbd> to confirm, <kbd>Esc</kbd> to go back',
      'help.statusTitle': 'Status hotkeys (during play)',
      'help.f1': '<kbd>F1</kbd> — read current score',
      'help.f2': '<kbd>F2</kbd> — read distance to the next pipe',
      'help.f3': '<kbd>F3</kbd> — read your altitude (low / mid / high)',
      'help.f4': '<kbd>F4</kbd> — read your best score',
      'help.audioTitle': 'Listening guide',
      'help.audio1': 'A continuous tone tells you your altitude — higher pitch means higher in the world.',
      'help.audio2': 'Each pipe is voiced by two tones — the lower edge of the gap as a low tone, the upper edge as a high tone. Steer between them.',
      'help.audio3': 'The pipe pans from right (incoming) through center (at the bird) to left (passed). Pan + volume tell you how close it is.',
      'help.audio4': 'A pulsing klaxon rises if you are about to crash into a pipe edge. Flap or fall to find the gap.',
      'help.audio5': 'A regular tick marks the rhythm of level flight — flap on every tick to stay at altitude, flap between ticks to climb, skip a tick to descend.',
      'help.back': 'Back',

      // Learn the sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Audition each cue individually.',
      'learn.flap': 'Wing flap',
      'learn.score': 'Score (passed pipe)',
      'learn.collide': 'Collision',
      'learn.gameOver': 'Game over',
      'learn.menuMove': 'Menu move',
      'learn.menuSelect': 'Menu select',
      'learn.menuBack': 'Menu back',
      'learn.altitudeLow': 'Altitude tone (low)',
      'learn.altitudeMid': 'Altitude tone (mid)',
      'learn.altitudeHigh': 'Altitude tone (high)',
      'learn.pipeDemo': 'Pipe pair (gap in middle)',
      'learn.pipeNarrow': 'Pipe pair (narrow gap)',
      'learn.warning': 'Crash warning klaxon',
      'learn.tick': 'Rhythm tick',
      'learn.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Top 10 scores on this device.',
      'highscores.empty': 'No scores yet — go play.',
      'highscores.entry': '{name} — {score}',
      'highscores.back': 'Back',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game over',
      'gameover.score': 'Final score: {score}',
      'gameover.best': 'Best: {best}',
      'gameover.newRecord': 'New high score!',
      'gameover.namePrompt': 'Enter your name to record this run:',
      'gameover.namePlaceholder': 'Your name',
      'gameover.save': 'Save',
      'gameover.continue': 'Continue',
      'gameover.reasonFloor': 'You hit the ground.',
      'gameover.reasonCeiling': 'You hit the ceiling.',
      'gameover.reasonPipe': 'You hit a pipe.',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Announcements
      'ann.menu': 'Main menu. Up and down to navigate, Enter to confirm.',
      'ann.help': 'How to play. Press Escape to return.',
      'ann.learnHello': 'Learn the sounds. Choose a button to audition.',
      'ann.playing': 'Playing: {label}',
      'ann.highscoresEmpty': 'No high scores yet.',
      'ann.highscoresList': 'High scores. {top}',
      'ann.gameStart': 'Flap to begin.',
      'ann.score': 'Score: {score}',
      'ann.altitudeLow': 'Altitude: low.',
      'ann.altitudeMid': 'Altitude: middle.',
      'ann.altitudeHigh': 'Altitude: high.',
      'ann.nextPipeFar': 'Next pipe: far.',
      'ann.nextPipeNear': 'Next pipe in {dist}.',
      'ann.bestScore': 'Best score: {best}.',
      'ann.gameOver': 'Game over. Score {score}.',
      'ann.gameOverHigh': 'Game over. New record! Score {score}.',
      'ann.scoreSaved': 'Score saved.',
    },

    es: {
      // <head>
      'doc.title': 'Flappy Audio',

      // Splash
      'splash.author': 'arcade audio-first',
      'splash.instruction': 'Pulsa una tecla para empezar',
      'splash.subtitle': 'Un Flappy Bird puramente sonoro. Escucha, aletea, sobrevive.',

      // Main menu
      'menu.aria': 'Menú principal',
      'menu.title': 'Flappy Audio',
      'menu.subtitle': 'Elige una opción.',
      'menu.play': 'Jugar',
      'menu.tutorial': 'Tutorial',
      'menu.help': 'Cómo se juega',
      'menu.learn': 'Aprender los sonidos',
      'menu.highscores': 'Mejores puntuaciones',
      'menu.language': 'Idioma',

      // Tutorial
      'tutorial.aria': 'Tutorial',
      'tutorial.title': 'Tutorial',
      'tutorial.hint': 'Pulsa Intro para avanzar, Espacio para repetir el sonido, Escape para salir.',
      'tutorial.progress': 'Paso {n} de {total}',
      'tutorial.replay': 'Repetir sonido',
      'tutorial.next': 'Siguiente',
      'tutorial.skip': 'Saltar al menú',
      'tutorial.finished': 'Tutorial completado. ¡Mucha suerte!',
      'tutorial.s1.title': 'Bienvenida',
      'tutorial.s1.body': 'Este es un Flappy Bird audio-first. Todo el juego se puede jugar de oído. Vamos a repasar cada sonido que necesitas.',
      'tutorial.s2.title': 'Tu tono de altitud',
      'tutorial.s2.body': 'Un tono continuo te indica la altura del pájaro. Vas a oír tres tonos: baja, media y alta. Cuanto más agudo, más arriba estás.',
      'tutorial.s3.title': 'Un hueco ancho',
      'tutorial.s3.body': 'Cada tubería suena con dos tonos: el borde inferior del hueco y el superior. El espacio entre los dos es el hueco. Escucha un hueco ancho.',
      'tutorial.s4.title': 'Un hueco estrecho',
      'tutorial.s4.body': 'Ahora un hueco estrecho. Los dos tonos están muy cerca en altura, dejando poco margen. Cuanto más avanza la partida, más estrechos.',
      'tutorial.s5.title': 'La tubería se desplaza',
      'tutorial.s5.body': 'La tubería entra por la derecha, pasa por el centro cuando te alcanza y se va por la izquierda cuando ya la has rebasado. Escucha cómo te cruza.',
      'tutorial.s6.title': 'Alineado con el hueco',
      'tutorial.s6.body': 'Cuando tu tono de altitud queda entre los dos tonos de la tubería, estás justo a la altura del hueco. Así suena estar bien alineado.',
      'tutorial.s7.title': 'Demasiado bajo',
      'tutorial.s7.body': 'Si tu tono está por debajo de los dos de la tubería, vas demasiado bajo. Aletea para subir. Esto es lo que se oye cuando vas bajo.',
      'tutorial.s8.title': 'Demasiado alto',
      'tutorial.s8.body': 'Si tu tono queda por encima de los dos de la tubería, vas demasiado alto. Deja de aletear y la gravedad te bajará.',
      'tutorial.s9.title': 'Alarma de choque',
      'tutorial.s9.body': 'Cuando una tubería está cerca y aún estás fuera del hueco, una alarma pulsada sube. Ajusta la altitud hasta que se calle.',
      'tutorial.s10.title': 'Metrónomo de ritmo',
      'tutorial.s10.body': 'El metrónomo marca la cadencia del vuelo nivelado: si aleteas en cada tic, te mantienes más o menos a la misma altura. Aletea entre tics para subir. Sáltate un tic para bajar un poco.',
      'tutorial.s11.title': 'Teclas de estado',
      'tutorial.s11.body': 'Durante el juego, F1 lee tu puntuación, F2 la distancia a la próxima tubería, F3 tu altitud, F4 tu récord.',
      'tutorial.s12.title': '¡A volar!',
      'tutorial.s12.body': 'Ese es todo el lenguaje sonoro. Pulsa Intro para volver al menú y elige Jugar. Mucha suerte.',

      // Game HUD
      'game.aria': 'Juego Flappy Bird',
      'game.scoreLabel': 'Puntos',
      'game.bestLabel': 'Récord',
      'game.altitudeLabel': 'Altitud',

      // Help
      'help.aria': 'Cómo se juega',
      'help.title': 'Cómo se juega',
      'help.intro': 'Aletea para mantener al pájaro en el aire y pasa por los huecos de las tuberías. Cada tubería superada da un punto. Si chocas con una tubería, con el suelo o con el techo, la partida termina.',
      'help.controlsTitle': 'Controles',
      'help.flap': '<kbd>Espacio</kbd> o <kbd>↑</kbd> — aletear',
      'help.menuNav': '<kbd>↑</kbd> <kbd>↓</kbd> — mover el foco, <kbd>Intro</kbd> para confirmar, <kbd>Esc</kbd> para volver',
      'help.statusTitle': 'Teclas de estado (durante el juego)',
      'help.f1': '<kbd>F1</kbd> — leer la puntuación actual',
      'help.f2': '<kbd>F2</kbd> — leer la distancia a la próxima tubería',
      'help.f3': '<kbd>F3</kbd> — leer tu altitud (baja / media / alta)',
      'help.f4': '<kbd>F4</kbd> — leer tu mejor puntuación',
      'help.audioTitle': 'Guía sonora',
      'help.audio1': 'Un tono continuo te indica tu altitud: cuanto más agudo, más alto estás.',
      'help.audio2': 'Cada tubería suena con dos tonos — el borde inferior del hueco como tono grave, el superior como agudo. Pasa por en medio.',
      'help.audio3': 'La tubería se desplaza de derecha (acercándose) a centro (a tu altura) a izquierda (rebasada). El paneo y el volumen indican la distancia.',
      'help.audio4': 'Una alarma pulsada se intensifica si estás a punto de chocar con un borde. Aletea o cae para encontrar el hueco.',
      'help.audio5': 'Un tic regular marca el ritmo del vuelo nivelado: aletea en cada tic para mantener la altitud, aletea entre tics para subir, sáltate un tic para bajar.',
      'help.back': 'Atrás',

      // Learn the sounds
      'learn.aria': 'Aprender los sonidos',
      'learn.title': 'Aprender los sonidos',
      'learn.subtitle': 'Escucha cada señal por separado.',
      'learn.flap': 'Aleteo',
      'learn.score': 'Punto (tubería superada)',
      'learn.collide': 'Choque',
      'learn.gameOver': 'Fin de la partida',
      'learn.menuMove': 'Mover en menú',
      'learn.menuSelect': 'Confirmar en menú',
      'learn.menuBack': 'Atrás en menú',
      'learn.altitudeLow': 'Tono de altitud (baja)',
      'learn.altitudeMid': 'Tono de altitud (media)',
      'learn.altitudeHigh': 'Tono de altitud (alta)',
      'learn.pipeDemo': 'Par de tubería (hueco al medio)',
      'learn.pipeNarrow': 'Par de tubería (hueco estrecho)',
      'learn.warning': 'Alarma de choque',
      'learn.tick': 'Tic de ritmo',
      'learn.back': 'Atrás',

      // High scores
      'highscores.aria': 'Mejores puntuaciones',
      'highscores.title': 'Mejores puntuaciones',
      'highscores.subtitle': 'Top 10 en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones — ¡a jugar!',
      'highscores.entry': '{name} — {score}',
      'highscores.back': 'Atrás',

      // Game over
      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Fin de la partida',
      'gameover.score': 'Puntuación final: {score}',
      'gameover.best': 'Récord: {best}',
      'gameover.newRecord': '¡Nuevo récord!',
      'gameover.namePrompt': 'Escribe tu nombre para guardar la partida:',
      'gameover.namePlaceholder': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.reasonFloor': 'Te has estrellado contra el suelo.',
      'gameover.reasonCeiling': 'Te has dado contra el techo.',
      'gameover.reasonPipe': 'Has chocado con una tubería.',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Announcements
      'ann.menu': 'Menú principal. Arriba y abajo para navegar, Intro para confirmar.',
      'ann.help': 'Cómo se juega. Pulsa Escape para volver.',
      'ann.learnHello': 'Aprender los sonidos. Elige un botón para escuchar.',
      'ann.playing': 'Reproduciendo: {label}',
      'ann.highscoresEmpty': 'Aún no hay puntuaciones.',
      'ann.highscoresList': 'Mejores puntuaciones. {top}',
      'ann.gameStart': 'Aletea para empezar.',
      'ann.score': 'Puntuación: {score}',
      'ann.altitudeLow': 'Altitud: baja.',
      'ann.altitudeMid': 'Altitud: media.',
      'ann.altitudeHigh': 'Altitud: alta.',
      'ann.nextPipeFar': 'Próxima tubería: lejos.',
      'ann.nextPipeNear': 'Próxima tubería en {dist}.',
      'ann.bestScore': 'Mejor puntuación: {best}.',
      'ann.gameOver': 'Fin de la partida. Puntuación {score}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord! Puntuación {score}.',
      'ann.scoreSaved': 'Puntuación guardada.',
    },
  }

  let current = FALLBACK
  const listeners = []

  function detect() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && dictionaries[stored]) return stored
    } catch (e) { /* localStorage may be blocked */ }
    const browser = (navigator.language || navigator.userLanguage || '').toLowerCase()
    if (browser) {
      const short = browser.slice(0, 2)
      if (dictionaries[short]) return short
    }
    return FALLBACK
  }

  function lookup(key, locale) {
    const dict = dictionaries[locale]
    if (dict && dict[key] != null) return dict[key]
    const fb = dictionaries[FALLBACK]
    if (fb && fb[key] != null) return fb[key]
    return key
  }

  function format(template, params) {
    if (!params) return template
    return String(template).replace(/\{(\w+)\}/g, (m, k) =>
      Object.prototype.hasOwnProperty.call(params, k) && params[k] != null ? params[k] : m
    )
  }

  function t(key, params) {
    return format(lookup(key, current), params)
  }

  function applyDom(root) {
    const scope = root || document

    if (scope === document) {
      document.title = t('doc.title')
      document.documentElement.lang = current
    }

    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n')
      if (key) el.textContent = t(key)
    })

    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html')
      if (key) el.innerHTML = t(key)
    })

    scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr')
      if (!spec) return
      for (const pair of spec.split(';')) {
        const [attr, key] = pair.split(':').map((s) => s && s.trim())
        if (attr && key) el.setAttribute(attr, t(key))
      }
    })
  }

  function setLocale(loc) {
    if (!dictionaries[loc]) loc = FALLBACK
    if (loc === current) return
    current = loc
    try { localStorage.setItem(STORAGE_KEY, loc) } catch (e) {}
    applyDom()
    for (const fn of listeners.slice()) {
      try { fn(loc) } catch (e) {}
    }
  }

  function onChange(fn) {
    listeners.push(fn)
    return () => {
      const i = listeners.indexOf(fn)
      if (i >= 0) listeners.splice(i, 1)
    }
  }

  current = detect()

  return {
    t,
    applyDom,
    setLocale,
    locale: () => current,
    available: () => Object.keys(dictionaries).map((id) => ({id, name: localeNames[id] || id})),
    localeName: (id) => localeNames[id] || id,
    onChange,
    detect,
  }
})()
