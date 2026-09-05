/**
 * Lightweight i18n for accessible audio games.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
 * 2-letter prefix → fallback ('en').
 *
 * Dictionaries are keyed by short locale id ('en', 'es', ...). New languages
 * are added by extending the `dictionaries` and `localeNames` objects below.
 *
 * DOM strings: annotate with `data-i18n="key"` (textContent),
 * `data-i18n-html="key"` (innerHTML, for fragments containing inline tags
 * like <kbd>), or `data-i18n-attr="aria-label:key;placeholder:key"`.
 *
 * Runtime strings: call app.i18n.t('key', {param: 'val'}). Templates use
 * {name} placeholders.
 *
 * This is the canonical implementation shared across all games. To localize
 * a new game: copy this file, change STORAGE_KEY (e.g. 'pong.lang'), and
 * fill in the per-game dictionaries below.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'nightChase.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Night Chase',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Night Chase',
      'menu.subtitle': 'Audio-first street pursuit racing.',
      'menu.start': 'Start Chase',
      'menu.difficulty': 'Difficulty: {difficulty}',
      'menu.highscores': 'High Scores',
      'menu.help': 'How to Play',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Generic UI
      'game.aria': 'Game',
      'game.heading': 'Race in progress',
      'game.score': 'Score',
      'game.speed': 'Speed',
      'game.health': 'Health',
      'game.heat': 'Heat',
      'game.cops': 'Cops',
      'game.turbo': 'Turbo',
      'game.capture': 'Capture',
      'game.prompt': 'Keep the engine centered. F1 status, F2 target, F3 road, F4 resources, F5 lane.',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.menu': 'Quit to Menu',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High Scores',
      'highscores.listLabel': 'Local high score list',
      'highscores.empty': 'No scores yet.',
      'highscores.entry': '{name}, {score} points, {distance} meters, {difficulty}.',
      'highscores.back': 'Back',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Captured',
      'gameover.finalScore': 'Final score:',
      'gameover.nameLabel': 'Driver name',
      'gameover.namePlaceholder': 'Driver name',
      'gameover.save': 'Save Score',
      'gameover.continue': 'Continue',
      'gameover.nameRequired': 'Enter a driver name first.',
      'gameover.reasonCaptured': 'The cops boxed you in and pulled you out.',
      'gameover.reasonWrecked': 'The car was too damaged to keep moving.',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.goalHeader': 'Goal',
      'help.goal': 'Survive as long as possible, score by wrecking targets, and escape escalating police pressure.',
      'help.controlsHeader': 'Controls',
      'help.controlSteer': '<kbd>Left</kbd>/<kbd>Right</kbd> or gamepad stick steer.',
      'help.controlThrottle': '<kbd>Up</kbd> accelerates. <kbd>Down</kbd> brakes.',
      'help.controlTurbo': '<kbd>Space</kbd> or gamepad south button uses turbo when available.',
      'help.controlPause': '<kbd>Escape</kbd> pauses.',
      'help.audioHeader': 'Audio Driving',
      'help.audioEngine': 'Your engine pans left or right when you drift from the center. Keep it centered.',
      'help.audioCurves': 'Curve warnings play from the turn direction about two seconds early.',
      'help.audioTargets': 'Target beacons point toward pedestrians, bars, turbo, and armor.',
      'help.audioCops': 'Cop engines and sirens grow behind you as they close in.',
      'help.statusHeader': 'Status Keys',
      'help.statusF1': '<kbd>F1</kbd> reads score, health, heat, speed, cops, and armor.',
      'help.statusF2': '<kbd>F2</kbd> reads nearest target.',
      'help.statusF3': '<kbd>F3</kbd> reads current or upcoming curve.',
      'help.statusF4': '<kbd>F4</kbd> reads turbo and armor.',
      'help.statusF5': '<kbd>F5</kbd> reads lane position.',
      'help.back': 'Back',

      // Difficulty
      'difficulty.rookie': 'Rookie',
      'difficulty.pursuit': 'Pursuit',
      'difficulty.outlaw': 'Outlaw',

      // Directions
      'direction.left': 'left',
      'direction.right': 'right',
      'direction.center': 'center',

      // Announcements
      'ann.menu': 'Main menu.',
      'ann.help': 'How to play.',
      'ann.highscores': 'High scores.',
      'ann.difficulty': 'Difficulty {difficulty}.',
      'ann.start': 'Chase started. Difficulty {difficulty}. Keep the engine centered.',
      'ann.paused': 'Paused.',
      'ann.status': 'Score {score}. Speed {speed}. Health {health}. Heat {heat}. Cops {cops}. Armor {armor}.',
      'ann.resources': 'Turbo {turbo} seconds. Armor {armor}.',
      'ann.lane': 'Lane position {lane}.',
      'ann.noTarget': 'No target nearby.',
      'ann.nearestPedestrian': 'Pedestrian {direction}, {meters} meters.',
      'ann.nearestBar': 'Bar {direction}, {meters} meters.',
      'ann.nearestTurbo': 'Turbo {direction}, {meters} meters.',
      'ann.nearestArmor': 'Armor {direction}, {meters} meters.',
      'ann.targetPedestrian': 'Pedestrian {direction}.',
      'ann.targetBar': 'Bar {direction}, {people} people.',
      'ann.targetTurbo': 'Turbo {direction}.',
      'ann.targetArmor': 'Armor {direction}.',
      'ann.curveCue': '{direction} curve in two seconds.',
      'ann.curveExit': 'Curve exit.',
      'ann.currentCurve': 'In a {direction} curve.',
      'ann.upcomingCurve': '{direction} curve in {meters} meters.',
      'ann.noCurve': 'Straight road.',
      'ann.pedestrianHit': 'Pedestrian hit. {points} points. Score {score}.',
      'ann.pedestrianMissed': 'Target missed. Points deducted.',
      'ann.barHit': 'Bar wrecked. {people} people. {points} points.',
      'ann.rowCleared': 'Full row cleared. {total} targets. Bonus {bonus}.',
      'ann.turboPickup': 'Turbo collected.',
      'ann.armorPickup': 'Armor collected.',
      'ann.armorUsed': 'Armor absorbed the crash.',
      'ann.crash': 'Crash. Health {health}.',
      'ann.ram': 'Cop rammed you. Health {health}.',
      'ann.copSpawn': 'Cop unit joined the chase. {count} cops active.',
      'ann.gameOver': 'Captured. {reason} Final score {score}.',
      'ann.scoreSaved': 'Score saved.',
      'ann.scoreRecorded': 'Score recorded.',
    },

    es: {
      // <head>
      'doc.title': 'Night Chase',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'Night Chase',
      'menu.subtitle': 'Carreras de persecución audio-first.',
      'menu.start': 'Empezar persecución',
      'menu.difficulty': 'Dificultad: {difficulty}',
      'menu.highscores': 'Puntuaciones',
      'menu.help': 'Cómo jugar',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Generic UI
      'game.aria': 'Juego',
      'game.heading': 'Carrera en curso',
      'game.score': 'Puntos',
      'game.speed': 'Velocidad',
      'game.health': 'Salud',
      'game.heat': 'Alerta',
      'game.cops': 'Policías',
      'game.turbo': 'Turbo',
      'game.capture': 'Captura',
      'game.prompt': 'Mantén el motor centrado. F1 estado, F2 objetivo, F3 carretera, F4 recursos, F5 carril.',

      // Pause
      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.menu': 'Salir al menú',

      // High scores
      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.listLabel': 'Lista local de puntuaciones',
      'highscores.empty': 'Todavía no hay puntuaciones.',
      'highscores.entry': '{name}, {score} puntos, {distance} metros, {difficulty}.',
      'highscores.back': 'Atrás',

      // Game over
      'gameover.aria': 'Fin de partida',
      'gameover.title': 'Capturado',
      'gameover.finalScore': 'Puntuación final:',
      'gameover.nameLabel': 'Nombre del conductor',
      'gameover.namePlaceholder': 'Nombre del conductor',
      'gameover.save': 'Guardar puntuación',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe primero un nombre.',
      'gameover.reasonCaptured': 'La policía te cerró el paso y te sacó del coche.',
      'gameover.reasonWrecked': 'El coche quedó demasiado dañado para seguir.',

      // Help
      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.goalHeader': 'Objetivo',
      'help.goal': 'Sobrevive todo lo posible, puntúa destrozando objetivos y escapa de una presión policial creciente.',
      'help.controlsHeader': 'Controles',
      'help.controlSteer': '<kbd>Izquierda</kbd>/<kbd>Derecha</kbd> o stick del mando para girar.',
      'help.controlThrottle': '<kbd>Arriba</kbd> acelera. <kbd>Abajo</kbd> frena.',
      'help.controlTurbo': '<kbd>Espacio</kbd> o botón sur del mando usa turbo cuando tengas.',
      'help.controlPause': '<kbd>Escape</kbd> pausa.',
      'help.audioHeader': 'Conducción por audio',
      'help.audioEngine': 'Tu motor se desplaza a la izquierda o derecha cuando sales del centro. Mantenlo centrado.',
      'help.audioCurves': 'Los avisos de curva suenan desde la dirección del giro unos dos segundos antes.',
      'help.audioTargets': 'Las balizas de objetivo señalan peatones, bares, turbo y armadura.',
      'help.audioCops': 'Los motores y sirenas de la policía crecen detrás de ti cuando se acercan.',
      'help.statusHeader': 'Teclas de estado',
      'help.statusF1': '<kbd>F1</kbd> lee puntos, salud, alerta, velocidad, policías y armadura.',
      'help.statusF2': '<kbd>F2</kbd> lee el objetivo más cercano.',
      'help.statusF3': '<kbd>F3</kbd> lee la curva actual o la próxima.',
      'help.statusF4': '<kbd>F4</kbd> lee turbo y armadura.',
      'help.statusF5': '<kbd>F5</kbd> lee la posición en el carril.',
      'help.back': 'Atrás',

      // Difficulty
      'difficulty.rookie': 'Novato',
      'difficulty.pursuit': 'Persecución',
      'difficulty.outlaw': 'Fugitivo',

      // Directions
      'direction.left': 'izquierda',
      'direction.right': 'derecha',
      'direction.center': 'centro',

      // Announcements
      'ann.menu': 'Menú principal.',
      'ann.help': 'Cómo jugar.',
      'ann.highscores': 'Puntuaciones.',
      'ann.difficulty': 'Dificultad {difficulty}.',
      'ann.start': 'Persecución iniciada. Dificultad {difficulty}. Mantén el motor centrado.',
      'ann.paused': 'Pausa.',
      'ann.status': 'Puntos {score}. Velocidad {speed}. Salud {health}. Alerta {heat}. Policías {cops}. Armadura {armor}.',
      'ann.resources': 'Turbo {turbo} segundos. Armadura {armor}.',
      'ann.lane': 'Posición en el carril {lane}.',
      'ann.noTarget': 'No hay objetivos cerca.',
      'ann.nearestPedestrian': 'Peatón a la {direction}, {meters} metros.',
      'ann.nearestBar': 'Bar a la {direction}, {meters} metros.',
      'ann.nearestTurbo': 'Turbo a la {direction}, {meters} metros.',
      'ann.nearestArmor': 'Armadura a la {direction}, {meters} metros.',
      'ann.targetPedestrian': 'Peatón a la {direction}.',
      'ann.targetBar': 'Bar a la {direction}, {people} personas.',
      'ann.targetTurbo': 'Turbo a la {direction}.',
      'ann.targetArmor': 'Armadura a la {direction}.',
      'ann.curveCue': 'Curva a la {direction} en dos segundos.',
      'ann.curveExit': 'Salida de curva.',
      'ann.currentCurve': 'En una curva a la {direction}.',
      'ann.upcomingCurve': 'Curva a la {direction} en {meters} metros.',
      'ann.noCurve': 'Recta.',
      'ann.pedestrianHit': 'Peatón atropellado. {points} puntos. Total {score}.',
      'ann.pedestrianMissed': 'Objetivo perdido. Puntos descontados.',
      'ann.barHit': 'Bar destrozado. {people} personas. {points} puntos.',
      'ann.rowCleared': 'Fila completa. {total} objetivos. Bono {bonus}.',
      'ann.turboPickup': 'Turbo recogido.',
      'ann.armorPickup': 'Armadura recogida.',
      'ann.armorUsed': 'La armadura absorbió el choque.',
      'ann.crash': 'Choque. Salud {health}.',
      'ann.ram': 'La policía te embistió. Salud {health}.',
      'ann.copSpawn': 'Unidad policial en la persecución. {count} policías activos.',
      'ann.gameOver': 'Capturado. {reason} Puntuación final {score}.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.scoreRecorded': 'Puntuación registrada.',
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
