/**
 * Lightweight i18n for accessible audio games. See bumper/template for the
 * canonical implementation; only the STORAGE_KEY and dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'pong.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Pong',

      'splash.aria': 'Welcome',
      'splash.menuAria': 'Main menu',
      'splash.author': 'by guilevi',
      'splash.play': 'Play game',
      'splash.multi': 'Multiplayer',
      'splash.learn': 'Learn sounds',
      'splash.language': 'Language',

      'game.aria': 'Game',
      'game.newGame': 'New game',
      'game.scoreLimit': 'Score limit',
      'game.start': 'Start game',
      'game.back': 'Back to menu',
      'game.return': 'Return to menu',

      'learn.aria': 'Learn sounds',
      'learn.title': 'Learn sounds',
      'learn.ballRolling': 'Ball rolling',
      'learn.serveWarning': 'Serve transfer warning',
      'learn.back': 'Back to main menu',
      'learn.playing': 'Playing…',

      'lobby.aria': 'Multiplayer lobby',
      'lobby.playersAria': 'Players',
      'lobby.create': 'Create room',
      'lobby.codeLabel': 'Room code (4 letters)',
      'lobby.codeAria': '4-letter room code',
      'lobby.join': 'Join room',
      'lobby.back': 'Back',
      'lobby.team1': 'Join Team 1',
      'lobby.team2': 'Join Team 2',
      'lobby.ready': 'Ready',
      'lobby.leave': 'Leave room',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',

      // Runtime announcements
      'ann.youServe': 'You serve. You have 3 seconds.',
      'ann.opponentServes': '{opponent} serves.',
      'ann.serveTransferYou': 'Serve transferred to you. You serve.',
      'ann.serveTransferOther': 'Serve transferred to {opponentLower}. {opponent} serves.',
      'ann.goalYou': 'Goal! You score. Score: {you} to {them}.',
      'ann.goalOther': 'Goal! {opponent} scores. Score: {you} to {them}.',
      'ann.gameOverWin': 'Game over. You win {you} to {them}.',
      'ann.gameOverLose': 'Game over. {opponent} wins {them} to {you}.',
      'ann.opponent': 'Opponent',
      'ann.computer': 'Computer',
      'ann.opponentLower': 'opponent',
      'ann.computerLower': 'computer',

      // Lobby announcements
      'lob.enterCode': 'Please enter a 4-letter room code.',
      'lob.allReady': 'All players ready. Starting in 3 seconds.',
      'lob.creating': 'Creating room...',
      'lob.created': 'Room created. Code: {code}. Waiting for players.',
      'lob.createFailed': 'Failed to create room. Please try again.',
      'lob.joining': 'Joining room {code}...',
      'lob.joined': 'Joined room. Waiting for player list.',
      'lob.joinFailed': 'Could not join room. Check the code and try again.',
      'lob.youJoinedTeam': 'You joined Team {n}.',
      'lob.joinTeamFirst': 'Please join a team first.',
      'lob.youReady': 'You are ready.',
      'lob.youNotReady': 'You are not ready.',
      'lob.peerJoined': '{name} joined. {count} players in lobby.',
      'lob.peerLeft': '{name} left.',
      'lob.peerJoinedTeam': '{name} joined Team {n}.',
      'lob.peerReady': '{name} is ready.',
      'lob.peerNotReady': '{name} is not ready.',
      'lob.peerJoinedShort': '{name} joined.',
      'lob.hostDisconnected': 'Host disconnected. Returning to menu.',
      'lob.roomCode': 'Room code: {code}',
      'lob.playerN': 'Player {n}',
      'lob.team': 'Team {n}',
      'lob.noTeam': 'No team',
      'lob.youSuffix': ' (you)',
      'lob.readySuffix': ', ready',
      'lob.entry': '{name} — {team}{ready}{you}',
    },

    es: {
      'doc.title': 'Pong',

      'splash.aria': 'Bienvenida',
      'splash.menuAria': 'Menú principal',
      'splash.author': 'por guilevi',
      'splash.play': 'Jugar partida',
      'splash.multi': 'Multijugador',
      'splash.learn': 'Aprende los sonidos',
      'splash.language': 'Idioma',

      'game.aria': 'Juego',
      'game.newGame': 'Nueva partida',
      'game.scoreLimit': 'Puntos para ganar',
      'game.start': 'Empezar partida',
      'game.back': 'Volver al menú',
      'game.return': 'Volver al menú',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.ballRolling': 'Bola rodando',
      'learn.serveWarning': 'Aviso de pérdida de saque',
      'learn.back': 'Volver al menú principal',
      'learn.playing': 'Reproduciendo…',

      'lobby.aria': 'Sala multijugador',
      'lobby.playersAria': 'Jugadores',
      'lobby.create': 'Crear sala',
      'lobby.codeLabel': 'Código de sala (4 letras)',
      'lobby.codeAria': 'Código de sala de 4 letras',
      'lobby.join': 'Unirse a sala',
      'lobby.back': 'Atrás',
      'lobby.team1': 'Unirse al Equipo 1',
      'lobby.team2': 'Unirse al Equipo 2',
      'lobby.ready': 'Listo',
      'lobby.leave': 'Salir de la sala',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',

      'ann.youServe': 'Tú sacas. Tienes 3 segundos.',
      'ann.opponentServes': 'Saca {opponent}.',
      'ann.serveTransferYou': 'El saque pasa a ti. Tú sacas.',
      'ann.serveTransferOther': 'El saque pasa a {opponentLower}. Saca {opponent}.',
      'ann.goalYou': '¡Gol! Marcas tú. Marcador: {you} a {them}.',
      'ann.goalOther': '¡Gol! Marca {opponent}. Marcador: {you} a {them}.',
      'ann.gameOverWin': 'Fin de la partida. Ganas {you} a {them}.',
      'ann.gameOverLose': 'Fin de la partida. Gana {opponent} {them} a {you}.',
      'ann.opponent': 'Rival',
      'ann.computer': 'Ordenador',
      'ann.opponentLower': 'el rival',
      'ann.computerLower': 'el ordenador',

      'lob.enterCode': 'Introduce un código de sala de 4 letras.',
      'lob.allReady': 'Todos listos. Empezando en 3 segundos.',
      'lob.creating': 'Creando sala...',
      'lob.created': 'Sala creada. Código: {code}. Esperando jugadores.',
      'lob.createFailed': 'No se pudo crear la sala. Inténtalo de nuevo.',
      'lob.joining': 'Uniéndose a la sala {code}...',
      'lob.joined': 'Unido a la sala. Esperando lista de jugadores.',
      'lob.joinFailed': 'No se pudo unir a la sala. Comprueba el código.',
      'lob.youJoinedTeam': 'Te has unido al Equipo {n}.',
      'lob.joinTeamFirst': 'Únete primero a un equipo.',
      'lob.youReady': 'Estás listo.',
      'lob.youNotReady': 'No estás listo.',
      'lob.peerJoined': '{name} se ha unido. {count} jugadores en la sala.',
      'lob.peerLeft': '{name} se ha ido.',
      'lob.peerJoinedTeam': '{name} se ha unido al Equipo {n}.',
      'lob.peerReady': '{name} está listo.',
      'lob.peerNotReady': '{name} no está listo.',
      'lob.peerJoinedShort': '{name} se ha unido.',
      'lob.hostDisconnected': 'El anfitrión se ha desconectado. Volviendo al menú.',
      'lob.roomCode': 'Código de sala: {code}',
      'lob.playerN': 'Jugador {n}',
      'lob.team': 'Equipo {n}',
      'lob.noTeam': 'Sin equipo',
      'lob.youSuffix': ' (tú)',
      'lob.readySuffix': ', listo',
      'lob.entry': '{name} — {team}{ready}{you}',
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
