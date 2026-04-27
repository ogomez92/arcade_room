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
  const STORAGE_KEY = 'roadsplat.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'roadsplat',

      'splash.author': 'audio-only road crossing',
      'splash.instruction': 'Press any key or click to begin',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Game',
      'game.headline': 'roadsplat — game in progress',
      'game.hudLabel': 'Game status',
      'game.hp': 'HP',
      'game.level': 'Level',
      'game.score': 'Score',
      'game.next': 'Next',
      'game.position': 'Position',
      'game.help': 'Hold Up Arrow to walk forward, Down Arrow to walk back. F1 score · F2 health · F3 level · F4 position · I full status · Esc pause.',

      // Runtime announcements
      'ann.crashLand': 'You crash-land on the {sidewalk} sidewalk.',
      'ann.hitBy': 'Hit by {vehicle}! Health {hp}',
      'ann.gameOver': 'Game over. {reason}. Reached level {level} with {score} points. Reload to try again.',
      'ann.crossedNorth': 'Crossed north',
      'ann.crossedSouth': 'Crossed back south',
      'ann.scoreLine': '{direction}! Plus {points}. Score {score}',
      'ann.levelUpMsg': 'Level {level}!',
      'ann.roadGrew': ' Road grew to {steps} road steps.',
      'ann.newTraffic': ' New traffic: {names}.',
      'ann.paused': 'Paused',
      'ann.resumed': 'Resumed',
      'ann.startGame': 'Game started at level 1. {steps} road steps to cross. Starting traffic: {starters}. Hold up arrow to walk forward, down arrow to walk back. Listen for cars and time your crossings between them. Score 200 per crossing. Do not loiter on the sidewalk.',
      'ann.statusLine': 'Level {level}. Health {hp}. Score {score}. {need} to next level. {position}.',
      'ann.scoreOnly': 'Score {score}',
      'ann.healthOnly': 'Health {hp}',
      'ann.levelOnly': 'Level {level}, {need} to next level',
      'ann.hitByReason': 'Hit by {vehicle}',

      // Position labels
      'pos.south': 'south sidewalk',
      'pos.north': 'north sidewalk',
      'pos.road': 'on the road',
      'side.south': 'south',
      'side.north': 'north',

      // Vehicle names
      'vehicle.sedan': 'sedan',
      'vehicle.motorbike': 'motorbike',
      'vehicle.bicycle': 'bicycle',
      'vehicle.tractor': 'tractor',
      'vehicle.truck': 'truck',
      'vehicle.scooter': 'scooter',
      'vehicle.delivery van': 'delivery van',
      'vehicle.sports car': 'sports car',
      'vehicle.bus': 'bus',
      'vehicle.race car': 'race car',
    },

    es: {
      'doc.title': 'roadsplat',

      'splash.author': 'cruzar la calle solo con audio',
      'splash.instruction': 'Pulsa una tecla o haz clic para empezar',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Juego',
      'game.headline': 'roadsplat — partida en curso',
      'game.hudLabel': 'Estado del juego',
      'game.hp': 'Vida',
      'game.level': 'Nivel',
      'game.score': 'Puntos',
      'game.next': 'Próximo',
      'game.position': 'Posición',
      'game.help': 'Mantén flecha arriba para caminar adelante, flecha abajo para retroceder. F1 puntos · F2 vida · F3 nivel · F4 posición · I estado completo · Esc pausa.',

      'ann.crashLand': 'Aterrizas de mala manera en la acera {sidewalk}.',
      'ann.hitBy': '¡Te ha atropellado un {vehicle}! Vida {hp}',
      'ann.gameOver': 'Fin del juego. {reason}. Alcanzaste el nivel {level} con {score} puntos. Recarga para volver a intentarlo.',
      'ann.crossedNorth': 'Cruzaste al norte',
      'ann.crossedSouth': 'Cruzaste de vuelta al sur',
      'ann.scoreLine': '¡{direction}! +{points}. Puntos {score}',
      'ann.levelUpMsg': '¡Nivel {level}!',
      'ann.roadGrew': ' La calle creció a {steps} pasos.',
      'ann.newTraffic': ' Tráfico nuevo: {names}.',
      'ann.paused': 'Pausado',
      'ann.resumed': 'Reanudado',
      'ann.startGame': 'Partida iniciada en nivel 1. {steps} pasos para cruzar la calle. Tráfico inicial: {starters}. Mantén flecha arriba para avanzar, flecha abajo para retroceder. Escucha los coches y cruza entre ellos. 200 puntos por cada cruce. No te quedes parado en la acera.',
      'ann.statusLine': 'Nivel {level}. Vida {hp}. Puntos {score}. Faltan {need} para subir de nivel. {position}.',
      'ann.scoreOnly': 'Puntos {score}',
      'ann.healthOnly': 'Vida {hp}',
      'ann.levelOnly': 'Nivel {level}, faltan {need} para el siguiente',
      'ann.hitByReason': 'Atropellado por un {vehicle}',

      'pos.south': 'acera sur',
      'pos.north': 'acera norte',
      'pos.road': 'en la calle',
      'side.south': 'sur',
      'side.north': 'norte',

      'vehicle.sedan': 'turismo',
      'vehicle.motorbike': 'motocicleta',
      'vehicle.bicycle': 'bicicleta',
      'vehicle.tractor': 'tractor',
      'vehicle.truck': 'camión',
      'vehicle.scooter': 'patinete',
      'vehicle.delivery van': 'furgoneta',
      'vehicle.sports car': 'coche deportivo',
      'vehicle.bus': 'autobús',
      'vehicle.race car': 'coche de carreras',
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
