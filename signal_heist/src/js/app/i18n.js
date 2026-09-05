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
  const STORAGE_KEY = 'signal-heist.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Signal Heist',

      'menu.aria': 'Main menu',
      'menu.title': 'Signal Heist',
      'menu.subtitle': 'Steal the data, read the room by ear, and leave before security closes in.',
      'menu.start': 'Start Contract Run',
      'menu.highscores': 'High Scores',
      'menu.help': 'How to Play',
      'menu.learn': 'Learn Sounds',
      'menu.quit': 'Quit',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Signal Heist game',
      'gameover.aria': 'Run ended',
      'gameover.title': 'Run Ended',
      'gameover.subtitle': '{reason} Score {score}. Reached contract {contract}. Loot {loot}.',
      'gameover.reasonCaught': 'Captured by security.',
      'gameover.reasonTrace': 'Trace lock completed.',
      'gameover.namePrompt': 'Enter your name to post your score:',
      'gameover.namePlaceholder': 'Operator',
      'gameover.nameFallback': 'Operator',
      'gameover.nameRequired': 'Enter a name before posting.',
      'gameover.submit': 'Post Score',
      'gameover.skip': 'Skip',
      'gameover.again': 'Run Again',
      'gameover.menu': 'Main Menu',

      'highscores.aria': 'High scores',
      'highscores.title': 'High Scores',
      'highscores.subtitleLocal': 'Top runs on this device.',
      'highscores.subtitleLoading': 'Loading the world leaderboard...',
      'highscores.subtitleOnline': 'World leaderboard.',
      'highscores.empty': 'No local scores yet.',
      'highscores.onlineEmpty': 'No online scores yet.',
      'highscores.row': '{rank}. {name}, {score} points, contract {contract}, loot {loot}, ghost passes {ghosts}',
      'highscores.back': 'Back',

      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.intro': 'Signal Heist is an audio-first stealth score chase. Each contract asks you to collect every data cache, reach the exit beacon, and survive the next harder floor.',
      'help.move': '<kbd>Up</kbd>/<kbd>W</kbd> move forward, <kbd>Down</kbd>/<kbd>S</kbd> back up, <kbd>A</kbd>/<kbd>D</kbd> strafe, and <kbd>Left</kbd>/<kbd>Right</kbd> or <kbd>Q</kbd>/<kbd>E</kbd> turn. Hold <kbd>Shift</kbd> or gamepad face button 3 to sprint.',
      'help.jam': '<kbd>Space</kbd>, <kbd>Enter</kbd>, <kbd>F</kbd>, or the main gamepad button fires a signal jammer. It disables nearby guards and cameras for a few seconds, but costs score and breaks a perfect contract.',
      'help.goal': 'Uncollected data caches emit glassy spatial tones. After the last cache, the exit beacon comes alive. Follow it and leave.',
      'help.stealth': 'Guards have footsteps and low radio cloth noise. Cameras have a thin motor hum. If you pass close without being seen, the music opens briefly and you earn a ghost-pass bonus.',
      'help.heat': 'The darker the music gets, the closer you are to capture. A heartbeat means danger. A rising scream means security is nearly on top of you.',
      'help.statusKeys': '<kbd>F1</kbd> score, <kbd>F2</kbd> contract, <kbd>F3</kbd> objective, <kbd>F4</kbd> nearest threat, <kbd>F5</kbd> heat, <kbd>F6</kbd> tools, <kbd>F7</kbd> position.',
      'help.scoring': 'Score comes from stolen caches, contract-clear bonuses, time left, perfect contracts, and ghost passes. Jammers are useful, but they reduce score.',
      'help.back': 'Back',

      'learn.aria': 'Learn sounds',
      'learn.title': 'Learn Sounds',
      'learn.subtitle': 'Audition the important cues before you enter the building.',
      'learn.guard': 'Guard footsteps',
      'learn.camera': 'Camera alert motor',
      'learn.cache': 'Data cache',
      'learn.exit': 'Exit beacon',
      'learn.jam': 'Signal jammer',
      'learn.sneak': 'Clean sneak-past music',
      'learn.nearCaught': 'Almost caught',
      'learn.caught': 'Captured',
      'learn.contract': 'Perfect contract clear',
      'learn.musicLow': 'Low-tension music layer',
      'learn.musicHigh': 'High-tension music layer',
      'learn.back': 'Back',

      'hud.score': 'Score {score}',
      'hud.contract': 'Contract {number}: {name}',
      'hud.loot': 'Loot {taken}/{total}',
      'hud.heat': 'Heat {heat}%',
      'hud.jammers': 'Jammers {jammers}',
      'hud.status': 'Trace {time}s. Stamina {stamina}%.',

      'objective.cache': 'data cache',
      'objective.exit': 'exit',
      'threat.guard': 'guard',
      'threat.camera': 'camera',

      'ann.cache': 'Data stolen. {points} points.',
      'ann.contractComplete': 'Contract cleared: {name}. Bonus {bonus}.',
      'ann.contractPerfect': 'Perfect contract cleared: {name}. Bonus {bonus}.',
      'ann.contractStart': 'Contract: {name}.',
      'ann.contractStatus': 'Contract {number}: {name}. Trace time {time} seconds.',
      'ann.gameOver': 'Run ended. Score {score}.',
      'ann.guardAlert': 'Guard heard you.',
      'ann.heat': 'Heat {heat} percent.',
      'ann.jam': 'Jammer fired. {affected} systems disabled.',
      'ann.jamEmpty': 'No jammers left.',
      'ann.nearCaught': 'Security is about to catch you.',
      'ann.noThreat': 'No active threat.',
      'ann.objective': 'Nearest {type}, {distance} meters.',
      'ann.onlineError': 'Online score posting failed.',
      'ann.onlineRank': 'Posted online. Rank {rank}.',
      'ann.playing': 'Playing {label}.',
      'ann.position': 'Position {x}, {y}.',
      'ann.score': 'Score {score}. Loot {loot}. Contracts cleared {contracts}.',
      'ann.sneakPast': 'Clean pass. Combo {combo}. {points} points.',
      'ann.threat': 'Nearest {type}, {distance} meters.',
      'ann.tools': '{jammers} jammers. Stamina {stamina} percent.',

      'online.posting': 'Posting score...',
      'online.rank': 'Posted. World rank {rank}.',
      'online.error': 'Online posting failed. Local score was saved.',
      'online.viewBoard': 'View the world leaderboard',

      'contract.blackoutLobby': 'Blackout Lobby',
      'contract.archiveSpine': 'Archive Spine',
      'contract.coldServer': 'Cold Server',
      'contract.mirrorHall': 'Mirror Hall',
      'contract.glassVault': 'Glass Vault',
      'contract.deadSwitch': 'Dead Switch',
      'contract.redElevator': 'Red Elevator',
      'contract.nightLedger': 'Night Ledger',
      'contract.needleFloor': 'Needle Floor',
      'contract.blackSite': 'Black Site',
      'contract.quietMoney': 'Quiet Money',
      'contract.panicRoom': 'Panic Room',
      'contract.basementNine': 'Basement Nine',
      'contract.zeroWing': 'Zero Wing',
      'contract.ashenCore': 'Ashen Core',
      'contract.whiteNoise': 'White Noise',
      'contract.finalHandshake': 'Final Handshake',
      'contract.deepBlack': 'Deep Black',
      'contract.deepBlackLoop': 'Deep Black {number}',
    },

    es: {
      'doc.title': 'Signal Heist',

      'menu.aria': 'Menú principal',
      'menu.title': 'Signal Heist',
      'menu.subtitle': 'Roba los datos, lee la sala de oído y sal antes de que cierre seguridad.',
      'menu.start': 'Empezar contratos',
      'menu.highscores': 'Puntuaciones',
      'menu.help': 'Cómo jugar',
      'menu.learn': 'Aprender sonidos',
      'menu.quit': 'Salir',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Juego Signal Heist',
      'gameover.aria': 'Partida terminada',
      'gameover.title': 'Partida terminada',
      'gameover.subtitle': '{reason} Puntuación {score}. Llegaste al contrato {contract}. Botín {loot}.',
      'gameover.reasonCaught': 'Seguridad te ha capturado.',
      'gameover.reasonTrace': 'El rastreo se ha completado.',
      'gameover.namePrompt': 'Escribe tu nombre para publicar la puntuación:',
      'gameover.namePlaceholder': 'Operador',
      'gameover.nameFallback': 'Operador',
      'gameover.nameRequired': 'Escribe un nombre antes de publicar.',
      'gameover.submit': 'Publicar puntuación',
      'gameover.skip': 'Saltar',
      'gameover.again': 'Jugar otra vez',
      'gameover.menu': 'Menú principal',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitleLocal': 'Mejores partidas en este dispositivo.',
      'highscores.subtitleLoading': 'Cargando la clasificación mundial...',
      'highscores.subtitleOnline': 'Clasificación mundial.',
      'highscores.empty': 'Aún no hay puntuaciones locales.',
      'highscores.onlineEmpty': 'Aún no hay puntuaciones en línea.',
      'highscores.row': '{rank}. {name}, {score} puntos, contrato {contract}, botín {loot}, pasos fantasma {ghosts}',
      'highscores.back': 'Atrás',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.intro': 'Signal Heist es un juego de sigilo audio-first y puntuación. En cada contrato tienes que recoger todos los datos, llegar a la baliza de salida y sobrevivir al siguiente piso.',
      'help.move': '<kbd>Arriba</kbd>/<kbd>W</kbd> avanza, <kbd>Abajo</kbd>/<kbd>S</kbd> retrocede, <kbd>A</kbd>/<kbd>D</kbd> desplaza lateralmente, y <kbd>Izquierda</kbd>/<kbd>Derecha</kbd> o <kbd>Q</kbd>/<kbd>E</kbd> giran. Mantén <kbd>Shift</kbd> o el botón 3 del mando para correr.',
      'help.jam': '<kbd>Espacio</kbd>, <kbd>Intro</kbd>, <kbd>F</kbd>, o el botón principal del mando dispara un inhibidor. Desactiva guardias y cámaras cercanos durante unos segundos, pero cuesta puntos y rompe el contrato perfecto.',
      'help.goal': 'Los datos sin recoger emiten tonos espaciales cristalinos. Al recogerlos todos, se activa la baliza de salida. Síguela y escapa.',
      'help.stealth': 'Los guardias tienen pasos y ruido bajo de radio y ropa. Las cámaras tienen un zumbido fino de motor. Si pasas cerca sin que te vean, la música se abre un momento y ganas un bonus de paso fantasma.',
      'help.heat': 'Cuanto más oscura se vuelve la música, más cerca estás de caer. Un latido significa peligro. Un grito ascendente significa que seguridad casi te tiene.',
      'help.statusKeys': '<kbd>F1</kbd> puntuación, <kbd>F2</kbd> contrato, <kbd>F3</kbd> objetivo, <kbd>F4</kbd> amenaza cercana, <kbd>F5</kbd> calor, <kbd>F6</kbd> herramientas, <kbd>F7</kbd> posición.',
      'help.scoring': 'Ganas puntos por datos robados, contratos completados, tiempo restante, contratos perfectos y pasos fantasma. Los inhibidores ayudan, pero restan puntuación.',
      'help.back': 'Atrás',

      'learn.aria': 'Aprender sonidos',
      'learn.title': 'Aprender sonidos',
      'learn.subtitle': 'Escucha las señales importantes antes de entrar.',
      'learn.guard': 'Pasos de guardia',
      'learn.camera': 'Motor de cámara',
      'learn.cache': 'Datos',
      'learn.exit': 'Baliza de salida',
      'learn.jam': 'Inhibidor',
      'learn.sneak': 'Música de sigilo limpio',
      'learn.nearCaught': 'Casi capturado',
      'learn.caught': 'Capturado',
      'learn.contract': 'Contrato perfecto',
      'learn.musicLow': 'Música con poca tensión',
      'learn.musicHigh': 'Música con mucha tensión',
      'learn.back': 'Atrás',

      'hud.score': 'Puntos {score}',
      'hud.contract': 'Contrato {number}: {name}',
      'hud.loot': 'Botín {taken}/{total}',
      'hud.heat': 'Calor {heat}%',
      'hud.jammers': 'Inhibidores {jammers}',
      'hud.status': 'Rastreo {time}s. Resistencia {stamina}%.',

      'objective.cache': 'datos',
      'objective.exit': 'salida',
      'threat.guard': 'guardia',
      'threat.camera': 'cámara',

      'ann.cache': 'Datos robados. {points} puntos.',
      'ann.contractComplete': 'Contrato completado: {name}. Bonus {bonus}.',
      'ann.contractPerfect': 'Contrato perfecto completado: {name}. Bonus {bonus}.',
      'ann.contractStart': 'Contrato: {name}.',
      'ann.contractStatus': 'Contrato {number}: {name}. Tiempo de rastreo {time} segundos.',
      'ann.gameOver': 'Partida terminada. Puntuación {score}.',
      'ann.guardAlert': 'Un guardia te ha oído.',
      'ann.heat': 'Calor {heat} por ciento.',
      'ann.jam': 'Inhibidor disparado. {affected} sistemas desactivados.',
      'ann.jamEmpty': 'No quedan inhibidores.',
      'ann.nearCaught': 'Seguridad está a punto de capturarte.',
      'ann.noThreat': 'No hay amenaza activa.',
      'ann.objective': '{type} más cercano, {distance} metros.',
      'ann.onlineError': 'No se pudo publicar en línea.',
      'ann.onlineRank': 'Publicado en línea. Puesto {rank}.',
      'ann.playing': 'Reproduciendo {label}.',
      'ann.position': 'Posición {x}, {y}.',
      'ann.score': 'Puntuación {score}. Botín {loot}. Contratos completados {contracts}.',
      'ann.sneakPast': 'Paso limpio. Combo {combo}. {points} puntos.',
      'ann.threat': '{type} más cercano, {distance} metros.',
      'ann.tools': '{jammers} inhibidores. Resistencia {stamina} por ciento.',

      'online.posting': 'Publicando puntuación...',
      'online.rank': 'Publicado. Puesto mundial {rank}.',
      'online.error': 'No se pudo publicar en línea. La puntuación local se guardó.',
      'online.viewBoard': 'Ver clasificación mundial',
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
