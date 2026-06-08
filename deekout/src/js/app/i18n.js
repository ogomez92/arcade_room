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
  const STORAGE_KEY = 'deekout.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Super Deekout',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Super Deekout',
      'menu.subtitle': 'A fast, audio-first arcade chase.',
      'menu.start': 'Start game',
      'menu.difficulty': 'Difficulty',
      'menu.options': 'Options',
      'menu.highscores': 'High scores',
      'menu.learn': 'Learn game sounds',
      'menu.test': 'Test speaker orientation',
      'menu.help': 'How to play',
      'menu.quit': 'Quit',

      // Difficulty
      'difficulty.aria': 'Choose difficulty',
      'difficulty.title': 'Choose difficulty',
      'difficulty.subtitle': 'Higher difficulties mean smarter, faster enemies.',
      'difficulty.easy': 'Easy',
      'difficulty.normal': 'Normal',
      'difficulty.crazy': 'Crazy',
      'difficulty.back': 'Back',

      // Options
      'options.aria': 'Options',
      'options.title': 'Options',
      'options.music': 'Background music',
      'options.musicVolume': 'Music volume',
      'options.tts': 'Speak with built-in voice',
      'options.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Local leaderboard — {difficulty}.',
      'highscores.difficulty': 'Difficulty: {difficulty}',
      'highscores.online': 'View online leaderboard',
      'highscores.back': 'Back',
      'highscores.empty': 'No scores yet.',
      'highscores.entry': '{rank}. {name} — {score} (level {level})',

      // Learn sounds
      'learn.aria': 'Learn game sounds',
      'learn.title': 'Learn game sounds',
      'learn.subtitle': 'Audition each cue with a fixed listener facing north.',
      'learn.back': 'Back',
      'learn.coin': 'Coin',
      'learn.coinSpecial': 'Coin (can end level)',
      'learn.botRobot': '1O1 bot (rolling chase)',
      'learn.botRocket': 'Rocket (wandering)',
      'learn.good': 'Good item pickup',
      'learn.dispatch': 'Good item appeared',
      'learn.nasty': 'Nasty item',
      'learn.wall': 'Approaching a wall',
      'learn.wallHit': 'Hitting a wall',
      'learn.warp': 'Wall fusion warp',
      'learn.bombTick': 'Bomb ticking',
      'learn.bombExplode': 'Bomb exploding',
      'learn.hazard': 'Hazard zone',
      'learn.oil': 'Oil slick',
      'learn.experiment': 'Experiment piece',
      'learn.death.robot': 'Caught by 1O1 bot',
      'learn.death.rocket': 'Caught by the rocket',
      'learn.death.bullet': 'Hit by a bullet',
      'learn.laugh': '1O1 bot laughing',

      // Orientation test
      'test.aria': 'Orientation test',
      'test.title': 'Orientation test',
      'test.subtitle': 'Ticks fire at front (north), right (east), behind (south), left (west) in sequence.',
      'test.back': 'Back',
      'test.front': 'Front (north)',
      'test.right': 'Right (east)',
      'test.behind': 'Behind (south)',
      'test.left': 'Left (west)',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.goal': '<strong>Goal:</strong> collect every coin to clear the level.',
      'help.move': '<kbd>Arrow keys</kbd> roll the robot. Hold two for a diagonal.',
      'help.collect': 'Centre a coin’s sound left-to-right to line up its column, then move until it is loudest to grab it.',
      'help.behind': 'Sounds behind you (south) are muffled and lower.',
      'help.enemies': 'Avoid 1O1 bot and the rocket. A centred, loud enemy is right on top of you.',
      'help.space': '<kbd>Space</kbd> ends a level early when two or fewer coins remain.',
      'help.inv': '<kbd>E</kbd> neutralizer, <kbd>C</kbd> collector, <kbd>W</kbd> wall fusion, <kbd>S</kbd> oil slick.',
      'help.status': '<kbd>Enter</kbd> coins and health, <kbd>Shift</kbd> score and level, <kbd>I</kbd> inventory, <kbd>T</kbd> time, <kbd>H</kbd> high score.',
      'help.modes': '<kbd>M</kbd> toggles hearing one coin or all. <kbd>1</kbd>-<kbd>5</kbd> set how many coins to track. <kbd>P</kbd> pauses.',
      'help.back': 'Back',

      // Game
      'game.aria': 'Playing Super Deekout',
      'game.title': 'Super Deekout',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game over',
      'gameover.summary': 'You reached level {level} with {score} points.',
      'gameover.nameLabel': 'Name',
      'gameover.submit': 'Save score',
      'gameover.again': 'Play again',
      'gameover.menu': 'Main menu',
      'gameover.scoreEntry': '{rank}. {name} — {score}',
      'gameover.newBest': 'New personal best!',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Online scores
      'online.posting': 'Posting score…',
      'online.rank': 'Online rank: {rank}.',
      'online.error': 'Online scores unavailable; saved locally.',
      'online.viewBoard': 'View online leaderboard',

      // Player
      'player.you': 'You',

      // Item names
      'item.speedup': 'speed up',
      'item.health': 'health',
      'item.points': 'bonus points',
      'item.invisibility': 'invisibility',
      'item.armor': 'armor',
      'item.coinSpawn': 'coin spawn',

      // Announcer
      'ann.coinsHealth': '{coins} coins left. Health {health}.',
      'ann.scoreLevel': 'Score {score}. Level {level}.',
      'ann.scoreDigits': 'Score: {digits}.',
      'ann.inventory': '{neutralizers} neutralizers, {collectors} collectors, {fusions} fusions, {oils} oil slicks.',
      'ann.time': '{seconds} seconds.',
      'ann.highScore': 'High score {score}.',
      'ann.modeSingle': 'Tracking {n} closest coins.',
      'ann.modeAll': 'Hearing all coins.',
      'ann.experiment': 'Experiment piece {n}.',
      'ann.goodItem': 'A good item appeared!',
      'ann.gotItem': 'Got {item}!',
      'ann.nastyItem': 'A nasty item appeared!',
      'ann.death.robot': '1O1 bot caught you!',
      'ann.death.rocket': 'The rocket got you!',
      'ann.death.bullet': 'Hit by a bullet!',
      'ann.death.bomb': 'Caught in a blast!',
      'ann.death.hazard': 'You stepped on a hazard!',
      'ann.death.oil': 'You slipped on your own oil!',
      'ann.hit': '{cause} Health {health}.',
      'ann.levelClear': 'Level {level} clear! {points} bonus points.',
      'ann.ready': 'Level {level}. Go!',
      'ann.bonus.coinShower': 'Coin shower! Grab every coin you can in twenty seconds.',
      'ann.bonus.mineField': 'Mine field! Survive thirty seconds of bombs.',
      'ann.gameOver': 'Game over. Level {level}, {score} points.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.warn.wall': 'Wall ahead.',
      'ann.warn.bomb': 'A bomb is ticking nearby.',
      'ann.warn.hazard': 'Hazard nearby.',
      'ann.warn.robot': '1O1 bot is closing in.',
      'ann.onlineRank': 'Online rank {rank}.',
      'ann.onlineError': 'Could not post online score.',
      'ann.killRobot': 'You destroyed 1O1 bot!',
      'ann.robotLaugh': '1O1 bot laughs at you.',
      'ann.levelDrop': 'Dropped to level {level}!',
      'ann.endEarly': 'Level ended.',
    },

    es: {
      'doc.title': 'Super Deekout',

      'menu.aria': 'Menú principal',
      'menu.title': 'Super Deekout',
      'menu.subtitle': 'Una persecución arcade rápida y sonora.',
      'menu.start': 'Empezar',
      'menu.difficulty': 'Dificultad',
      'menu.options': 'Opciones',
      'menu.highscores': 'Puntuaciones',
      'menu.learn': 'Aprender sonidos',
      'menu.test': 'Probar orientación',
      'menu.help': 'Cómo jugar',
      'menu.quit': 'Salir',

      'difficulty.aria': 'Elegir dificultad',
      'difficulty.title': 'Elegir dificultad',
      'difficulty.subtitle': 'A mayor dificultad, enemigos más listos y rápidos.',
      'difficulty.easy': 'Fácil',
      'difficulty.normal': 'Normal',
      'difficulty.crazy': 'Locura',
      'difficulty.back': 'Atrás',

      'options.aria': 'Opciones',
      'options.title': 'Opciones',
      'options.music': 'Música de fondo',
      'options.musicVolume': 'Volumen de música',
      'options.tts': 'Hablar con voz integrada',
      'options.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Marcador local — {difficulty}.',
      'highscores.difficulty': 'Dificultad: {difficulty}',
      'highscores.online': 'Ver marcador en línea',
      'highscores.back': 'Atrás',
      'highscores.empty': 'Aún no hay puntuaciones.',
      'highscores.entry': '{rank}. {name} — {score} (nivel {level})',

      'learn.aria': 'Aprender sonidos',
      'learn.title': 'Aprender sonidos del juego',
      'learn.subtitle': 'Escucha cada sonido con el oyente fijo mirando al norte.',
      'learn.back': 'Atrás',
      'learn.coin': 'Moneda',
      'learn.coinSpecial': 'Moneda (puede terminar el nivel)',
      'learn.botRobot': 'Robot 1O1 (persecución rodante)',
      'learn.botRocket': 'Cohete (errante)',
      'learn.good': 'Recoger objeto bueno',
      'learn.dispatch': 'Apareció un objeto bueno',
      'learn.nasty': 'Objeto malo',
      'learn.wall': 'Acercándose a un muro',
      'learn.wallHit': 'Chocar con un muro',
      'learn.warp': 'Teletransporte por fusión',
      'learn.bombTick': 'Bomba haciendo tic-tac',
      'learn.bombExplode': 'Bomba explotando',
      'learn.hazard': 'Zona de peligro',
      'learn.oil': 'Mancha de aceite',
      'learn.experiment': 'Pieza del experimento',
      'learn.death.robot': 'Atrapado por 1O1',
      'learn.death.rocket': 'Atrapado por el cohete',
      'learn.death.bullet': 'Golpeado por una bala',
      'learn.laugh': '1O1 riéndose',

      'test.aria': 'Prueba de orientación',
      'test.title': 'Prueba de orientación',
      'test.subtitle': 'Los toques suenan al frente (norte), derecha (este), detrás (sur), izquierda (oeste).',
      'test.back': 'Atrás',
      'test.front': 'Frente (norte)',
      'test.right': 'Derecha (este)',
      'test.behind': 'Detrás (sur)',
      'test.left': 'Izquierda (oeste)',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.goal': '<strong>Objetivo:</strong> recoge todas las monedas para superar el nivel.',
      'help.move': 'Las <kbd>flechas</kbd> mueven al robot. Pulsa dos para ir en diagonal.',
      'help.collect': 'Centra el sonido de una moneda a izquierda-derecha para alinear su columna, luego muévete hasta oírla más fuerte para cogerla.',
      'help.behind': 'Lo que está detrás de ti (sur) suena apagado y más grave.',
      'help.enemies': 'Evita a 1O1 y al cohete. Un enemigo centrado y fuerte está encima de ti.',
      'help.space': '<kbd>Espacio</kbd> termina el nivel cuando quedan dos monedas o menos.',
      'help.inv': '<kbd>E</kbd> neutralizador, <kbd>C</kbd> recolector, <kbd>W</kbd> fusión de muros, <kbd>S</kbd> mancha de aceite.',
      'help.status': '<kbd>Entrar</kbd> monedas y salud, <kbd>Mayús</kbd> puntos y nivel, <kbd>I</kbd> inventario, <kbd>T</kbd> tiempo, <kbd>H</kbd> récord.',
      'help.modes': '<kbd>M</kbd> alterna oír una moneda o todas. <kbd>1</kbd>-<kbd>5</kbd> fijan cuántas seguir. <kbd>P</kbd> pausa.',
      'help.back': 'Atrás',

      'game.aria': 'Jugando a Super Deekout',
      'game.title': 'Super Deekout',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Fin de la partida',
      'gameover.summary': 'Llegaste al nivel {level} con {score} puntos.',
      'gameover.nameLabel': 'Nombre',
      'gameover.submit': 'Guardar puntuación',
      'gameover.again': 'Jugar otra vez',
      'gameover.menu': 'Menú principal',
      'gameover.scoreEntry': '{rank}. {name} — {score}',
      'gameover.newBest': '¡Nuevo récord personal!',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'online.posting': 'Enviando puntuación…',
      'online.rank': 'Puesto en línea: {rank}.',
      'online.error': 'Marcador en línea no disponible; guardado localmente.',
      'online.viewBoard': 'Ver marcador en línea',

      'player.you': 'Tú',

      'item.speedup': 'velocidad',
      'item.health': 'salud',
      'item.points': 'puntos extra',
      'item.invisibility': 'invisibilidad',
      'item.armor': 'armadura',
      'item.coinSpawn': 'lluvia de monedas',

      'ann.coinsHealth': 'Quedan {coins} monedas. Salud {health}.',
      'ann.scoreLevel': 'Puntos {score}. Nivel {level}.',
      'ann.scoreDigits': 'Puntos: {digits}.',
      'ann.inventory': '{neutralizers} neutralizadores, {collectors} recolectores, {fusions} fusiones, {oils} manchas de aceite.',
      'ann.time': '{seconds} segundos.',
      'ann.highScore': 'Récord {score}.',
      'ann.modeSingle': 'Siguiendo {n} monedas más cercanas.',
      'ann.modeAll': 'Oyendo todas las monedas.',
      'ann.experiment': 'Pieza del experimento {n}.',
      'ann.goodItem': '¡Apareció un objeto bueno!',
      'ann.gotItem': '¡Conseguiste {item}!',
      'ann.nastyItem': '¡Apareció un objeto malo!',
      'ann.death.robot': '¡1O1 te atrapó!',
      'ann.death.rocket': '¡El cohete te alcanzó!',
      'ann.death.bullet': '¡Te dio una bala!',
      'ann.death.bomb': '¡Te pilló una explosión!',
      'ann.death.hazard': '¡Pisaste un peligro!',
      'ann.death.oil': '¡Resbalaste en tu propio aceite!',
      'ann.hit': '{cause} Salud {health}.',
      'ann.levelClear': '¡Nivel {level} superado! {points} puntos de bonus.',
      'ann.ready': 'Nivel {level}. ¡Ya!',
      'ann.bonus.coinShower': '¡Lluvia de monedas! Coge todas las que puedas en veinte segundos.',
      'ann.bonus.mineField': '¡Campo de minas! Sobrevive treinta segundos de bombas.',
      'ann.gameOver': 'Fin. Nivel {level}, {score} puntos.',
      'ann.paused': 'Pausa.',
      'ann.resumed': 'Continúa.',
      'ann.warn.wall': 'Muro delante.',
      'ann.warn.bomb': 'Una bomba hace tic-tac cerca.',
      'ann.warn.hazard': 'Peligro cerca.',
      'ann.warn.robot': '1O1 se acerca.',
      'ann.onlineRank': 'Puesto en línea {rank}.',
      'ann.onlineError': 'No se pudo enviar la puntuación.',
      'ann.killRobot': '¡Destruiste a 1O1!',
      'ann.robotLaugh': '1O1 se ríe de ti.',
      'ann.levelDrop': '¡Bajaste al nivel {level}!',
      'ann.endEarly': 'Nivel terminado.',
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
