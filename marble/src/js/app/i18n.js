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
  const STORAGE_KEY = 'marble.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Marble',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Marble',
      'menu.subtitle': 'Tilt the maze. Reach the exit. Don\'t fall in.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.learn': 'Learn the sounds',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game
      'game.aria': 'Game',

      // Directions (fixed to the screen: ahead = north/up)
      'dir.front': 'ahead',
      'dir.right': 'to your right',
      'dir.behind': 'behind you',
      'dir.left': 'to your left',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Roll the marble to the exit without falling in a pit.',
      'help.controls': '<strong>Tilt</strong> the board with the <kbd>Arrow keys</kbd> or <kbd>WASD</kbd> — or a gamepad stick. The marble keeps rolling, so steer against its momentum.',
      'help.goal': 'A soft pulsing tone marks the <strong>exit</strong>, and a regular tick points the way to reach it. Roll onto it to clear the level.',
      'help.pit': 'A low growl warns of the <strong>nearest pit</strong>, rising as you approach. Fall in and the run is over.',
      'help.score': 'Clear each level <strong>fast</strong> to score more — points scale with how quickly you reach the exit.',
      'help.audio': 'Sound is fixed to the board: "ahead" is always up (north), no matter which way the marble rolls. <kbd>Up</kbd> tilts it ahead.',
      'help.keys': '<kbd>F1</kbd> status, <kbd>F2</kbd> exit direction, <kbd>F3</kbd> nearest pit, <kbd>F4</kbd> speed. <kbd>Esc</kbd> pauses.',
      'help.back': 'Back',

      // Learn the sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Audition each sound. Use your ears.',
      'learn.goal': 'Exit beacon',
      'learn.pit': 'Pit warning',
      'learn.wall': 'Wall ahead',
      'learn.radar': 'Direction tick',
      'learn.roll': 'Wall bump',
      'learn.fell': 'Falling',
      'learn.clear': 'Level clear',
      'learn.start': 'Level start',
      'learn.back': 'Back',

      // Audio test
      'test.aria': 'Audio test',
      'test.title': 'Audio test',
      'test.subtitle': 'A tick plays at front, right, behind, then left.',
      'test.intro': 'Playing front, right, behind, left.',
      'test.replay': 'Replay',
      'test.back': 'Back',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.quit': 'Quit to menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game Over',
      'gameover.finalScore': 'Score:',
      'gameover.rankMsg': 'New high score! Enter your name:',
      'gameover.nameLabel': 'Your name',
      'gameover.namePlaceholder': 'Your name',
      'gameover.save': 'Save score',
      'gameover.continue': 'Continue',
      'gameover.nameRequired': 'Please enter a name.',

      // Announcements
      'ann.level': 'Level {level}. Score {score}.',
      'ann.status': 'Level {level}, score {score}, best {best}.',
      'ann.exit': 'Exit {dir}, {dist} cells.',
      'ann.pit': 'Nearest pit {dir}, {dist} cells.',
      'ann.noPit': 'No pits nearby.',
      'ann.speed': 'Speed {speed}.',
      'ann.cleared': 'Cleared in {time} seconds. Plus {gain} points. Score {score}.',
      'ann.fell': 'You fell! Score {score}.',
      'ann.gameOver': 'Game over. Score {score}.',
      'ann.gameOverHigh': 'New high score! Score {score}.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank {rank}.',
    },

    es: {
      // <head>
      'doc.title': 'Canica',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'Canica',
      'menu.subtitle': 'Inclina el laberinto. Llega a la salida. No te caigas.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.learn': 'Aprende los sonidos',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Game
      'game.aria': 'Juego',

      // Directions
      'dir.front': 'al frente',
      'dir.right': 'a tu derecha',
      'dir.behind': 'detrás de ti',
      'dir.left': 'a tu izquierda',

      // Help
      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Lleva la canica a la salida sin caer en un pozo.',
      'help.controls': '<strong>Inclina</strong> el tablero con las <kbd>flechas</kbd> o <kbd>WASD</kbd>, o con el joystick. La canica sigue rodando: contrarresta su inercia.',
      'help.goal': 'Un tono suave y pulsante marca la <strong>salida</strong>, y un tic regular indica el camino. Rueda sobre ella para pasar de nivel.',
      'help.pit': 'Un gruñido grave avisa del <strong>pozo más cercano</strong> y crece al acercarte. Si caes, se acaba la partida.',
      'help.score': 'Completa cada nivel <strong>rápido</strong> para puntuar más: los puntos dependen de lo deprisa que llegues a la salida.',
      'help.audio': 'El sonido está fijado al tablero: «al frente» es siempre arriba (norte), sin importar hacia dónde ruede la canica. <kbd>Arriba</kbd> la inclina al frente.',
      'help.keys': '<kbd>F1</kbd> estado, <kbd>F2</kbd> dirección de la salida, <kbd>F3</kbd> pozo más cercano, <kbd>F4</kbd> velocidad. <kbd>Esc</kbd> pausa.',
      'help.back': 'Atrás',

      // Learn the sounds
      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Escucha cada sonido. Usa los oídos.',
      'learn.goal': 'Baliza de salida',
      'learn.pit': 'Aviso de pozo',
      'learn.wall': 'Pared delante',
      'learn.radar': 'Tic de dirección',
      'learn.roll': 'Golpe contra pared',
      'learn.fell': 'Caída',
      'learn.clear': 'Nivel superado',
      'learn.start': 'Inicio de nivel',
      'learn.back': 'Atrás',

      // Audio test
      'test.aria': 'Prueba de audio',
      'test.title': 'Prueba de audio',
      'test.subtitle': 'Suena un tic al frente, a la derecha, detrás y a la izquierda.',
      'test.intro': 'Reproduciendo frente, derecha, detrás, izquierda.',
      'test.replay': 'Repetir',
      'test.back': 'Atrás',

      // Pause
      'pause.aria': 'En pausa',
      'pause.title': 'En pausa',
      'pause.resume': 'Continuar',
      'pause.quit': 'Salir al menú',

      // Game over
      'gameover.aria': 'Fin del juego',
      'gameover.title': 'Fin del juego',
      'gameover.finalScore': 'Puntuación:',
      'gameover.rankMsg': '¡Nueva mejor puntuación! Escribe tu nombre:',
      'gameover.nameLabel': 'Tu nombre',
      'gameover.namePlaceholder': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre, por favor.',

      // Announcements
      'ann.level': 'Nivel {level}. Puntos {score}.',
      'ann.status': 'Nivel {level}, puntos {score}, mejor {best}.',
      'ann.exit': 'Salida {dir}, {dist} casillas.',
      'ann.pit': 'Pozo más cercano {dir}, {dist} casillas.',
      'ann.noPit': 'No hay pozos cerca.',
      'ann.speed': 'Velocidad {speed}.',
      'ann.cleared': 'Completado en {time} segundos. Más {gain} puntos. Puntuación {score}.',
      'ann.fell': '¡Te caíste! Puntuación {score}.',
      'ann.gameOver': 'Fin del juego. Puntuación {score}.',
      'ann.gameOverHigh': '¡Nueva mejor puntuación! {score} puntos.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.onlineRank': 'Puesto en línea {rank}.',
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
