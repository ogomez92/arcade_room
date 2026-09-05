/**
 * Lightweight i18n for Quartet. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'quartet.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Quartet',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Quartet',
      'menu.subtitle': 'Audio four-in-a-row. Drop sounding discs and align four before the machine does.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game / HUD
      'game.aria': 'Quartet board',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.level': 'Level',
      'hud.turn': 'Turn',
      'hud.turnYou': 'You',
      'hud.turnAi': 'Machine',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Align four of your discs before the machine does.',
      'help.intro': 'Seven columns stand left to right in front of you. On your turn you drop a disc into a column and it falls to the lowest free slot. Connect four of your discs in a line — across, up, or diagonal — to win the game and climb to a tougher opponent. If the machine connects four first you lose a life; lose three and the run ends. Each column sounds from its own place in the stereo field (column one hard left, column seven hard right), and a disc’s pitch rises the higher it sits in the stack. Your discs are a warm tone; the machine’s are darker and metallic.',
      'help.h.move': '<kbd>Left</kbd> / <kbd>Right</kbd> (or <kbd>A</kbd> / <kbd>D</kbd>) — move your aim across the columns. Each step previews where your next disc would land.',
      'help.h.drop': '<kbd>Enter</kbd> — drop a disc into the aimed column.',
      'help.h.scan': '<kbd>Space</kbd> or <kbd>Down</kbd> — scan the aimed column from the bottom up, disc by disc.',
      'help.h.sweep': '<kbd>Up</kbd> — sweep the whole board left to right, hearing the top disc of every column.',
      'help.h.describe': '<kbd>C</kbd> — say how full the aimed column is and who owns its top disc.',
      'help.h.threats': '<kbd>F2</kbd> — announce immediate threats: columns where you can win, and columns you must block.',
      'help.h.status': '<kbd>F1</kbd> level, opponent, score and lives · <kbd>F3</kbd> disc counts · <kbd>F4</kbd> the last moves played.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: a column to the left sounds in your left ear, a column to the right in your right ear, the centre column dead ahead. A disc near the bottom of a column is low-pitched; a disc near the top is high and bright. Your discs are warm and rounded; the machine’s are darker and metallic, so you can tell whose is whose by ear.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Beat a few opponents!',
      'highscores.entry': '#{rank}. {name} — {score} points, reached level {level}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart run',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game over',
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
      'learn.youdrop': 'Your disc dropping (warm)',
      'learn.aidrop': 'Machine disc dropping (metallic)',
      'learn.preview': 'Aim preview (where it lands)',
      'learn.scan': 'Scan a column (bottom to top)',
      'learn.sweep': 'Sweep the board (left to right)',
      'learn.win': 'You win',
      'learn.lose': 'Machine wins',
      'learn.draw': 'Draw',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Stereo test
      'test.aria': 'Stereo audio test',
      'test.title': 'Stereo audio test',
      'test.subtitle': 'Confirm the field: far left is column one, far right is column seven, and pitch rises with height.',
      'test.left': 'Play far left (column 1)',
      'test.center': 'Play centre (column 4)',
      'test.right': 'Play far right (column 7)',
      'test.low': 'Play low (bottom row)',
      'test.high': 'Play high (top row)',
      'test.sweep': 'Sweep left to right',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Opponent tiers
      'tier.novice': 'Novice',
      'tier.adept': 'Adept',
      'tier.expert': 'Expert',
      'tier.master': 'Master',
      'tier.grand': 'Grandmaster',

      // Announcements
      'ann.levelStart': 'Level {level}. {tier} opponent. You move first.',
      'ann.yourTurn': 'Your turn.',
      'ann.aiThinking': 'Machine is thinking.',
      'ann.colShort': 'Column {col}, {n} of {rows}.',
      'ann.youDrop': 'You drop in column {col}.',
      'ann.aiDrop': 'Machine drops in column {col}.',
      'ann.colFull': 'Column {col} is full.',
      'ann.win': 'Four in a row — you win level {level}! Plus {bonus} points.',
      'ann.lose': 'The machine connected four. {lives} lives left.',
      'ann.loseLast': 'The machine connected four. No lives left.',
      'ann.draw': 'Board full — a draw. Plus {points} points. Replaying level {level}.',
      'ann.gameOver': 'Game over. Final score {score}, reached level {level}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.status': 'Level {level}, {tier} opponent. Score {score}. {lives} lives. {turn}.',
      'ann.threatWin': 'You can win at column {cols}.',
      'ann.threatBlock': 'Block the machine at column {cols}.',
      'ann.threatNone': 'No immediate threats.',
      'ann.board': '{you} yours, {ai} machine, {empty} empty. Full columns: {full}.',
      'ann.lastMoves': 'You last played column {you}. Machine last played column {ai}.',
      'ann.sweep': 'Board sweep.',
      'ann.colEmpty': 'Column {col} is empty.',
      'ann.colDesc': 'Column {col}: {n} of {rows}. Top disc {owner}.',
      'ann.owner.you': 'yours',
      'ann.owner.machine': 'machine',
      'ann.owner.none': 'none',
      'ann.none': 'none',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Cuarteto',

      'menu.aria': 'Menú principal',
      'menu.title': 'Cuarteto',
      'menu.subtitle': 'Cuatro en raya sonoro. Deja caer discos que suenan y alinea cuatro antes que la máquina.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Tablero de Cuarteto',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.level': 'Nivel',
      'hud.turn': 'Turno',
      'hud.turnYou': 'Tú',
      'hud.turnAi': 'Máquina',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Alinea cuatro de tus discos antes que la máquina.',
      'help.intro': 'Siete columnas se alzan de izquierda a derecha frente a ti. En tu turno dejas caer un disco en una columna y cae al hueco libre más bajo. Conecta cuatro de tus discos en línea — horizontal, vertical o diagonal — para ganar la partida y subir a un rival más duro. Si la máquina conecta cuatro antes, pierdes una vida; pierde tres y termina la partida. Cada columna suena desde su propio lugar en el campo estéreo (la columna uno a la izquierda del todo, la siete a la derecha del todo), y el tono de un disco sube cuanto más alto está en la pila. Tus discos son un tono cálido; los de la máquina son más oscuros y metálicos.',
      'help.h.move': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> (o <kbd>A</kbd> / <kbd>D</kbd>) — mueve tu puntería por las columnas. Cada paso anticipa dónde caería tu próximo disco.',
      'help.h.drop': '<kbd>Enter</kbd> — deja caer un disco en la columna apuntada.',
      'help.h.scan': '<kbd>Espacio</kbd> o <kbd>Abajo</kbd> — escanea la columna apuntada de abajo arriba, disco a disco.',
      'help.h.sweep': '<kbd>Arriba</kbd> — recorre todo el tablero de izquierda a derecha, oyendo el disco superior de cada columna.',
      'help.h.describe': '<kbd>C</kbd> — di cuánto llena está la columna apuntada y de quién es su disco superior.',
      'help.h.threats': '<kbd>F2</kbd> — anuncia amenazas inmediatas: columnas donde puedes ganar y columnas que debes bloquear.',
      'help.h.status': '<kbd>F1</kbd> nivel, rival, puntos y vidas · <kbd>F3</kbd> recuento de discos · <kbd>F4</kbd> las últimas jugadas.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: una columna a la izquierda suena en tu oído izquierdo, una a la derecha en el derecho, la central justo al frente. Un disco cerca del fondo de una columna es grave; uno cerca de lo alto es agudo y brillante. Tus discos son cálidos y redondos; los de la máquina son más oscuros y metálicos, así distingues de quién es cada uno de oído.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Vence a unos cuantos rivales!',
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
      'learn.youdrop': 'Tu disco al caer (cálido)',
      'learn.aidrop': 'Disco de la máquina al caer (metálico)',
      'learn.preview': 'Anticipo de puntería (dónde cae)',
      'learn.scan': 'Escanear una columna (de abajo arriba)',
      'learn.sweep': 'Recorrer el tablero (de izquierda a derecha)',
      'learn.win': 'Ganas',
      'learn.lose': 'Gana la máquina',
      'learn.draw': 'Empate',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio estéreo',
      'test.title': 'Prueba de audio estéreo',
      'test.subtitle': 'Confirma el campo: a la izquierda del todo es la columna uno, a la derecha del todo la siete, y el tono sube con la altura.',
      'test.left': 'Sonar izquierda del todo (columna 1)',
      'test.center': 'Sonar centro (columna 4)',
      'test.right': 'Sonar derecha del todo (columna 7)',
      'test.low': 'Sonar grave (fila inferior)',
      'test.high': 'Sonar agudo (fila superior)',
      'test.sweep': 'Recorrer de izquierda a derecha',
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

      'ann.levelStart': 'Nivel {level}. Rival {tier}. Mueves primero.',
      'ann.yourTurn': 'Tu turno.',
      'ann.aiThinking': 'La máquina está pensando.',
      'ann.colShort': 'Columna {col}, {n} de {rows}.',
      'ann.youDrop': 'Dejas caer en la columna {col}.',
      'ann.aiDrop': 'La máquina deja caer en la columna {col}.',
      'ann.colFull': 'La columna {col} está llena.',
      'ann.win': '¡Cuatro en raya, ganas el nivel {level}! Más {bonus} puntos.',
      'ann.lose': 'La máquina conectó cuatro. Quedan {lives} vidas.',
      'ann.loseLast': 'La máquina conectó cuatro. Sin vidas.',
      'ann.draw': 'Tablero lleno: empate. Más {points} puntos. Repitiendo el nivel {level}.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}, nivel {level}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
      'ann.status': 'Nivel {level}, rival {tier}. Puntos {score}. {lives} vidas. {turn}.',
      'ann.threatWin': 'Puedes ganar en la columna {cols}.',
      'ann.threatBlock': 'Bloquea a la máquina en la columna {cols}.',
      'ann.threatNone': 'Sin amenazas inmediatas.',
      'ann.board': '{you} tuyos, {ai} de la máquina, {empty} vacíos. Columnas llenas: {full}.',
      'ann.lastMoves': 'Tu última jugada, columna {you}. La de la máquina, columna {ai}.',
      'ann.sweep': 'Recorrido del tablero.',
      'ann.colEmpty': 'La columna {col} está vacía.',
      'ann.colDesc': 'Columna {col}: {n} de {rows}. Disco superior {owner}.',
      'ann.owner.you': 'tuyo',
      'ann.owner.machine': 'de la máquina',
      'ann.owner.none': 'ninguno',
      'ann.none': 'ninguna',
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
