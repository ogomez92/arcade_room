/**
 * Lightweight i18n for accessible audio games — Missile Command edition.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
 * 2-letter prefix → fallback ('en').
 *
 * Per-locale phrase pools: announcer flavor (incoming, wave clear, city
 * lost) is authored independently per language rather than translated, so
 * Spanish reads naturally rather than as a literal English carbon copy.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'missilecmd.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Missile Command',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Missile Command',
      'menu.subtitle': 'Audio-first arcade defense — protect six Spanish cities.',
      'menu.start': 'Start Game',
      'menu.help': 'How To Play',
      'menu.highscores': 'High Scores',
      'menu.learn': 'Sound Learning',
      'menu.test': 'Spatial Audio Test',
      'menu.language': 'Language',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game HUD
      'game.aria': 'Game in progress',
      'game.headline': 'Missile Command',
      'game.score': 'Score:',
      'game.scoreAria': 'Score',
      'game.wave': 'Wave:',
      'game.waveAria': 'Wave',
      'game.cities': 'Cities:',
      'game.citiesAria': 'Cities standing',
      'game.ammo': 'Ammo:',
      'game.ammoAria': 'Ammo per battery',
      'game.help': 'Arrow keys aim. Z X C fire from left, center, right battery. Space fires from nearest with ammo. F1 score. F2 cities. F3 ammo. F4 wave. P pause. Escape pauses.',

      // Cities
      'city.madrid':    'Madrid',
      'city.barcelona': 'Barcelona',
      'city.sevilla':   'Seville',
      'city.valencia':  'Valencia',
      'city.zaragoza':  'Zaragoza',
      'city.bilbao':    'Bilbao',

      // Batteries
      'battery.left':   'left battery',
      'battery.center': 'center battery',
      'battery.right':  'right battery',

      // Pause
      'pause.aria': 'Game paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.menu': 'Quit to Main Menu',

      // Game-over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game Over',
      'gameover.finalScore': 'Final score:',
      'gameover.finalWave': 'You reached wave',
      'gameover.rankMsg': 'You earned a high score! Enter your name:',
      'gameover.nameLabel': 'Your name',
      'gameover.namePlaceholder': 'Player',
      'gameover.save': 'Save Score',
      'gameover.continue': 'Continue',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High Scores',
      'highscores.listLabel': 'High score list',
      'highscores.empty': 'No scores yet — be the first.',
      'highscores.entry': '{name}, {score}, wave {wave}',
      'highscores.back': 'Back to Menu',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.goalHeader': 'Goal',
      'help.goal': 'Six Spanish cities are under missile attack. Aim your crosshair, fire from one of three batteries, and bloom blast clouds in the path of every incoming threat. Lose all six cities and the game ends. Survive to clear the wave; clear waves to climb the ranks.',
      'help.controlsHeader': 'Controls',
      'help.controlArrows': '<kbd>Arrow keys</kbd> — sweep the crosshair across the sky.',
      'help.controlBatteries': '<kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> — fire from left, center, right battery. Each has a distinct thunk pitch.',
      'help.controlSpace': '<kbd>Space</kbd> — fire from the nearest battery with ammo (one-handed play).',
      'help.controlPause': '<kbd>P</kbd> or <kbd>Escape</kbd> — pause.',
      'help.controlF1': '<kbd>F1</kbd> — read score and wave.',
      'help.controlF2': '<kbd>F2</kbd> — read which cities are still standing.',
      'help.controlF3': '<kbd>F3</kbd> — read ammo per battery.',
      'help.controlF4': '<kbd>F4</kbd> — read wave and threats remaining.',
      'help.audioHeader': 'Listening to the sky',
      'help.audioPing': 'A subtle <strong>crosshair ping</strong> rises in pitch as you sweep the crosshair upward — that\'s your Y-axis cue.',
      'help.audioLock': 'A continuous <strong>lock tone</strong> grows louder as your crosshair nears any threat. A tremolo wobble means you have a perfect lock.',
      'help.audioIcbm': '<strong>ICBMs</strong> whistle downward; the closer the ground, the higher the urgency.',
      'help.audioSplitter': '<strong>Splitters</strong> have a distinct triad cluster timbre — kill them before they fork.',
      'help.audioBomber': '<strong>Bombers</strong> are a low pan-sliding drone; their pitch does not change with altitude.',
      'help.audioCities': 'Each <strong>city</strong> hums at its own pitch (Madrid lowest, Bilbao highest). Lose a city and its hum cuts out with a downward swoop.',
      'help.tipsHeader': 'Tips',
      'help.tip1': 'Detonate <em>ahead</em> of where the missile is going, not where it is. Blast clouds linger.',
      'help.tip2': 'Save the center battery for the final volley — it tends to have the longest reach.',
      'help.tip3': 'Listen to which city pitch dropped out — that\'s the one already lost. Don\'t waste shots defending it.',
      'help.tip4': 'When the lock tone wobbles, fire — that\'s a perfect bead.',
      'help.back': 'Back to Menu',

      // Spatial-audio test
      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial Audio Test',
      'test.subtitle': 'Listen for ticks at four positions: front, right, behind, left. If you hear them in any other order, the audio coordinate frame is wrong.',
      'test.intro': 'Spatial audio test starting.',
      'test.replay': 'Replay Test',
      'test.dirFront': 'Front.',
      'test.dirRight': 'Right.',
      'test.dirBehind': 'Behind.',
      'test.dirLeft': 'Left.',
      'test.back': 'Back to Menu',

      // Sound learning
      'learn.aria': 'Sound learning',
      'learn.title': 'Sound Learning',
      'learn.subtitle': 'Press a button to listen to each sound. Each plays once.',
      'learn.icbm': 'Incoming ICBM',
      'learn.splitter': 'Splitter (about to fork)',
      'learn.bomber': 'Bomber drone',
      'learn.bomberDrop': 'Bomber drops a bomb',
      'learn.outgoingL': 'Outgoing missile (left battery)',
      'learn.outgoingC': 'Outgoing missile (center battery)',
      'learn.outgoingR': 'Outgoing missile (right battery)',
      'learn.blast': 'Blast cloud',
      'learn.cityMadrid': 'Madrid (C3)',
      'learn.cityBarcelona': 'Barcelona (D3)',
      'learn.citySevilla': 'Seville (E3)',
      'learn.cityValencia': 'Valencia (G3)',
      'learn.cityZaragoza': 'Zaragoza (A3)',
      'learn.cityBilbao': 'Bilbao (C4)',
      'learn.crosshairPing': 'Crosshair ping (sweeps with Y)',
      'learn.lockTone': 'Lock tone (proximity + tremolo at lock)',
      'learn.thunkL': 'Battery thunk (left)',
      'learn.thunkC': 'Battery thunk (center)',
      'learn.thunkR': 'Battery thunk (right)',
      'learn.depleted': 'Battery depleted',
      'learn.cityDestroy': 'City destroyed',
      'learn.bonusCity': 'Bonus city restored',
      'learn.back': 'Back to Menu',

      // Announcer flavor — phrase pools (multiple variants per pool to avoid repetition)
      'ann.menu': 'Missile Command. Six cities, three batteries. Choose Start to begin.',
      'ann.menuLoaded': 'Welcome back to Missile Command.',

      'ann.waveStart.0': 'Wave {n} incoming.',
      'ann.waveStart.1': 'Wave {n}. Brace.',
      'ann.waveStart.2': 'Wave {n} — incoming missiles.',
      'ann.waveStart.3': 'Here comes wave {n}.',

      'ann.waveClear.0': 'Wave {n} cleared. Bonus {bonus}.',
      'ann.waveClear.1': 'Wave {n} down. Plus {bonus}.',
      'ann.waveClear.2': 'Skies clear. Bonus {bonus}.',
      'ann.waveClear.3': 'All threats neutralized. Plus {bonus}.',

      'ann.cityLost.0': 'City lost: {city}.',
      'ann.cityLost.1': '{city} is gone.',
      'ann.cityLost.2': '{city} destroyed.',
      'ann.cityLost.3': 'We lost {city}.',

      'ann.bonusCity.0': 'Bonus city! {city} restored.',
      'ann.bonusCity.1': '{city} rebuilt.',
      'ann.bonusCity.2': 'Reinforcements: {city} is back.',

      'ann.depleted.0': '{battery} empty.',
      'ann.depleted.1': '{battery} out of ammo.',
      'ann.depleted.2': '{battery} depleted.',

      'ann.allDepleted': 'All batteries empty!',
      'ann.gameOver': 'Game over. Final score {score}, wave {wave}.',
      'ann.gameOverHigh': 'Game over. High score! Final score {score}, wave {wave}.',
      'ann.scoreSaved': 'Score saved.',
      'ann.pause': 'Paused.',
      'ann.resume': 'Resumed.',
      'ann.help': 'How to play. Read the page for controls and audio cues.',
      'ann.highscoresEmpty': 'No scores yet.',
      'ann.highscoresList': 'High scores: {top}.',

      'ann.score': 'Score {score}, wave {wave}, {cities} cities standing.',
      'ann.cities': 'Cities standing: {list}.',
      'ann.citiesNone': 'No cities standing.',
      'ann.ammo': 'Ammo: left {l}, center {c}, right {r}.',
      'ann.waveStat': 'Wave {wave}. {remaining} threats remaining.',
      'ann.playing': 'Playing {label}.',
      'ann.learnHello': 'Sound learning. Pick a sound to preview.',
    },

    es: {
      // <head>
      'doc.title': 'Missile Command',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'Defensa de Misiles',
      'menu.subtitle': 'Arcade audio-first — defiende seis ciudades españolas.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo Jugar',
      'menu.highscores': 'Récords',
      'menu.learn': 'Aprender Sonidos',
      'menu.test': 'Prueba de Audio Espacial',
      'menu.language': 'Idioma',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Game HUD
      'game.aria': 'Partida en curso',
      'game.headline': 'Defensa de Misiles',
      'game.score': 'Puntos:',
      'game.scoreAria': 'Puntos',
      'game.wave': 'Oleada:',
      'game.waveAria': 'Oleada',
      'game.cities': 'Ciudades:',
      'game.citiesAria': 'Ciudades en pie',
      'game.ammo': 'Munición:',
      'game.ammoAria': 'Munición por batería',
      'game.help': 'Flechas apuntan. Z X C disparan desde la batería izquierda, central, derecha. Espacio dispara desde la batería más cercana con munición. F1 puntos. F2 ciudades. F3 munición. F4 oleada. P pausar. Escape pausa.',

      // Cities
      'city.madrid':    'Madrid',
      'city.barcelona': 'Barcelona',
      'city.sevilla':   'Sevilla',
      'city.valencia':  'Valencia',
      'city.zaragoza':  'Zaragoza',
      'city.bilbao':    'Bilbao',

      // Batteries
      'battery.left':   'batería izquierda',
      'battery.center': 'batería central',
      'battery.right':  'batería derecha',

      // Pause
      'pause.aria': 'Partida pausada',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.menu': 'Salir al Menú',

      // Game-over
      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Fin de la Partida',
      'gameover.finalScore': 'Puntuación final:',
      'gameover.finalWave': 'Llegaste a la oleada',
      'gameover.rankMsg': '¡Has entrado en la tabla de récords! Escribe tu nombre:',
      'gameover.nameLabel': 'Tu nombre',
      'gameover.namePlaceholder': 'Jugador',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',

      // High scores
      'highscores.aria': 'Récords',
      'highscores.title': 'Récords',
      'highscores.listLabel': 'Tabla de récords',
      'highscores.empty': 'Sin récords todavía — sé el primero.',
      'highscores.entry': '{name}, {score}, oleada {wave}',
      'highscores.back': 'Volver al Menú',

      // Help
      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo Jugar',
      'help.goalHeader': 'Objetivo',
      'help.goal': 'Seis ciudades españolas están bajo ataque. Mueve la mira, dispara desde una de tus tres baterías y haz estallar nubes de plasma en la trayectoria de cada misil enemigo. Si pierdes las seis ciudades, se acaba. Sobrevive para limpiar la oleada; limpia oleadas para subir de rango.',
      'help.controlsHeader': 'Controles',
      'help.controlArrows': '<kbd>Flechas</kbd> — mueve la mira por el cielo.',
      'help.controlBatteries': '<kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> — dispara desde la batería izquierda, central, derecha. Cada una tiene su tono distinto.',
      'help.controlSpace': '<kbd>Espacio</kbd> — dispara desde la batería más cercana con munición (juego a una mano).',
      'help.controlPause': '<kbd>P</kbd> o <kbd>Escape</kbd> — pausa.',
      'help.controlF1': '<kbd>F1</kbd> — anuncia puntos y oleada.',
      'help.controlF2': '<kbd>F2</kbd> — anuncia qué ciudades siguen en pie.',
      'help.controlF3': '<kbd>F3</kbd> — anuncia munición por batería.',
      'help.controlF4': '<kbd>F4</kbd> — anuncia oleada y amenazas restantes.',
      'help.audioHeader': 'Escuchando el cielo',
      'help.audioPing': 'Un <strong>tono de mira</strong> sutil sube de tono cuando mueves la mira hacia arriba — esa es tu pista vertical.',
      'help.audioLock': 'Un <strong>tono de fijación</strong> continuo se hace más fuerte cuando la mira se acerca a una amenaza. Si vibra, tienes el blanco perfecto.',
      'help.audioIcbm': 'Los <strong>misiles balísticos</strong> silban al caer; cuanto más cerca del suelo, más urgente.',
      'help.audioSplitter': 'Los <strong>misiles MIRV</strong> tienen un timbre de tríada inconfundible — derríbalos antes de que se dividan.',
      'help.audioBomber': 'Los <strong>bombarderos</strong> son un zumbido grave que se desliza horizontalmente; su tono no cambia con la altura.',
      'help.audioCities': 'Cada <strong>ciudad</strong> tararea su propia nota (Madrid la más grave, Bilbao la más aguda). Si una cae, su nota se desvanece con un quejido.',
      'help.tipsHeader': 'Consejos',
      'help.tip1': 'Detona <em>delante</em> de donde va el misil, no donde está. Las nubes de plasma se quedan un rato.',
      'help.tip2': 'Guarda la batería central para la última andanada — suele tener mejor alcance.',
      'help.tip3': 'Escucha qué nota de ciudad ha desaparecido — esa ya está perdida. No malgastes munición defendiéndola.',
      'help.tip4': 'Cuando el tono de fijación vibra, dispara — es el blanco perfecto.',
      'help.back': 'Volver al Menú',

      // Spatial-audio test
      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de Audio Espacial',
      'test.subtitle': 'Escucha sonidos en cuatro posiciones: delante, derecha, detrás, izquierda. Si los oyes en otro orden, el sistema de audio está mal.',
      'test.intro': 'Prueba de audio espacial empezando.',
      'test.replay': 'Repetir Prueba',
      'test.dirFront': 'Delante.',
      'test.dirRight': 'Derecha.',
      'test.dirBehind': 'Detrás.',
      'test.dirLeft': 'Izquierda.',
      'test.back': 'Volver al Menú',

      // Sound learning
      'learn.aria': 'Aprender sonidos',
      'learn.title': 'Aprender Sonidos',
      'learn.subtitle': 'Pulsa un botón para escuchar cada sonido. Cada uno suena una vez.',
      'learn.icbm': 'Misil balístico entrante',
      'learn.splitter': 'Misil MIRV (a punto de dividirse)',
      'learn.bomber': 'Zumbido de bombardero',
      'learn.bomberDrop': 'Bombardero suelta una bomba',
      'learn.outgoingL': 'Misil saliente (batería izquierda)',
      'learn.outgoingC': 'Misil saliente (batería central)',
      'learn.outgoingR': 'Misil saliente (batería derecha)',
      'learn.blast': 'Nube de plasma',
      'learn.cityMadrid': 'Madrid (C3)',
      'learn.cityBarcelona': 'Barcelona (D3)',
      'learn.citySevilla': 'Sevilla (E3)',
      'learn.cityValencia': 'Valencia (G3)',
      'learn.cityZaragoza': 'Zaragoza (A3)',
      'learn.cityBilbao': 'Bilbao (C4)',
      'learn.crosshairPing': 'Tono de mira (sube con Y)',
      'learn.lockTone': 'Tono de fijación (cercanía + vibrato al fijar)',
      'learn.thunkL': 'Disparo de batería (izquierda)',
      'learn.thunkC': 'Disparo de batería (central)',
      'learn.thunkR': 'Disparo de batería (derecha)',
      'learn.depleted': 'Batería sin munición',
      'learn.cityDestroy': 'Ciudad destruida',
      'learn.bonusCity': 'Ciudad de bonificación restaurada',
      'learn.back': 'Volver al Menú',

      // Announcer flavor — Spanish leans civil-defense, with phrase pools
      'ann.menu': 'Defensa de Misiles. Seis ciudades, tres baterías. Pulsa Empezar.',
      'ann.menuLoaded': 'Bienvenido de vuelta a Defensa de Misiles.',

      'ann.waveStart.0': '¡Atención! Misiles entrantes — oleada {n}.',
      'ann.waveStart.1': 'Oleada {n}. Posiciones de combate.',
      'ann.waveStart.2': 'Empieza la oleada {n}. Sigan firmes.',
      'ann.waveStart.3': 'Aviso: oleada {n} en aproximación.',

      'ann.waveClear.0': 'Oleada {n} contenida. Bonificación {bonus}.',
      'ann.waveClear.1': 'Cielo despejado. Bonificación {bonus}.',
      'ann.waveClear.2': 'Amenaza neutralizada. Más {bonus} puntos.',
      'ann.waveClear.3': 'Oleada {n} acabada. Suman {bonus}.',

      'ann.cityLost.0': '{city} ha caído.',
      'ann.cityLost.1': 'Hemos perdido {city}.',
      'ann.cityLost.2': '{city} arrasada.',
      'ann.cityLost.3': '{city}: sin contacto.',

      'ann.bonusCity.0': '¡Refuerzos! {city} reconstruida.',
      'ann.bonusCity.1': '{city} vuelve a estar en pie.',
      'ann.bonusCity.2': 'Bonificación: {city} restaurada.',

      'ann.depleted.0': '{battery} sin munición.',
      'ann.depleted.1': '{battery} agotada.',
      'ann.depleted.2': '{battery} vacía.',

      'ann.allDepleted': '¡Todas las baterías sin munición!',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}, oleada {wave}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Récord! Puntuación final {score}, oleada {wave}.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.pause': 'Pausa.',
      'ann.resume': 'Continuando.',
      'ann.help': 'Cómo jugar. Lee la página para los controles y los sonidos.',
      'ann.highscoresEmpty': 'Sin récords todavía.',
      'ann.highscoresList': 'Récords: {top}.',

      'ann.score': '{score} puntos, oleada {wave}, {cities} ciudades en pie.',
      'ann.cities': 'Ciudades en pie: {list}.',
      'ann.citiesNone': 'Sin ciudades en pie.',
      'ann.ammo': 'Munición: izquierda {l}, central {c}, derecha {r}.',
      'ann.waveStat': 'Oleada {wave}. {remaining} amenazas restantes.',
      'ann.playing': 'Reproduciendo {label}.',
      'ann.learnHello': 'Aprender sonidos. Elige uno para escucharlo.',
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

  // Pick a random variant from a phrase pool keyed `prefix.0`, `prefix.1`, ...
  // Returns t(prefix) if no numbered variants exist.
  function tPool(prefix, params) {
    const dict = dictionaries[current] || dictionaries[FALLBACK]
    const fb = dictionaries[FALLBACK]
    const variants = []
    for (let i = 0; i < 16; i++) {
      const key = prefix + '.' + i
      if ((dict && dict[key] != null) || (fb && fb[key] != null)) variants.push(key)
      else if (i > 0) break
    }
    if (!variants.length) return t(prefix, params)
    const k = variants[Math.floor(Math.random() * variants.length)]
    return t(k, params)
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
    tPool,
    applyDom,
    setLocale,
    locale: () => current,
    available: () => Object.keys(dictionaries).map((id) => ({id, name: localeNames[id] || id})),
    localeName: (id) => localeNames[id] || id,
    onChange,
    detect,
  }
})()
