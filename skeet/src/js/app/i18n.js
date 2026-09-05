/**
 * Lightweight i18n for SKEET. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'skeet.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Skeet',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Skeet',
      'menu.subtitle': 'An audio clay-shooting gallery. Clays streak across the sky — track each one by ear with your swept gun and shoot it before it gets away.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game / HUD
      'game.aria': 'The range',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.wave': 'Round',
      'hud.combo': 'Combo',

      // Side words (where on the arc)
      'side.farLeft': 'far left',
      'side.left': 'left',
      'side.centre': 'centre',
      'side.right': 'right',
      'side.farRight': 'far right',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Track the clays by ear and shoot them out of the sky.',
      'help.intro': 'Clays launch and streak across the sky in front of you. Each one whirs from its position — left is always your left, right always your right, and it never rotates — and its pitch rides its arc: low near the horizon, high at the top. Sweep your gun left and right; a soft sight tone pans with your aim. When your aim lines up with a live clay you hear a clean lock tone — that is your cue to fire. Let a live clay cross un-hit and it gets away, costing a life. Doves are protected: shooting one costs a life, so let them pass. Five lives, endless rounds.',
      'help.h.aim': '<kbd>Left</kbd> / <kbd>Right</kbd> (or <kbd>A</kbd> / <kbd>D</kbd>) — sweep your gun across the sky. A soft sight tone pans with your aim.',
      'help.h.fire': 'Hold or tap <kbd>Space</kbd> / <kbd>Enter</kbd> — fire. The shot hits whatever live clay is lined up with your aim. It pumps between shots, so time it.',
      'help.h.lock': 'When your aim lines up with a live clay, a clean <strong>lock tone</strong> swells — fire then. No lock means nothing to hit (or only a dove), so hold your shot.',
      'help.h.doves': '<strong>Doves</strong> coo softly and must NOT be shot — shooting one costs a life. They never make a lock tone. Let them pass.',
      'help.h.types': 'Three clays by ear: a steady clay, a fast high <strong>streaker</strong> (worth most), and a slow lazy <strong>lob</strong>.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> nearest clay · <kbd>F3</kbd> best combo · <kbd>F4</kbd> aim position.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'The shot pumps between rounds, so you cannot down a dense volley of fast crossers in time — pick your targets and lead them. A clean hit shatters; a missed shot at empty sky breaks your combo; a clay getting past or a shot dove is a heavy cue and costs a life.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best rounds on this device.',
      'highscores.empty': 'No scores yet. Pull!',
      'highscores.entry': '#{rank}. {name} — {score} points, reached round {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart round',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Range closed',
      'gameover.subtitle': 'Enter your name to save your score.',
      'gameover.score': 'Score: {score}',
      'gameover.name': 'Your name',
      'gameover.save': 'Save score',
      'gameover.continue': 'Continue',
      'gameover.nameRequired': 'Please enter a name first.',

      // Learn sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each cue on its own.',
      'learn.clayLeft': 'Clay — crossing on the left',
      'learn.clayApex': 'Clay — at the apex (high pitch)',
      'learn.streaker': 'Streaker — fast, high',
      'learn.lob': 'Lob — slow, lazy',
      'learn.dove': 'Dove — do NOT shoot',
      'learn.pull': 'Launch (the pull call)',
      'learn.shot': 'Your shot',
      'learn.hit': 'Clay shattered (hit)',
      'learn.doveHit': 'Shot a dove (penalty)',
      'learn.escape': 'Clay got away (penalty)',
      'learn.wave': 'Round cleared',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Spatial test
      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm the field: front is downrange, right is east, behind is south, left is west.',
      'test.north': 'Play front (downrange)',
      'test.east': 'Play right',
      'test.south': 'Play behind',
      'test.west': 'Play left',
      'test.ring': 'Play full ring',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Announcements
      'ann.combo': 'Combo {combo}!',
      'ann.escape': 'Clay got past, {side}! {lives} lives left.',
      'ann.escapeLast': 'Clay got past, {side}! No lives left.',
      'ann.dove': 'Dove down! {lives} lives left.',
      'ann.doveLast': 'Dove down! No lives left.',
      'ann.waveStart': 'Round {wave}.',
      'ann.waveClear': 'Round {wave} cleared! Plus {bonus} points.',
      'ann.gameOver': 'Range closed. Final score {score}.',
      'ann.gameOverHigh': 'Range closed. New high score, {score}!',
      'ann.status': 'Score {score}, {lives} lives, round {wave}, combo {combo}.',
      'ann.nearest': 'Nearest clay {side}, {secs} seconds. {n} in the air.',
      'ann.allClear': 'Sky clear.',
      'ann.best': 'Best combo {combo}.',
      'ann.aim': 'Aim {side}.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Skeet',

      'menu.aria': 'Menú principal',
      'menu.title': 'Skeet',
      'menu.subtitle': 'Una galería de tiro al plato por audio. Los platos cruzan el cielo: sigue cada uno de oído con tu escopeta y derríbalo antes de que escape.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'El campo de tiro',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.wave': 'Ronda',
      'hud.combo': 'Combo',

      'side.farLeft': 'muy a la izquierda',
      'side.left': 'a la izquierda',
      'side.centre': 'al centro',
      'side.right': 'a la derecha',
      'side.farRight': 'muy a la derecha',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Sigue los platos de oído y derríbalos del cielo.',
      'help.intro': 'Los platos se lanzan y cruzan el cielo frente a ti. Cada uno zumba desde su posición —la izquierda siempre es tu izquierda, la derecha tu derecha, y nunca gira— y su tono sigue su arco: grave cerca del horizonte, agudo en lo alto. Barre tu escopeta a izquierda y derecha; un tono de mira suave se desplaza con tu puntería. Cuando tu puntería se alinea con un plato vivo oyes un tono de fijación limpio: esa es tu señal para disparar. Si dejas que un plato vivo cruce sin derribarlo, escapa y cuesta una vida. Las palomas están protegidas: dispararles cuesta una vida, así que déjalas pasar. Cinco vidas, rondas infinitas.',
      'help.h.aim': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> (o <kbd>A</kbd> / <kbd>D</kbd>) — barre tu escopeta por el cielo. Un tono de mira suave se desplaza con tu puntería.',
      'help.h.fire': 'Mantén o pulsa <kbd>Espacio</kbd> / <kbd>Enter</kbd> — dispara. El tiro impacta el plato vivo alineado con tu puntería. Recarga entre disparos, así que cronométralo.',
      'help.h.lock': 'Cuando tu puntería se alinea con un plato vivo, crece un <strong>tono de fijación</strong> limpio: dispara entonces. Sin fijación no hay nada que derribar (o solo una paloma), así que aguanta.',
      'help.h.doves': 'Las <strong>palomas</strong> arrullan suavemente y NO deben dispararse: hacerlo cuesta una vida. Nunca producen tono de fijación. Déjalas pasar.',
      'help.h.types': 'Tres platos de oído: un plato constante, un <strong>veloz</strong> agudo y rápido (vale más) y un <strong>lento</strong> perezoso.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> plato más cercano · <kbd>F3</kbd> mejor combo · <kbd>F4</kbd> posición de puntería.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'La escopeta recarga entre disparos, así que no puedes derribar una andanada densa de cruces rápidos a tiempo: elige tus blancos y anticípalos. Un impacto limpio rompe el plato; un disparo al cielo vacío rompe tu combo; un plato que escapa o una paloma derribada es una señal grave y cuesta una vida.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores rondas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Lanza!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, ronda {wave}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar ronda',
      'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Campo cerrado',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.clayLeft': 'Plato — cruzando por la izquierda',
      'learn.clayApex': 'Plato — en el apex (tono agudo)',
      'learn.streaker': 'Veloz — rápido y agudo',
      'learn.lob': 'Lento — perezoso',
      'learn.dove': 'Paloma — NO disparar',
      'learn.pull': 'Lanzamiento (el grito de tiro)',
      'learn.shot': 'Tu disparo',
      'learn.hit': 'Plato roto (impacto)',
      'learn.doveHit': 'Disparaste a una paloma (penalización)',
      'learn.escape': 'Un plato escapó (penalización)',
      'learn.wave': 'Ronda superada',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma el campo: al frente es campo abajo, derecha es este, detrás es sur, izquierda es oeste.',
      'test.north': 'Sonar al frente',
      'test.east': 'Sonar a la derecha',
      'test.south': 'Sonar detrás',
      'test.west': 'Sonar a la izquierda',
      'test.ring': 'Sonar el anillo completo',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.combo': '¡Combo {combo}!',
      'ann.escape': '¡Un plato escapó, {side}! Quedan {lives} vidas.',
      'ann.escapeLast': '¡Un plato escapó, {side}! Sin vidas.',
      'ann.dove': '¡Paloma derribada! Quedan {lives} vidas.',
      'ann.doveLast': '¡Paloma derribada! Sin vidas.',
      'ann.waveStart': 'Ronda {wave}.',
      'ann.waveClear': '¡Ronda {wave} superada! Más {bonus} puntos.',
      'ann.gameOver': 'Campo cerrado. Puntuación final {score}.',
      'ann.gameOverHigh': 'Campo cerrado. ¡Nuevo récord, {score}!',
      'ann.status': 'Puntos {score}, {lives} vidas, ronda {wave}, combo {combo}.',
      'ann.nearest': 'Plato más cercano {side}, {secs} segundos. {n} en el aire.',
      'ann.allClear': 'Cielo despejado.',
      'ann.best': 'Mejor combo {combo}.',
      'ann.aim': 'Puntería {side}.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.onlineRank': 'Puesto en línea número {rank}.',
      'ann.onlineError': 'Clasificación no disponible. Guardado en este dispositivo.',
      'ann.paused': 'Pausa.',
      'ann.resumed': 'Reanudado.',
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
