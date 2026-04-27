/**
 * Lightweight i18n for accessible audio games. See bumper/template for the
 * canonical implementation; only the STORAGE_KEY and dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'pacman.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Audio Pac-Man',

      'splash.author': 'Audio-first edition',
      'splash.instruction': 'Press any key or click to begin',

      'menu.aria': 'Main Menu',
      'menu.subtitle': 'An audio-first arcade adventure',
      'menu.start': 'Start Game',
      'menu.learn': 'Sound Learning Menu',
      'menu.settings': 'Settings',
      'menu.highscores': 'High Scores',
      'menu.help': 'How To Play',
      'menu.language': 'Language',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',

      'game.aria': 'Game',
      'game.headline': 'Game in progress',
      'game.score': 'Score:',
      'game.lives': 'Lives:',
      'game.level': 'Level:',
      'game.dots': 'Dots:',
      'game.scoreAria': 'Score',
      'game.livesAria': 'Lives',
      'game.levelAria': 'Level',
      'game.dotsAria': 'Dots remaining',
      'game.help': 'Arrow keys to steer. F1 reads score. F2 reads nearest target. F3 reads dots remaining. F4 reads percent complete. 1–9 sets speed. Escape pauses.',

      'learn.aria': 'Sound Learning Menu',
      'learn.title': 'Sound Learning',
      'learn.subtitle': 'Press a button to listen to each sound. Each plays once and ahead of you.',
      'learn.back': 'Back to Menu',
      'learn.blinky': 'Blinky (red ghost)',
      'learn.pinky': 'Pinky (pink ghost)',
      'learn.inky': 'Inky (cyan ghost)',
      'learn.clyde': 'Clyde (orange ghost)',
      'learn.frightened': 'Frightened ghost',
      'learn.eaten': 'Eaten ghost (eyes)',
      'learn.fruit': 'Bonus fruit',
      'learn.powerNW': 'Power pellet — north-west corner (lowest, slowest)',
      'learn.powerNE': 'Power pellet — north-east corner',
      'learn.powerSW': 'Power pellet — south-west corner',
      'learn.powerSE': 'Power pellet — south-east corner (highest, fastest)',
      'learn.beacon': 'Navigation beacon (nearest dot)',
      'learn.wall': 'Wall proximity',
      'learn.chompA': 'Chomp pellet',
      'learn.eatPower': 'Power pellet eaten',
      'learn.eatGhost': 'Ghost eaten jingle',
      'learn.eatFruit': 'Fruit eaten jingle',
      'learn.death': 'Death sound',
      'learn.extraLife': 'Extra life',
      'learn.levelClear': 'Level cleared',
      'learn.introJingle': 'Intro jingle',

      'settings.aria': 'Settings',
      'settings.title': 'Settings',
      'settings.back': 'Back to Menu',
      'settings.masterVolume': 'Master Volume',
      'settings.volumeDown': 'Volume down',
      'settings.volumeUp': 'Volume up',

      'highscores.aria': 'High Scores',
      'highscores.title': 'High Scores',
      'highscores.listLabel': 'Top scores',
      'highscores.back': 'Back to Menu',
      'highscores.empty': 'No scores yet — be the first!',
      'highscores.entry': '{name} — {score} (level {level})',

      'gameover.aria': 'Game Over',
      'gameover.title': 'Game Over',
      'gameover.finalScore': 'Final score:',
      'gameover.rankMsg': 'You earned a high score! Enter your name:',
      'gameover.nameLabel': 'Your name',
      'gameover.namePlaceholder': 'Your name',
      'gameover.save': 'Save Score',
      'gameover.continue': 'Continue',

      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.menu': 'Quit to Main Menu',

      'test.aria': 'Spatial Audio Test',
      'test.title': 'Spatial Audio Test',
      'test.subtitle': 'Listen for sounds at four screen positions: north (front), east (right), south (behind), west (left).',
      'test.replay': 'Replay Test',
      'test.wakaTitle': 'Waka-waka at game speed',
      'test.wakaIntro': 'Press number keys 1 through 9 (same scale as the in-game debug speed keys) to hear the waka-waka at that simulated speed. ka is half a footstep, so faster speeds produce a tighter waka.',
      'test.waka1': '1: slowest',
      'test.waka3': '3',
      'test.waka5': '5: default',
      'test.waka7': '7',
      'test.waka9': '9: fastest',
      'test.back': 'Back to Menu',
      'test.intro': 'Spatial audio test. Press 1 through 9 to hear the waka-waka at that game-speed level. Replay button repeats the spatial test.',
      'test.speed': 'Speed {digit}, waka period {ms} ms.',
      'test.dirFront': 'Front (north)',
      'test.dirRight': 'Right (east)',
      'test.dirBehind': 'Behind (south)',
      'test.dirLeft': 'Left (west)',

      'music.aria': 'Music Preview',
      'music.title': 'Music Preview',
      'music.subtitle': 'Plays the intro melody. Press space or enter to replay.',
      'music.play': 'Play',
      'music.back': 'Back to Menu',

      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.goalHeader': 'Goal',
      'help.goal': 'Eat every dot in the maze to clear the level. Avoid the four ghosts. Eat power pellets to turn ghosts blue and chase them down for bonus points. Catch fruit for big extra score.',
      'help.controlsHeader': 'Controls',
      'help.controlArrows': '<kbd>Arrow keys</kbd> — steer Pac-Man. The next turn is queued and taken at the next legal tile.',
      'help.controlEsc': '<kbd>Esc</kbd> — pause',
      'help.controlF1': '<kbd>F1</kbd> — speak score, lives, level, dots remaining',
      'help.controlF2': '<kbd>F2</kbd> — speak the nearest target with compass direction and tile distance. If a fruit is on the board, F2 points to the fruit; otherwise it points to the nearest dot.',
      'help.controlF3': '<kbd>F3</kbd> — speak dots remaining',
      'help.controlF4': '<kbd>F4</kbd> — speak percent of the level completed',
      'help.controlSpeed': '<kbd>1</kbd>–<kbd>9</kbd> — set Pac-Man\'s speed (debugging)',
      'help.audioHeader': 'Listening to the maze',
      'help.audioIntro': 'The audio is fixed top-down: <strong>north is in front of you, south is behind, east is to your right, west is to your left</strong>. This never changes regardless of which way Pac-Man last moved, so a ghost south of you always sounds like it\'s behind you.',
      'help.audioGhosts': 'Each ghost has its own voice — Blinky, Pinky, Inky, and Clyde all sound different. Distance is communicated by volume.',
      'help.audioFrightened': 'Frightened ghosts (after a power pellet) have a distinct vulnerable warble.',
      'help.audioEaten': 'Eaten ghosts return to the house as fast eyes — a high, racing whistle that fades as they reach home.',
      'help.audioBeacon': 'A short tick every 1.5 seconds points to the next move toward the nearest dot.',
      'help.audioWall': 'A low rumble grows louder as you approach a wall in your current direction.',
      'help.audioFruit': 'Fruit makes its own shimmering tone while it\'s on the board.',
      'help.audioBehind': 'Sounds behind you are muffled; sounds in front are bright. Use that to tell ahead from behind on the same axis.',
      'help.tipsHeader': 'Tips',
      'help.tip1': 'Visit the <strong>Sound Learning</strong> menu from the main menu to preview every game sound on its own.',
      'help.tip2': 'Power pellets stop frightening ghosts from level 19 onward — same as the arcade.',
      'help.tip3': 'Fruit appears twice per level. F2 will guide you to it while it\'s on the board.',
      'help.tip4': 'Row 14 has a tunnel that wraps around left-to-right.',
      'help.back': 'Back to Menu',

      // Runtime announcements
      'ann.menu': 'Main Menu. Use arrow keys to navigate, Enter to select.',
      'ann.help': 'How to play. Press Escape to return to the main menu.',
      'ann.learnHello': 'Sound Learning Menu. Tab through buttons to listen to each sound.',
      'ann.playing': 'Playing: {label}',
      'ann.scoreSaved': 'Score saved.',
      'ann.gameOverHigh': 'Game over! Final score {score}. You earned a high score! Type your name and press Enter.',
      'ann.gameOver': 'Game over. Final score {score}.',
      'ann.pause': 'Paused. Resume or quit to main menu.',
      'ann.music': 'Music preview. Press space or enter to play the intro.',
      'ann.highscoresEmpty': 'High scores. No scores yet.',
      'ann.highscoresList': 'High scores. {top}.',
      'ann.splash': 'Audio Pac-Man. Press any key or click to begin.',
      'ann.settings': 'Settings. Use Tab to navigate.',
      'ann.difficulty': 'Difficulty: {value}',
      'ann.volume': 'Volume {value} percent',
      'ann.levelGetReady': 'Level {level}. Get ready!',
      'ann.levelCleared': 'Level {level} cleared!',
      'ann.caught': 'Caught! Lives left: {lives}',
      'ann.extraLife': 'Extra life!',
      'ann.eatPower': 'Power pellet! Ghosts vulnerable.',
      'ann.ghostEaten': '{name} eaten! +{points}',
      'ann.fruitSpawn': 'A {name} appeared!',
      'ann.fruitEaten': '{name} +{points}',
      'ann.gameOverShort': 'Game over.',
      'ann.noExits': 'no exits',
      'ann.opensList': '{list} open',
      'ann.score': 'Score {score}. Lives {lives}. Level {level}. {dots} dots remaining.',
      'ann.speed': 'Speed {n}',
      'ann.ghostsOff': 'Ghosts off.',
      'ann.ghostsOn': 'Ghosts on.',
      'ann.targetFruit': '{name}: {direction}, {distance} tiles.',
      'ann.noDots': 'No dots remaining.',
      'ann.targetDot': 'Nearest dot: {bucket}, {direction}, {distance} tiles.',
      'ann.bucketClose': 'close',
      'ann.bucketMedium': 'medium',
      'ann.bucketFar': 'far',
      'ann.dirNorth': 'north',
      'ann.dirSouth': 'south',
      'ann.dirEast': 'east',
      'ann.dirWest': 'west',
      'ann.dirNE': 'north-east',
      'ann.dirNW': 'north-west',
      'ann.dirSE': 'south-east',
      'ann.dirSW': 'south-west',
      'ann.dirHere': 'here',
      'ann.levelClearedShort': 'Level cleared.',
      'ann.dotsLeft1': '1 dot left to clear the level.',
      'ann.dotsLeftN': '{n} dots left to clear the level.',
      'ann.levelNotStarted': 'Level not started.',
      'ann.percentComplete': '{pct} percent complete.',
      'ann.fruitGeneric': 'fruit',

      // Settings
      'settings.difficulty': 'Difficulty',
      'settings.volume': 'Volume',
      'settings.diffEasy': 'easy',
      'settings.diffNormal': 'normal',
      'settings.diffHard': 'hard',
    },

    es: {
      'doc.title': 'Audio Pac-Man',

      'splash.author': 'Edición centrada en el audio',
      'splash.instruction': 'Pulsa una tecla o haz clic para empezar',

      'menu.aria': 'Menú principal',
      'menu.subtitle': 'Una aventura arcade centrada en el audio',
      'menu.start': 'Empezar partida',
      'menu.learn': 'Aprende los sonidos',
      'menu.settings': 'Ajustes',
      'menu.highscores': 'Récords',
      'menu.help': 'Cómo se juega',
      'menu.language': 'Idioma',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',

      'game.aria': 'Juego',
      'game.headline': 'Partida en curso',
      'game.score': 'Puntos:',
      'game.lives': 'Vidas:',
      'game.level': 'Nivel:',
      'game.dots': 'Puntos:',
      'game.scoreAria': 'Puntos',
      'game.livesAria': 'Vidas',
      'game.levelAria': 'Nivel',
      'game.dotsAria': 'Puntos restantes',
      'game.help': 'Flechas para girar. F1 lee la puntuación. F2 lee el objetivo más cercano. F3 lee los puntos restantes. F4 lee el porcentaje completado. 1–9 ajusta la velocidad. Escape pausa.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Pulsa un botón para oír cada sonido. Suena una vez delante de ti.',
      'learn.back': 'Volver al menú',
      'learn.blinky': 'Blinky (fantasma rojo)',
      'learn.pinky': 'Pinky (fantasma rosa)',
      'learn.inky': 'Inky (fantasma cian)',
      'learn.clyde': 'Clyde (fantasma naranja)',
      'learn.frightened': 'Fantasma asustado',
      'learn.eaten': 'Fantasma comido (ojos)',
      'learn.fruit': 'Fruta de bonificación',
      'learn.powerNW': 'Píldora — esquina noroeste (la más grave, lenta)',
      'learn.powerNE': 'Píldora — esquina noreste',
      'learn.powerSW': 'Píldora — esquina suroeste',
      'learn.powerSE': 'Píldora — esquina sureste (la más aguda, rápida)',
      'learn.beacon': 'Baliza de navegación (punto más cercano)',
      'learn.wall': 'Proximidad de muro',
      'learn.chompA': 'Comer punto',
      'learn.eatPower': 'Píldora comida',
      'learn.eatGhost': 'Tonadilla de fantasma comido',
      'learn.eatFruit': 'Tonadilla de fruta comida',
      'learn.death': 'Sonido de muerte',
      'learn.extraLife': 'Vida extra',
      'learn.levelClear': 'Nivel superado',
      'learn.introJingle': 'Tonadilla de entrada',

      'settings.aria': 'Ajustes',
      'settings.title': 'Ajustes',
      'settings.back': 'Volver al menú',
      'settings.masterVolume': 'Volumen general',
      'settings.volumeDown': 'Bajar volumen',
      'settings.volumeUp': 'Subir volumen',

      'highscores.aria': 'Récords',
      'highscores.title': 'Récords',
      'highscores.listLabel': 'Mejores puntuaciones',
      'highscores.back': 'Volver al menú',
      'highscores.empty': 'Aún no hay puntuaciones — ¡sé el primero!',
      'highscores.entry': '{name} — {score} (nivel {level})',

      'gameover.aria': 'Fin del juego',
      'gameover.title': 'Fin del juego',
      'gameover.finalScore': 'Puntuación final:',
      'gameover.rankMsg': '¡Has hecho un récord! Escribe tu nombre:',
      'gameover.nameLabel': 'Tu nombre',
      'gameover.namePlaceholder': 'Tu nombre',
      'gameover.save': 'Guardar récord',
      'gameover.continue': 'Continuar',

      'pause.aria': 'En pausa',
      'pause.title': 'En pausa',
      'pause.resume': 'Reanudar',
      'pause.menu': 'Salir al menú principal',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Escucha los sonidos en cuatro posiciones: norte (delante), este (derecha), sur (detrás), oeste (izquierda).',
      'test.replay': 'Repetir prueba',
      'test.wakaTitle': 'Waka-waka a velocidad de juego',
      'test.wakaIntro': 'Pulsa los números del 1 al 9 (la misma escala que las teclas de depuración) para oír el waka-waka a esa velocidad simulada. ka es medio paso, así que velocidades altas producen un waka más apretado.',
      'test.waka1': '1: el más lento',
      'test.waka3': '3',
      'test.waka5': '5: por defecto',
      'test.waka7': '7',
      'test.waka9': '9: el más rápido',
      'test.back': 'Volver al menú',
      'test.intro': 'Prueba de audio espacial. Pulsa del 1 al 9 para oír el waka-waka a esa velocidad. El botón Repetir reproduce de nuevo la prueba espacial.',
      'test.speed': 'Velocidad {digit}, periodo del waka {ms} ms.',
      'test.dirFront': 'Delante (norte)',
      'test.dirRight': 'Derecha (este)',
      'test.dirBehind': 'Detrás (sur)',
      'test.dirLeft': 'Izquierda (oeste)',

      'music.aria': 'Vista previa de la música',
      'music.title': 'Vista previa de la música',
      'music.subtitle': 'Reproduce la melodía de inicio. Pulsa Espacio o Enter para repetir.',
      'music.play': 'Reproducir',
      'music.back': 'Volver al menú',

      'help.aria': 'Cómo se juega',
      'help.title': 'Cómo se juega',
      'help.goalHeader': 'Objetivo',
      'help.goal': 'Cómete cada punto del laberinto para superar el nivel. Evita a los cuatro fantasmas. Cómete las píldoras grandes para volverlos azules y persíguelos por puntos extra. Atrapa la fruta para una bonificación grande.',
      'help.controlsHeader': 'Controles',
      'help.controlArrows': '<kbd>Flechas</kbd> — guían a Pac-Man. El próximo giro se encola y se ejecuta al llegar al siguiente cruce.',
      'help.controlEsc': '<kbd>Esc</kbd> — pausa',
      'help.controlF1': '<kbd>F1</kbd> — lee puntos, vidas, nivel y puntos restantes',
      'help.controlF2': '<kbd>F2</kbd> — lee el objetivo más cercano con dirección y distancia. Si hay fruta, F2 apunta a la fruta; si no, al punto más cercano.',
      'help.controlF3': '<kbd>F3</kbd> — lee los puntos restantes',
      'help.controlF4': '<kbd>F4</kbd> — lee el porcentaje completado',
      'help.controlSpeed': '<kbd>1</kbd>–<kbd>9</kbd> — ajusta la velocidad de Pac-Man (depuración)',
      'help.audioHeader': 'Escuchar el laberinto',
      'help.audioIntro': 'El audio está fijo cenital: <strong>el norte está delante, el sur detrás, el este a la derecha y el oeste a la izquierda</strong>. Esto no cambia, da igual hacia dónde se mueva Pac-Man, así que un fantasma al sur siempre suena detrás de ti.',
      'help.audioGhosts': 'Cada fantasma tiene su propia voz — Blinky, Pinky, Inky y Clyde suenan distintos. La distancia se comunica con el volumen.',
      'help.audioFrightened': 'Los fantasmas asustados (tras una píldora) tienen un trémolo vulnerable distintivo.',
      'help.audioEaten': 'Los fantasmas comidos vuelven a la casa como ojos rápidos — un silbido agudo que se desvanece al llegar.',
      'help.audioBeacon': 'Un tic corto cada 1,5 segundos te indica el siguiente movimiento hacia el punto más cercano.',
      'help.audioWall': 'Un retumbo grave aumenta cuando te aproximas a un muro en tu dirección actual.',
      'help.audioFruit': 'La fruta produce su propio tono brillante mientras está en el laberinto.',
      'help.audioBehind': 'Los sonidos detrás suenan apagados; los de delante son brillantes. Úsalos para distinguir delante/detrás en el mismo eje.',
      'help.tipsHeader': 'Consejos',
      'help.tip1': 'Visita <strong>Aprende los sonidos</strong> en el menú principal para escuchar cada sonido por separado.',
      'help.tip2': 'A partir del nivel 19 las píldoras dejan de asustar a los fantasmas — igual que en el arcade.',
      'help.tip3': 'La fruta aparece dos veces por nivel. F2 te guía mientras está en el laberinto.',
      'help.tip4': 'La fila 14 tiene un túnel que conecta el lado izquierdo con el derecho.',
      'help.back': 'Volver al menú',

      'ann.menu': 'Menú principal. Usa las flechas para navegar, Enter para elegir.',
      'ann.help': 'Cómo se juega. Pulsa Escape para volver al menú principal.',
      'ann.learnHello': 'Aprende los sonidos. Tabula entre los botones para oír cada sonido.',
      'ann.playing': 'Reproduciendo: {label}',
      'ann.scoreSaved': 'Récord guardado.',
      'ann.gameOverHigh': '¡Fin del juego! Puntuación final {score}. ¡Has hecho un récord! Escribe tu nombre y pulsa Enter.',
      'ann.gameOver': 'Fin del juego. Puntuación final {score}.',
      'ann.pause': 'En pausa. Reanuda o sal al menú principal.',
      'ann.music': 'Vista previa de la música. Pulsa Espacio o Enter para reproducir la intro.',
      'ann.highscoresEmpty': 'Récords. Aún no hay puntuaciones.',
      'ann.highscoresList': 'Récords. {top}.',
      'ann.splash': 'Audio Pac-Man. Pulsa una tecla o haz clic para empezar.',
      'ann.settings': 'Ajustes. Usa Tab para navegar.',
      'ann.difficulty': 'Dificultad: {value}',
      'ann.volume': 'Volumen al {value} por ciento',
      'ann.levelGetReady': 'Nivel {level}. ¡Prepárate!',
      'ann.levelCleared': '¡Nivel {level} superado!',
      'ann.caught': '¡Te han atrapado! Vidas restantes: {lives}',
      'ann.extraLife': '¡Vida extra!',
      'ann.eatPower': '¡Píldora! Fantasmas vulnerables.',
      'ann.ghostEaten': '¡{name} comido! +{points}',
      'ann.fruitSpawn': '¡Apareció {name}!',
      'ann.fruitEaten': '{name} +{points}',
      'ann.gameOverShort': 'Fin del juego.',
      'ann.noExits': 'sin salidas',
      'ann.opensList': '{list} abierto',
      'ann.score': 'Puntos {score}. Vidas {lives}. Nivel {level}. {dots} puntos restantes.',
      'ann.speed': 'Velocidad {n}',
      'ann.ghostsOff': 'Fantasmas desactivados.',
      'ann.ghostsOn': 'Fantasmas activados.',
      'ann.targetFruit': '{name}: {direction}, {distance} casillas.',
      'ann.noDots': 'No quedan puntos.',
      'ann.targetDot': 'Punto más cercano: {bucket}, {direction}, {distance} casillas.',
      'ann.bucketClose': 'cerca',
      'ann.bucketMedium': 'medio',
      'ann.bucketFar': 'lejos',
      'ann.dirNorth': 'norte',
      'ann.dirSouth': 'sur',
      'ann.dirEast': 'este',
      'ann.dirWest': 'oeste',
      'ann.dirNE': 'noreste',
      'ann.dirNW': 'noroeste',
      'ann.dirSE': 'sureste',
      'ann.dirSW': 'suroeste',
      'ann.dirHere': 'aquí',
      'ann.levelClearedShort': 'Nivel superado.',
      'ann.dotsLeft1': 'Queda 1 punto para superar el nivel.',
      'ann.dotsLeftN': 'Quedan {n} puntos para superar el nivel.',
      'ann.levelNotStarted': 'Nivel no iniciado.',
      'ann.percentComplete': '{pct} por ciento completado.',
      'ann.fruitGeneric': 'fruta',

      'settings.difficulty': 'Dificultad',
      'settings.volume': 'Volumen',
      'settings.diffEasy': 'fácil',
      'settings.diffNormal': 'normal',
      'settings.diffHard': 'difícil',
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
