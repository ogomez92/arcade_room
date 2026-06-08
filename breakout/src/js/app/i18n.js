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
  const STORAGE_KEY = 'breakout.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Audio Breakout',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Audio Breakout',
      'menu.subtitle': 'A wood-and-glass arcade wall you can play by ear.',
      'menu.start': 'Start Game',
      'menu.learn': 'Learn Sounds',
      'menu.help': 'How to Play',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Generic UI
      'game.aria': 'Game',
      'game.ready': 'Ready. Press Space or Enter to launch.',
      'game.paused': 'Paused',
      'game.status': 'Level {level}  Score {score}',
      'game.lives': 'Lives {lives}',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.move': '<kbd>Left</kbd>/<kbd>Right</kbd> or <kbd>A</kbd>/<kbd>D</kbd>: move the paddle.',
      'help.launch': '<kbd>Space</kbd> or <kbd>Enter</kbd>: launch the ball or release a caught ball.',
      'help.ping': '<kbd>Tab</kbd>: announce the ball and paddle alignment.',
      'help.debug': '<kbd>0</kbd> three times: spawn a test powerup.',
      'help.audio': 'All gameplay sounds are heard from the paddle. Ball and falling powerups pan left or right from the paddle position; their volume follows vertical position, not horizontal offset. While sliding, a faint scan tone rises with the number of brick rows in that x sector.',
      'help.goal': 'Clear every brick. Catch falling powerups for wide paddle, slow ball, catch, laser, multiball, or extra life.',
      'help.back': 'Back',

      // Learn sounds
      'learn.aria': 'Learn sounds',
      'learn.title': 'Learn Sounds',
      'learn.subtitle': 'Press a button to hear each cue on its own.',
      'learn.ball': 'Ball locator',
      'learn.paddle': 'Sliding paddle',
      'learn.paddleHit': 'Ball hits paddle',
      'learn.wall': 'Ball hits wall',
      'learn.brick': 'Ball hits brick',
      'learn.hardBrick': 'Hard brick cracks',
      'learn.laserShot': 'Laser shots',
      'learn.powerWide': 'Powerup falling — Wide paddle',
      'learn.powerSlow': 'Powerup falling — Slow ball',
      'learn.powerCatch': 'Powerup falling — Catch',
      'learn.powerLaser': 'Powerup falling — Laser',
      'learn.powerMulti': 'Powerup falling — Multiball',
      'learn.powerLife': 'Powerup falling — Extra life',
      'learn.back': 'Back',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game Over',
      'gameover.summary': 'Score {score}. Reached level {level}.',
      'gameover.nameLabel': 'Name',
      'gameover.namePlaceholder': 'Your name',
      'gameover.submitScore': 'Post Online Score',
      'gameover.scorePrompt': 'Enter a name to post this score online.',
      'gameover.scorePosting': 'Posting score...',
      'gameover.scorePosted': 'Score posted online.',
      'gameover.scorePostedRank': 'Score posted online. Rank {rank}.',
      'gameover.scoreFailed': 'Online score failed. Try again.',
      'gameover.scoreUnavailable': 'Online scores are unavailable in this browser.',
      'gameover.scoreInvalidName': 'Use letters, numbers, spaces, or .,-_!?¡¿*.',
      'gameover.again': 'Play Again',
      'gameover.menu': 'Main Menu',

      // Announcements
      'ann.start': 'Audio Breakout. Level {level}. Press Space to launch.',
      'ann.launch': 'Ball launched.',
      'ann.life': 'Ball lost. {lives} lives left.',
      'ann.gameover': 'Game over. Final score {score}.',
      'ann.level': 'Level {level}.',
      'ann.clear': 'Wall cleared.',
      'ann.ping': 'Ball {vertical}, {horizontal}. Paddle {paddle}.',
      'ann.paddleAligned': 'aligned',
      'ann.paddleLeft': 'left of ball',
      'ann.paddleRight': 'right of ball',
      'ann.top': 'near the top',
      'ann.middle': 'mid field',
      'ann.bottom': 'near the paddle',
      'ann.left': 'left',
      'ann.center': 'center',
      'ann.right': 'right',
      'ann.power.wide': 'Wide paddle.',
      'ann.power.slow': 'Slow ball.',
      'ann.power.catch': 'Catch paddle.',
      'ann.power.laser': 'Laser armed.',
      'ann.power.multi': 'Multiball.',
      'ann.power.life': 'Extra life.',
      'ann.power.appear': '{power} powerup falling.',
      'ann.power.name.wide': 'wide paddle',
      'ann.power.name.slow': 'slow ball',
      'ann.power.name.catch': 'catch',
      'ann.power.name.laser': 'laser',
      'ann.power.name.multi': 'multiball',
      'ann.power.name.life': 'extra life',
      'ann.power.end.wide': 'Wide paddle ended.',
      'ann.power.end.slow': 'Slow ball ended.',
      'ann.power.end.catch': 'Catch paddle ended.',
      'ann.power.end.laser': 'Laser ended.',
    },

    es: {
      // <head>
      'doc.title': 'Audio Breakout',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'Audio Breakout',
      'menu.subtitle': 'Un muro arcade de madera y cristal que se puede jugar de oído.',
      'menu.start': 'Empezar partida',
      'menu.learn': 'Aprender sonidos',
      'menu.help': 'Cómo jugar',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Generic UI
      'game.aria': 'Juego',
      'game.ready': 'Listo. Pulsa Espacio o Intro para lanzar.',
      'game.paused': 'Pausa',
      'game.status': 'Nivel {level}  Puntos {score}',
      'game.lives': 'Vidas {lives}',

      // Help
      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.move': '<kbd>Izquierda</kbd>/<kbd>Derecha</kbd> o <kbd>A</kbd>/<kbd>D</kbd>: mover la pala.',
      'help.launch': '<kbd>Espacio</kbd> o <kbd>Intro</kbd>: lanzar la bola o soltar una bola atrapada.',
      'help.ping': '<kbd>Tab</kbd>: anunciar la alineación de bola y pala.',
      'help.debug': '<kbd>0</kbd> tres veces: hacer aparecer un poder de prueba.',
      'help.audio': 'Todos los sonidos del juego se oyen desde la pala. La bola y los poderes que caen se panean a izquierda o derecha desde la posición de la pala; el volumen depende de la posición vertical, no del desplazamiento horizontal. Al deslizar, un tono de escaneo muy suave sube con el número de filas de ladrillos en ese sector horizontal.',
      'help.goal': 'Rompe todos los ladrillos. Recoge poderes: pala ancha, bola lenta, captura, láser, multibola o vida extra.',
      'help.back': 'Atrás',

      // Learn sounds
      'learn.aria': 'Aprender sonidos',
      'learn.title': 'Aprender sonidos',
      'learn.subtitle': 'Pulsa cada botón para oír el sonido aislado.',
      'learn.ball': 'Localizador de la bola',
      'learn.paddle': 'Pala deslizándose',
      'learn.paddleHit': 'La bola golpea la pala',
      'learn.wall': 'La bola golpea la pared',
      'learn.brick': 'La bola golpea un ladrillo',
      'learn.hardBrick': 'Ladrillo duro agrietándose',
      'learn.laserShot': 'Disparos láser',
      'learn.powerWide': 'Poder cayendo — Pala ancha',
      'learn.powerSlow': 'Poder cayendo — Bola lenta',
      'learn.powerCatch': 'Poder cayendo — Captura',
      'learn.powerLaser': 'Poder cayendo — Láser',
      'learn.powerMulti': 'Poder cayendo — Multibola',
      'learn.powerLife': 'Poder cayendo — Vida extra',
      'learn.back': 'Atrás',

      // Game over
      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Fin de la partida',
      'gameover.summary': 'Puntos {score}. Nivel alcanzado {level}.',
      'gameover.nameLabel': 'Nombre',
      'gameover.namePlaceholder': 'Tu nombre',
      'gameover.submitScore': 'Publicar puntuación',
      'gameover.scorePrompt': 'Escribe un nombre para publicar esta puntuación.',
      'gameover.scorePosting': 'Publicando puntuación...',
      'gameover.scorePosted': 'Puntuación publicada.',
      'gameover.scorePostedRank': 'Puntuación publicada. Puesto {rank}.',
      'gameover.scoreFailed': 'No se pudo publicar. Inténtalo otra vez.',
      'gameover.scoreUnavailable': 'Las puntuaciones online no están disponibles en este navegador.',
      'gameover.scoreInvalidName': 'Usa letras, números, espacios o .,-_!?¡¿*.',
      'gameover.again': 'Jugar otra vez',
      'gameover.menu': 'Menú principal',

      // Announcements
      'ann.start': 'Audio Breakout. Nivel {level}. Pulsa Espacio para lanzar.',
      'ann.launch': 'Bola lanzada.',
      'ann.life': 'Bola perdida. Quedan {lives} vidas.',
      'ann.gameover': 'Fin de la partida. Puntuación final {score}.',
      'ann.level': 'Nivel {level}.',
      'ann.clear': 'Muro despejado.',
      'ann.ping': 'Bola {vertical}, {horizontal}. Pala {paddle}.',
      'ann.paddleAligned': 'alineada',
      'ann.paddleLeft': 'a la izquierda de la bola',
      'ann.paddleRight': 'a la derecha de la bola',
      'ann.top': 'arriba',
      'ann.middle': 'en medio',
      'ann.bottom': 'cerca de la pala',
      'ann.left': 'izquierda',
      'ann.center': 'centro',
      'ann.right': 'derecha',
      'ann.power.wide': 'Pala ancha.',
      'ann.power.slow': 'Bola lenta.',
      'ann.power.catch': 'Pala adhesiva.',
      'ann.power.laser': 'Láser listo.',
      'ann.power.multi': 'Multibola.',
      'ann.power.life': 'Vida extra.',
      'ann.power.appear': 'Poder cayendo: {power}.',
      'ann.power.name.wide': 'pala ancha',
      'ann.power.name.slow': 'bola lenta',
      'ann.power.name.catch': 'captura',
      'ann.power.name.laser': 'láser',
      'ann.power.name.multi': 'multibola',
      'ann.power.name.life': 'vida extra',
      'ann.power.end.wide': 'Pala ancha terminada.',
      'ann.power.end.slow': 'Bola lenta terminada.',
      'ann.power.end.catch': 'Captura terminada.',
      'ann.power.end.laser': 'Láser terminado.',
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
