/**
 * HAMMER OF GLORY! — i18n.
 *
 * Locale resolution: localStorage('hammer.lang') → navigator.language
 * 2-letter prefix → 'en'.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'hammer.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'HAMMER OF GLORY!',

      // Splash
      'splash.logo': 'HAMMER OF GLORY!',
      'splash.author': 'an audio-first fairground',
      'splash.instruction': 'Step Right Up — Press Anything to Begin',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'HAMMER OF GLORY!',
      'menu.subtitle': 'Step right up — ring the bell at the top!',
      'menu.start': 'Start Game',
      'menu.learn': 'Learn the Sounds',
      'menu.help': 'How to Play',
      'menu.highscores': 'Hall of Fame',
      'menu.language': 'Language',
      'menu.version': 'v{version}',

      // Game screen
      'game.aria': 'Game',
      'game.title': 'HAMMER OF GLORY!',
      'game.instruction': 'Press {kbdSpace} or {kbdEnter} to swing the hammer when the slide matches the target pitch.',
      'game.smash': 'SWING!',
      'game.statusLevel': 'Level {level}',
      'game.statusScore': 'Score {score}',
      'game.phaseIntro': 'Listen…',
      'game.phaseTarget': 'Target: {note}',
      'game.phaseTargetPitch': 'Target pitch',
      'game.phaseSlide': 'SWING NOW!',
      'game.phaseHammer': '*WHAM*',
      'game.phasePreview': 'And up she goes…',
      'game.phaseReaction': '',
      'game.phaseReady': 'Get ready…',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'GAME OVER',
      'gameover.subtitle': 'The crowd disperses…',
      'gameover.score': 'Total score: {score}',
      'gameover.level': 'Reached level: {level}',
      'gameover.lastscore': 'Last swing: {score}',
      'gameover.nameLabel': 'Name for the Hall of Fame',
      'gameover.save': 'Save Score',
      'gameover.restart': 'Play Again',
      'gameover.menu': 'Main Menu',

      // High scores
      'highscores.aria': 'Hall of Fame',
      'highscores.title': 'HALL OF FAME',
      'highscores.empty': 'No glory yet — be the first!',
      'highscores.entry': '#{rank}  {name} — {score}  (lvl {level})',
      'highscores.back': 'Back',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.line1': '<strong>Listen</strong> to the target pitch — a steady tone.',
      'help.line2': 'Then a <strong>slide</strong> sweeps from a low pitch up to a high pitch.',
      'help.line3': 'Press <kbd>Space</kbd> or <kbd>Enter</kbd> to <strong>SWING</strong> the hammer when the slide matches the target.',
      'help.line4': 'Score 100 to ring the <strong>bell</strong>! 50–99 the crowd cheers and you continue. Below 50 the run ends.',
      'help.line5': 'Each round the slide gets <strong>faster</strong>. Levels 1–2 use musical notes; level 3+ uses any pitch.',
      'help.line6': '<kbd>F1</kbd> read score · <kbd>F2</kbd> level.',
      'help.back': 'Back',

      // Learn the sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the Sounds',
      'learn.subtitle': 'Audition every sound the game uses.',
      'learn.fanfare': 'Fairground fanfare',
      'learn.targetPitch': 'Target pitch (steady tone)',
      'learn.slide': 'Pitch slide (low to high)',
      'learn.hammer': 'Hammer impact',
      'learn.preview': 'Score preview sweep',
      'learn.bell': 'Bell — score 100',
      'learn.cheer': 'Crowd cheer (good swing)',
      'learn.applause': 'Crowd applause (decent swing)',
      'learn.boo': 'Crowd "ooooh" (failed swing)',
      'learn.levelUp': 'Level up sting',
      'learn.back': 'Back',

      // Language
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Announcements (aria-live + optional TTS)
      'ann.gameStart': 'HAMMER OF GLORY! Level 1.',
      'ann.levelUp': 'Level {level}.',
      'ann.targetNote': 'Target: {note}.',
      'ann.targetContinuous': 'Target pitch.',
      'ann.smash': 'WHAM!',
      'ann.score': 'Score: {score}.',
      'ann.scoreLabel': '{score}. {label}',
      'ann.gameOver': 'Game over. Final score: {score}.',
      'ann.passDelta': 'Score {score}. {delta} — keep swinging!',
      'ann.failDelta': 'Failed! Total {score}.',
      'ann.savedScore': 'Score saved.',
      'ann.fxScore': 'Score',
      'ann.fxLevel': 'Level',

      // Score band labels
      'band.wow': 'WOW!',
      'band.super': 'Super good!',
      'band.great': 'Great!',
      'band.better': 'Solid hit!',
      'band.almost': 'Just barely!',
      'band.fail': 'Oof — too far off.',

      // Note names (sharps notation)
      'note.C': 'C',
      'note.Cs': 'C sharp',
      'note.D': 'D',
      'note.Ds': 'D sharp',
      'note.E': 'E',
      'note.F': 'F',
      'note.Fs': 'F sharp',
      'note.G': 'G',
      'note.Gs': 'G sharp',
      'note.A': 'A',
      'note.As': 'A sharp',
      'note.B': 'B',
      'note.continuous': 'no exact note',
      'note.full': '{name} {octave}',
    },

    es: {
      // <head>
      'doc.title': '¡MARTILLO DE GLORIA!',

      // Splash
      'splash.logo': '¡MARTILLO DE GLORIA!',
      'splash.author': 'una feria sonora',
      'splash.instruction': 'Pasen y vean — Pulsa cualquier tecla para empezar',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': '¡MARTILLO DE GLORIA!',
      'menu.subtitle': '¡Pasen y vean — haz sonar la campana de arriba!',
      'menu.start': 'Empezar partida',
      'menu.learn': 'Aprende los sonidos',
      'menu.help': 'Cómo se juega',
      'menu.highscores': 'Salón de la Fama',
      'menu.language': 'Idioma',
      'menu.version': 'v{version}',

      // Game screen
      'game.aria': 'Juego',
      'game.title': '¡MARTILLO DE GLORIA!',
      'game.instruction': 'Pulsa {kbdSpace} o {kbdEnter} para soltar el mazo cuando el deslizamiento iguale al tono objetivo.',
      'game.smash': '¡PEGA!',
      'game.statusLevel': 'Nivel {level}',
      'game.statusScore': 'Puntos {score}',
      'game.phaseIntro': 'Atento…',
      'game.phaseTarget': 'Objetivo: {note}',
      'game.phaseTargetPitch': 'Tono objetivo',
      'game.phaseSlide': '¡PEGA YA!',
      'game.phaseHammer': '¡PUM!',
      'game.phasePreview': 'Y allá va…',
      'game.phaseReaction': '',
      'game.phaseReady': 'Prepárate…',

      // Game over
      'gameover.aria': 'Fin del juego',
      'gameover.title': 'FIN DE LA PARTIDA',
      'gameover.subtitle': 'La gente se va dispersando…',
      'gameover.score': 'Puntos totales: {score}',
      'gameover.level': 'Nivel alcanzado: {level}',
      'gameover.lastscore': 'Último golpe: {score}',
      'gameover.nameLabel': 'Nombre para el Salón de la Fama',
      'gameover.save': 'Guardar puntuación',
      'gameover.restart': 'Otra partida',
      'gameover.menu': 'Menú principal',

      // High scores
      'highscores.aria': 'Salón de la Fama',
      'highscores.title': 'SALÓN DE LA FAMA',
      'highscores.empty': 'Aún sin gloria — ¡sé el primero!',
      'highscores.entry': '#{rank}  {name} — {score}  (niv {level})',
      'highscores.back': 'Atrás',

      // Help
      'help.aria': 'Cómo se juega',
      'help.title': 'Cómo se juega',
      'help.line1': '<strong>Escucha</strong> el tono objetivo: una nota mantenida.',
      'help.line2': 'Luego un <strong>deslizamiento</strong> sube desde un tono grave hasta un tono agudo.',
      'help.line3': 'Pulsa <kbd>Espacio</kbd> o <kbd>Enter</kbd> para <strong>SOLTAR</strong> el mazo cuando el deslizamiento coincida con el objetivo.',
      'help.line4': '¡100 puntos hace sonar la <strong>campana</strong>! 50–99 te aplauden y sigues. Menos de 50 acaba la partida.',
      'help.line5': 'Cada ronda el deslizamiento es <strong>más rápido</strong>. Niveles 1–2 usan notas musicales; nivel 3+ cualquier tono.',
      'help.line6': '<kbd>F1</kbd> puntos · <kbd>F2</kbd> nivel.',
      'help.back': 'Atrás',

      // Learn the sounds
      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Escucha cada sonido que usa el juego.',
      'learn.fanfare': 'Fanfarria de feria',
      'learn.targetPitch': 'Tono objetivo (nota fija)',
      'learn.slide': 'Deslizamiento (grave a agudo)',
      'learn.hammer': 'Golpe del mazo',
      'learn.preview': 'Subida de puntuación',
      'learn.bell': 'Campana — puntuación 100',
      'learn.cheer': 'Aclamación del público (gran golpe)',
      'learn.applause': 'Aplauso (golpe decente)',
      'learn.boo': '«Oooooh» del público (golpe fallido)',
      'learn.levelUp': 'Acorde de subida de nivel',
      'learn.back': 'Atrás',

      // Language
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Announcements
      'ann.gameStart': '¡MARTILLO DE GLORIA! Nivel 1.',
      'ann.levelUp': 'Nivel {level}.',
      'ann.targetNote': 'Objetivo: {note}.',
      'ann.targetContinuous': 'Tono objetivo.',
      'ann.smash': '¡PUM!',
      'ann.score': 'Puntos: {score}.',
      'ann.scoreLabel': '{score}. {label}',
      'ann.gameOver': 'Fin de la partida. Puntuación final: {score}.',
      'ann.passDelta': 'Puntos {score}. {delta} — ¡a por la siguiente!',
      'ann.failDelta': '¡Fallaste! Total {score}.',
      'ann.savedScore': 'Puntuación guardada.',
      'ann.fxScore': 'Puntos',
      'ann.fxLevel': 'Nivel',

      // Score band labels
      'band.wow': '¡INCREÍBLE!',
      'band.super': '¡Súper bueno!',
      'band.great': '¡Genial!',
      'band.better': '¡Buen golpe!',
      'band.almost': '¡Por los pelos!',
      'band.fail': 'Uy — te has pasado.',

      // Note names
      'note.C': 'do',
      'note.Cs': 'do sostenido',
      'note.D': 're',
      'note.Ds': 're sostenido',
      'note.E': 'mi',
      'note.F': 'fa',
      'note.Fs': 'fa sostenido',
      'note.G': 'sol',
      'note.Gs': 'sol sostenido',
      'note.A': 'la',
      'note.As': 'la sostenido',
      'note.B': 'si',
      'note.continuous': 'sin nota exacta',
      'note.full': '{name} {octave}',
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
