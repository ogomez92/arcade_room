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
  const STORAGE_KEY = 'airhockey.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Air Hockey',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Air Hockey',
      'menu.subtitle': 'Defend your goal, score in theirs.',
      'menu.difficulty': 'Difficulty',
      'menu.firstTo': 'Match length',
      'menu.start': 'Start',
      'menu.learn': 'Learn the sounds',
      'menu.help': 'How to play',

      'diff.easy': 'Easy',
      'diff.medium': 'Medium',
      'diff.hard': 'Hard',
      'target.7': 'First to 7',
      'target.11': 'First to 11',
      'target.15': 'First to 15',
      'records.line': 'Wins {wins}, losses {losses}, best streak {streak}.',

      // Game over
      'over.aria': 'Game over',
      'over.win': 'You win!',
      'over.lose': 'You lose',
      'over.score': 'Final score: you {you}, opponent {opp}.',
      'over.rematch': 'Rematch',
      'over.menu': 'Menu',

      // How to play
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.move': 'Move your mallet with the <kbd>Arrow keys</kbd>, a gamepad stick, or by dragging on a touch screen. You are confined to your half.',
      'help.hit': 'There is no hit button. <strong>Drive your mallet through the puck</strong> to add pace. Aim is pure physics — you learn shot lines by ear.',
      'help.audio': 'Up-table is in front of you; your goal is behind. The puck hisses; a ping marks the opponent goal; a rising alarm warns when a shot is heading for your net.',
      'help.keys': 'Status keys: <kbd>F1</kbd> score, <kbd>F2</kbd> puck bearing, <kbd>F3</kbd> your position, <kbd>F4</kbd> match state. <kbd>Esc</kbd> leaves the match.',
      'help.back': 'Back',

      // Announcements
      'ann.target': 'First to {n}',
      'ann.serveYou': 'Your serve',
      'ann.serveOpp': 'Opponent serves',
      'ann.youScore': 'You score. {you} to {opp}.',
      'ann.oppScore': 'Opponent scores. {you} to {opp}.',
      'ann.matchPoint': 'Match point.',
      'ann.danger': 'Danger!',
      'ann.score': 'You {you}, opponent {opp}.',
      'ann.state': '{diff}, first to {target}, {serve}.',
      'ann.puck': 'Puck {vert} {horiz}, {dist}.',
      'ann.mallet': 'Mallet {horiz}, {depth}.',
      'ann.cm': '{n} centimetres',
      'ann.m': '{n} metres',
      'ann.win': 'You win, {you} to {opp}.',
      'ann.lose': 'You lose, {you} to {opp}.',
      'ann.onlineRank': 'Online rank {rank}.',
      'ann.onlineError': 'Could not reach the leaderboard.',

      // Direction tokens
      'dir.ahead': 'ahead',
      'dir.behind': 'behind',
      'dir.level': 'level',
      'dir.left': 'left',
      'dir.right': 'right',
      'dir.centre': 'centre',
      'dir.deep': 'deep',
      'dir.forward': 'forward',
      'dir.mid': 'mid-half',

      // Online leaderboard
      'online.posting': 'Posting your streak…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': 'Could not reach the leaderboard.',
      'online.viewBoard': 'View leaderboard',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Generic UI
      'game.aria': 'Game',

      // Orientation test (#test)
      'test.aria': 'Orientation test',
      'test.title': 'Orientation test',
      'test.subtitle': 'A tick plays in front, right, behind, then left.',
      'test.intro': 'Orientation test. Listen for front, right, behind, left.',
      'test.replay': 'Replay',
      'test.back': 'Back',
      'test.dirFront': 'Front',
      'test.dirRight': 'Right',
      'test.dirBehind': 'Behind',
      'test.dirLeft': 'Left',

      // Learn the sounds (#learn)
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Press a button to hear each cue.',
      'learn.intro': 'Learn the sounds. Pick a cue to hear it.',
      'learn.back': 'Back',
      'learn.puck': 'The puck (air hiss)',
      'learn.aimPing': 'Opponent goal — aim ping',
      'learn.homeHum': 'Your goal — home hum',
      'learn.blower': 'Table blower',
      'learn.threat': 'Threat alarm',
      'learn.yourHit': 'Your mallet hit',
      'learn.oppHit': 'Opponent mallet hit',
      'learn.telegraph': 'Opponent wind-up (telegraph)',
      'learn.railSide': 'Puck on side rail',
      'learn.railEnd': 'Puck on end rail',
      'learn.malletBump': 'Your mallet on a wall',
      'learn.post': 'Goal post ping',
      'learn.goalYou': 'You score',
      'learn.goalOpp': 'Opponent scores',
      'learn.serve': 'Serve indicator',
      'learn.go': 'Ready, go!',
      'learn.win': 'Win jingle',
      'learn.lose': 'Lose jingle',
    },

    es: {
      // <head>
      'doc.title': 'Air Hockey',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'Air Hockey',
      'menu.subtitle': 'Defiende tu portería y marca en la suya.',
      'menu.difficulty': 'Dificultad',
      'menu.firstTo': 'Duración del partido',
      'menu.start': 'Empezar',
      'menu.learn': 'Aprende los sonidos',
      'menu.help': 'Cómo jugar',

      'diff.easy': 'Fácil',
      'diff.medium': 'Media',
      'diff.hard': 'Difícil',
      'target.7': 'A 7',
      'target.11': 'A 11',
      'target.15': 'A 15',
      'records.line': 'Victorias {wins}, derrotas {losses}, mejor racha {streak}.',

      // Game over
      'over.aria': 'Fin de la partida',
      'over.win': '¡Ganaste!',
      'over.lose': 'Perdiste',
      'over.score': 'Resultado final: tú {you}, rival {opp}.',
      'over.rematch': 'Revancha',
      'over.menu': 'Menú',

      // How to play
      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.move': 'Mueve tu mazo con las <kbd>flechas</kbd>, el stick del mando o arrastrando en una pantalla táctil. Estás confinado a tu mitad.',
      'help.hit': 'No hay botón de golpe. <strong>Empuja el mazo a través del disco</strong> para darle velocidad. La puntería es pura física: aprendes las líneas de tiro de oído.',
      'help.audio': 'Hacia el fondo es delante de ti; tu portería queda detrás. El disco silba; un pitido marca la portería rival; una alarma creciente avisa cuando un tiro va hacia tu red.',
      'help.keys': 'Teclas de estado: <kbd>F1</kbd> marcador, <kbd>F2</kbd> posición del disco, <kbd>F3</kbd> tu posición, <kbd>F4</kbd> estado del partido. <kbd>Esc</kbd> sale del partido.',
      'help.back': 'Atrás',

      // Announcements
      'ann.target': 'A {n}',
      'ann.serveYou': 'Tu saque',
      'ann.serveOpp': 'Saca el rival',
      'ann.youScore': 'Marcas. {you} a {opp}.',
      'ann.oppScore': 'Marca el rival. {you} a {opp}.',
      'ann.matchPoint': 'Punto de partido.',
      'ann.danger': '¡Peligro!',
      'ann.score': 'Tú {you}, rival {opp}.',
      'ann.state': '{diff}, a {target}, {serve}.',
      'ann.puck': 'Disco {vert} {horiz}, {dist}.',
      'ann.mallet': 'Mazo {horiz}, {depth}.',
      'ann.cm': '{n} centímetros',
      'ann.m': '{n} metros',
      'ann.win': 'Ganas, {you} a {opp}.',
      'ann.lose': 'Pierdes, {you} a {opp}.',
      'ann.onlineRank': 'Puesto en línea {rank}.',
      'ann.onlineError': 'No se pudo conectar con la clasificación.',

      // Direction tokens
      'dir.ahead': 'delante',
      'dir.behind': 'detrás',
      'dir.level': 'a la altura',
      'dir.left': 'a la izquierda',
      'dir.right': 'a la derecha',
      'dir.centre': 'en el centro',
      'dir.deep': 'atrás',
      'dir.forward': 'adelantado',
      'dir.mid': 'media zona',

      // Online leaderboard
      'online.posting': 'Enviando tu racha…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación.',
      'online.viewBoard': 'Ver clasificación',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Generic UI
      'game.aria': 'Juego',

      // Orientation test (#test)
      'test.aria': 'Prueba de orientación',
      'test.title': 'Prueba de orientación',
      'test.subtitle': 'Un toque suena delante, a la derecha, detrás y a la izquierda.',
      'test.intro': 'Prueba de orientación. Escucha: delante, derecha, detrás, izquierda.',
      'test.replay': 'Repetir',
      'test.back': 'Atrás',
      'test.dirFront': 'Delante',
      'test.dirRight': 'Derecha',
      'test.dirBehind': 'Detrás',
      'test.dirLeft': 'Izquierda',

      // Learn the sounds (#learn)
      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Pulsa un botón para oír cada señal.',
      'learn.intro': 'Aprende los sonidos. Elige una señal para oírla.',
      'learn.back': 'Atrás',
      'learn.puck': 'El disco (silbido de aire)',
      'learn.aimPing': 'Portería rival — pitido de puntería',
      'learn.homeHum': 'Tu portería — zumbido',
      'learn.blower': 'Soplador de la mesa',
      'learn.threat': 'Alarma de peligro',
      'learn.yourHit': 'Golpe de tu mazo',
      'learn.oppHit': 'Golpe del mazo rival',
      'learn.telegraph': 'Amago del rival (aviso)',
      'learn.railSide': 'Disco en banda lateral',
      'learn.railEnd': 'Disco en banda de fondo',
      'learn.malletBump': 'Tu mazo contra una pared',
      'learn.post': 'Toque en el poste',
      'learn.goalYou': 'Marcas tú',
      'learn.goalOpp': 'Marca el rival',
      'learn.serve': 'Indicador de saque',
      'learn.go': '¡Listos, ya!',
      'learn.win': 'Melodía de victoria',
      'learn.lose': 'Melodía de derrota',
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
