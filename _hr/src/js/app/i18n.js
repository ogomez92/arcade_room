/**
 * Lightweight i18n for the horse race. Same shape as the rest of the
 * collection (bumper/pong/pacman/tennis/...). EN + ES; localStorage
 * key 'horserace.lang' so locale doesn't leak between games hosted on
 * the same origin.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'horserace.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Horse Race!',

      // Splash
      'splash.author': 'an audio race',
      'splash.instruction': 'Press any key to begin',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Horse Race',
      'menu.subtitle': 'Choose a mode',
      'menu.single': 'Single Player',
      'menu.multi': 'Multiplayer',
      'menu.help': 'How to Play',
      'menu.learn': 'Learn the Sounds',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.intro': 'You ride a horse against rivals on a 1-kilometre track.',
      'help.whip': '<kbd>Space</kbd> — whip your horse to push it faster. Each whip costs stamina.',
      'help.jump': '<kbd>Up Arrow</kbd> — jump. You will hear approaching fences as a low pulsing tone ahead. Jump too early or too late and the horse crashes.',
      'help.stamina': 'Whip too much and stamina drops; the horse slows. Stop whipping to recover. Whipping a tired horse is wasteful and costs more.',
      'help.spatial': 'Other horses are heard around you. Horses ahead sound clear and in front; horses behind sound muffled.',
      'help.f1': '<kbd>F1</kbd> — current position and gap to the nearest horse ahead/behind.',
      'help.f2': '<kbd>F2</kbd> — your stamina and speed.',
      'help.f3': '<kbd>F3</kbd> — distance to the next jump.',
      'help.f4': '<kbd>F4</kbd> — distance remaining and elapsed time.',
      'help.score': 'Score is built from finishing position, clean and perfect jumps, average stamina kept, average speed, and finish time. Crashes lose points.',
      'help.back': 'Back',

      // Learn (sound test)
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the Sounds',
      'learn.subtitle': 'Press a button to hear each sound by itself.',
      'learn.front': 'Tick from the front',
      'learn.right': 'Tick from the right',
      'learn.behind': 'Tick from behind',
      'learn.left': 'Tick from the left',
      'learn.hooves': 'A galloping horse beside you',
      'learn.hoovesAhead': 'A horse ahead of you',
      'learn.hoovesBehind': 'A horse behind you (muffled)',
      'learn.whip': 'Whip crack',
      'learn.jump': 'Jump whoosh',
      'learn.crash': 'Crash thud',
      'learn.fence': 'Approaching fence beacon',
      'learn.bell': 'Finish bell',
      'learn.gun': 'Start gun',
      'learn.back': 'Back',

      // Lobby
      'lobby.aria': 'Multiplayer lobby',
      'lobby.title': 'Multiplayer',
      'lobby.subtitle': 'Create a room or join one with a code.',
      'lobby.create': 'Create Room',
      'lobby.codeLabel': 'Room code',
      'lobby.join': 'Join Room',
      'lobby.start': 'Start Race',
      'lobby.leave': 'Leave Room',
      'lobby.back': 'Back',
      'lobby.players1': '1 player in room. Waiting for more…',
      'lobby.players2': '{n} players in room.',
      'lobby.created': 'Room created. Code is {code}.',
      'lobby.joined': 'Joined room {code}.',
      'lobby.opponentJoined': 'Player joined:',
      'lobby.opponentLeft': 'A player left.',
      'lobby.notHost': 'Only the host can start the race.',
      'lobby.notEnough': 'Need at least 2 players.',
      'lobby.starting': 'Starting race…',
      'lobby.error': 'Error: {message}',
      'lobby.libUnavailable': 'Multiplayer unavailable: networking library failed to load.',
      'lobby.hostLeft': 'The host left the room.',
      'lobby.fillAi': 'Fill empty slots with AI horses',

      // Game HUD / shared
      'game.aria': 'Race in progress',
      'game.pause': 'Race paused. Press Escape again to leave, or any other key to resume.',
      'game.leave': 'Leaving race.',

      // Gameover
      'gameover.aria': 'Race over',
      'gameover.title': 'Race Over',
      'gameover.again': 'Race Again',
      'gameover.menu': 'Main Menu',
      'gameover.you': 'You finished {rank} of {total} with {score} points.',
      'gameover.you.dnf': 'You did not finish.',
      'gameover.results': 'Final standings',
      'gameover.row': '{rank}. {name} — {score} points (clean {clean}, perfect {perfect}, crashes {crashes})',

      // Announcer — countdown / start / finish
      'ann.countdown3': 'Three.',
      'ann.countdown2': 'Two.',
      'ann.countdown1': 'One.',
      'ann.go': 'Go!',
      'ann.you': 'You',
      'ann.opponent': 'Opponent',
      'ann.rank1': 'first',
      'ann.rank2': 'second',
      'ann.rank3': 'third',
      'ann.rank4': 'fourth',
      'ann.rank5': 'fifth',
      'ann.rank6': 'sixth',

      // Stamina ticks
      'ann.staminaFull': 'Stamina full.',
      'ann.staminaHigh': 'Stamina high.',
      'ann.staminaMid': 'Stamina half.',
      'ann.staminaLow': 'Stamina low!',
      'ann.staminaCritical': 'Horse is gasping!',

      // Position
      'ann.posRank': 'You are {rank} of {total}.',
      'ann.posAhead': '{name} is {m} metres ahead.',
      'ann.posBehind': '{name} is {m} metres behind.',

      // Stat readouts
      'ann.staminaSpeed': 'Stamina {stam} percent. Speed {speed} metres per second.',
      'ann.nextObstacle': 'Next fence in {m} metres.',
      'ann.noMoreObstacles': 'No more fences.',
      'ann.progress': '{m} metres to go. Time {t} seconds.',

      // Overtake
      'ann.overtake': 'You passed {name}. Now {rank} of {total}.',
      'ann.advance': 'You moved up to {rank} of {total}.',
      'ann.overtaken': '{name} passed you. Now {rank} of {total}.',
      'ann.fallback': 'You dropped to {rank} of {total}.',

      // Jumps
      'ann.jumpPerfect': 'Perfect jump!',
      'ann.jumpClean': 'Clean jump.',
      'ann.jumpCrashYou': 'You crashed into the fence!',
      'ann.jumpCrashThem': '{name} crashed.',
      'ann.jumpWasted': 'Jumped early. Save your jumps for fences.',
      'ann.jumpNoFence': 'No fence ahead.',

      // Finish
      'ann.finishYou': 'You finished {rank}!',
      'ann.finishThem': '{name} finished {rank}.',
    },

    es: {
      // <head>
      'doc.title': '¡Carrera de Caballos!',

      // Splash
      'splash.author': 'una carrera sonora',
      'splash.instruction': 'Pulsa cualquier tecla para empezar',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'Carrera de Caballos',
      'menu.subtitle': 'Elige un modo',
      'menu.single': 'Un jugador',
      'menu.multi': 'Multijugador',
      'menu.help': 'Cómo jugar',
      'menu.learn': 'Aprende los sonidos',

      // Help
      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.intro': 'Montas un caballo en una pista de un kilómetro contra rivales.',
      'help.whip': '<kbd>Espacio</kbd> — fustiga al caballo para acelerar. Cada fustazo gasta resistencia.',
      'help.jump': '<kbd>Flecha arriba</kbd> — salta. Las vallas suenan como un tono pulsante grave que se acerca por delante. Si saltas muy pronto o muy tarde, el caballo se estrella.',
      'help.stamina': 'Si fustigas demasiado, la resistencia baja y el caballo frena. Para recuperar, deja de fustigar. Fustigar a un caballo cansado es inútil y cuesta más.',
      'help.spatial': 'Oirás a los demás caballos a tu alrededor. Los que van delante suenan claros y al frente; los de detrás suenan amortiguados.',
      'help.f1': '<kbd>F1</kbd> — tu posición y la distancia con el caballo más cercano por delante o detrás.',
      'help.f2': '<kbd>F2</kbd> — tu resistencia y velocidad.',
      'help.f3': '<kbd>F3</kbd> — distancia hasta el próximo salto.',
      'help.f4': '<kbd>F4</kbd> — distancia restante y tiempo transcurrido.',
      'help.score': 'La puntuación combina la posición final, los saltos limpios y perfectos, la resistencia media, la velocidad media y el tiempo. Los choques restan puntos.',
      'help.back': 'Atrás',

      // Learn
      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Pulsa un botón para oír cada sonido por separado.',
      'learn.front': 'Tic desde delante',
      'learn.right': 'Tic desde la derecha',
      'learn.behind': 'Tic desde detrás',
      'learn.left': 'Tic desde la izquierda',
      'learn.hooves': 'Caballo galopando a tu lado',
      'learn.hoovesAhead': 'Caballo por delante',
      'learn.hoovesBehind': 'Caballo por detrás (amortiguado)',
      'learn.whip': 'Restallido del látigo',
      'learn.jump': 'Salto',
      'learn.crash': 'Choque',
      'learn.fence': 'Baliza de valla cercana',
      'learn.bell': 'Campana de meta',
      'learn.gun': 'Pistola de salida',
      'learn.back': 'Atrás',

      // Lobby
      'lobby.aria': 'Sala multijugador',
      'lobby.title': 'Multijugador',
      'lobby.subtitle': 'Crea una sala o únete con un código.',
      'lobby.create': 'Crear sala',
      'lobby.codeLabel': 'Código de sala',
      'lobby.join': 'Unirse',
      'lobby.start': 'Empezar carrera',
      'lobby.leave': 'Salir',
      'lobby.back': 'Atrás',
      'lobby.players1': 'Hay 1 jugador en la sala. Esperando más…',
      'lobby.players2': '{n} jugadores en la sala.',
      'lobby.created': 'Sala creada. Código {code}.',
      'lobby.joined': 'Te uniste a la sala {code}.',
      'lobby.opponentJoined': 'Se unió un jugador:',
      'lobby.opponentLeft': 'Un jugador se fue.',
      'lobby.notHost': 'Solo el anfitrión puede empezar.',
      'lobby.notEnough': 'Hacen falta al menos 2 jugadores.',
      'lobby.starting': 'Empezando la carrera…',
      'lobby.error': 'Error: {message}',
      'lobby.libUnavailable': 'Multijugador no disponible: la red no cargó.',
      'lobby.hostLeft': 'El anfitrión se fue.',
      'lobby.fillAi': 'Rellenar huecos con caballos IA',

      // Game HUD
      'game.aria': 'Carrera en curso',
      'game.pause': 'Carrera en pausa. Pulsa Escape de nuevo para salir o cualquier otra tecla para continuar.',
      'game.leave': 'Saliendo de la carrera.',

      // Gameover
      'gameover.aria': 'Carrera terminada',
      'gameover.title': 'Carrera terminada',
      'gameover.again': 'Otra carrera',
      'gameover.menu': 'Menú principal',
      'gameover.you': 'Acabaste en posición {rank} de {total} con {score} puntos.',
      'gameover.you.dnf': 'No terminaste la carrera.',
      'gameover.results': 'Clasificación final',
      'gameover.row': '{rank}. {name} — {score} puntos (limpios {clean}, perfectos {perfect}, choques {crashes})',

      // Announcer — countdown
      'ann.countdown3': 'Tres.',
      'ann.countdown2': 'Dos.',
      'ann.countdown1': 'Uno.',
      'ann.go': '¡Ya!',
      'ann.you': 'Tú',
      'ann.opponent': 'Rival',
      'ann.rank1': 'primero',
      'ann.rank2': 'segundo',
      'ann.rank3': 'tercero',
      'ann.rank4': 'cuarto',
      'ann.rank5': 'quinto',
      'ann.rank6': 'sexto',

      'ann.staminaFull': 'Resistencia al máximo.',
      'ann.staminaHigh': 'Resistencia alta.',
      'ann.staminaMid': 'Resistencia a la mitad.',
      'ann.staminaLow': '¡Resistencia baja!',
      'ann.staminaCritical': '¡El caballo está agotado!',

      'ann.posRank': 'Vas {rank} de {total}.',
      'ann.posAhead': '{name} va {m} metros por delante.',
      'ann.posBehind': '{name} va {m} metros por detrás.',

      'ann.staminaSpeed': 'Resistencia {stam} por ciento. Velocidad {speed} metros por segundo.',
      'ann.nextObstacle': 'Próxima valla en {m} metros.',
      'ann.noMoreObstacles': 'No quedan vallas.',
      'ann.progress': 'Quedan {m} metros. Tiempo {t} segundos.',

      'ann.overtake': '¡Adelantaste a {name}! Ahora vas {rank} de {total}.',
      'ann.advance': 'Subiste al puesto {rank} de {total}.',
      'ann.overtaken': '{name} te adelantó. Vas {rank} de {total}.',
      'ann.fallback': 'Bajaste al puesto {rank} de {total}.',

      'ann.jumpPerfect': '¡Salto perfecto!',
      'ann.jumpClean': 'Salto limpio.',
      'ann.jumpCrashYou': '¡Chocaste contra la valla!',
      'ann.jumpCrashThem': '{name} chocó.',
      'ann.jumpWasted': 'Saltaste sin valla. Guarda los saltos.',
      'ann.jumpNoFence': 'No hay valla por delante.',

      'ann.finishYou': '¡Acabaste {rank}!',
      'ann.finishThem': '{name} acabó {rank}.',
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
    t, applyDom, setLocale,
    locale: () => current,
    available: () => Object.keys(dictionaries).map((id) => ({id, name: localeNames[id] || id})),
    localeName: (id) => localeNames[id] || id,
    onChange, detect,
  }
})()
