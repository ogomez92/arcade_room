/**
 * Lightweight i18n for accessible audio games.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
 * 2-letter prefix → fallback ('en').
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'beatstar.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'beatstar',

      // Splash
      'splash.author': 'an audio rhythm game',
      'splash.instruction': 'Press any key to begin',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'beatstar',
      'menu.subtitle': 'Listen, remember, repeat.',
      'menu.start': 'Start Game',
      'menu.levelSelect': 'Start at Level…',
      'menu.learn': 'Learn the Sounds',
      'menu.language': 'Language',

      // Style preview (hidden screen, Ctrl+Shift+P from main menu)
      'stylePreview.aria': 'Style previews',
      'stylePreview.title': 'Style Previews',
      'stylePreview.subtitle': 'Up and Down to choose a style. Left and Right to set the level. Enter to audition. Escape to return.',
      'stylePreview.stop': 'Stop',
      'stylePreview.back': 'Back',
      'stylePreview.level': 'Level {level} — {bpm} BPM',
      'stylePreview.now': 'Now playing {style} at level {level}, {bpm} BPM.',

      // Level-select
      'levelSelect.aria': 'Pick a starting level',
      'levelSelect.title': 'Start at Level',
      'levelSelect.subtitle': 'Use Up and Down arrows to choose a level. Press Enter to start. The highest unlocked level grows as you play.',
      'levelSelect.levelLabel': 'Level',
      'levelSelect.maxLabel': 'Highest unlocked:',
      'levelSelect.decrease': 'Lower (Down arrow)',
      'levelSelect.increase': 'Higher (Up arrow)',
      'levelSelect.start': 'Start at level {level}',
      'levelSelect.back': 'Back',
      'levelSelect.announceLevel': 'Level {level}.',

      // Learn
      'learn.aria': 'Learn the four arrow sounds',
      'learn.title': 'Learn the Sounds',
      'learn.subtitle': 'Each arrow has a hint tone (the cue) and an echo tone (your reply). Press a button to hear both.',
      'learn.up': 'Up — high, centre',
      'learn.down': 'Down — low, centre',
      'learn.left': 'Left — warm, panned left',
      'learn.right': 'Right — bright, panned right',
      'learn.hintLabel': '(hint)',
      'learn.echoLabel': '(echo)',
      'learn.back': 'Back to menu',

      // Game HUD / aria
      'game.aria': 'Rhythm round',
      'game.hudLevel': 'Level {level}',
      'game.hudScore': 'Score {score}',
      'game.hudLives': 'Lives {lives}',
      'game.hudPhase.intro': 'Get ready',
      'game.hudPhase.hint': 'Listen',
      'game.hudPhase.transition': 'Ready…',
      'game.hudPhase.echo': 'Repeat',
      'game.hudPhase.verdict': '…',
      'game.help': 'Use the arrow keys to repeat the pattern. F1 level, F2 score, F3 lives, F4 phase, Escape pause.',

      // Game-over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game Over',
      'gameover.subtitle': 'You scored {score} on level {level}.',
      'gameover.statScore':    'Score',
      'gameover.statLevel':    'Level reached',
      'gameover.statPatterns': 'Patterns cleared',
      'gameover.statAccuracy': 'Accuracy',
      'gameover.statPerfect':  'Perfect hits',
      'gameover.retry': 'Play Again',
      'gameover.menu': 'Main Menu',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.menu': 'Quit to Main Menu',

      // Announcer
      'ann.levelTerse': 'Level {level}.',
      'ann.level': 'Level {level}. {prevStats}',
      'ann.prevStats': 'Previous accuracy {percent} percent.',
      'ann.clear': 'Level {level} clear. Bonus {bonus}.',
      'ann.clearBonus': 'Level {level} clear. Bonus {bonus}. Extra life!',
      'ann.roundClear': '{cleared} of {total}.',
      'ann.lostLife': '{misses} missed. {lives} lives remaining.',
      'ann.gameover': 'Game over. Final score {score}.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.statusLevel': 'Level {level}.',
      'ann.statusScore': 'Score {score}.',
      'ann.statusLives': '{lives} lives remaining.',
      'ann.statusPhase': 'Phase: {phase}.',
      'ann.subdiv.quarter':   'Quarter notes only.',
      'ann.subdiv.eighth':    'Includes off-beats.',
      'ann.subdiv.sixteenth': 'Includes sixteenth notes.',

      // Modulation announcement (between levels). Empty for "same" so
      // unchanged keys read cleanly.
      'mod.start':   '',
      'mod.same':    '',
      'mod.up2':     'Modulating up a whole step.',
      'mod.down2':   'Modulating down a whole step.',
      'mod.up4':     'Modulating up a fourth.',
      'mod.down4':   'Modulating down a fourth.',
      'mod.up5':     'Modulating up a fifth.',
      'mod.down5':   'Modulating down a fifth.',
      'mod.toMinor': 'Switching to minor.',
      'mod.toMajor': 'Switching to major.',

      // Verdicts (i18n keys, used by content.game)
      'verdict.clean': 'clean',
      'verdict.miss': 'miss',

      // Arrow names (also reused by announcer)
      'arrow.up': 'Up',
      'arrow.down': 'Down',
      'arrow.left': 'Left',
      'arrow.right': 'Right',

      // Style names (per content.styles)
      'style.lounge':    'Lounge',
      'style.synthwave': 'Synthwave',
      'style.house':     'House',
      'style.chiptune':  'Chiptune',
      'style.rock':      'Rock',
      'style.waltz':     'Waltz',
      'style.funk':      'Funk',
      'style.jazz':      'Jazz',
      'style.ambient':   'Ambient',
      'style.latin':     'Latin',
      'style.disco':     'Disco',

      // Time signatures (announced and shown in HUD)
      'meter.3': 'three four time',
      'meter.4': 'four four time',
      'meter.5': 'five four time',
      'meter.7': 'seven four time',
    },

    es: {
      // <head>
      'doc.title': 'beatstar',

      // Splash
      'splash.author': 'un juego de ritmo en audio',
      'splash.instruction': 'Pulsa cualquier tecla para empezar',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'beatstar',
      'menu.subtitle': 'Escucha, recuerda, repite.',
      'menu.start': 'Empezar partida',
      'menu.levelSelect': 'Empezar en nivel…',
      'menu.learn': 'Aprender los sonidos',
      'menu.language': 'Idioma',

      // Vista previa de estilos (pantalla oculta, Ctrl+Shift+P)
      'stylePreview.aria': 'Vista previa de estilos',
      'stylePreview.title': 'Vista previa de estilos',
      'stylePreview.subtitle': 'Arriba y Abajo para elegir un estilo. Izquierda y Derecha para fijar el nivel. Intro para escucharlo. Escape para volver.',
      'stylePreview.stop': 'Parar',
      'stylePreview.back': 'Atrás',
      'stylePreview.level': 'Nivel {level} — {bpm} BPM',
      'stylePreview.now': 'Sonando {style} en nivel {level}, {bpm} BPM.',

      // Level-select
      'levelSelect.aria': 'Elige un nivel de inicio',
      'levelSelect.title': 'Empezar en nivel',
      'levelSelect.subtitle': 'Usa las flechas Arriba y Abajo para elegir el nivel. Pulsa Intro para empezar. El nivel máximo desbloqueado crece según vas jugando.',
      'levelSelect.levelLabel': 'Nivel',
      'levelSelect.maxLabel': 'Máximo desbloqueado:',
      'levelSelect.decrease': 'Bajar (flecha abajo)',
      'levelSelect.increase': 'Subir (flecha arriba)',
      'levelSelect.start': 'Empezar en nivel {level}',
      'levelSelect.back': 'Atrás',
      'levelSelect.announceLevel': 'Nivel {level}.',

      // Learn
      'learn.aria': 'Aprende los cuatro sonidos de las flechas',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Cada flecha tiene un tono guía (la pista) y un tono de respuesta (tu eco). Pulsa un botón para oír ambos.',
      'learn.up': 'Arriba — agudo, centrado',
      'learn.down': 'Abajo — grave, centrado',
      'learn.left': 'Izquierda — cálido, panorámica izquierda',
      'learn.right': 'Derecha — brillante, panorámica derecha',
      'learn.hintLabel': '(pista)',
      'learn.echoLabel': '(eco)',
      'learn.back': 'Volver al menú',

      // Game HUD / aria
      'game.aria': 'Ronda rítmica',
      'game.hudLevel': 'Nivel {level}',
      'game.hudScore': 'Puntos {score}',
      'game.hudLives': 'Vidas {lives}',
      'game.hudPhase.intro': 'Prepárate',
      'game.hudPhase.hint': 'Escucha',
      'game.hudPhase.transition': 'Listo…',
      'game.hudPhase.echo': 'Repite',
      'game.hudPhase.verdict': '…',
      'game.help': 'Usa las flechas para repetir el patrón. F1 nivel, F2 puntos, F3 vidas, F4 fase, Escape pausa.',

      // Game-over
      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Fin de la partida',
      'gameover.subtitle': 'Has hecho {score} puntos en el nivel {level}.',
      'gameover.statScore':    'Puntos',
      'gameover.statLevel':    'Nivel alcanzado',
      'gameover.statPatterns': 'Patrones superados',
      'gameover.statAccuracy': 'Precisión',
      'gameover.statPerfect':  'Aciertos perfectos',
      'gameover.retry': 'Jugar otra vez',
      'gameover.menu': 'Menú principal',

      // Pause
      'pause.aria': 'En pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.menu': 'Salir al menú',

      // Announcer
      'ann.levelTerse': 'Nivel {level}.',
      'ann.level': 'Nivel {level}. {prevStats}',
      'ann.prevStats': 'Precisión anterior {percent} por ciento.',
      'ann.clear': 'Nivel {level} superado. Bonificación {bonus}.',
      'ann.clearBonus': 'Nivel {level} superado. Bonificación {bonus}. ¡Vida extra!',
      'ann.roundClear': '{cleared} de {total}.',
      'ann.lostLife': '{misses} fallos. Te quedan {lives} vidas.',
      'ann.gameover': 'Fin de la partida. Puntuación final {score}.',
      'ann.paused': 'En pausa.',
      'ann.resumed': 'Continuamos.',
      'ann.statusLevel': 'Nivel {level}.',
      'ann.statusScore': 'Puntos {score}.',
      'ann.statusLives': 'Te quedan {lives} vidas.',
      'ann.statusPhase': 'Fase: {phase}.',
      'ann.subdiv.quarter':   'Sólo negras.',
      'ann.subdiv.eighth':    'Con contratiempos.',
      'ann.subdiv.sixteenth': 'Con semicorcheas.',

      // Modulación (transición de nivel)
      'mod.start':   '',
      'mod.same':    '',
      'mod.up2':     'Modulamos un tono arriba.',
      'mod.down2':   'Modulamos un tono abajo.',
      'mod.up4':     'Modulamos a la cuarta.',
      'mod.down4':   'Modulamos una cuarta abajo.',
      'mod.up5':     'Modulamos a la quinta.',
      'mod.down5':   'Modulamos una quinta abajo.',
      'mod.toMinor': 'Pasamos a menor.',
      'mod.toMajor': 'Pasamos a mayor.',

      // Verdicts
      'verdict.clean': 'limpio',
      'verdict.miss': 'fallo',

      // Arrow names
      'arrow.up': 'Arriba',
      'arrow.down': 'Abajo',
      'arrow.left': 'Izquierda',
      'arrow.right': 'Derecha',

      // Style names (per content.styles)
      'style.lounge':    'Lounge',
      'style.synthwave': 'Synthwave',
      'style.house':     'House',
      'style.chiptune':  'Chiptune',
      'style.rock':      'Rock',
      'style.waltz':     'Vals',
      'style.funk':      'Funk',
      'style.jazz':      'Jazz',
      'style.ambient':   'Ambient',
      'style.latin':     'Latino',
      'style.disco':     'Disco',

      // Time signatures (announced and shown in HUD)
      'meter.3': 'tres por cuatro',
      'meter.4': 'cuatro por cuatro',
      'meter.5': 'cinco por cuatro',
      'meter.7': 'siete por cuatro',
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
