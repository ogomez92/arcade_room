/**
 * Lightweight i18n for accessible audio games. See template CLAUDE.md
 * for the canonical pattern; only STORAGE_KEY and the dictionaries
 * differ between games.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'tennis.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Audio Tennis',

      // Splash / main menu
      'splash.aria': 'Main menu',
      'splash.menuAria': 'Main menu',
      'splash.title': 'Audio Tennis',
      'splash.author': 'an accessible audio game',
      'splash.single': 'Single player vs. computer',
      'splash.multi': 'Multiplayer',
      'splash.help': 'How to play',
      'splash.settings': 'Settings',
      'splash.language': 'Language',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.move': '<strong>Arrow keys</strong> — move around your half of the court.',
      'help.forehand': '<kbd>D</kbd> — forehand (swing the racket to your right).',
      'help.backhand': '<kbd>A</kbd> — backhand (swing the racket to your left, like a reverse).',
      'help.smash': '<kbd>S</kbd> — smash (powerful, lower trajectory).',
      'help.serve': '<strong>When you serve</strong>, press D, A, or S to toss and strike the ball. The serve must land in the diagonal service box.',
      'help.timing': '<strong>Timing.</strong> Listen to the ball whoosh louder as it nears you. Swing while it is in your strike zone (within roughly two metres of your racket).',
      'help.audio': '<strong>Audio map.</strong> The listener is fixed: north of the screen is in front of you, south is behind, east is to your right, west is to your left. The net runs east–west across the middle.',
      'help.back': 'Back to menu',

      // Lobby
      'lobby.aria': 'Multiplayer lobby',
      'lobby.title': 'Multiplayer',
      'lobby.subtitle': 'Create a room and share the code with a friend, or enter a code to join.',
      'lobby.create': 'Create room',
      'lobby.codeLabel': 'Room code',
      'lobby.codeAria': 'Room code',
      'lobby.join': 'Join room',
      'lobby.start': 'Start match',
      'lobby.leave': 'Leave room',
      'lobby.back': 'Back',
      'lobby.created': 'Room created. Code: {code}. Waiting for opponent.',
      'lobby.joined': 'Joined room {code}. Waiting for host to start.',
      'lobby.opponentJoined': 'Opponent joined. Host can start the match.',
      'lobby.opponentLeft': 'Opponent left the room.',
      'lobby.hostLeft': 'The host left the room.',
      'lobby.starting': 'Starting match.',
      'lobby.libUnavailable': 'Multiplayer is unavailable: PeerJS could not be loaded. Check your internet connection.',
      'lobby.error': 'Connection error: {message}',
      'lobby.players1': 'Players: 1 of 2 (waiting for opponent).',
      'lobby.players2': 'Players: 2 of 2 (ready).',
      'lobby.notHost': 'Only the host can start the match.',
      'lobby.notEnough': 'Need a second player to start.',

      // Game / announcements
      'game.aria': 'Tennis match',
      'game.instructions': 'Arrows to move. D for forehand, A for backhand, S for smash. Listen for the ball as it nears your side; swing when it is close.',
      'game.score': 'Set {set}, you {you}, opponent {them}. Game score: {gameYou} - {gameThem}.',
      'ann.matchStart': 'Match start. Best of three sets.',
      'ann.youServe': 'Your serve. Press D, A, or S to strike the ball.',
      'ann.opponentServes': '{opponent} serves.',
      'ann.serveLet': 'Let. Replay the serve.',
      'ann.serveFault': 'Fault.',
      'ann.doubleFault': 'Double fault. {scorer} wins the point.',
      'ann.serveOut': 'Service out. Fault.',
      'ann.serveNet': 'Service into the net. Fault.',
      'ann.point': '{scorer} wins the point.',
      'ann.pointYou': 'You win the point.',
      'ann.pointThem': '{opponent} wins the point.',
      'ann.gameYou': 'Game, you. {gameYou} games to {gameThem}.',
      'ann.gameThem': 'Game, {opponent}. {gameYou} games to {gameThem}.',
      'ann.setYou': 'Set, you. Sets {setYou} to {setThem}.',
      'ann.setThem': 'Set, {opponent}. Sets {setYou} to {setThem}.',
      'ann.scoreCall': '{server} serving. {serverScore}, {receiverScore}.',
      'ann.scoreLove': 'Love',
      'ann.score15': 'fifteen',
      'ann.score30': 'thirty',
      'ann.score40': 'forty',
      'ann.scoreDeuce': 'Deuce.',
      'ann.scoreAdYou': 'Advantage you.',
      'ann.scoreAdThem': 'Advantage {opponent}.',
      'ann.outOfBounds': 'Out.',
      'ann.intoNet': 'Into the net.',
      'ann.youHit': 'Returned.',
      'ann.theyHit': '{opponent} returned.',
      'ann.matchYou': 'Game, set, and match. You win the match.',
      'ann.matchThem': 'Game, set, and match. {opponent} wins the match.',
      'ann.opponent': 'Opponent',
      'ann.computer': 'Computer',
      'ann.you': 'You',
      'ann.swingMiss': 'Miss.',
      'ann.swingHit': 'Hit.',
      'ann.disconnect': 'Opponent disconnected. You win by forfeit.',

      // Game over
      'gameover.aria': 'Match over',
      'gameover.title': 'Match over',
      'gameover.summaryWin': 'You won {setYou} sets to {setThem}. {games}.',
      'gameover.summaryLose': '{opponent} won {setThem} sets to {setYou}. {games}.',
      'gameover.summaryGames': 'Games per set: {games}',
      'gameover.rematch': 'Play again',
      'gameover.menu': 'Main menu',

      // Language
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Settings
      'settings.aria': 'Settings',
      'settings.title': 'Settings',
      'settings.diffTitle': 'Difficulty',
      'settings.diffSubtitle': 'Lower difficulties slow the ball so you have more time to react. AI footwork is unchanged. In multiplayer the host\'s choice applies to both players.',
      'settings.diff.easy': 'Easy — slow ball',
      'settings.diff.normal': 'Normal — medium pace',
      'settings.diff.hard': 'Hard — full pace',
      'settings.diff.easy.short': 'easy',
      'settings.diff.normal.short': 'normal',
      'settings.diff.hard.short': 'hard',
      'settings.diffSet': 'Difficulty set to {value}.',
      'settings.setsTitle': 'Match length',
      'settings.setsSubtitle': 'Number of sets in a match. In multiplayer the host\'s choice applies.',
      'settings.sets.1': 'Best of 1 — single set',
      'settings.sets.3': 'Best of 3 — standard',
      'settings.sets.5': 'Best of 5 — long match',
      'settings.setsSet': 'Match length set to best of {value}.',
      'settings.back': 'Back',
    },

    es: {
      'doc.title': 'Tenis de Audio',

      'splash.aria': 'Menú principal',
      'splash.menuAria': 'Menú principal',
      'splash.title': 'Tenis de Audio',
      'splash.author': 'un juego de audio accesible',
      'splash.single': 'Un jugador contra la computadora',
      'splash.multi': 'Multijugador',
      'splash.help': 'Cómo jugar',
      'splash.settings': 'Ajustes',
      'splash.language': 'Idioma',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.move': '<strong>Flechas</strong> — moverse por tu mitad de la pista.',
      'help.forehand': '<kbd>D</kbd> — derecha (golpear con la raqueta a tu derecha).',
      'help.backhand': '<kbd>A</kbd> — revés (golpear con la raqueta a tu izquierda).',
      'help.smash': '<kbd>S</kbd> — remate (golpe potente y rasante).',
      'help.serve': '<strong>Al sacar</strong>, pulsa D, A o S para lanzar la pelota y golpearla. El saque debe caer en el cuadro de saque diagonal.',
      'help.timing': '<strong>Tiempo.</strong> Escucha cómo la pelota silba más fuerte al acercarse. Golpea cuando esté en tu zona de impacto (a unos dos metros de tu raqueta).',
      'help.audio': '<strong>Mapa de audio.</strong> El oyente está fijo: el norte está delante, el sur detrás, el este a tu derecha y el oeste a tu izquierda. La red cruza la pista de este a oeste.',
      'help.back': 'Volver al menú',

      'lobby.aria': 'Sala multijugador',
      'lobby.title': 'Multijugador',
      'lobby.subtitle': 'Crea una sala y comparte el código con un amigo, o introduce un código para unirte.',
      'lobby.create': 'Crear sala',
      'lobby.codeLabel': 'Código de sala',
      'lobby.codeAria': 'Código de sala',
      'lobby.join': 'Unirse',
      'lobby.start': 'Empezar partido',
      'lobby.leave': 'Salir de la sala',
      'lobby.back': 'Atrás',
      'lobby.created': 'Sala creada. Código: {code}. Esperando rival.',
      'lobby.joined': 'Te uniste a la sala {code}. Esperando que el anfitrión empiece.',
      'lobby.opponentJoined': 'Rival conectado. El anfitrión puede empezar.',
      'lobby.opponentLeft': 'El rival salió de la sala.',
      'lobby.hostLeft': 'El anfitrión salió de la sala.',
      'lobby.starting': 'Empezando partido.',
      'lobby.libUnavailable': 'Multijugador no disponible: PeerJS no se pudo cargar. Comprueba tu conexión.',
      'lobby.error': 'Error de conexión: {message}',
      'lobby.players1': 'Jugadores: 1 de 2 (esperando rival).',
      'lobby.players2': 'Jugadores: 2 de 2 (listos).',
      'lobby.notHost': 'Solo el anfitrión puede empezar.',
      'lobby.notEnough': 'Falta un segundo jugador.',

      'game.aria': 'Partido de tenis',
      'game.instructions': 'Flechas para moverte. D derecha, A revés, S remate. Escucha la pelota al acercarse y golpea en su zona.',
      'game.score': 'Set {set}, tú {you}, rival {them}. Marcador: {gameYou} - {gameThem}.',
      'ann.matchStart': 'Comienza el partido. Al mejor de tres sets.',
      'ann.youServe': 'Sacas tú. Pulsa D, A o S para golpear la pelota.',
      'ann.opponentServes': 'Saca {opponent}.',
      'ann.serveLet': 'Let. Repite el saque.',
      'ann.serveFault': 'Falta.',
      'ann.doubleFault': 'Doble falta. {scorer} gana el punto.',
      'ann.serveOut': 'Saque fuera. Falta.',
      'ann.serveNet': 'Saque a la red. Falta.',
      'ann.point': '{scorer} gana el punto.',
      'ann.pointYou': 'Ganas el punto.',
      'ann.pointThem': '{opponent} gana el punto.',
      'ann.gameYou': 'Juego para ti. {gameYou} juegos a {gameThem}.',
      'ann.gameThem': 'Juego para {opponent}. {gameYou} juegos a {gameThem}.',
      'ann.setYou': 'Set para ti. Sets {setYou} a {setThem}.',
      'ann.setThem': 'Set para {opponent}. Sets {setYou} a {setThem}.',
      'ann.scoreCall': 'Saca {server}. {serverScore}, {receiverScore}.',
      'ann.scoreLove': 'cero',
      'ann.score15': 'quince',
      'ann.score30': 'treinta',
      'ann.score40': 'cuarenta',
      'ann.scoreDeuce': 'Iguales.',
      'ann.scoreAdYou': 'Ventaja tú.',
      'ann.scoreAdThem': 'Ventaja {opponent}.',
      'ann.outOfBounds': 'Fuera.',
      'ann.intoNet': 'A la red.',
      'ann.youHit': 'Devolviste.',
      'ann.theyHit': '{opponent} devolvió.',
      'ann.matchYou': 'Juego, set y partido. Ganas el partido.',
      'ann.matchThem': 'Juego, set y partido. {opponent} gana el partido.',
      'ann.opponent': 'Rival',
      'ann.computer': 'Computadora',
      'ann.you': 'Tú',
      'ann.swingMiss': 'Fallo.',
      'ann.swingHit': 'Golpeas.',
      'ann.disconnect': 'El rival se desconectó. Ganas por incomparecencia.',

      'gameover.aria': 'Fin del partido',
      'gameover.title': 'Fin del partido',
      'gameover.summaryWin': 'Ganaste {setYou} sets a {setThem}. {games}.',
      'gameover.summaryLose': '{opponent} ganó {setThem} sets a {setYou}. {games}.',
      'gameover.summaryGames': 'Juegos por set: {games}',
      'gameover.rematch': 'Volver a jugar',
      'gameover.menu': 'Menú principal',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'settings.aria': 'Ajustes',
      'settings.title': 'Ajustes',
      'settings.diffTitle': 'Dificultad',
      'settings.diffSubtitle': 'Las dificultades menores ralentizan la pelota para darte más tiempo de reacción. El movimiento de la IA no cambia. En multijugador se aplica la elección del anfitrión.',
      'settings.diff.easy': 'Fácil — pelota lenta',
      'settings.diff.normal': 'Normal — ritmo medio',
      'settings.diff.hard': 'Difícil — ritmo completo',
      'settings.diff.easy.short': 'fácil',
      'settings.diff.normal.short': 'normal',
      'settings.diff.hard.short': 'difícil',
      'settings.diffSet': 'Dificultad establecida en {value}.',
      'settings.setsTitle': 'Duración del partido',
      'settings.setsSubtitle': 'Número de sets del partido. En multijugador se aplica la elección del anfitrión.',
      'settings.sets.1': 'A 1 set — partido corto',
      'settings.sets.3': 'Al mejor de 3 — estándar',
      'settings.sets.5': 'Al mejor de 5 — partido largo',
      'settings.setsSet': 'Partido al mejor de {value}.',
      'settings.back': 'Atrás',
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
