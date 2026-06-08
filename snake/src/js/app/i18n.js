/**
 * Lightweight i18n for COIL. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'coil.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Snake',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Snake',
      'menu.subtitle': 'An audio snake. Steer a growing serpent to the food by ear; the longer you get, the more your own body becomes the maze you must not bite. Every blocked side holds a beacon from its direction, so you hear your cage tighten.',
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
      'game.aria': 'The board',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.length': 'Length',
      'hud.eaten': 'Eaten',

      // Directions
      'dir.n': 'north', 'dir.e': 'east', 'dir.s': 'south', 'dir.w': 'west', 'dir.here': 'on you',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': "Eat to grow. Don't bite your own tail or the walls.",
      'help.intro': 'You steer a snake around a walled board. It always slithers forward; press a direction to turn. The view never rotates — Up is north, and north is always ahead in the audio, east is right, south behind, west left. A beacon pings toward the FOOD (higher and brighter the closer it is); reach it to grow one segment, score, and speed up a little. The danger is your own lengthening body: a wall or a piece of you within a few cells holds a low, pulsing beacon from its direction — the closer it gets, the louder and faster it pulses, and an adjacent one (about to crash you) is the loud, fast LAST warning. An open board is quiet; as you coil up, those beacons close into a cage around you, so steer toward the silent side. Crash into a wall or yourself and you lose a life. Three lives.',
      'help.h.steer': '<kbd>Arrow keys</kbd> / <kbd>WASD</kbd> — turn (Up = north, always). At the start of a run and after each crash the snake holds still until you press a direction, so you can get your bearings first. You cannot turn straight back on yourself; try it and you hear a short, dull thunk from behind, not a turn.',
      'help.h.food': 'A continuous tone hums toward the food: it pans to its direction, rises in pitch the closer you are, and goes muffled and dull when the food is behind you. Head for it.',
      'help.h.cage': 'A wall or your body within a few cells sings a low, pulsing beacon from its side — the closer it is, the louder and faster it pulses; an adjacent one is the loud, fast last warning. A wall ticks bright and hard; your own coil ticks lower and warmer, so you can tell which is closing you in. Quiet = open; a tightening ring of beacons = you are boxing yourself in.',
      'help.h.exit': 'As the cage closes in, each OPEN side answers with a soft, warm beacon — the roomier the space beyond it, the brighter and louder it rings, while a gap that only leads into a trap stays faint. Steer toward the clearest open beacon.',
      'help.h.grow': 'Eating grows you and quickens the pace. Longer + faster = less room and less time — that is the climb.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> food direction · <kbd>F3</kbd> which sides are blocked · <kbd>F4</kbd> your heading.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'A soft tick marks each step (its pitch rises as you lengthen and speed up). The blocked-side beacons are your safety sense — the louder and faster one pulses, the closer that wall or body is, so never turn toward a loud, fast one. The food beacon is your goal. Sounds to the south (behind you) are muffled.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your longest coils on this device.',
      'highscores.empty': 'No scores yet. Start slithering!',
      'highscores.entry': '#{rank}. {name} — {score} points, ate {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused', 'pause.title': 'Paused', 'pause.resume': 'Resume',
      'pause.restart': 'Restart run', 'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Tangled',
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
      'learn.food': 'Food beacon (near, ahead)',
      'learn.foodFar': 'Food beacon (far)',
      'learn.exit': 'Open exit (a clear way out)',
      'learn.exitTight': 'Open exit into a trap (faint)',
      'learn.blockedN': 'Wall ahead (north)',
      'learn.blockedE': 'Wall to the right (east)',
      'learn.blockedS': 'Wall behind (south)',
      'learn.blockedW': 'Wall to the left (west)',
      'learn.blockedBody': 'Your own body blocking a side',
      'learn.turnBlocked': 'Turn refused (back into yourself)',
      'learn.step': 'Your slither step',
      'learn.eat': 'You eat',
      'learn.crash': 'You crash',
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
      'ann.milestone': 'Ate {eaten}! Length {length}.',
      'ann.crash': 'Crash! {lives} lives left.',
      'ann.crashLast': 'Crash! No lives left.',
      'ann.status': 'Score {score}, {lives} lives, length {length}, eaten {eaten}.',
      'ann.food': 'Food to the {dir}, {dist} away.',
      'ann.noFood': 'No food on the board.',
      'ann.blocked': 'Blocked: {dirs}.',
      'ann.allClear': 'All sides clear.',
      'ann.heading': 'Heading {dir}.',
      'ann.ready': 'Ready — press a direction to begin.',
      'ann.gameOver': 'Tangled. Final score {score}.',
      'ann.gameOverHigh': 'Tangled. New high score, {score}!',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Snake',

      'menu.aria': 'Menú principal',
      'menu.title': 'Snake',
      'menu.subtitle': 'Una serpiente por audio. Guía a la serpiente hacia la comida de oído; cuanto más creces, más se vuelve tu propio cuerpo el laberinto que no debes morder. Cada lado bloqueado mantiene un faro desde su dirección, así que oyes cómo se cierra tu jaula.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.learn': 'Aprende los sonidos',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'El tablero',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.length': 'Longitud',
      'hud.eaten': 'Comidas',

      'dir.n': 'norte', 'dir.e': 'este', 'dir.s': 'sur', 'dir.w': 'oeste', 'dir.here': 'sobre ti',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Come para crecer. No muerdas tu cola ni los muros.',
      'help.intro': 'Guías una serpiente por un tablero amurallado. Siempre avanza; pulsa una dirección para girar. La vista nunca gira: Arriba es el norte, y el norte siempre está al frente en el audio, el este a la derecha, el sur detrás, el oeste a la izquierda. Un faro repica hacia la COMIDA (más agudo y brillante cuanto más cerca); alcánzala para crecer un segmento, puntuar y acelerar un poco. El peligro es tu propio cuerpo creciente: un muro o una parte de ti a pocas casillas mantiene un faro grave y pulsante desde su dirección; cuanto más cerca, más fuerte y rápido pulsa, y uno adyacente (a punto de estrellarte) es el AVISO final, fuerte y rápido. Un tablero abierto está en silencio; al enroscarte, esos faros se cierran en una jaula a tu alrededor, así que gira hacia el lado silencioso. Choca contra un muro o contra ti y pierdes una vida. Tres vidas.',
      'help.h.steer': '<kbd>Flechas</kbd> / <kbd>WASD</kbd> — gira (Arriba = norte, siempre). Al empezar una partida y tras cada choque la serpiente se queda quieta hasta que pulsas una dirección, así puedes orientarte primero. No puedes girar 180 grados sobre ti; si lo intentas oyes un golpe seco y grave por detrás, no un giro.',
      'help.h.food': 'Un tono continuo zumba hacia la comida: se panea a su dirección, sube de tono cuanto más cerca estás, y se vuelve apagado y sordo cuando la comida está detrás de ti. Ve hacia él.',
      'help.h.cage': 'Un muro o tu cuerpo a pocas casillas suena con un faro grave y pulsante desde su lado; cuanto más cerca, más fuerte y rápido pulsa, y uno adyacente es el aviso final, fuerte y rápido. Un muro repica brillante y duro; tu propio cuerpo repica más grave y cálido, así que distingues cuál te está cerrando. Silencio = abierto; un anillo de faros que se cierra = te estás encerrando.',
      'help.h.exit': 'Cuando la jaula se cierra, cada lado ABIERTO responde con un faro suave y cálido: cuanto más espacio hay tras él, más brillante y fuerte suena, mientras que un hueco que solo lleva a una trampa se queda tenue. Gira hacia el faro abierto más claro.',
      'help.h.grow': 'Comer te alarga y acelera el ritmo. Más largo + más rápido = menos espacio y menos tiempo: ese es el reto.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> dirección de la comida · <kbd>F3</kbd> qué lados están bloqueados · <kbd>F4</kbd> tu rumbo.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Un repique suave marca cada paso (su tono sube al alargarte y acelerar). Los faros de lados bloqueados son tu sentido de seguridad: cuanto más fuerte y rápido pulsa uno, más cerca está ese muro o cuerpo, así que nunca gires hacia uno fuerte y rápido. El faro de comida es tu meta. Los sonidos del sur (detrás) suenan apagados.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus serpientes más largas en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. A reptar!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, comió {wave}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa', 'pause.title': 'Pausa', 'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida', 'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Enredado',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.food': 'Faro de comida (cerca, al frente)',
      'learn.foodFar': 'Faro de comida (lejos)',
      'learn.exit': 'Salida abierta (un camino claro)',
      'learn.exitTight': 'Salida abierta hacia una trampa (tenue)',
      'learn.blockedN': 'Muro al frente (norte)',
      'learn.blockedE': 'Muro a la derecha (este)',
      'learn.blockedS': 'Muro detrás (sur)',
      'learn.blockedW': 'Muro a la izquierda (oeste)',
      'learn.blockedBody': 'Tu propio cuerpo bloqueando un lado',
      'learn.turnBlocked': 'Giro rechazado (de vuelta sobre ti)',
      'learn.step': 'Tu paso reptante',
      'learn.eat': 'Comes',
      'learn.crash': 'Chocas',
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

      'ann.milestone': '¡Comiste {eaten}! Longitud {length}.',
      'ann.crash': '¡Choque! Quedan {lives} vidas.',
      'ann.crashLast': '¡Choque! Sin vidas.',
      'ann.status': 'Puntos {score}, {lives} vidas, longitud {length}, comidas {eaten}.',
      'ann.food': 'Comida al {dir}, a {dist}.',
      'ann.noFood': 'No hay comida en el tablero.',
      'ann.blocked': 'Bloqueado: {dirs}.',
      'ann.allClear': 'Todos los lados despejados.',
      'ann.heading': 'Rumbo {dir}.',
      'ann.ready': 'Listo — pulsa una dirección para empezar.',
      'ann.gameOver': 'Enredado. Puntuación final {score}.',
      'ann.gameOverHigh': 'Enredado. ¡Nuevo récord, {score}!',
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
