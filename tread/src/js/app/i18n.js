/**
 * Lightweight i18n for TREAD. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'tread.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Tread',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Tread',
      'menu.subtitle': 'An audio tank battle. Drive a tank on a grid: line up with the enemy tanks and fire, dodge their telegraphed return fire, and stop them from breaking through to your base.',
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
      'game.aria': 'The battlefield',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.wave': 'Wave',
      'hud.base': 'Base',

      // Directions
      'dir.n': 'north', 'dir.e': 'east', 'dir.s': 'south', 'dir.w': 'west', 'dir.here': 'on you',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Destroy the tanks. Dodge their fire. Defend the base.',
      'help.intro': 'You drive a tank on a grid. The view never rotates — north is always ahead in the audio, east right, south behind, west left, and your steering is absolute (Up = drive/face north). Enemy tanks roll in from the top and push toward your BASE (its hum sits to your south), shooting brick out of the way. Drive so an enemy is on your exact row or column with a clear line, face it, and FIRE to destroy it — your gun fires one shell at a time. When an enemy lines YOU up, it telegraphs with a rising aim tell from its direction; step off that row or column before its shell arrives. If a tank or an enemy shell reaches the base, it is over; so is losing all three lives. Endless, escalating waves.',
      'help.h.drive': '<kbd>Arrow keys</kbd> / <kbd>WASD</kbd> — drive and face (absolute: Up = north). Pressing toward a wall just turns you.',
      'help.h.fire': '<kbd>Space</kbd> — fire down your facing. Only one of your shells is in flight at a time, so make it count; line up on a tank\'s row or column first.',
      'help.h.dodge': 'A rising AIM tell from an enemy means it has you lined up — step off that line before the shell lands. A jump won\'t help; only moving will.',
      'help.h.base': 'Your base hums from its direction (urgent when threatened). Intercept tanks before they shoot through the brick and reach it.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> nearest tank · <kbd>F3</kbd> the base · <kbd>F4</kbd> your facing.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Enemy tanks blip from their bearing (faster as they near; a sharper timbre when they are aiming). Incoming enemy shells whistle as they cross toward you. The base hum is your anchor. Sounds to the south (behind you) are muffled.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best stands on this device.',
      'highscores.empty': 'No scores yet. Hold the line!',
      'highscores.entry': '#{rank}. {name} — {score} points, reached wave {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused', 'pause.title': 'Paused', 'pause.resume': 'Resume',
      'pause.restart': 'Restart run', 'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Knocked out',
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
      'learn.enemy': 'Enemy tank (ahead)',
      'learn.aiming': 'Enemy tank lining you up (right)',
      'learn.aim': 'Aim tell — dodge!',
      'learn.enemyFire': 'Enemy fires',
      'learn.fire': 'Your gun',
      'learn.kill': 'A tank destroyed',
      'learn.brick': 'Brick shot away',
      'learn.base': 'Base beacon (safe)',
      'learn.baseThreat': 'Base beacon (threatened)',
      'learn.hit': 'You take a hit',
      'learn.baseLost': 'Base destroyed',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Spatial test
      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm: ahead is north, right is east, behind is south, left is west.',
      'test.north': 'Play north (ahead)',
      'test.east': 'Play east (right)',
      'test.south': 'Play south (behind)',
      'test.west': 'Play west (left)',
      'test.ring': 'Play full ring',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Announcements
      'ann.hit': 'Hit! {lives} lives left.',
      'ann.hitLast': 'Hit! No lives left.',
      'ann.baseHit': 'Base breached! {hp} base left.',
      'ann.baseLost': 'The base is destroyed!',
      'ann.waveClear': 'Wave {wave} cleared!',
      'ann.waveStart': 'Wave {wave}. Hold the line!',
      'ann.status': 'Score {score}, {lives} lives, wave {wave}, {left} tanks left.',
      'ann.nearest': 'Nearest tank {dir}, {dist} away{aiming}.',
      'ann.takingAim': ', taking aim',
      'ann.allClear': 'No tanks near.',
      'ann.baseAt': 'Base to the {dir}, {state}.',
      'ann.threatened': 'threatened',
      'ann.safe': 'safe',
      'ann.facing': 'Facing {dir}.',
      'ann.gameOver': 'Knocked out. Final score {score}.',
      'ann.gameOverHigh': 'Knocked out. New high score, {score}!',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Tread',

      'menu.aria': 'Menú principal',
      'menu.title': 'Tread',
      'menu.subtitle': 'Una batalla de tanques por audio. Conduce un tanque por una cuadrícula: alinéate con los tanques enemigos y dispara, esquiva su fuego telegrafiado y evita que rompan hasta tu base.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'El campo de batalla',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.wave': 'Oleada',
      'hud.base': 'Base',

      'dir.n': 'norte', 'dir.e': 'este', 'dir.s': 'sur', 'dir.w': 'oeste', 'dir.here': 'sobre ti',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Destruye los tanques. Esquiva su fuego. Defiende la base.',
      'help.intro': 'Conduces un tanque por una cuadrícula. La vista nunca gira: el norte siempre está al frente en el audio, el este a la derecha, el sur detrás, el oeste a la izquierda, y tu dirección es absoluta (Arriba = conducir/mirar al norte). Los tanques enemigos entran por arriba y empujan hacia tu BASE (su zumbido está al sur), disparando para abrir los ladrillos. Conduce hasta que un enemigo esté en tu misma fila o columna con línea libre, encáralo y DISPARA para destruirlo: tu cañón dispara un proyectil a la vez. Cuando un enemigo te apunta, lo telegrafía con un tono ascendente desde su dirección; sal de esa fila o columna antes de que llegue el proyectil. Si un tanque o un proyectil enemigo alcanza la base, se acabó; igual que perder las tres vidas. Oleadas infinitas y crecientes.',
      'help.h.drive': '<kbd>Flechas</kbd> / <kbd>WASD</kbd> — conduce y mira (absoluto: Arriba = norte). Pulsar contra un muro solo te gira.',
      'help.h.fire': '<kbd>Espacio</kbd> — dispara hacia donde miras. Solo un proyectil tuyo vuela a la vez, así que apunta bien; alinéate antes en la fila o columna de un tanque.',
      'help.h.dodge': 'Un tono de PUNTERÍA ascendente desde un enemigo significa que te tiene alineado: sal de esa línea antes de que caiga el proyectil. Saltar no sirve; solo moverte.',
      'help.h.base': 'Tu base zumba desde su dirección (urgente si está amenazada). Intercepta a los tanques antes de que disparen los ladrillos y la alcancen.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> tanque más cercano · <kbd>F3</kbd> la base · <kbd>F4</kbd> hacia dónde miras.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Los tanques enemigos pitan desde su rumbo (más rápido al acercarse; un timbre más áspero cuando apuntan). Los proyectiles entrantes silban al cruzar hacia ti. El zumbido de la base es tu ancla. Los sonidos del sur (detrás) suenan apagados.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores defensas en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. Aguanta la línea!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, oleada {wave}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa', 'pause.title': 'Pausa', 'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida', 'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Fuera de combate',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.enemy': 'Tanque enemigo (al frente)',
      'learn.aiming': 'Tanque enemigo apuntándote (derecha)',
      'learn.aim': 'Tono de puntería — ¡esquiva!',
      'learn.enemyFire': 'El enemigo dispara',
      'learn.fire': 'Tu cañón',
      'learn.kill': 'Un tanque destruido',
      'learn.brick': 'Ladrillo volado',
      'learn.base': 'Faro de la base (a salvo)',
      'learn.baseThreat': 'Faro de la base (amenazada)',
      'learn.hit': 'Recibes un impacto',
      'learn.baseLost': 'Base destruida',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma: al frente es norte, derecha este, detrás sur, izquierda oeste.',
      'test.north': 'Sonar al norte (frente)',
      'test.east': 'Sonar al este (derecha)',
      'test.south': 'Sonar al sur (detrás)',
      'test.west': 'Sonar al oeste (izquierda)',
      'test.ring': 'Sonar el anillo completo',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.hit': '¡Impacto! Quedan {lives} vidas.',
      'ann.hitLast': '¡Impacto! Sin vidas.',
      'ann.baseHit': '¡Base alcanzada! Quedan {hp} de base.',
      'ann.baseLost': '¡La base ha sido destruida!',
      'ann.waveClear': '¡Oleada {wave} superada!',
      'ann.waveStart': 'Oleada {wave}. ¡Aguanta!',
      'ann.status': 'Puntos {score}, {lives} vidas, oleada {wave}, quedan {left} tanques.',
      'ann.nearest': 'Tanque más cercano al {dir}, a {dist}{aiming}.',
      'ann.takingAim': ', apuntando',
      'ann.allClear': 'No hay tanques cerca.',
      'ann.baseAt': 'Base al {dir}, {state}.',
      'ann.threatened': 'amenazada',
      'ann.safe': 'a salvo',
      'ann.facing': 'Mirando al {dir}.',
      'ann.gameOver': 'Fuera de combate. Puntuación final {score}.',
      'ann.gameOverHigh': 'Fuera de combate. ¡Nuevo récord, {score}!',
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
