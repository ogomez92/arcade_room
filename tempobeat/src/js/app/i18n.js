/**
 * RITMO! i18n. Full dictionaries for English and Spanish.
 *
 * Authoring rule per project memory: per-locale phrase pools are
 * authored independently — direct translations of English stilt-walk
 * Spanish, and vice versa. Style names, announcer flavor lines, and
 * stop reasons each have native pools for the locale.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'ritmo.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'RITMO!',

      'menu.aria': 'Main menu',
      'menu.title': 'RITMO!',
      'menu.subtitle': 'Press Enter on every beat as the ping bounces left and right. Three misses and the song stops.',
      'menu.start': 'Start',
      'menu.highscores': 'High scores',
      'menu.learn': 'Learn the sounds',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Game',
      'game.title': 'RITMO!',
      'game.hint': 'Press Enter on every beat. F1 score, F2 hits, F3 BPM, F4 lives. Esc to menu.',
      'game.style': 'Style: {name}',
      'game.score': 'Score {score}',
      'game.hits': 'Hits {hits}',
      'game.bpm': 'BPM {bpm}',
      'game.lives': 'Lives {lives}',
      'game.statusReady': 'Listen — count-in.',
      'game.statusPlay': 'Catch every beat.',
      'game.statusMiss': 'Missed.',
      'game.statusHit': 'Nice.',
      'game.statusOver': 'You broke the pulse.',

      'gameover.aria': 'Game over',
      'gameover.title': 'You broke the pulse',
      'gameover.score': 'Final score: {n}',
      'gameover.meta': '{hits} beats — peak {bpm} BPM — style {style}',
      'gameover.newRecord': 'New local record!',
      'gameover.nameLabel': 'Your name',
      'gameover.save': 'Save score',
      'gameover.saved': 'Score saved.',
      'gameover.nameRequired': 'Type your name first.',
      'gameover.playAgain': 'Play again',
      'gameover.highscores': 'High scores',
      'gameover.menu': 'Main menu',

      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Local top 10 — beat them.',
      'highscores.empty': 'No scores yet. Set the first.',
      'highscores.online': 'Online leaderboard',
      'highscores.back': 'Back',
      'highscores.row': '{name} — {score} — {hits} beats — {bpm} BPM',

      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Audition each cue before you play.',
      'learn.metronome': 'Metronome count-in',
      'learn.pingRight': 'Ping at the right beat',
      'learn.pingLeft': 'Ping at the left beat',
      'learn.kick': 'Kick drum (the beat)',
      'learn.hit': 'Hit (you nailed it)',
      'learn.miss': 'Miss (you lost a life)',
      'learn.gameover': 'Game over',
      'learn.back': 'Back',

      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard.",
      'online.viewBoard': 'View leaderboard',

      'ann.start': 'Style {style}. Listen for the count-in.',
      'ann.go': 'Go.',
      'ann.miss': 'Missed. {lives} lives left.',
      'ann.life': 'Life lost. {lives} left.',
      'ann.hit': 'Hit.',
      'ann.gameover': 'Game over. Score {score}.',
      'ann.score': 'Score {score}.',
      'ann.hits': '{hits} beats.',
      'ann.bpm': '{bpm} BPM.',
      'ann.lives': '{lives} lives.',
      'ann.onlineRank': 'Online rank {rank}.',
      'ann.onlineError': "Couldn't reach the leaderboard.",

      // Style display names — short, evocative.
      'style.house':       'house',
      'style.techno':      'techno',
      'style.disco':       'disco',
      'style.tribal':      'tribal',
      'style.synthwave':   'synthwave',
      'style.dnb':         'drum and bass',
    },

    es: {
      'doc.title': '¡RITMO!',

      'menu.aria': 'Menú principal',
      'menu.title': '¡RITMO!',
      'menu.subtitle': 'Pulsa Intro en cada pulso mientras el pin rebota de izquierda a derecha. Tres fallos y se acabó.',
      'menu.start': 'Empezar',
      'menu.highscores': 'Puntuaciones',
      'menu.learn': 'Aprende los sonidos',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Juego',
      'game.title': '¡RITMO!',
      'game.hint': 'Pulsa Intro en cada pulso. F1 puntos, F2 golpes, F3 BPM, F4 vidas. Esc al menú.',
      'game.style': 'Estilo: {name}',
      'game.score': 'Puntos {score}',
      'game.hits': 'Golpes {hits}',
      'game.bpm': '{bpm} BPM',
      'game.lives': 'Vidas {lives}',
      'game.statusReady': 'Atento — entra el conteo.',
      'game.statusPlay': 'Coge cada pulso.',
      'game.statusMiss': 'Fallaste.',
      'game.statusHit': 'Eso es.',
      'game.statusOver': 'Rompiste el pulso.',

      'gameover.aria': 'Fin de partida',
      'gameover.title': 'Rompiste el pulso',
      'gameover.score': 'Puntuación final: {n}',
      'gameover.meta': '{hits} golpes — pico {bpm} BPM — estilo {style}',
      'gameover.newRecord': '¡Récord local!',
      'gameover.nameLabel': 'Tu nombre',
      'gameover.save': 'Guardar puntuación',
      'gameover.saved': 'Guardado.',
      'gameover.nameRequired': 'Escribe tu nombre primero.',
      'gameover.playAgain': 'Otra partida',
      'gameover.highscores': 'Puntuaciones',
      'gameover.menu': 'Menú principal',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Top 10 local — supéralo.',
      'highscores.empty': 'Aún no hay puntuaciones. Marca la primera.',
      'highscores.online': 'Ranking online',
      'highscores.back': 'Atrás',
      'highscores.row': '{name} — {score} — {hits} golpes — {bpm} BPM',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Escucha cada señal antes de jugar.',
      'learn.metronome': 'Conteo del metrónomo',
      'learn.pingRight': 'Pin en el pulso derecho',
      'learn.pingLeft': 'Pin en el pulso izquierdo',
      'learn.kick': 'Bombo (el pulso)',
      'learn.hit': 'Acierto (clavado)',
      'learn.miss': 'Fallo (vida perdida)',
      'learn.gameover': 'Fin de partida',
      'learn.back': 'Atrás',

      'online.posting': 'Enviando puntuación…',
      'online.rank': 'Posición online: #{rank}',
      'online.error': 'No pude contactar con el ranking.',
      'online.viewBoard': 'Ver ranking',

      'ann.start': 'Estilo {style}. Atento al conteo.',
      'ann.go': '¡Ya!',
      'ann.miss': 'Fallo. Quedan {lives} vidas.',
      'ann.life': 'Vida perdida. Quedan {lives}.',
      'ann.hit': '¡Toma!',
      'ann.gameover': 'Fin. Puntos {score}.',
      'ann.score': 'Puntos {score}.',
      'ann.hits': '{hits} golpes.',
      'ann.bpm': '{bpm} BPM.',
      'ann.lives': '{lives} vidas.',
      'ann.onlineRank': 'Posición online {rank}.',
      'ann.onlineError': 'No pude contactar con el ranking.',

      'style.house':       'house',
      'style.techno':      'techno',
      'style.disco':       'disco',
      'style.tribal':      'tribal',
      'style.synthwave':   'synthwave',
      'style.dnb':         'drum and bass',
    },
  }

  let current = FALLBACK
  const listeners = []

  function detect() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && dictionaries[stored]) return stored
    } catch (e) {}
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
