/**
 * Lightweight i18n for FUSE. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'fuse.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Fuse',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Fuse',
      'menu.subtitle': 'An audio bomb-maze. Roam the maze, plant bombs to blow up soft walls and roaming enemies — and flee your own cross-blast before the fuse runs out.',
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
      'game.aria': 'The maze',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.wave': 'Level',
      'hud.enemies': 'Enemies',

      // Directions + power-ups
      'dir.n': 'north',
      'dir.e': 'east',
      'dir.s': 'south',
      'dir.w': 'west',
      'pu.bomb': 'extra bomb',
      'pu.fire': 'bigger blast',
      'pu.speed': 'more speed',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Bomb the maze clear — and outrun your own blast.',
      'help.intro': 'You roam a tile maze. North is always ahead, east to your right, south behind, west to your left — it never rotates, and every sound comes from its direction relative to you. Plant a bomb on your tile; after a ticking fuse it bursts in a plus-shaped cross of flame, destroying soft walls and any enemy — or you — caught in it. The catch: you must step OUT of that cross before it blows. Clear every enemy on a level to descend to the next, harder one. Three lives.',
      'help.h.move': '<kbd>Arrow keys</kbd> or <kbd>W A S D</kbd> — move through the maze, one tile at a time. A bump means a wall that way.',
      'help.h.bomb': '<kbd>Space</kbd> — plant a bomb on your tile. It ticks, then bursts in a cross (up/down/left/right). Soft walls and bombs stop the flame; hard pillars block it.',
      'help.h.danger': 'When a live cross covers YOUR tile you hear a harsh rising alarm — get off that row or column before the fuse ends. The faster the alarm, the closer the blast.',
      'help.h.enemies': 'Enemies prowl the maze, each a low menacing blip from its direction (louder and higher the closer it is). Touching one costs a life — corner them with a bomb instead.',
      'help.h.power': 'Some soft walls hide power-ups: <strong>extra bomb</strong>, <strong>bigger blast</strong>, <strong>more speed</strong>. Walk over one to grab it.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> nearest enemy · <kbd>F3</kbd> open exits around you · <kbd>F4</kbd> your bombs and blast size.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Read the maze by ear: the fuse ticks from where the bomb sits, the danger alarm warns when its cross reaches you, and a wall-bump tells you a direction is blocked. Catch two or more enemies in one blast for a bonus. A bigger blast clears more — but also reaches you from further, so plan your escape.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Light a fuse!',
      'highscores.entry': '#{rank}. {name} — {score} points, reached level {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart run',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Caught in the blast',
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
      'learn.enemyNear': 'Enemy — near, to the north',
      'learn.enemyFar': 'Enemy — far, to the southeast',
      'learn.fuse': 'Bomb fuse — just lit',
      'learn.fuseHot': 'Bomb fuse — about to blow',
      'learn.danger': 'DANGER — you are in the blast line',
      'learn.plant': 'You plant a bomb',
      'learn.detonate': 'Bomb detonates',
      'learn.soft': 'Soft wall crumbles',
      'learn.kill': 'Enemy destroyed',
      'learn.powerup': 'Collect a power-up',
      'learn.hurt': 'You take a hit',
      'learn.blocked': 'Bumped a wall',
      'learn.clear': 'Level cleared',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Spatial test
      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm the maze: front is north, right is east, behind is south, left is west.',
      'test.north': 'Play north (front)',
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
      'ann.status': 'Score {score}, {lives} lives, level {level}, {enemies} enemies left.',
      'ann.nearest': 'Nearest enemy {dir}, {dist} tiles. {count} on the level.',
      'ann.clear': 'No enemies in range.',
      'ann.scan': 'Open: {dirs}.',
      'ann.scanNone': 'Walled in on all sides.',
      'ann.loadout': '{bombs} bombs, blast size {fire}.',
      'ann.powerup': 'Got {kind}!',
      'ann.multikill': 'Double! {n} enemies.',
      'ann.caught': 'Caught by an enemy! {lives} lives left.',
      'ann.caughtLast': 'Caught by an enemy! No lives left.',
      'ann.blasted': 'Caught in the blast! {lives} lives left.',
      'ann.blastedLast': 'Caught in the blast! No lives left.',
      'ann.levelClear': 'Level {level} cleared!',
      'ann.levelStart': 'Level {level}.',
      'ann.gameOver': 'Game over. Final score {score}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Fuse',

      'menu.aria': 'Menú principal',
      'menu.title': 'Fuse',
      'menu.subtitle': 'Un laberinto de bombas por audio. Recorre el laberinto, planta bombas para volar muros blandos y enemigos errantes, y huye de tu propia explosión en cruz antes de que se acabe la mecha.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'El laberinto',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.wave': 'Nivel',
      'hud.enemies': 'Enemigos',

      'dir.n': 'norte',
      'dir.e': 'este',
      'dir.s': 'sur',
      'dir.w': 'oeste',
      'pu.bomb': 'bomba extra',
      'pu.fire': 'explosión mayor',
      'pu.speed': 'más velocidad',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Limpia el laberinto con bombas, y huye de tu propia explosión.',
      'help.intro': 'Recorres un laberinto de casillas. El norte siempre está al frente, el este a tu derecha, el sur detrás, el oeste a tu izquierda: nunca gira, y cada sonido viene de su dirección respecto a ti. Planta una bomba en tu casilla; tras una mecha que hace tictac, estalla en una cruz de fuego que destruye muros blandos y a cualquier enemigo —o a ti— atrapado en ella. El truco: debes SALIR de esa cruz antes de que estalle. Limpia todos los enemigos de un nivel para bajar al siguiente, más difícil. Tres vidas.',
      'help.h.move': '<kbd>Flechas</kbd> o <kbd>W A S D</kbd> — muévete por el laberinto, casilla a casilla. Un golpe significa un muro en esa dirección.',
      'help.h.bomb': '<kbd>Espacio</kbd> — planta una bomba en tu casilla. Hace tictac y estalla en cruz (arriba/abajo/izquierda/derecha). Muros blandos y bombas detienen el fuego; los pilares duros lo bloquean.',
      'help.h.danger': 'Cuando una cruz activa cubre TU casilla oyes una alarma áspera y creciente: sal de esa fila o columna antes de que acabe la mecha. Cuanto más rápida la alarma, más cerca la explosión.',
      'help.h.enemies': 'Los enemigos merodean, cada uno un pitido grave y amenazante desde su dirección (más fuerte y agudo cuanto más cerca). Tocar a uno cuesta una vida: acorrálalo con una bomba.',
      'help.h.power': 'Algunos muros blandos esconden mejoras: <strong>bomba extra</strong>, <strong>explosión mayor</strong>, <strong>más velocidad</strong>. Pasa por encima para recogerla.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> enemigo más cercano · <kbd>F3</kbd> salidas abiertas · <kbd>F4</kbd> tus bombas y tamaño de explosión.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Lee el laberinto de oído: la mecha hace tictac desde donde está la bomba, la alarma de peligro avisa cuando su cruz te alcanza, y un golpe de muro indica una dirección bloqueada. Atrapa dos o más enemigos en una explosión para un bonus. Una explosión mayor limpia más, pero también te alcanza desde más lejos: planea tu escape.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. Enciende una mecha!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, nivel {wave}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida',
      'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Atrapado en la explosión',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.enemyNear': 'Enemigo — cerca, al norte',
      'learn.enemyFar': 'Enemigo — lejos, al sureste',
      'learn.fuse': 'Mecha — recién encendida',
      'learn.fuseHot': 'Mecha — a punto de estallar',
      'learn.danger': 'PELIGRO — estás en la línea de explosión',
      'learn.plant': 'Plantas una bomba',
      'learn.detonate': 'La bomba estalla',
      'learn.soft': 'Un muro blando se derrumba',
      'learn.kill': 'Enemigo destruido',
      'learn.powerup': 'Recoges una mejora',
      'learn.hurt': 'Recibes un golpe',
      'learn.blocked': 'Chocaste con un muro',
      'learn.clear': 'Nivel superado',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma el laberinto: al frente es norte, derecha es este, detrás es sur, izquierda es oeste.',
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

      'ann.status': 'Puntos {score}, {lives} vidas, nivel {level}, quedan {enemies} enemigos.',
      'ann.nearest': 'Enemigo más cercano al {dir}, {dist} casillas. {count} en el nivel.',
      'ann.clear': 'Ningún enemigo cerca.',
      'ann.scan': 'Abierto: {dirs}.',
      'ann.scanNone': 'Amurallado por todos lados.',
      'ann.loadout': '{bombs} bombas, tamaño de explosión {fire}.',
      'ann.powerup': '¡Conseguiste {kind}!',
      'ann.multikill': '¡Doble! {n} enemigos.',
      'ann.caught': '¡Te atrapó un enemigo! Quedan {lives} vidas.',
      'ann.caughtLast': '¡Te atrapó un enemigo! Sin vidas.',
      'ann.blasted': '¡Atrapado en la explosión! Quedan {lives} vidas.',
      'ann.blastedLast': '¡Atrapado en la explosión! Sin vidas.',
      'ann.levelClear': '¡Nivel {level} superado!',
      'ann.levelStart': 'Nivel {level}.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
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
