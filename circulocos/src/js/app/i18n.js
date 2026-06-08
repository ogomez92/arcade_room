/**
 * Lightweight i18n for Vault. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'vault.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Vault',

      'menu.aria': 'Main menu',
      'menu.title': 'Vault',
      'menu.subtitle': 'Audio peg solitaire. Jump pegs over each other to clear the board down to one.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Vault board',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.level': 'Level',
      'hud.pegs': 'Pegs',
      'hud.undos': 'Undos',

      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Jump pegs until one remains.',
      'help.intro': 'A board of pegs and empty holes. A peg can jump over an orthogonally-adjacent peg into the empty hole two cells beyond — north, east, south, or west — and the peg it jumps over is removed. Keep jumping to thin the board; reduce it to a single peg to clear the level and climb. Every board is guaranteed solvable. Undo is limited: if you run out of undos with no jumps left, the board is failed and you lose one of three lives.',
      'help.h.move': '<kbd>Arrow keys</kbd> / <kbd>WASD</kbd> / <kbd>numpad</kbd> — move the cursor north, south, east, west.',
      'help.h.select': '<kbd>Enter</kbd> — select the peg under the cursor (you’ll hear which directions it can jump), then press a <kbd>direction</kbd> to jump that way. Enter again cancels.',
      'help.h.shortcut': '<kbd>Shift</kbd> + a <kbd>direction</kbd> — jump the cursor’s peg that way in one step, without selecting first.',
      'help.h.scan': '<kbd>Space</kbd> — scan the four neighbours: a warm tone is a peg, a soft pip an empty hole, a dull thud the board edge; a bright ping means you can jump that way.',
      'help.h.undo': '<kbd>U</kbd> — undo the last jump (uses one from your undo budget).',
      'help.h.describe': '<kbd>C</kbd> — describe the current cell and the directions it can jump.',
      'help.h.status': '<kbd>F1</kbd> score, lives, pegs, undos · <kbd>F2</kbd> list every legal jump · <kbd>F3</kbd> pegs + undos left · <kbd>F4</kbd> the last jump.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: the cursor’s position tone pans to its column and rises in pitch toward the north (top). The scan, and the hop of a jump, come from their true compass direction around you — north in front, south behind, east to your right, west to your left — and sounds behind you are muffled. A peg is a warm, rounded tone; an empty hole a soft pip.',
      'help.back': 'Back',

      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Clear a few boards!',
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
      'learn.peg': 'A peg under the cursor (warm)',
      'learn.hole': 'An empty hole (soft pip)',
      'learn.scan': 'Scan neighbours (north peg + jump, west edge)',
      'learn.jump': 'Jump east (capture)',
      'learn.select': 'Select a peg',
      'learn.undo': 'Undo',
      'learn.stuck': 'No moves left',
      'learn.clear': 'Level cleared',
      'learn.fail': 'Board failed',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm the compass: front is north, right is east, behind is south, left is west.',
      'test.north': 'Play north (front)',
      'test.east': 'Play east (right)',
      'test.south': 'Play south (behind)',
      'test.west': 'Play west (left)',
      'test.ring': 'Play full ring',
      'test.back': 'Back',

      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      'dir.n': 'north',
      'dir.e': 'east',
      'dir.s': 'south',
      'dir.w': 'west',

      'ann.levelStart': 'Level {level}. {size} by {size} board, {pegs} pegs, {undos} undos. Reduce to one peg.',
      'ann.cellEdge': 'Edge.',
      'ann.cellHole': 'Column {col}, row {row}: empty hole.',
      'ann.cellPeg': 'Column {col}, row {row}: peg, no jumps.',
      'ann.cellPegJumps': 'Column {col}, row {row}: peg. Jumps: {dirs}.',
      'ann.selected': 'Selected column {col}, row {row}. Jump: {dirs}.',
      'ann.deselected': 'Deselected.',
      'ann.selectEmpty': 'No peg here.',
      'ann.selectNoJump': 'No jumps from here.',
      'ann.illegal': "Can't jump {dir} from here.",
      'ann.jump': 'Jumped {dir}. {pegs} pegs left.',
      'ann.undo': 'Undone. {undos} undos left. {pegs} pegs.',
      'ann.undoEmpty': 'Nothing to undo.',
      'ann.undoNone': 'No undos left.',
      'ann.stuck': 'No moves left. Undo to continue — {undos} undos left.',
      'ann.clear': 'Board cleared! Plus {bonus} points. Level {level} done.',
      'ann.clearCentered': 'Board cleared, last peg dead centre! Plus {bonus} points. Level {level} done.',
      'ann.fail': 'Stuck — board failed. {lives} lives left.',
      'ann.failLast': 'Stuck — no lives left.',
      'ann.gameOver': 'Game over. Final score {score}, reached level {level}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.status': 'Level {level}. Score {score}. {lives} lives. {pegs} pegs, {undos} undos.',
      'ann.jumps': '{n} legal jumps. {list}.',
      'ann.jumpsNone': 'No legal jumps.',
      'ann.jumpCell': 'column {col} row {row} jumps {dir}',
      'ann.progress': '{pegs} pegs left, {undos} undos left.',
      'ann.last': 'Last jump: column {col}, row {row}, {dir}.',
      'ann.lastNone': 'No moves yet.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Vault',

      'menu.aria': 'Menú principal',
      'menu.title': 'Vault',
      'menu.subtitle': 'Solitario de fichas sonoro. Salta unas fichas sobre otras hasta dejar el tablero en una sola.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Tablero de Vault',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.level': 'Nivel',
      'hud.pegs': 'Fichas',
      'hud.undos': 'Deshacer',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Salta fichas hasta que quede una.',
      'help.intro': 'Un tablero de fichas y huecos vacíos. Una ficha puede saltar sobre una ficha contigua (en línea recta) cayendo en el hueco vacío dos casillas más allá — norte, este, sur u oeste — y la ficha saltada se retira. Sigue saltando para vaciar el tablero; déjalo en una sola ficha para superar el nivel y subir. Todos los tableros tienen solución garantizada. Deshacer es limitado: si te quedas sin deshacer y sin saltos posibles, el tablero se pierde y gastas una de tres vidas.',
      'help.h.move': '<kbd>Flechas</kbd> / <kbd>WASD</kbd> / <kbd>teclado numérico</kbd> — mueve el cursor norte, sur, este, oeste.',
      'help.h.select': '<kbd>Enter</kbd> — selecciona la ficha bajo el cursor (oirás en qué direcciones puede saltar) y luego pulsa una <kbd>dirección</kbd> para saltar. Enter de nuevo cancela.',
      'help.h.shortcut': '<kbd>Mayús</kbd> + una <kbd>dirección</kbd> — salta la ficha del cursor en esa dirección de un solo paso, sin seleccionar antes.',
      'help.h.scan': '<kbd>Espacio</kbd> — escanea las cuatro vecinas: un tono cálido es una ficha, un pip suave un hueco vacío, un golpe sordo el borde; un tono brillante significa que puedes saltar por ahí.',
      'help.h.undo': '<kbd>U</kbd> — deshaz el último salto (gasta uno de tu margen de deshacer).',
      'help.h.describe': '<kbd>C</kbd> — describe la casilla actual y las direcciones en que puede saltar.',
      'help.h.status': '<kbd>F1</kbd> puntos, vidas, fichas, deshacer · <kbd>F2</kbd> lista cada salto legal · <kbd>F3</kbd> fichas y deshacer restantes · <kbd>F4</kbd> el último salto.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: el tono de posición del cursor se desplaza al lado de su columna y sube de tono hacia el norte (arriba). El escaneo y el salto vienen de su verdadera dirección de brújula a tu alrededor — el norte al frente, el sur detrás, el este a la derecha, el oeste a la izquierda — y los sonidos a tu espalda suenan apagados. Una ficha es un tono cálido y redondo; un hueco vacío un pip suave.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Despeja unos tableros!',
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
      'learn.peg': 'Una ficha bajo el cursor (cálida)',
      'learn.hole': 'Un hueco vacío (pip suave)',
      'learn.scan': 'Escanear vecinas (norte ficha + salto, oeste borde)',
      'learn.jump': 'Saltar al este (captura)',
      'learn.select': 'Seleccionar una ficha',
      'learn.undo': 'Deshacer',
      'learn.stuck': 'Sin movimientos',
      'learn.clear': 'Nivel superado',
      'learn.fail': 'Tablero perdido',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma la brújula: al frente es norte, derecha es este, detrás es sur, izquierda es oeste.',
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

      'dir.n': 'norte',
      'dir.e': 'este',
      'dir.s': 'sur',
      'dir.w': 'oeste',

      'ann.levelStart': 'Nivel {level}. Tablero {size} por {size}, {pegs} fichas, {undos} deshacer. Déjalo en una ficha.',
      'ann.cellEdge': 'Borde.',
      'ann.cellHole': 'Columna {col}, fila {row}: hueco vacío.',
      'ann.cellPeg': 'Columna {col}, fila {row}: ficha, sin saltos.',
      'ann.cellPegJumps': 'Columna {col}, fila {row}: ficha. Saltos: {dirs}.',
      'ann.selected': 'Seleccionada columna {col}, fila {row}. Salto: {dirs}.',
      'ann.deselected': 'Deseleccionada.',
      'ann.selectEmpty': 'Aquí no hay ficha.',
      'ann.selectNoJump': 'No hay saltos desde aquí.',
      'ann.illegal': 'No puedes saltar al {dir} desde aquí.',
      'ann.jump': 'Salto al {dir}. Quedan {pegs} fichas.',
      'ann.undo': 'Deshecho. Quedan {undos} deshacer. {pegs} fichas.',
      'ann.undoEmpty': 'Nada que deshacer.',
      'ann.undoNone': 'Sin deshacer disponibles.',
      'ann.stuck': 'Sin movimientos. Deshaz para continuar — quedan {undos} deshacer.',
      'ann.clear': '¡Tablero despejado! Más {bonus} puntos. Nivel {level} completado.',
      'ann.clearCentered': '¡Tablero despejado, última ficha en el centro! Más {bonus} puntos. Nivel {level} completado.',
      'ann.fail': 'Atascado: tablero perdido. Quedan {lives} vidas.',
      'ann.failLast': 'Atascado: sin vidas.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}, nivel {level}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
      'ann.status': 'Nivel {level}. Puntos {score}. {lives} vidas. {pegs} fichas, {undos} deshacer.',
      'ann.jumps': '{n} saltos legales. {list}.',
      'ann.jumpsNone': 'No hay saltos legales.',
      'ann.jumpCell': 'columna {col} fila {row} salta al {dir}',
      'ann.progress': 'Quedan {pegs} fichas, {undos} deshacer.',
      'ann.last': 'Último salto: columna {col}, fila {row}, {dir}.',
      'ann.lastNone': 'Aún no hay movimientos.',
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
