app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'whack.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Whack-a-Critter',

      'splash.title': 'Whack-a-Critter',
      'splash.author': 'an audio-first arcade game',
      'splash.instruction': 'Press any key to begin',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'menu.aria': 'Main menu',
      'menu.title': 'Whack-a-Critter',
      'menu.subtitle': 'An audio-first whack-a-mole. Listen to the lair, swing the hammer.',
      'menu.play': 'Play',
      'menu.learn': 'Learn the critters',
      'menu.help': 'How to play',
      'menu.language': 'Language',
      'menu.highLabel': 'Best:',

      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.intro': 'Six critters live in lairs around you. They poke their heads out and you must whack them with your rubber hammer before they hide again.',
      'help.layoutTitle': 'Lair layout',
      'help.layoutQ': '<kbd>Q</kbd> — front-left lair',
      'help.layoutE': '<kbd>E</kbd> — straight ahead',
      'help.layoutT': '<kbd>T</kbd> — front-right lair',
      'help.layoutZ': '<kbd>Z</kbd> — back-left lair',
      'help.layoutC': '<kbd>C</kbd> — directly behind',
      'help.layoutB': '<kbd>B</kbd> — back-right lair',
      'help.layoutNote': 'You stand on D at the centre. D is empty — never whacked. Each lair has its own creature with its own voice, so you can tell them apart by sound.',
      'help.scoringTitle': 'Scoring',
      'help.scoringEarly': 'Hit early for more points. A fresh popup is worth up to 150; a dying popup is worth as little as 30.',
      'help.scoringMisses': 'If a critter hides without being hit, you lose one miss. Five misses ends the run.',
      'help.scoringSpeed': 'The longer you survive, the faster the critters pop and the more pop at once. The music layers up too.',
      'help.statusTitle': 'Status keys',
      'help.statusF1': '<kbd>F1</kbd> — read score',
      'help.statusF2': '<kbd>F2</kbd> — read misses left',
      'help.statusF3': '<kbd>F3</kbd> — read current level',
      'help.statusEsc': '<kbd>Esc</kbd> — back to the menu',
      'help.back': 'Back',

      'learn.aria': 'Learn the critters',
      'learn.title': 'Learn the critters',
      'learn.subtitle': 'Click a button to hear that critter pop out of its lair from your point of view at the centre.',
      'learn.back': 'Back',
      'learn.item': '{key} — {name} ({direction})',

      'game.aria': 'Game',
      'game.title': 'Whack the Critters',
      'game.instruction': 'Press Z C B Q E T to whack each lair.',
      'game.scoreLabel': 'Score:',
      'game.missesLabel': 'Misses left:',
      'game.levelLabel': 'Level:',

      'gameover.aria': 'Run over',
      'gameover.title': 'Run over',
      'gameover.summary': 'Final score {score} on level {level}.',
      'gameover.summaryNew': 'New best! Final score {score} on level {level}.',
      'gameover.again': 'Play again',
      'gameover.menu': 'Main menu',

      'critter.q': 'Frog',
      'critter.e': 'Bird',
      'critter.t': 'Cat',
      'critter.z': 'Pup',
      'critter.c': 'Owl',
      'critter.b': 'Mouse',

      'dir.q': 'front-left',
      'dir.e': 'straight ahead',
      'dir.t': 'front-right',
      'dir.z': 'back-left',
      'dir.c': 'behind',
      'dir.b': 'back-right',

      'ann.start': 'Go!',
      'ann.pop': '{name} {direction}',
      'ann.miss': 'Missed!',
      'ann.gameOver': 'Game over. Final score {score}.',
      'ann.score': 'Score {score}.',
      'ann.misses': '{misses} misses left.',
      'ann.level': 'Level {level}.',
      'ann.levelUp': 'Level {level}!',
      'ann.newHigh': 'New best score!',
    },

    es: {
      'doc.title': 'Pim Pam Bichos',

      'splash.title': 'Pim Pam Bichos',
      'splash.author': 'un arcade que se juega de oído',
      'splash.instruction': 'Pulsa cualquier tecla para empezar',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'menu.aria': 'Menú principal',
      'menu.title': 'Pim Pam Bichos',
      'menu.subtitle': 'Un pim pam que se juega de oído. Escucha la madriguera, lanza el martillo.',
      'menu.play': 'Jugar',
      'menu.learn': 'Aprender los bichos',
      'menu.help': 'Cómo se juega',
      'menu.language': 'Idioma',
      'menu.highLabel': 'Récord:',

      'help.aria': 'Cómo se juega',
      'help.title': 'Cómo se juega',
      'help.intro': 'Seis bichos viven en madrigueras a tu alrededor. Asoman la cabeza y debes golpearles con el martillo de goma antes de que vuelvan a esconderse.',
      'help.layoutTitle': 'Disposición de las madrigueras',
      'help.layoutQ': '<kbd>Q</kbd> — madriguera delantera izquierda',
      'help.layoutE': '<kbd>E</kbd> — justo enfrente',
      'help.layoutT': '<kbd>T</kbd> — madriguera delantera derecha',
      'help.layoutZ': '<kbd>Z</kbd> — madriguera trasera izquierda',
      'help.layoutC': '<kbd>C</kbd> — justo detrás',
      'help.layoutB': '<kbd>B</kbd> — madriguera trasera derecha',
      'help.layoutNote': 'Tú estás en la D, en el centro. La D está vacía y no se golpea. Cada madriguera tiene su propio bicho con su propia voz, así que se distinguen de oído.',
      'help.scoringTitle': 'Puntuación',
      'help.scoringEarly': 'Golpea pronto para más puntos. Un asomo recién hecho vale hasta 150; uno casi escondido vale 30.',
      'help.scoringMisses': 'Si un bicho se esconde sin recibir golpe pierdes una oportunidad. A las cinco se acaba la partida.',
      'help.scoringSpeed': 'Cuanto más aguantes, más rápido salen y más bichos a la vez. La música también gana capas.',
      'help.statusTitle': 'Teclas de estado',
      'help.statusF1': '<kbd>F1</kbd> — leer puntuación',
      'help.statusF2': '<kbd>F2</kbd> — leer oportunidades restantes',
      'help.statusF3': '<kbd>F3</kbd> — leer nivel actual',
      'help.statusEsc': '<kbd>Esc</kbd> — volver al menú',
      'help.back': 'Atrás',

      'learn.aria': 'Aprender los bichos',
      'learn.title': 'Aprender los bichos',
      'learn.subtitle': 'Pulsa un botón para oír cómo asoma cada bicho desde tu posición central.',
      'learn.back': 'Atrás',
      'learn.item': '{key} — {name} ({direction})',

      'game.aria': 'Juego',
      'game.title': 'Aporrea los bichos',
      'game.instruction': 'Pulsa Z C B Q E T para golpear cada madriguera.',
      'game.scoreLabel': 'Puntos:',
      'game.missesLabel': 'Fallos restantes:',
      'game.levelLabel': 'Nivel:',

      'gameover.aria': 'Partida terminada',
      'gameover.title': 'Partida terminada',
      'gameover.summary': 'Puntuación final {score} en el nivel {level}.',
      'gameover.summaryNew': '¡Nuevo récord! Puntuación final {score} en el nivel {level}.',
      'gameover.again': 'Jugar otra vez',
      'gameover.menu': 'Menú principal',

      'critter.q': 'Rana',
      'critter.e': 'Pájaro',
      'critter.t': 'Gato',
      'critter.z': 'Cachorro',
      'critter.c': 'Búho',
      'critter.b': 'Ratón',

      'dir.q': 'delantera izquierda',
      'dir.e': 'justo enfrente',
      'dir.t': 'delantera derecha',
      'dir.z': 'trasera izquierda',
      'dir.c': 'detrás',
      'dir.b': 'trasera derecha',

      'ann.start': '¡Adelante!',
      'ann.pop': '{name} {direction}',
      'ann.miss': '¡Fallo!',
      'ann.gameOver': 'Fin de la partida. Puntos finales {score}.',
      'ann.score': 'Puntos {score}.',
      'ann.misses': 'Fallos restantes {misses}.',
      'ann.level': 'Nivel {level}.',
      'ann.levelUp': '¡Nivel {level}!',
      'ann.newHigh': '¡Nuevo récord!',
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
