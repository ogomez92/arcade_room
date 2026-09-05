/**
 * Lightweight i18n for DELVE. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'delve.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Delve',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Delve',
      'menu.subtitle': 'An audio dungeon crawl. Shoot the monsters streaming from their generators, grab food to fight the draining health clock, and find the way down — deeper and deeper, until your health runs out.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.learn': 'Learn the sounds',
      'menu.highscores': 'High scores',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game / HUD
      'game.aria': 'The dungeon',
      'hud.health': 'Health',
      'hud.level': 'Floor',
      'hud.score': 'Score',
      'hud.foes': 'Foes',

      // Directions
      'dir.n': 'north', 'dir.e': 'east', 'dir.s': 'south', 'dir.w': 'west', 'dir.here': 'on you',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Shoot the horde. Grab food. Find the way down.',
      'help.intro': 'You crawl a dungeon floor. The view never rotates — north is always ahead in the audio, east right, south behind, west left, and your steering is absolute (Up = north). Your HEALTH drains the whole time you are down here — it IS your life, and when it hits zero the run ends. Monsters stream endlessly from GENERATORS and chase you; one standing next to you chips your health, so shoot them — and shoot the generators (a couple of bolts each) to stop the stream. Grab FOOD to top your health back up. A beacon ticks the way to the EXIT — reach it to descend to a deeper floor (faster drain, more monsters). There is no winning, only how deep you get; score is monsters + generators + floors.',
      'help.h.move': '<kbd>Arrow keys</kbd> / <kbd>WASD</kbd> — move and face (absolute: Up = north).',
      'help.h.fire': '<kbd>Space</kbd> — fire a bolt the way you face. It kills the first monster, or chips a generator, in that line.',
      'help.h.exit': 'A bright beacon ticks from the next step toward the EXIT. Follow it down — but the longer you take, the more health drains.',
      'help.h.health': 'Your heartbeat is your health bar — it races as your health falls. Grab FOOD (a warm chime) to restore it.',
      'help.h.gen': 'GENERATORS throb from their position and never stop spawning. Destroy them to thin the horde — or just rush the exit.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> exit direction · <kbd>F3</kbd> nearest monster · <kbd>F4</kbd> health + nearest generator/food.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Monsters blip from their bearing (faster + louder as they near); generators throb; food and the exit beacon stay audible at any range. Sounds to the south (behind you) are muffled.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your deepest delves on this device.',
      'highscores.empty': 'No delves yet. Descend!',
      'highscores.entry': '#{rank}. {name} — {score} points, floor {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused', 'pause.title': 'Paused', 'pause.resume': 'Resume',
      'pause.restart': 'Restart run', 'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'You fell',
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
      'learn.exit': 'Exit beacon (way down)',
      'learn.enemy': 'A monster (ahead)',
      'learn.gen': 'A generator (right)',
      'learn.food': 'Food (left)',
      'learn.fire': 'Your bolt',
      'learn.kill': 'A monster slain',
      'learn.genDestroyed': 'A generator destroyed',
      'learn.hurt': 'A monster hits you',
      'learn.foodGet': 'Eating food',
      'learn.heartbeat': 'Heartbeat (low health)',
      'learn.descend': 'Descend a floor',
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
      'ann.gen': 'Generator destroyed!',
      'ann.food': 'Food! Health {health}.',
      'ann.lowHealth': 'Health low!',
      'ann.descend': 'Descending to floor {level}!',
      'ann.levelStart': 'Floor {level}.',
      'ann.status': 'Health {health}, floor {level}, score {score}, {foes} foes near.',
      'ann.exit': 'Exit to the {dir}, {dist} away.',
      'ann.enemy': 'Nearest monster {dir}, {dist} away.',
      'ann.noEnemy': 'No monsters near.',
      'ann.help4': 'Health {health}, generator {gen}, food {food}.',
      'ann.none': 'none',
      'ann.gameOver': 'You fell on floor {level}. Score {score}.',
      'ann.gameOverHigh': 'You fell on floor {level}. New high score, {score}!',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Delve',

      'menu.aria': 'Menú principal',
      'menu.title': 'Delve',
      'menu.subtitle': 'Una mazmorra por audio. Dispara a los monstruos que salen de sus generadores, recoge comida para luchar contra el reloj de salud que se agota, y encuentra la bajada — cada vez más hondo, hasta que tu salud se acabe.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.learn': 'Aprende los sonidos',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'La mazmorra',
      'hud.health': 'Salud',
      'hud.level': 'Piso',
      'hud.score': 'Puntos',
      'hud.foes': 'Enemigos',

      'dir.n': 'norte', 'dir.e': 'este', 'dir.s': 'sur', 'dir.w': 'oeste', 'dir.here': 'sobre ti',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Dispara a la horda. Recoge comida. Encuentra la bajada.',
      'help.intro': 'Recorres un piso de mazmorra. La vista nunca gira: el norte siempre está al frente en el audio, el este a la derecha, el sur detrás, el oeste a la izquierda, y tu dirección es absoluta (Arriba = norte). Tu SALUD se agota todo el tiempo que estás aquí abajo — ES tu vida, y cuando llega a cero, se acaba. Los monstruos salen sin fin de los GENERADORES y te persiguen; uno a tu lado te resta salud, así que dispárales — y dispara a los generadores (un par de disparos cada uno) para cortar el flujo. Recoge COMIDA para recuperar salud. Un faro marca el camino a la SALIDA: alcánzala para bajar a un piso más hondo (más agotamiento, más monstruos). No se gana, solo importa cuán hondo llegas; la puntuación son monstruos + generadores + pisos.',
      'help.h.move': '<kbd>Flechas</kbd> / <kbd>WASD</kbd> — moverte y mirar (absoluto: Arriba = norte).',
      'help.h.fire': '<kbd>Espacio</kbd> — dispara un rayo hacia donde miras. Mata al primer monstruo, o daña un generador, en esa línea.',
      'help.h.exit': 'Un faro brillante marca el siguiente paso hacia la SALIDA. Síguelo para bajar, pero cuanto más tardes, más salud pierdes.',
      'help.h.health': 'Tu latido es tu barra de salud: se acelera al caer. Recoge COMIDA (un tono cálido) para restaurarla.',
      'help.h.gen': 'Los GENERADORES laten desde su posición y no paran de generar. Destrúyelos para reducir la horda, o corre a la salida.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> dirección de la salida · <kbd>F3</kbd> monstruo más cercano · <kbd>F4</kbd> salud + generador/comida más cercanos.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Los monstruos pitan desde su rumbo (más rápido y fuerte al acercarse); los generadores laten; la comida y el faro de salida se oyen a cualquier distancia. Los sonidos del sur (detrás) suenan apagados.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus descensos más profundos en este dispositivo.',
      'highscores.empty': '¡Aún no hay descensos. A bajar!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, piso {wave}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa', 'pause.title': 'Pausa', 'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida', 'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Caíste',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.exit': 'Faro de salida (la bajada)',
      'learn.enemy': 'Un monstruo (al frente)',
      'learn.gen': 'Un generador (derecha)',
      'learn.food': 'Comida (izquierda)',
      'learn.fire': 'Tu rayo',
      'learn.kill': 'Un monstruo abatido',
      'learn.genDestroyed': 'Un generador destruido',
      'learn.hurt': 'Un monstruo te golpea',
      'learn.foodGet': 'Comer comida',
      'learn.heartbeat': 'Latido (salud baja)',
      'learn.descend': 'Bajar un piso',
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

      'ann.gen': '¡Generador destruido!',
      'ann.food': '¡Comida! Salud {health}.',
      'ann.lowHealth': '¡Salud baja!',
      'ann.descend': '¡Bajando al piso {level}!',
      'ann.levelStart': 'Piso {level}.',
      'ann.status': 'Salud {health}, piso {level}, puntos {score}, {foes} enemigos cerca.',
      'ann.exit': 'Salida al {dir}, a {dist}.',
      'ann.enemy': 'Monstruo más cercano al {dir}, a {dist}.',
      'ann.noEnemy': 'No hay monstruos cerca.',
      'ann.help4': 'Salud {health}, generador {gen}, comida {food}.',
      'ann.none': 'ninguno',
      'ann.gameOver': 'Caíste en el piso {level}. Puntuación {score}.',
      'ann.gameOverHigh': 'Caíste en el piso {level}. ¡Nuevo récord, {score}!',
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
