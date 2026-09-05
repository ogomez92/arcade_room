/**
 * Lightweight i18n for Pipe (English / Spanish). Canonical module body shared
 * across the collection; only STORAGE_KEY and the dictionaries are game-specific.
 * See the template CLAUDE.md "Localization" section.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'pipe.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Pipe',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Pipe',
      'menu.start': 'Start Game',
      'menu.training': 'Training Mode',
      'menu.learn': 'Learn Game Sounds',
      'menu.scores': 'Top Scores',
      'menu.speaker': 'Speaker Test',
      'menu.settings': 'Settings',
      'menu.quit': 'Quit',

      // City / difficulty
      'city.aria': 'Choose a city',
      'city.title': 'Choose a City',
      'city.subtitle': 'Cities are listed in order of difficulty.',
      'city.back': 'Back',
      'city.usa': 'USA',
      'city.canada': 'Canada',
      'city.spain': 'Spain',
      'city.button.usa': 'USA — Easy ({lives} lives)',
      'city.button.canada': 'Canada — Normal ({lives} lives)',
      'city.button.spain': 'Spain — Insane ({lives} lives)',

      // Game shell
      'game.aria': 'Game',
      'dir.up': 'up',
      'dir.down': 'down',
      'dir.left': 'left',
      'dir.right': 'right',

      // Announcer — gameplay
      'ann.levelIntro': '{city}, level {level}. {pipes} pipes to fit, {box} in your toolbox, {hits} hammer hits each. Press control to begin.',
      'ann.pipe': 'Pipe {n} of {total}.',
      'ann.fits': 'It fits!',
      'ann.noFit': 'No fit.',
      'ann.scream': 'Ouch! Wrong pipe.',
      'ann.slide': 'Slide {dir}!',
      'ann.now': 'Now!',
      'ann.enemy.bee': 'A bee!',
      'ann.enemy.bat': 'A bat!',
      'ann.enemy.dog': "Spanky the dog!",
      'ann.enemyAvoided.bee': 'You sprayed the bee!',
      'ann.enemyAvoided.bat': 'You ducked the bat!',
      'ann.enemyAvoided.dog': 'You jumped over Spanky!',
      'ann.enemyHit.bee': 'Stung! {lives} lives left.',
      'ann.enemyHit.bat': 'The bat hit you! {lives} lives left.',
      'ann.enemyHit.dog': 'Spanky bit you! {lives} lives left.',
      'ann.trip': 'You trip! Find the grab with the arrows.',
      'ann.grab': 'Grab {dir}! Press control.',
      'ann.tripOk': 'Steady again!',
      'ann.fall': 'You fell! {lives} lives left.',
      'ann.drenched': 'Drenched! {lives} lives left.',
      'ann.levelClear': 'Level {level} clear!',
      'ann.levelClearPerfect': 'Perfect! Level {level} clear with bonus!',
      'ann.bonusIntro': 'Bonus round! Move with left and right, match the sound with up and down, then press control.',
      'ann.bonusGot': 'Got it! {items} items.',
      'ann.bonusExtraLife': 'Bonus complete — {items} items. Extra life!',
      'ann.bonusDone': 'Bonus complete — {items} items, {points} points.',
      'ann.status': 'Level {level}, score {score}.',
      'ann.scoreDigits': 'Score {digits}.',
      'ann.lives': '{lives} lives, {pipes} pipes left.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.win': 'You finished the city! Final score {score}.',
      'ann.gameover': 'Game over. Score {score}, level {level}.',

      // Game over screen
      'gameover.aria': 'Game over',
      'gameover.title': 'Game Over',
      'gameover.status': '{city}: reached level {level} with {score} points.',
      'gameover.win': '{city} complete! Level {level}, {score} points.',
      'gameover.localRank': 'New local high score — rank {rank}!',
      'gameover.namePrompt': 'Your name',
      'gameover.submit': 'Submit to leaderboard',
      'gameover.onlineReady': 'Press submit to post your score online.',
      'gameover.onlineOffline': 'Online leaderboard not configured for this city.',
      'gameover.onlineSending': 'Sending…',
      'gameover.onlineRank': 'Posted! Online rank {rank}.',
      'gameover.onlineFail': 'Could not post online — saved locally.',
      'gameover.playAgain': 'Play Again',
      'gameover.viewScores': 'Top Scores',
      'gameover.menu': 'Main Menu',

      // Scores
      'scores.aria': 'Top scores',
      'scores.title': 'Top Scores',
      'scores.chart': '{city} chart',
      'scores.online': 'Online top ten:',
      'scores.row': '{rank}. {name} — {score} (level {level})',
      'scores.empty': 'No scores yet.',
      'scores.back': 'Back',

      // Learn sounds
      'learn.aria': 'Learn game sounds',
      'learn.title': 'Learn Game Sounds',
      'learn.back': 'Back',
      'learn.cycle': 'Cycle a toolbox pipe',
      'learn.fits': 'Pipe fits',
      'learn.nofit': 'Pipe does not fit',
      'learn.hammer': 'Hammering a pipe',
      'learn.water': 'Gushing water',
      'learn.drench': 'Drenched',
      'learn.bee': 'Bee',
      'learn.bat': 'Bat',
      'learn.dog': 'Spanky the dog',
      'learn.beep': 'Avoid-now beep',
      'learn.avoid': 'Avoided an animal',
      'learn.hit': 'Hit by an animal',
      'learn.trip': 'Tripping',
      'learn.clap': 'Grab hand-clap',
      'learn.balance': 'Regained balance',
      'learn.fall': 'Fell down',
      'learn.bonusCymbal': 'Bonus — cymbal',
      'learn.bonusBass': 'Bonus — bass',
      'learn.bonusChoir': 'Bonus — choir',
      'learn.bonusSax': 'Bonus — saxophone',
      'learn.bonusBottle': 'Bonus — smashing bottle',
      'learn.bonusGot': 'Bonus item obtained',
      'learn.jingle': 'Level jingle',

      // Training
      'training.aria': 'Training mode',
      'training.title': 'Training Mode',
      'training.back': 'Back to menu',
      'training.intro': 'Welcome to training. Use up and down arrows to cycle the pipes in your toolbox. Press Enter or slash to test the selected pipe. When it fits, press control several times to hammer it in. Try it now.',
      'training.newPipe': 'New pipe. Find the one that fits.',
      'training.done': 'Great! Pipe fitted.',
      'training.wrong': 'Wrong pipe — keep looking.',

      // Speaker test
      'speaker.aria': 'Speaker test',
      'speaker.title': 'Speaker Test',
      'speaker.intro': 'Press play, then tell us which side you heard the sound on.',
      'speaker.played': 'Which side did you hear it on?',
      'speaker.play': 'Play test sound',
      'speaker.left': 'I heard it on the LEFT (correct)',
      'speaker.right': 'I heard it on the RIGHT (swap)',
      'speaker.ok': 'Speakers are correct.',
      'speaker.swapped': 'Channels swapped — audio is now corrected.',
      'speaker.back': 'Back',

      // Settings
      'settings.aria': 'Settings',
      'settings.title': 'Settings',
      'settings.back': 'Back',
      'settings.speakPipes': 'Speak pipe numbers',
      'settings.music': 'Background music',
      'settings.tts': 'Spoken cues (TTS)',
      'settings.layout': 'Keyboard layout',
      'settings.layout.desktop': 'Desktop (Enter)',
      'settings.layout.laptop': 'Laptop (slash)',
      'settings.on': 'on',
      'settings.off': 'off',

      // Language
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',
    },

    es: {
      'doc.title': 'Pipe',

      'menu.aria': 'Menú principal',
      'menu.title': 'Pipe',
      'menu.start': 'Empezar Juego',
      'menu.training': 'Modo Entrenamiento',
      'menu.learn': 'Aprender Sonidos',
      'menu.scores': 'Mejores Puntuaciones',
      'menu.speaker': 'Prueba de Altavoces',
      'menu.settings': 'Ajustes',
      'menu.quit': 'Salir',

      'city.aria': 'Elige una ciudad',
      'city.title': 'Elige una Ciudad',
      'city.subtitle': 'Las ciudades se listan por orden de dificultad.',
      'city.back': 'Atrás',
      'city.usa': 'EE. UU.',
      'city.canada': 'Canadá',
      'city.spain': 'España',
      'city.button.usa': 'EE. UU. — Fácil ({lives} vidas)',
      'city.button.canada': 'Canadá — Normal ({lives} vidas)',
      'city.button.spain': 'España — Demente ({lives} vidas)',

      'game.aria': 'Juego',
      'dir.up': 'arriba',
      'dir.down': 'abajo',
      'dir.left': 'izquierda',
      'dir.right': 'derecha',

      'ann.levelIntro': '{city}, nivel {level}. {pipes} tuberías que arreglar, {box} en tu caja, {hits} martillazos cada una. Pulsa control para empezar.',
      'ann.pipe': 'Tubería {n} de {total}.',
      'ann.fits': '¡Encaja!',
      'ann.noFit': 'No encaja.',
      'ann.scream': '¡Ay! Tubería incorrecta.',
      'ann.slide': '¡Deslízate a la {dir}!',
      'ann.now': '¡Ahora!',
      'ann.enemy.bee': '¡Una abeja!',
      'ann.enemy.bat': '¡Un murciélago!',
      'ann.enemy.dog': '¡Spanky el perro!',
      'ann.enemyAvoided.bee': '¡Rociaste a la abeja!',
      'ann.enemyAvoided.bat': '¡Esquivaste al murciélago!',
      'ann.enemyAvoided.dog': '¡Saltaste sobre Spanky!',
      'ann.enemyHit.bee': '¡Picado! Quedan {lives} vidas.',
      'ann.enemyHit.bat': '¡El murciélago te golpeó! Quedan {lives} vidas.',
      'ann.enemyHit.dog': '¡Spanky te mordió! Quedan {lives} vidas.',
      'ann.trip': '¡Tropiezas! Busca el agarre con las flechas.',
      'ann.grab': '¡Agárrate {dir}! Pulsa control.',
      'ann.tripOk': '¡De nuevo en pie!',
      'ann.fall': '¡Te caíste! Quedan {lives} vidas.',
      'ann.drenched': '¡Empapado! Quedan {lives} vidas.',
      'ann.levelClear': '¡Nivel {level} superado!',
      'ann.levelClearPerfect': '¡Perfecto! ¡Nivel {level} superado con bonus!',
      'ann.bonusIntro': '¡Ronda de bonus! Muévete con izquierda y derecha, iguala el sonido con arriba y abajo, y pulsa control.',
      'ann.bonusGot': '¡Conseguido! {items} objetos.',
      'ann.bonusExtraLife': 'Bonus completo — {items} objetos. ¡Vida extra!',
      'ann.bonusDone': 'Bonus completo — {items} objetos, {points} puntos.',
      'ann.status': 'Nivel {level}, puntuación {score}.',
      'ann.scoreDigits': 'Puntuación {digits}.',
      'ann.lives': '{lives} vidas, {pipes} tuberías restantes.',
      'ann.paused': 'Pausa.',
      'ann.resumed': 'Continúa.',
      'ann.win': '¡Terminaste la ciudad! Puntuación final {score}.',
      'ann.gameover': 'Fin del juego. Puntuación {score}, nivel {level}.',

      'gameover.aria': 'Fin del juego',
      'gameover.title': 'Fin del Juego',
      'gameover.status': '{city}: llegaste al nivel {level} con {score} puntos.',
      'gameover.win': '¡{city} completada! Nivel {level}, {score} puntos.',
      'gameover.localRank': '¡Nuevo récord local — puesto {rank}!',
      'gameover.namePrompt': 'Tu nombre',
      'gameover.submit': 'Enviar a la clasificación',
      'gameover.onlineReady': 'Pulsa enviar para publicar tu puntuación.',
      'gameover.onlineOffline': 'Clasificación online no configurada para esta ciudad.',
      'gameover.onlineSending': 'Enviando…',
      'gameover.onlineRank': '¡Publicado! Puesto online {rank}.',
      'gameover.onlineFail': 'No se pudo publicar — guardado localmente.',
      'gameover.playAgain': 'Jugar de Nuevo',
      'gameover.viewScores': 'Mejores Puntuaciones',
      'gameover.menu': 'Menú Principal',

      'scores.aria': 'Mejores puntuaciones',
      'scores.title': 'Mejores Puntuaciones',
      'scores.chart': 'Tabla de {city}',
      'scores.online': 'Top diez online:',
      'scores.row': '{rank}. {name} — {score} (nivel {level})',
      'scores.empty': 'Aún no hay puntuaciones.',
      'scores.back': 'Atrás',

      'learn.aria': 'Aprender sonidos',
      'learn.title': 'Aprender Sonidos',
      'learn.back': 'Atrás',
      'learn.cycle': 'Cambiar de tubería',
      'learn.fits': 'La tubería encaja',
      'learn.nofit': 'La tubería no encaja',
      'learn.hammer': 'Martillar una tubería',
      'learn.water': 'Agua a borbotones',
      'learn.drench': 'Empapado',
      'learn.bee': 'Abeja',
      'learn.bat': 'Murciélago',
      'learn.dog': 'Spanky el perro',
      'learn.beep': 'Pitido de esquivar',
      'learn.avoid': 'Esquivar a un animal',
      'learn.hit': 'Golpeado por un animal',
      'learn.trip': 'Tropezar',
      'learn.clap': 'Palmada de agarre',
      'learn.balance': 'Recuperar el equilibrio',
      'learn.fall': 'Caerse',
      'learn.bonusCymbal': 'Bonus — platillo',
      'learn.bonusBass': 'Bonus — bajo',
      'learn.bonusChoir': 'Bonus — coro',
      'learn.bonusSax': 'Bonus — saxofón',
      'learn.bonusBottle': 'Bonus — botella rota',
      'learn.bonusGot': 'Objeto de bonus conseguido',
      'learn.jingle': 'Melodía de nivel',

      'training.aria': 'Modo entrenamiento',
      'training.title': 'Modo Entrenamiento',
      'training.back': 'Volver al menú',
      'training.intro': 'Bienvenido al entrenamiento. Usa las flechas arriba y abajo para cambiar entre las tuberías de tu caja. Pulsa Enter o barra para probar la tubería seleccionada. Cuando encaje, pulsa control varias veces para martillarla. Inténtalo ahora.',
      'training.newPipe': 'Nueva tubería. Encuentra la que encaja.',
      'training.done': '¡Bien! Tubería colocada.',
      'training.wrong': 'Tubería incorrecta — sigue buscando.',

      'speaker.aria': 'Prueba de altavoces',
      'speaker.title': 'Prueba de Altavoces',
      'speaker.intro': 'Pulsa reproducir y dinos en qué lado oíste el sonido.',
      'speaker.played': '¿En qué lado lo oíste?',
      'speaker.play': 'Reproducir sonido',
      'speaker.left': 'Lo oí a la IZQUIERDA (correcto)',
      'speaker.right': 'Lo oí a la DERECHA (invertir)',
      'speaker.ok': 'Los altavoces son correctos.',
      'speaker.swapped': 'Canales invertidos — el audio ya está corregido.',
      'speaker.back': 'Atrás',

      'settings.aria': 'Ajustes',
      'settings.title': 'Ajustes',
      'settings.back': 'Atrás',
      'settings.speakPipes': 'Decir números de tubería',
      'settings.music': 'Música de fondo',
      'settings.tts': 'Voz hablada (TTS)',
      'settings.layout': 'Distribución de teclado',
      'settings.layout.desktop': 'Sobremesa (Enter)',
      'settings.layout.laptop': 'Portátil (barra)',
      'settings.on': 'sí',
      'settings.off': 'no',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',
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
    for (const fn of listeners.slice()) { try { fn(loc) } catch (e) {} }
  }

  function onChange(fn) {
    listeners.push(fn)
    return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1) }
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
