/**
 * Lightweight i18n for accessible audio games. See bumper/template for the
 * canonical implementation; only the STORAGE_KEY and dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'pinball.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Audio Pinball',

      // Game
      'game.aria': 'Pinball Table',
      'game.score': 'Score',
      'game.rank': 'Rank',
      'game.balls': 'Balls',
      'game.mission': 'Mission',
      'game.legend': 'Z / Left Shift = left flipper. M / Right Shift = right flipper. Space = launch / nudge. P = position read-out. Esc = pause.',

      // Splash
      'splash.aria': 'Audio Pinball main menu',
      'splash.menuAria': 'Main menu',
      'splash.tagline': 'Space Cadet, by ear.',
      'splash.start': 'Start Game',
      'splash.help': 'How to Play',
      'splash.learn': 'Learn the Sounds',
      'splash.language': 'Language',
      'splash.author': 'a syngen template demo',

      // Splash announcement
      'splash.announce': 'Audio Pinball main menu. Use Tab or arrow keys to move, Enter or Space to choose.',

      // Language
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',

      // Learn screen
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the Sounds',
      'learn.subtitle': 'Tab or arrow keys to move between sounds. Enter or Space to play. Press Escape to return to the menu.',
      'learn.ball': 'Ball',
      'learn.bumpers': 'Bumpers',
      'learn.slings': 'Slingshots',
      'learn.targets': 'Drop targets',
      'learn.rollovers': 'Rollover lanes',
      'learn.flippers': 'Flippers',
      'learn.plunger': 'Plunger and walls',
      'learn.gameEvents': 'Game events',
      'learn.back': 'Back to menu',
      'learn.rollSlow': 'Ball rolling, slow, centre',
      'learn.rollFast': 'Ball rolling, fast, centre',
      'learn.rollLeft': 'Ball rolling on the left side',
      'learn.rollRight': 'Ball rolling on the right side',
      'learn.rollFar': 'Ball rolling far up the table (high pitch)',
      'learn.ballReady': 'Ball ready chime',
      'learn.bumperAlpha': 'Alpha bumper, upper left, high pitch',
      'learn.bumperBeta': 'Beta bumper, upper right, mid pitch',
      'learn.bumperGamma': 'Gamma bumper, top centre, low pitch',
      'learn.slingLeft': 'Left slingshot',
      'learn.slingRight': 'Right slingshot',
      'learn.targetT1': 'Target one (left, C5)',
      'learn.targetT2': 'Target two (centre, E5)',
      'learn.targetT3': 'Target three (right, G5)',
      'learn.rolloverR1': 'Far left rollover, lowest',
      'learn.rolloverR2': 'Inner left rollover',
      'learn.rolloverR3': 'Inner right rollover',
      'learn.rolloverR4': 'Far right rollover, highest',
      'learn.flapLeft': 'Left flipper button press',
      'learn.flapRight': 'Right flipper button press',
      'learn.flipperHitLeft': 'Ball striking the left flipper',
      'learn.flipperHitRight': 'Ball striking the right flipper',
      'learn.proxLeft': 'Proximity beep, ball approaching left flipper',
      'learn.proxRight': 'Proximity beep, ball approaching right flipper',
      'learn.proxUpper': 'Proximity beep, ball approaching upper flipper',
      'learn.plungerCharge': 'Plunger charging tick',
      'learn.plungerLaunch': 'Plunger launch',
      'learn.wall': 'Ball striking a wall',
      'learn.missionComplete': 'Mission complete fanfare',
      'learn.rankUp': 'Rank promotion fanfare',
      'learn.drain': 'Drain (lost ball)',
      'learn.gameOver': 'Game over',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.controls': 'Controls',
      'help.controlZ': '<strong>Z</strong> or <strong>Left Shift</strong> — left flipper (also drives the upper-left mini-flipper).',
      'help.controlM': '<strong>M</strong> or <strong>Right Shift</strong> — right flipper.',
      'help.controlSpace': '<strong>Space</strong> — hold to pull the plunger, release to launch.',
      'help.controlP': '<strong>P</strong> — speak the ball\'s current position (side and depth).',
      'help.controlEscape': '<strong>Escape</strong> — pause during play, or return to the menu from this screen.',
      'help.controlQ': '<strong>Q</strong> from pause — quit to the title screen.',
      'help.audioHeader': 'How the audio works',
      'help.audio1': 'The listener is locked at the bottom of the table, facing up — as if you were sitting behind the machine. The ball is always in front of you and never behind. Left-right pan tells you which side of the table the ball is on. Quieter sounds are further away.',
      'help.audio2': 'A continuous rolling sound follows the ball as it travels. The faster the ball moves, the louder and brighter the rumble. A pitched undertone rises the further up the table the ball travels — low when it\'s near the flippers, high near the bumpers — so distance is encoded as pitch as well as volume.',
      'help.audio3': 'When the ball heads toward a flipper, a square-wave proximity beep starts up, panned to that flipper\'s side. The beep gets faster and higher as the ball gets closer — that\'s your cue to time the flip.',
      'help.audio4': 'Each bumper, target, and rollover lane has its own pitch, so a quick listen tells you which one was struck. Pick "Learn the Sounds" from the main menu to hear them all in isolation.',
      'help.goalsHeader': 'Goals',
      'help.goals': 'You have three balls. Score points by hitting bumpers, slingshots, drop targets, and rolling through the lanes at the top. A queue of missions guides what to aim for; complete them for big bonuses. Score enough and your rank rises from Cadet through Fleet Admiral. Drain all three balls and the game ends.',
      'help.back': 'Back to menu',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.body': 'Press Escape to resume. Press Q to quit to the title screen.',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game Over',
      'gameover.summary': 'Final score: {score}. Final rank: {rank}.',
      'gameover.body': 'Press Space or Enter to play again. Press Escape to return to the title screen.',

      // Runtime announcements
      'ann.pauseEnter': 'Paused. Press Escape or P to resume. Press Q to quit to title.',
      'ann.helpEnter': 'How to play. Tab through the text and the back button at the bottom, or press Escape to return to the menu.',
      'ann.learnEnter': 'Learn the sounds. Tab or arrow keys to move, Enter or Space to play. Escape to return.',
      'ann.resumed': 'Resumed.',
      'ann.promotedTo': 'Promoted to {rank}.',
      'ann.ballReady': 'Ball {n} ready. Press space to pull the plunger; release to launch.',
      'ann.gameStart': 'Game start. Three balls. Mission: {mission}.',
      'ann.gameOver': 'Game over. Final score {score}. Final rank {rank}.',
      'ann.missionComplete': 'Mission complete: {mission}. Bonus {reward}.',
      'ann.newMission': 'New mission: {mission}.',
      'ann.allMissions': 'All missions complete! Bonus multiplier engaged.',
      'ann.targetDown': '{label} down.',
      'ann.label': '{label}.',
      'ann.targetsReset': 'Targets reset.',
      'ann.ballRearmed': 'Ball returned to plunger. Press space to launch again.',
      'ann.drain1': 'Drain. 1 ball left.',
      'ann.drainN': 'Drain. {balls} balls left.',
      'ann.lastDrain': 'Last ball drained.',
      'ann.plungerPulling': 'Plunger pulling.',
      'ann.ballLaunched': 'Ball launched.',
      'ann.ballNotInPlay': 'Ball not in play.',
      'ann.ballPosition': 'Ball {side}, {depth}.',

      // Position labels
      'pos.farLeft': 'far left',
      'pos.left': 'left',
      'pos.right': 'right',
      'pos.farRight': 'far right',
      'pos.center': 'center',
      'pos.nearDrain': 'near drain',
      'pos.lower': 'lower',
      'pos.midTable': 'mid table',
      'pos.upper': 'upper',
      'pos.top': 'top',

      // Ranks
      'rank.cadet': 'Cadet',
      'rank.ensign': 'Ensign',
      'rank.lieutenant': 'Lieutenant',
      'rank.commander': 'Commander',
      'rank.captain': 'Captain',
      'rank.commodore': 'Commodore',
      'rank.rearAdmiral': 'Rear Admiral',
      'rank.viceAdmiral': 'Vice Admiral',
      'rank.admiral': 'Admiral',
      'rank.fleetAdmiral': 'Fleet Admiral',

      // Missions
      'mission.m1': 'Hit all three drop targets',
      'mission.m2': 'Twenty bumper hits',
      'mission.m3': 'Cross every rollover lane',
      'mission.m4': 'Light all targets again',
      'mission.m5': 'Score thirty thousand without draining',

      // Bumper / target labels
      'label.alphaBumper': 'alpha bumper',
      'label.betaBumper': 'beta bumper',
      'label.gammaBumper': 'gamma bumper',
      'label.targetOne': 'target one',
      'label.targetTwo': 'target two',
      'label.targetThree': 'target three',
      'label.leftRollover': 'left rollover',
      'label.innerLeftRollover': 'inner left rollover',
      'label.innerRightRollover': 'inner right rollover',
      'label.rightRollover': 'right rollover',
    },

    es: {
      'doc.title': 'Audio Pinball',

      'game.aria': 'Mesa de pinball',
      'game.score': 'Puntos',
      'game.rank': 'Rango',
      'game.balls': 'Bolas',
      'game.mission': 'Misión',
      'game.legend': 'Z / Mayús izquierdo = aleta izquierda. M / Mayús derecho = aleta derecha. Espacio = lanzar / golpe. P = leer posición. Esc = pausa.',

      'splash.aria': 'Menú principal de Audio Pinball',
      'splash.menuAria': 'Menú principal',
      'splash.tagline': 'Space Cadet, de oído.',
      'splash.start': 'Empezar partida',
      'splash.help': 'Cómo se juega',
      'splash.learn': 'Aprende los sonidos',
      'splash.language': 'Idioma',
      'splash.author': 'demo de la plantilla syngen',

      'splash.announce': 'Menú principal de Audio Pinball. Usa Tab o las flechas para moverte, Enter o Espacio para elegir.',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Tab o flechas para moverte entre sonidos. Enter o Espacio para reproducir. Pulsa Escape para volver al menú.',
      'learn.ball': 'Bola',
      'learn.bumpers': 'Bumpers',
      'learn.slings': 'Tiradores',
      'learn.targets': 'Dianas',
      'learn.rollovers': 'Carriles de paso',
      'learn.flippers': 'Aletas',
      'learn.plunger': 'Lanzador y paredes',
      'learn.gameEvents': 'Eventos de juego',
      'learn.back': 'Volver al menú',
      'learn.rollSlow': 'Bola rodando, lenta, centro',
      'learn.rollFast': 'Bola rodando, rápida, centro',
      'learn.rollLeft': 'Bola rodando por la izquierda',
      'learn.rollRight': 'Bola rodando por la derecha',
      'learn.rollFar': 'Bola rodando arriba (tono alto)',
      'learn.ballReady': 'Campanilla de bola lista',
      'learn.bumperAlpha': 'Bumper alfa, arriba a la izquierda, agudo',
      'learn.bumperBeta': 'Bumper beta, arriba a la derecha, medio',
      'learn.bumperGamma': 'Bumper gamma, arriba en el centro, grave',
      'learn.slingLeft': 'Tirador izquierdo',
      'learn.slingRight': 'Tirador derecho',
      'learn.targetT1': 'Diana uno (izquierda, do5)',
      'learn.targetT2': 'Diana dos (centro, mi5)',
      'learn.targetT3': 'Diana tres (derecha, sol5)',
      'learn.rolloverR1': 'Carril extremo izquierdo, el más grave',
      'learn.rolloverR2': 'Carril interior izquierdo',
      'learn.rolloverR3': 'Carril interior derecho',
      'learn.rolloverR4': 'Carril extremo derecho, el más agudo',
      'learn.flapLeft': 'Pulsación de aleta izquierda',
      'learn.flapRight': 'Pulsación de aleta derecha',
      'learn.flipperHitLeft': 'Bola golpeando la aleta izquierda',
      'learn.flipperHitRight': 'Bola golpeando la aleta derecha',
      'learn.proxLeft': 'Pitido de proximidad, bola hacia la aleta izquierda',
      'learn.proxRight': 'Pitido de proximidad, bola hacia la aleta derecha',
      'learn.proxUpper': 'Pitido de proximidad, bola hacia la aleta superior',
      'learn.plungerCharge': 'Tic de carga del lanzador',
      'learn.plungerLaunch': 'Disparo del lanzador',
      'learn.wall': 'Bola golpeando una pared',
      'learn.missionComplete': 'Fanfarria de misión completa',
      'learn.rankUp': 'Fanfarria de ascenso de rango',
      'learn.drain': 'Drenaje (bola perdida)',
      'learn.gameOver': 'Fin del juego',

      'help.aria': 'Cómo se juega',
      'help.title': 'Cómo se juega',
      'help.controls': 'Controles',
      'help.controlZ': '<strong>Z</strong> o <strong>Mayús izquierdo</strong> — aleta izquierda (también activa la mini aleta superior izquierda).',
      'help.controlM': '<strong>M</strong> o <strong>Mayús derecho</strong> — aleta derecha.',
      'help.controlSpace': '<strong>Espacio</strong> — manten para tensar el lanzador, suelta para disparar.',
      'help.controlP': '<strong>P</strong> — anuncia la posición actual de la bola (lado y profundidad).',
      'help.controlEscape': '<strong>Escape</strong> — pausa durante la partida, o vuelve al menú desde esta pantalla.',
      'help.controlQ': '<strong>Q</strong> desde la pausa — salir al menú principal.',
      'help.audioHeader': 'Cómo funciona el audio',
      'help.audio1': 'El oyente está fijo en la parte inferior de la mesa, mirando hacia arriba — como si estuvieras sentado detrás de la máquina. La bola siempre está delante, nunca detrás. El balance izquierda-derecha indica en qué lado de la mesa está la bola. Los sonidos más bajos están más lejos.',
      'help.audio2': 'Un sonido continuo de rodadura sigue a la bola. Cuanto más rápido va, más fuerte y brillante es el rumor. Un tono superpuesto sube según la bola se aleja hacia arriba — grave cerca de las aletas, agudo cerca de los bumpers — codificando la distancia también con el tono.',
      'help.audio3': 'Cuando la bola se acerca a una aleta, suena un pitido de proximidad panoramizado a ese lado. El pitido se vuelve más rápido y agudo — esa es tu señal para cronometrar la aleta.',
      'help.audio4': 'Cada bumper, diana y carril tiene su propio tono, así que un golpe te indica al instante cuál fue. Elige "Aprende los sonidos" en el menú para oírlos por separado.',
      'help.goalsHeader': 'Objetivos',
      'help.goals': 'Tienes tres bolas. Suma puntos golpeando bumpers, tiradores, dianas y atravesando los carriles superiores. Una cola de misiones guía a qué apuntar; complétalas para bonificaciones grandes. Acumula puntos para subir de rango desde Cadete hasta Almirante de la Flota. Si pierdes las tres bolas, la partida termina.',
      'help.back': 'Volver al menú',

      'pause.aria': 'En pausa',
      'pause.title': 'En pausa',
      'pause.body': 'Pulsa Escape para reanudar. Pulsa Q para salir al menú principal.',

      'gameover.aria': 'Fin del juego',
      'gameover.title': 'Fin del juego',
      'gameover.summary': 'Puntuación final: {score}. Rango final: {rank}.',
      'gameover.body': 'Pulsa Espacio o Enter para volver a jugar. Pulsa Escape para volver al menú.',

      'ann.pauseEnter': 'En pausa. Pulsa Escape o P para reanudar. Pulsa Q para salir al menú principal.',
      'ann.helpEnter': 'Cómo se juega. Tabula por el texto y el botón de volver al final, o pulsa Escape para volver al menú.',
      'ann.learnEnter': 'Aprende los sonidos. Tab o flechas para moverte, Enter o Espacio para reproducir. Escape para volver.',
      'ann.resumed': 'Reanudado.',
      'ann.promotedTo': 'Ascendido a {rank}.',
      'ann.ballReady': 'Bola {n} lista. Pulsa Espacio para tensar el lanzador; suelta para disparar.',
      'ann.gameStart': 'Comienza la partida. Tres bolas. Misión: {mission}.',
      'ann.gameOver': 'Fin del juego. Puntuación final {score}. Rango final {rank}.',
      'ann.missionComplete': 'Misión completa: {mission}. Bono {reward}.',
      'ann.newMission': 'Nueva misión: {mission}.',
      'ann.allMissions': '¡Todas las misiones completas! Multiplicador de bono activado.',
      'ann.targetDown': '{label} abatida.',
      'ann.label': '{label}.',
      'ann.targetsReset': 'Dianas restauradas.',
      'ann.ballRearmed': 'Bola devuelta al lanzador. Pulsa Espacio para volver a disparar.',
      'ann.drain1': 'Drenaje. Queda 1 bola.',
      'ann.drainN': 'Drenaje. Quedan {balls} bolas.',
      'ann.lastDrain': 'Última bola perdida.',
      'ann.plungerPulling': 'Tensando lanzador.',
      'ann.ballLaunched': 'Bola lanzada.',
      'ann.ballNotInPlay': 'La bola no está en juego.',
      'ann.ballPosition': 'Bola {side}, {depth}.',

      'pos.farLeft': 'extremo izquierdo',
      'pos.left': 'izquierda',
      'pos.right': 'derecha',
      'pos.farRight': 'extremo derecho',
      'pos.center': 'centro',
      'pos.nearDrain': 'cerca del drenaje',
      'pos.lower': 'parte baja',
      'pos.midTable': 'mitad de la mesa',
      'pos.upper': 'parte alta',
      'pos.top': 'arriba del todo',

      'rank.cadet': 'Cadete',
      'rank.ensign': 'Alférez',
      'rank.lieutenant': 'Teniente',
      'rank.commander': 'Comandante',
      'rank.captain': 'Capitán',
      'rank.commodore': 'Comodoro',
      'rank.rearAdmiral': 'Contralmirante',
      'rank.viceAdmiral': 'Vicealmirante',
      'rank.admiral': 'Almirante',
      'rank.fleetAdmiral': 'Almirante de la Flota',

      'mission.m1': 'Derriba las tres dianas',
      'mission.m2': 'Veinte golpes a bumpers',
      'mission.m3': 'Atraviesa todos los carriles',
      'mission.m4': 'Vuelve a iluminar todas las dianas',
      'mission.m5': 'Marca treinta mil sin perder bola',

      'label.alphaBumper': 'bumper alfa',
      'label.betaBumper': 'bumper beta',
      'label.gammaBumper': 'bumper gamma',
      'label.targetOne': 'diana uno',
      'label.targetTwo': 'diana dos',
      'label.targetThree': 'diana tres',
      'label.leftRollover': 'carril izquierdo',
      'label.innerLeftRollover': 'carril interior izquierdo',
      'label.innerRightRollover': 'carril interior derecho',
      'label.rightRollover': 'carril derecho',
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
