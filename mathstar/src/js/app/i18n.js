/**
 * i18n for Mathstar. Same shape as every other game in the
 * collection — copy this and the language picker screen verbatim into
 * a new game; only the STORAGE_KEY and the dictionaries differ.
 *
 * Annotate static DOM with data-i18n / data-i18n-html / data-i18n-attr.
 * Runtime strings: app.i18n.t('key', {param}). Templates use {name}.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'mathstar.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Mathstar',

      // Menu
      'menu.aria':       'Main menu',
      'menu.title':      'Mathstar',
      'menu.subtitle':   'Solve the operation before the music ends.',
      'menu.start':      'Start',
      'menu.levelSelect': 'Start at Level…',
      'menu.highscores': 'High scores',

      // Level select
      'levelSelect.aria':          'Pick a starting level',
      'levelSelect.title':         'Start at Level',
      'levelSelect.subtitle':      'Use Up and Down arrows to choose a level. Press Enter to start. The highest unlocked level grows as you play.',
      'levelSelect.levelLabel':    'Level',
      'levelSelect.maxLabel':      'Highest unlocked:',
      'levelSelect.decrease':      'Lower (Down arrow)',
      'levelSelect.increase':      'Higher (Up arrow)',
      'levelSelect.start':         'Start at level {level}',
      'levelSelect.back':          'Back',
      'levelSelect.announceLevel': 'Level {level}.',

      // Language picker
      'language.aria':     'Choose language',
      'language.title':    'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back':     'Back',
      'language.button':   'Language',

      // Game HUD
      'game.aria':       'Game',
      'game.level':      'Level {n} — {done} / {of}',
      'game.lives':      'Lives: {n}',
      'game.score':      'Score: {n}',
      'game.tip':        'Type the answer with the number keys. F1 score, F2 lives, F3 level, F4 repeat operation.',

      // Status hotkey readouts
      'game.aria.score': 'Score {n}.',
      'game.aria.lives': '{n} lives remaining.',
      'game.aria.level': 'Level {n}, operation {done} of {of}.',

      // Operators (spelled out for the announcer)
      'op.plus':       'plus',
      'op.minus':      'minus',
      'op.times':      'times',
      'op.dividedBy':  'divided by',

      // Announcer events
      'ann.level':            'Level {level}.',
      'ann.operation':        '{a} {op} {b}.',
      'ann.correct':          'Correct, plus {gain}.',
      'ann.fail.wrongDigit':  'Wrong. The answer was {answer}. Lives: {lives}.',
      'ann.fail.timeout':     'Time. The answer was {answer}. Lives: {lives}.',
      'ann.fail.blur':        'Lost focus. The answer was {answer}. Lives: {lives}.',
      'ann.levelClear':       'Level {level} cleared. Bonus {bonus}.',
      'ann.levelClearBonus':  'Level {level} cleared, perfect run, extra life. Bonus {bonus}.',
      'ann.gameover':         'Game over. Final score {score}.',
      'ann.onlineRank':       'Online rank: number {rank}.',
      'ann.onlineError':      'Could not reach the online leaderboard. Score saved locally.',

      // Online leaderboard
      'online.posting':   'Posting your score…',
      'online.rank':      'Online rank: #{rank}',
      'online.error':     'Couldn’t reach the leaderboard. Saved locally.',
      'online.viewBoard': 'View the world leaderboard',

      // Game over screen
      'gameover.aria':       'Game over',
      'gameover.title':      'Game over',
      'gameover.score':      'Final score: {n}',
      'gameover.level':      'Reached level {n}',
      'gameover.newRecord':  'New high score!',
      'gameover.namePrompt': 'Your name:',
      'gameover.nameRequired': 'Type a name to save your score.',
      'gameover.save':       'Save',
      'gameover.saved':      'Score saved.',
      'gameover.playAgain':  'Play again',
      'gameover.highscores': 'High scores',
      'gameover.menu':       'Menu',

      // High scores screen
      'highscores.aria':  'High scores',
      'highscores.title': 'High scores',
      'highscores.empty': 'No scores yet — play a round!',
      'highscores.row':   '{rank}. {name} — {score} (level {level})',
      'highscores.back':  'Back',
    },

    es: {
      // <head>
      'doc.title': 'Mathstar',

      // Menu
      'menu.aria':       'Menú principal',
      'menu.title':      'Mathstar',
      'menu.subtitle':   'Resuelve la operación antes de que termine la música.',
      'menu.start':      'Empezar',
      'menu.levelSelect': 'Empezar en nivel…',
      'menu.highscores': 'Récords',

      // Level select
      'levelSelect.aria':          'Elige un nivel de inicio',
      'levelSelect.title':         'Empezar en nivel',
      'levelSelect.subtitle':      'Usa las flechas Arriba y Abajo para elegir el nivel. Pulsa Intro para empezar. El nivel máximo desbloqueado crece según vas jugando.',
      'levelSelect.levelLabel':    'Nivel',
      'levelSelect.maxLabel':      'Máximo desbloqueado:',
      'levelSelect.decrease':      'Bajar (flecha abajo)',
      'levelSelect.increase':      'Subir (flecha arriba)',
      'levelSelect.start':         'Empezar en nivel {level}',
      'levelSelect.back':          'Atrás',
      'levelSelect.announceLevel': 'Nivel {level}.',

      // Language picker
      'language.aria':     'Elegir idioma',
      'language.title':    'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back':     'Atrás',
      'language.button':   'Idioma',

      // Game HUD
      'game.aria':       'Juego',
      'game.level':      'Nivel {n} — {done} / {of}',
      'game.lives':      'Vidas: {n}',
      'game.score':      'Puntos: {n}',
      'game.tip':        'Teclea la respuesta con los números. F1 puntos, F2 vidas, F3 nivel, F4 repetir operación.',

      'game.aria.score': 'Puntos {n}.',
      'game.aria.lives': 'Te quedan {n} vidas.',
      'game.aria.level': 'Nivel {n}, operación {done} de {of}.',

      'op.plus':       'más',
      'op.minus':      'menos',
      'op.times':      'por',
      'op.dividedBy':  'entre',

      'ann.level':            'Nivel {level}.',
      'ann.operation':        '{a} {op} {b}.',
      'ann.correct':          '¡Correcto! Más {gain}.',
      'ann.fail.wrongDigit':  'Mal. Era {answer}. Te quedan {lives} vidas.',
      'ann.fail.timeout':     'Tiempo. Era {answer}. Te quedan {lives} vidas.',
      'ann.fail.blur':        'Foco perdido. Era {answer}. Te quedan {lives} vidas.',
      'ann.levelClear':       'Nivel {level} superado. Bonus {bonus}.',
      'ann.levelClearBonus':  '¡Nivel {level} perfecto! Vida extra. Bonus {bonus}.',
      'ann.gameover':         'Fin del juego. Puntos finales: {score}.',
      'ann.onlineRank':       'Puesto en línea: número {rank}.',
      'ann.onlineError':      'No se pudo conectar con el ránking en línea. Puntuación guardada localmente.',

      // Ránking online
      'online.posting':   'Enviando tu puntuación…',
      'online.rank':      'Puesto en línea: número {rank}',
      'online.error':     'No se pudo conectar con el ránking. Guardada localmente.',
      'online.viewBoard': 'Ver el ránking mundial',

      'gameover.aria':       'Fin del juego',
      'gameover.title':      'Fin del juego',
      'gameover.score':      'Puntos finales: {n}',
      'gameover.level':      'Llegaste al nivel {n}',
      'gameover.newRecord':  '¡Nuevo récord!',
      'gameover.namePrompt': 'Tu nombre:',
      'gameover.nameRequired': 'Escribe un nombre para guardar tu puntuación.',
      'gameover.save':       'Guardar',
      'gameover.saved':      'Récord guardado.',
      'gameover.playAgain':  'Otra partida',
      'gameover.highscores': 'Récords',
      'gameover.menu':       'Menú',

      'highscores.aria':  'Récords',
      'highscores.title': 'Récords',
      'highscores.empty': 'Aún no hay récords. ¡Échale una partida!',
      'highscores.row':   '{rank}. {name} — {score} (nivel {level})',
      'highscores.back':  'Atrás',
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
