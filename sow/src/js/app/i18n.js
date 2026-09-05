/**
 * Lightweight i18n for Sow. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'sow.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Sow',

      'menu.aria': 'Main menu',
      'menu.title': 'Sow',
      'menu.subtitle': 'Audio mancala. Sow seeds around the pits and bank more than the machine.',
      'menu.start': 'Start',
      'menu.multiplayer': 'Multiplayer',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Sow board',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.level': 'Level',
      'hud.store': 'Stores',
      'hud.turn': 'Turn',
      'hud.turnYou': 'You',
      'hud.turnAi': 'Machine',

      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Bank more seeds than the machine.',
      'help.intro': 'Mancala (the Kalah rules). You have six pits in front of you, each starting with four seeds, and a store (your bank) to your right. The machine has six pits behind you and a store to your left. On your turn, pick one of your pits and sow: its seeds are picked up and dropped one at a time into each following pit, going counterclockwise — rightward across your pits, into your store, then around through the machine’s pits (the opponent’s store is skipped). If your last seed lands in your store, you go again. If it lands in an empty pit on your own side, you capture that seed plus all the seeds in the pit opposite. When one side’s pits are all empty, each player banks the seeds left on their own side; the larger store wins. Win to climb to a tougher opponent; lose and spend one of three lives.',
      'help.h.move': '<kbd>Left</kbd> / <kbd>Right</kbd> (or <kbd>A</kbd> / <kbd>D</kbd>) — move along your six pits.',
      'help.h.sow': '<kbd>Enter</kbd> — sow the seeds from the current pit.',
      'help.h.scan': '<kbd>Space</kbd> — scan the whole board: a sweep around you where each pit’s pitch rises with how many seeds it holds (your pits in front, the machine’s behind, stores to the sides).',
      'help.h.count': '<kbd>C</kbd> — count the current pit: one tick per seed, from its place in front of you.',
      'help.h.rules': 'Last seed in your store = an extra turn. Last seed in an empty pit on your side = capture the opposite pit.',
      'help.h.status': '<kbd>F1</kbd> level, score, lives, stores, turn · <kbd>F2</kbd> the two stores · <kbd>F3</kbd> your pits · <kbd>F4</kbd> the machine’s pits.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: the pits ring around you — your six across the front, the machine’s across the behind (muffled, as they’re behind you), your store to the right, the machine’s to the left. When seeds are sown you hear them travel that ring, one soft pluck per pit; a seed dropped in a store is a warmer note. A capture is a scoop from two pits then a bright chime; an extra turn is a quick rising tone.',
      'help.back': 'Back',

      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Out-sow a few opponents!',
      'highscores.entry': '#{rank}. {name} — {score} points, reached level {level}',
      'highscores.back': 'Back',

      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart run',
      'pause.menu': 'Main menu',

      'gameover.aria': 'Game over',
      'gameover.title': 'Game over',
      'gameover.subtitle': 'Enter your name to save your score.',
      'gameover.score': 'Score: {score}',
      'gameover.name': 'Your name',
      'gameover.save': 'Save score',
      'gameover.continue': 'Continue',
      'gameover.nameRequired': 'Please enter a name first.',

      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each cue on its own.',
      'learn.pit': 'A seed in a pit (pluck)',
      'learn.store': 'A seed in your store (warm)',
      'learn.sweep': 'A sow sweep (circles you)',
      'learn.capture': 'A capture',
      'learn.extra': 'Extra turn',
      'learn.count': 'Count a pit (4 seeds)',
      'learn.win': 'You win',
      'learn.lose': 'Machine wins',
      'learn.draw': 'Draw',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm the compass: front is your pits, right is your store, behind is the machine, left is its store.',
      'test.north': 'Play north (your pits)',
      'test.east': 'Play east (your store)',
      'test.south': 'Play south (machine pits)',
      'test.west': 'Play west (machine store)',
      'test.ring': 'Play full ring',
      'test.back': 'Back',

      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      'tier.novice': 'Novice',
      'tier.adept': 'Adept',
      'tier.expert': 'Expert',
      'tier.master': 'Master',
      'tier.grand': 'Grandmaster',

      'ann.levelStart': 'Level {level}. {tier} opponent. You move first. Each pit has four seeds.',
      'ann.yourTurn': 'Your turn.',
      'ann.aiThinking': 'Machine is thinking.',
      'ann.pit': 'Pit {n}: {seeds} seeds.',
      'ann.emptyPit': 'That pit is empty.',
      'ann.youSow': 'You sow pit {n}.',
      'ann.capture': 'Capture! {gained} seeds banked.',
      'ann.aiSow': 'Machine sows its pit {n}.',
      'ann.aiCapture': 'Machine captures {gained} seeds.',
      'ann.extraYou': 'Extra turn!',
      'ann.extraAi': 'Machine goes again.',
      'ann.win': 'You win, {you} to {ai}! Plus {bonus} points.',
      'ann.lose': 'You lose, {you} to {ai}. {lives} lives left.',
      'ann.loseLast': 'You lose, {you} to {ai}. No lives left.',
      'ann.draw': 'A tie, {you} to {ai}. Plus {points} points. Replaying.',
      'ann.gameOver': 'Game over. Final score {score}, reached level {level}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.status': 'Level {level}, {tier} opponent. Score {score}. {lives} lives. Stores {you} to {ai}. {turn}.',
      'ann.stores': 'Your store {you}, machine store {ai}.',
      'ann.yourPits': 'Your pits, left to right: {list}.',
      'ann.oppPits': 'Machine pits: {list}.',
      'ann.scan': 'Board scan.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',

      'mp.aria': 'Multiplayer',
      'mp.title': 'Multiplayer',
      'mp.subtitle': 'Play another person, one on each device. One hosts and reads out a room code; the other joins with it.',
      'mp.host': 'Host a game',
      'mp.join': 'Join a game',
      'mp.connect': 'Connect',
      'mp.back': 'Back',
      'mp.codeLabel': 'Room code',
      'mp.codePlaceholder': 'Enter room code',
      'mp.unavailable': 'Multiplayer needs an internet connection and could not load.',
      'mp.starting': 'Creating a room…',
      'mp.hosting': 'Your room code is {code}. Tell the other player and wait for them to join.',
      'mp.joining': 'Connecting to room {code}…',
      'mp.connected': 'Connected. Starting the game.',
      'mp.failed': 'Could not connect. Check the code and try again.',
      'mp.hostFailed': 'Could not host a game. Please try again.',

      'mp.game.aria': 'Multiplayer board',
      'mp.hud.role': 'You are',
      'mp.hud.store': 'Stores',
      'mp.hud.turn': 'Turn',
      'mp.hud.you': 'You',
      'mp.hud.opp': 'Opponent',
      'mp.role.host': 'Host',
      'mp.role.guest': 'Guest',

      'mp.ann.start': 'New game. {turn}',
      'mp.ann.yourTurn': 'Your turn.',
      'mp.ann.oppTurn': "Opponent's turn.",
      'mp.ann.youSow': 'You sow pit {n}.',
      'mp.ann.oppSow': 'Opponent sows pit {n}.',
      'mp.ann.capture': 'Capture! {gained} seeds banked.',
      'mp.ann.oppCapture': 'Opponent captures {gained} seeds.',
      'mp.ann.extraYou': 'Extra turn!',
      'mp.ann.extraOpp': 'Opponent goes again.',
      'mp.ann.win': 'You win, {you} to {opp}!',
      'mp.ann.lose': 'You lose, {you} to {opp}.',
      'mp.ann.draw': 'A tie, {you} to {opp}.',
      'mp.ann.rematchHost': 'Press Enter to play again, or Escape to leave.',
      'mp.ann.rematchClient': 'Waiting for the host to start another game. Press Escape to leave.',
      'mp.ann.notYourTurn': 'Wait for your turn.',
      'mp.ann.emptyPit': 'That pit is empty.',
      'mp.ann.oppLeft': 'The other player left. Returning to the menu.',
      'mp.ann.left': 'Left the game.',
      'mp.ann.stores': 'Your store {you}, opponent store {opp}.',
      'mp.ann.yourPits': 'Your pits, left to right: {list}.',
      'mp.ann.oppPits': 'Opponent pits: {list}.',
      'mp.ann.status': 'Stores {you} to {opp}. {turn}',
      'mp.ann.scan': 'Board scan.',
    },

    es: {
      'doc.title': 'Sow',

      'menu.aria': 'Menú principal',
      'menu.title': 'Sow',
      'menu.subtitle': 'Mancala sonoro. Siembra semillas por los hoyos y guarda más que la máquina.',
      'menu.start': 'Empezar',
      'menu.multiplayer': 'Multijugador',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Tablero de Sow',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.level': 'Nivel',
      'hud.store': 'Graneros',
      'hud.turn': 'Turno',
      'hud.turnYou': 'Tú',
      'hud.turnAi': 'Máquina',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Guarda más semillas que la máquina.',
      'help.intro': 'Mancala (reglas Kalah). Tienes seis hoyos frente a ti, cada uno con cuatro semillas al empezar, y un granero (tu depósito) a tu derecha. La máquina tiene seis hoyos a tu espalda y un granero a tu izquierda. En tu turno, elige uno de tus hoyos y siembra: se recogen sus semillas y se sueltan una a una en cada hoyo siguiente, en sentido antihorario — hacia la derecha por tus hoyos, a tu granero, y luego por los hoyos de la máquina (el granero del rival se salta). Si tu última semilla cae en tu granero, juegas otra vez. Si cae en un hoyo vacío de tu lado, capturas esa semilla y todas las del hoyo opuesto. Cuando un lado se queda sin semillas, cada jugador guarda las que quedan en su propio lado; gana quien tenga más en su granero. Gana para subir a un rival más duro; pierde y gasta una de tres vidas.',
      'help.h.move': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> (o <kbd>A</kbd> / <kbd>D</kbd>) — recorre tus seis hoyos.',
      'help.h.sow': '<kbd>Enter</kbd> — siembra las semillas del hoyo actual.',
      'help.h.scan': '<kbd>Espacio</kbd> — escanea todo el tablero: un recorrido a tu alrededor donde el tono de cada hoyo sube según cuántas semillas tiene (tus hoyos al frente, los de la máquina detrás, los graneros a los lados).',
      'help.h.count': '<kbd>C</kbd> — cuenta el hoyo actual: un toque por semilla, desde su lugar frente a ti.',
      'help.h.rules': 'Última semilla en tu granero = turno extra. Última en un hoyo vacío de tu lado = captura el hoyo opuesto.',
      'help.h.status': '<kbd>F1</kbd> nivel, puntos, vidas, graneros, turno · <kbd>F2</kbd> los dos graneros · <kbd>F3</kbd> tus hoyos · <kbd>F4</kbd> los hoyos de la máquina.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: los hoyos te rodean — los tuyos seis al frente, los de la máquina detrás (apagados, por estar a tu espalda), tu granero a la derecha, el suyo a la izquierda. Al sembrar oyes las semillas recorrer ese anillo, un toque suave por hoyo; una semilla en un granero es una nota más cálida. Una captura es un barrido de dos hoyos y un tañido brillante; un turno extra es un tono ascendente rápido.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Supera a unos cuantos rivales!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, nivel {level}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida',
      'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Fin de la partida',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.pit': 'Una semilla en un hoyo (toque)',
      'learn.store': 'Una semilla en tu granero (cálido)',
      'learn.sweep': 'Un barrido de siembra (te rodea)',
      'learn.capture': 'Una captura',
      'learn.extra': 'Turno extra',
      'learn.count': 'Contar un hoyo (4 semillas)',
      'learn.win': 'Ganas',
      'learn.lose': 'Gana la máquina',
      'learn.draw': 'Empate',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma la brújula: al frente tus hoyos, a la derecha tu granero, detrás la máquina, a la izquierda su granero.',
      'test.north': 'Sonar al norte (tus hoyos)',
      'test.east': 'Sonar al este (tu granero)',
      'test.south': 'Sonar al sur (hoyos de la máquina)',
      'test.west': 'Sonar al oeste (granero de la máquina)',
      'test.ring': 'Sonar el anillo completo',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'tier.novice': 'Novato',
      'tier.adept': 'Hábil',
      'tier.expert': 'Experto',
      'tier.master': 'Maestro',
      'tier.grand': 'Gran maestro',

      'ann.levelStart': 'Nivel {level}. Rival {tier}. Mueves primero. Cada hoyo tiene cuatro semillas.',
      'ann.yourTurn': 'Tu turno.',
      'ann.aiThinking': 'La máquina está pensando.',
      'ann.pit': 'Hoyo {n}: {seeds} semillas.',
      'ann.emptyPit': 'Ese hoyo está vacío.',
      'ann.youSow': 'Siembras el hoyo {n}.',
      'ann.capture': '¡Captura! {gained} semillas guardadas.',
      'ann.aiSow': 'La máquina siembra su hoyo {n}.',
      'ann.aiCapture': 'La máquina captura {gained} semillas.',
      'ann.extraYou': '¡Turno extra!',
      'ann.extraAi': 'La máquina juega otra vez.',
      'ann.win': '¡Ganas, {you} a {ai}! Más {bonus} puntos.',
      'ann.lose': 'Pierdes, {you} a {ai}. Quedan {lives} vidas.',
      'ann.loseLast': 'Pierdes, {you} a {ai}. Sin vidas.',
      'ann.draw': 'Empate, {you} a {ai}. Más {points} puntos. Repitiendo.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}, nivel {level}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
      'ann.status': 'Nivel {level}, rival {tier}. Puntos {score}. {lives} vidas. Graneros {you} a {ai}. {turn}.',
      'ann.stores': 'Tu granero {you}, granero de la máquina {ai}.',
      'ann.yourPits': 'Tus hoyos, de izquierda a derecha: {list}.',
      'ann.oppPits': 'Hoyos de la máquina: {list}.',
      'ann.scan': 'Escaneo del tablero.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.onlineRank': 'Puesto en línea número {rank}.',
      'ann.onlineError': 'Clasificación no disponible. Guardado en este dispositivo.',
      'ann.paused': 'Pausa.',
      'ann.resumed': 'Reanudado.',

      'mp.aria': 'Multijugador',
      'mp.title': 'Multijugador',
      'mp.subtitle': 'Juega contra otra persona, cada una en su dispositivo. Uno crea la sala y dice el código; el otro se une con él.',
      'mp.host': 'Crear una partida',
      'mp.join': 'Unirse a una partida',
      'mp.connect': 'Conectar',
      'mp.back': 'Atrás',
      'mp.codeLabel': 'Código de sala',
      'mp.codePlaceholder': 'Escribe el código',
      'mp.unavailable': 'El multijugador necesita conexión a internet y no se pudo cargar.',
      'mp.starting': 'Creando una sala…',
      'mp.hosting': 'Tu código de sala es {code}. Díselo al otro jugador y espera a que se una.',
      'mp.joining': 'Conectando con la sala {code}…',
      'mp.connected': 'Conectado. Empezando la partida.',
      'mp.failed': 'No se pudo conectar. Revisa el código e inténtalo de nuevo.',
      'mp.hostFailed': 'No se pudo crear la partida. Inténtalo de nuevo.',

      'mp.game.aria': 'Tablero multijugador',
      'mp.hud.role': 'Eres',
      'mp.hud.store': 'Graneros',
      'mp.hud.turn': 'Turno',
      'mp.hud.you': 'Tú',
      'mp.hud.opp': 'Rival',
      'mp.role.host': 'Anfitrión',
      'mp.role.guest': 'Invitado',

      'mp.ann.start': 'Nueva partida. {turn}',
      'mp.ann.yourTurn': 'Tu turno.',
      'mp.ann.oppTurn': 'Turno del rival.',
      'mp.ann.youSow': 'Siembras el hoyo {n}.',
      'mp.ann.oppSow': 'El rival siembra el hoyo {n}.',
      'mp.ann.capture': '¡Captura! {gained} semillas guardadas.',
      'mp.ann.oppCapture': 'El rival captura {gained} semillas.',
      'mp.ann.extraYou': '¡Turno extra!',
      'mp.ann.extraOpp': 'El rival juega otra vez.',
      'mp.ann.win': '¡Ganas, {you} a {opp}!',
      'mp.ann.lose': 'Pierdes, {you} a {opp}.',
      'mp.ann.draw': 'Empate, {you} a {opp}.',
      'mp.ann.rematchHost': 'Pulsa Enter para jugar otra vez, o Escape para salir.',
      'mp.ann.rematchClient': 'Esperando a que el anfitrión empiece otra partida. Pulsa Escape para salir.',
      'mp.ann.notYourTurn': 'Espera tu turno.',
      'mp.ann.emptyPit': 'Ese hoyo está vacío.',
      'mp.ann.oppLeft': 'El otro jugador se fue. Volviendo al menú.',
      'mp.ann.left': 'Saliste de la partida.',
      'mp.ann.stores': 'Tu granero {you}, granero del rival {opp}.',
      'mp.ann.yourPits': 'Tus hoyos, de izquierda a derecha: {list}.',
      'mp.ann.oppPits': 'Hoyos del rival: {list}.',
      'mp.ann.status': 'Graneros {you} a {opp}. {turn}',
      'mp.ann.scan': 'Escaneo del tablero.',
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
