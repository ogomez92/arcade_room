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
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'approach.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Plane Control',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Plane Control',
      'menu.subtitle': 'Air-traffic control by ear. Vector every flight home before it runs dry — and never let two get too close.',
      'menu.start': 'Start shift',
      'menu.difficulty': 'Difficulty',
      'menu.options': 'Options',
      'menu.highscores': 'High scores',
      'menu.help': 'How to play',
      'menu.test': 'Test speaker orientation',
      'menu.quit': 'Quit',

      // Difficulty
      'difficulty.aria': 'Choose difficulty',
      'difficulty.title': 'Choose difficulty',
      'difficulty.subtitle': 'Higher tiers mean faster planes, less fuel, and busier skies.',
      'difficulty.cadet': 'Cadet',
      'difficulty.controller': 'Controller',
      'difficulty.nightmare': 'Nightmare',
      'difficulty.back': 'Back',

      // Options
      'options.aria': 'Options',
      'options.title': 'Options',
      'options.music': 'Ambient sound bed',
      'options.tts': 'Speak with built-in voice',
      'options.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Best shifts on {difficulty}.',
      'highscores.difficulty': 'Difficulty: {difficulty} (change)',
      'highscores.entry': '#{rank}: {name} — {score} ({landed} landed)',
      'highscores.empty': 'No scores yet. Work a shift!',
      'highscores.cycle': 'Change difficulty',
      'highscores.back': 'Back',
      'highscores.online': 'View online leaderboard',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.intro': 'You are the tower. Every plane is a sound placed around you: north is in front, east is to your right, south is behind (muffled), west is to your left. Bring each one to the runway at the centre before its fuel runs out — and keep any two planes from getting too close, or they collide and the shift ends.',
      'help.select': '<kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> — select the next / previous plane. The selected plane is louder and brighter.',
      'help.turn': '<kbd>Left</kbd> / <kbd>Right</kbd> — turn the selected plane.',
      'help.direct': '<kbd>Up</kbd> — vector it straight at the field.',
      'help.land': '<kbd>L</kbd> or <kbd>Enter</kbd> — clear it to land. Only one plane may approach at a time.',
      'help.hold': '<kbd>H</kbd> — order it to hold (circle) where it is.',
      'help.describe': '<kbd>Space</kbd> — read the selected plane: bearing, distance, fuel.',
      'help.status': '<kbd>R</kbd> — read the shift status: planes airborne, landed, score.',
      'help.pause': '<kbd>P</kbd> pause · <kbd>Esc</kbd> back to menu.',
      'help.back': 'Back',

      // Orientation test
      'test.aria': 'Speaker orientation test',
      'test.title': 'Speaker orientation test',
      'test.subtitle': 'A tone circles around you. Confirm it matches the spoken direction.',
      'test.front': 'Front (north)',
      'test.right': 'Right (east)',
      'test.behind': 'Behind (south)',
      'test.left': 'Left (west)',
      'test.back': 'Back',

      // Game
      'game.aria': 'Radar control',

      // Game over
      'gameover.aria': 'Shift over',
      'gameover.title': 'Shift over',
      'gameover.summary': 'You landed {landed} flights for {score} points.',
      'gameover.scoreEntry': '#{rank}: {name} — {score}',
      'gameover.namePrompt': 'New high score! Enter your name:',
      'gameover.nameLabel': 'Name',
      'gameover.save': 'Save score',
      'gameover.again': 'Play again',
      'gameover.menu': 'Menu',

      // Language
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Player default
      'player.you': 'Controller',

      // Compass directions
      'dir.north': 'north', 'dir.northeast': 'northeast', 'dir.east': 'east',
      'dir.southeast': 'southeast', 'dir.south': 'south', 'dir.southwest': 'southwest',
      'dir.west': 'west', 'dir.northwest': 'northwest',

      // Announcements
      'ann.plane': '{name}, {bearing}, {distance} miles, fuel {fuel}.',
      'ann.noPlanes': 'No flights in the airspace.',
      'ann.heading': '{name} turning {dir}.',
      'ann.status': '{airborne} airborne, {landed} landed, score {score}.',
      'ann.arrival': '{name} entering from the {bearing}.',
      'ann.cleared': '{name} cleared to land.',
      'ann.holding': '{name} holding.',
      'ann.runwayBusy': 'Runway occupied — a flight is already on approach.',
      'ann.landed': '{name} down safely. Plus {points}.',
      'ann.lowFuel': '{name} low on fuel: {fuel}.',
      'ann.conflict': 'Conflict alert: {a} and {b} closing.',
      'ann.crash.collision': 'Mid-air collision!',
      'ann.crash.fuel': 'A flight ran out of fuel and went down!',
      'ann.gameOver': 'Shift over. {landed} landed, score {score}.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.onlineRank': 'Online rank {rank}.',
      'ann.onlineError': 'Online scores unavailable.',

      // Online
      'online.posting': 'Submitting score…',
      'online.rank': 'Online rank: {rank}',
      'online.error': 'Online scores unavailable — saved locally.',
      'online.viewBoard': 'View leaderboard',
    },

    es: {
      'doc.title': 'Plane Control',

      'menu.aria': 'Menú principal',
      'menu.title': 'Plane Control',
      'menu.subtitle': 'Control aéreo de oído. Lleva cada vuelo a tierra antes de que se quede sin combustible, y que nunca se acerquen dos demasiado.',
      'menu.start': 'Empezar turno',
      'menu.difficulty': 'Dificultad',
      'menu.options': 'Opciones',
      'menu.highscores': 'Puntuaciones',
      'menu.help': 'Cómo jugar',
      'menu.test': 'Probar orientación de altavoces',
      'menu.quit': 'Salir',

      'difficulty.aria': 'Elegir dificultad',
      'difficulty.title': 'Elegir dificultad',
      'difficulty.subtitle': 'Los niveles altos traen aviones más rápidos, menos combustible y cielos más llenos.',
      'difficulty.cadet': 'Cadete',
      'difficulty.controller': 'Controlador',
      'difficulty.nightmare': 'Pesadilla',
      'difficulty.back': 'Atrás',

      'options.aria': 'Opciones',
      'options.title': 'Opciones',
      'options.music': 'Sonido ambiente',
      'options.tts': 'Hablar con voz integrada',
      'options.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Mejores turnos en {difficulty}.',
      'highscores.difficulty': 'Dificultad: {difficulty} (cambiar)',
      'highscores.entry': '#{rank}: {name} — {score} ({landed} aterrizados)',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Haz un turno!',
      'highscores.cycle': 'Cambiar dificultad',
      'highscores.back': 'Atrás',
      'highscores.online': 'Ver clasificación en línea',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.intro': 'Tú eres la torre. Cada avión es un sonido a tu alrededor: el norte está delante, el este a tu derecha, el sur detrás (apagado) y el oeste a tu izquierda. Lleva cada uno a la pista del centro antes de que se quede sin combustible, y evita que dos se acerquen demasiado o chocarán y acabará el turno.',
      'help.select': '<kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> — seleccionar el avión siguiente / anterior. El seleccionado suena más alto y brillante.',
      'help.turn': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> — girar el avión seleccionado.',
      'help.direct': '<kbd>Arriba</kbd> — dirigirlo recto al campo.',
      'help.land': '<kbd>L</kbd> o <kbd>Intro</kbd> — autorizar aterrizaje. Solo uno puede aproximar a la vez.',
      'help.hold': '<kbd>H</kbd> — ordenarle que espere en círculo.',
      'help.describe': '<kbd>Espacio</kbd> — leer el avión seleccionado: rumbo, distancia, combustible.',
      'help.status': '<kbd>R</kbd> — leer el estado: aviones en vuelo, aterrizados, puntuación.',
      'help.pause': '<kbd>P</kbd> pausa · <kbd>Esc</kbd> volver al menú.',
      'help.back': 'Atrás',

      'test.aria': 'Prueba de orientación de altavoces',
      'test.title': 'Prueba de orientación de altavoces',
      'test.subtitle': 'Un tono gira a tu alrededor. Confirma que coincide con la dirección hablada.',
      'test.front': 'Delante (norte)',
      'test.right': 'Derecha (este)',
      'test.behind': 'Detrás (sur)',
      'test.left': 'Izquierda (oeste)',
      'test.back': 'Atrás',

      'game.aria': 'Control de radar',

      'gameover.aria': 'Fin del turno',
      'gameover.title': 'Fin del turno',
      'gameover.summary': 'Aterrizaste {landed} vuelos por {score} puntos.',
      'gameover.scoreEntry': '#{rank}: {name} — {score}',
      'gameover.namePrompt': '¡Nueva puntuación! Escribe tu nombre:',
      'gameover.nameLabel': 'Nombre',
      'gameover.save': 'Guardar puntuación',
      'gameover.again': 'Jugar de nuevo',
      'gameover.menu': 'Menú',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'player.you': 'Controlador',

      'dir.north': 'norte', 'dir.northeast': 'noreste', 'dir.east': 'este',
      'dir.southeast': 'sureste', 'dir.south': 'sur', 'dir.southwest': 'suroeste',
      'dir.west': 'oeste', 'dir.northwest': 'noroeste',

      'ann.plane': '{name}, {bearing}, {distance} millas, combustible {fuel}.',
      'ann.noPlanes': 'No hay vuelos en el espacio aéreo.',
      'ann.heading': '{name} girando al {dir}.',
      'ann.status': '{airborne} en vuelo, {landed} aterrizados, puntuación {score}.',
      'ann.arrival': '{name} entrando por el {bearing}.',
      'ann.cleared': '{name} autorizado a aterrizar.',
      'ann.holding': '{name} en espera.',
      'ann.runwayBusy': 'Pista ocupada: ya hay un vuelo en aproximación.',
      'ann.landed': '{name} en tierra. Más {points}.',
      'ann.lowFuel': '{name} con poco combustible: {fuel}.',
      'ann.conflict': 'Alerta de conflicto: {a} y {b} acercándose.',
      'ann.crash.collision': '¡Colisión en el aire!',
      'ann.crash.fuel': '¡Un vuelo se quedó sin combustible y cayó!',
      'ann.gameOver': 'Fin del turno. {landed} aterrizados, puntuación {score}.',
      'ann.paused': 'En pausa.',
      'ann.resumed': 'Reanudado.',
      'ann.onlineRank': 'Puesto en línea {rank}.',
      'ann.onlineError': 'Puntuaciones en línea no disponibles.',

      'online.posting': 'Enviando puntuación…',
      'online.rank': 'Puesto en línea: {rank}',
      'online.error': 'Puntuaciones en línea no disponibles — guardada localmente.',
      'online.viewBoard': 'Ver clasificación',
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
