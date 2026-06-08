/**
 * Lightweight i18n for Etch. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'etch.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Drawing board',

      'menu.aria': 'Main menu',
      'menu.title': 'Drawing board',
      'menu.subtitle': 'Audio nonogram. Read the number clues and fill the hidden picture, cell by cell.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Drawing board grid',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.level': 'Level',
      'hud.progress': 'Filled',

      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Fill the grid from the number clues.',
      'help.intro': 'A nonogram (picross). Every row and every column has a clue — a list of numbers giving the lengths of the runs of filled cells in order, with at least one gap between runs. From the clues alone you can deduce exactly which cells are filled. Fill them all to reveal the hidden picture and clear the level. Every puzzle is guaranteed solvable by pure logic — no guessing needed — so a wrong fill is a real mistake and costs one of three lives.',
      'help.h.move': '<kbd>Arrow keys</kbd> / <kbd>WASD</kbd> / <kbd>numpad</kbd> — move the cursor.',
      'help.h.fill': '<kbd>Enter</kbd> — fill the current cell. If the cell is actually empty it is a mistake: it is marked empty for you and you lose a life.',
      'help.h.cross': '<kbd>X</kbd> — mark the current cell as empty (a free note for cells you have deduced are blank).',
      'help.h.row': '<kbd>R</kbd> — read the current ROW: its clue, and a left-to-right scan of its cells (each panned to its column).',
      'help.h.col': '<kbd>C</kbd> — read the current COLUMN: its clue, and a top-to-bottom scan of its cells (pitch rises toward the top).',
      'help.h.status': '<kbd>F1</kbd> score, lives, filled · <kbd>F2</kbd> progress and completed lines · <kbd>F3</kbd> row clue rhythm · <kbd>F4</kbd> column clue rhythm.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: the cursor pans to its column (left column = left ear, right column = right ear) and rises in pitch toward the top row. When you read a line, a filled cell is a warm tone, a crossed cell a short tick, an unknown cell a soft pip. A clue rhythm plays each run as that many quick beats, the runs separated by a low tick.',
      'help.back': 'Back',

      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Solve a few pictures!',
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
      'learn.filled': 'A filled cell (warm tone)',
      'learn.crossed': 'A crossed cell (tick)',
      'learn.unknown': 'An unknown cell (soft pip)',
      'learn.clue': 'A clue rhythm (3, 1, 2)',
      'learn.fill': 'Fill a cell',
      'learn.mistake': 'Mistake',
      'learn.line': 'Line complete',
      'learn.clear': 'Picture complete',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      'test.aria': 'Stereo audio test',
      'test.title': 'Stereo audio test',
      'test.subtitle': 'Confirm the field: far left is the first column, far right the last, and pitch rises toward the top row.',
      'test.left': 'Play far left (column 1)',
      'test.center': 'Play centre',
      'test.right': 'Play far right (last column)',
      'test.low': 'Play low (bottom row)',
      'test.high': 'Play high (top row)',
      'test.sweep': 'Sweep left to right',
      'test.back': 'Back',

      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      'ann.levelStart': 'Level {level}. {size} by {size}. Fill {target} cells from the clues.',
      'ann.cellFilled': 'Column {col}, row {row}: filled.',
      'ann.cellCrossed': 'Column {col}, row {row}: empty.',
      'ann.cellUnknown': 'Column {col}, row {row}: unknown.',
      'ann.mistake': 'Mistake — that cell is empty. {lives} lives left.',
      'ann.mistakeLast': 'Mistake — that cell is empty. No lives left.',
      'ann.rowDone': 'Row {row} complete.',
      'ann.colDone': 'Column {col} complete.',
      'ann.clear': 'Picture complete! Level {level} done, plus {bonus} points.',
      'ann.gameOver': 'Game over. Final score {score}, reached level {level}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.status': 'Level {level}. Score {score}. {lives} lives. {filled} of {target} filled.',
      'ann.progress': '{filled} of {target} filled. {rows} of {size} rows and {cols} of {size} columns complete.',
      'ann.rowRead': 'Row {row}, clue {clue}. {done} of {total} filled.',
      'ann.colRead': 'Column {col}, clue {clue}. {done} of {total} filled.',
      'ann.rowClue': 'Row {row}: {clue}.',
      'ann.colClue': 'Column {col}: {clue}.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Tabla de dibujos',

      'menu.aria': 'Menú principal',
      'menu.title': 'Tabla de dibujos',
      'menu.subtitle': 'Nonograma sonoro. Lee las pistas numéricas y rellena el dibujo oculto, casilla a casilla.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Cuadrícula de la tabla de dibujos',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.level': 'Nivel',
      'hud.progress': 'Rellenadas',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Rellena la cuadrícula con las pistas numéricas.',
      'help.intro': 'Un nonograma (picross). Cada fila y cada columna tiene una pista: una lista de números con las longitudes de los grupos de casillas rellenas, en orden y con al menos un hueco entre grupos. Solo con las pistas puedes deducir exactamente qué casillas se rellenan. Rellénalas todas para revelar el dibujo oculto y superar el nivel. Todos los puzles tienen solución por lógica pura — sin adivinar — así que rellenar mal es un error de verdad y cuesta una de tres vidas.',
      'help.h.move': '<kbd>Flechas</kbd> / <kbd>WASD</kbd> / <kbd>teclado numérico</kbd> — mueve el cursor.',
      'help.h.fill': '<kbd>Enter</kbd> — rellena la casilla actual. Si en realidad está vacía es un error: se marca como vacía y pierdes una vida.',
      'help.h.cross': '<kbd>X</kbd> — marca la casilla actual como vacía (una nota libre para las que hayas deducido en blanco).',
      'help.h.row': '<kbd>R</kbd> — lee la FILA actual: su pista y un recorrido de izquierda a derecha de sus casillas (cada una desplazada a su columna).',
      'help.h.col': '<kbd>C</kbd> — lee la COLUMNA actual: su pista y un recorrido de arriba abajo (el tono sube hacia arriba).',
      'help.h.status': '<kbd>F1</kbd> puntos, vidas, rellenadas · <kbd>F2</kbd> progreso y líneas completas · <kbd>F3</kbd> ritmo de la pista de fila · <kbd>F4</kbd> ritmo de la pista de columna.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: el cursor se desplaza a su columna (columna izquierda = oído izquierdo, derecha = oído derecho) y sube de tono hacia la fila superior. Al leer una línea, una casilla rellena es un tono cálido, una marcada vacía un toque breve, una desconocida un pip suave. El ritmo de una pista reproduce cada grupo como ese número de pulsos rápidos, separados por un toque grave.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Resuelve unos dibujos!',
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
      'learn.filled': 'Una casilla rellena (tono cálido)',
      'learn.crossed': 'Una casilla vacía marcada (toque)',
      'learn.unknown': 'Una casilla desconocida (pip suave)',
      'learn.clue': 'Un ritmo de pista (3, 1, 2)',
      'learn.fill': 'Rellenar una casilla',
      'learn.mistake': 'Error',
      'learn.line': 'Línea completa',
      'learn.clear': 'Dibujo completo',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio estéreo',
      'test.title': 'Prueba de audio estéreo',
      'test.subtitle': 'Confirma el campo: a la izquierda del todo es la primera columna, a la derecha la última, y el tono sube hacia la fila superior.',
      'test.left': 'Sonar izquierda del todo (columna 1)',
      'test.center': 'Sonar centro',
      'test.right': 'Sonar derecha del todo (última columna)',
      'test.low': 'Sonar grave (fila inferior)',
      'test.high': 'Sonar agudo (fila superior)',
      'test.sweep': 'Recorrer de izquierda a derecha',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.levelStart': 'Nivel {level}. {size} por {size}. Rellena {target} casillas con las pistas.',
      'ann.cellFilled': 'Columna {col}, fila {row}: rellena.',
      'ann.cellCrossed': 'Columna {col}, fila {row}: vacía.',
      'ann.cellUnknown': 'Columna {col}, fila {row}: desconocida.',
      'ann.mistake': 'Error: esa casilla está vacía. Quedan {lives} vidas.',
      'ann.mistakeLast': 'Error: esa casilla está vacía. Sin vidas.',
      'ann.rowDone': 'Fila {row} completa.',
      'ann.colDone': 'Columna {col} completa.',
      'ann.clear': '¡Dibujo completo! Nivel {level} superado, más {bonus} puntos.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}, nivel {level}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
      'ann.status': 'Nivel {level}. Puntos {score}. {lives} vidas. {filled} de {target} rellenas.',
      'ann.progress': '{filled} de {target} rellenas. {rows} de {size} filas y {cols} de {size} columnas completas.',
      'ann.rowRead': 'Fila {row}, pista {clue}. {done} de {total} rellenas.',
      'ann.colRead': 'Columna {col}, pista {clue}. {done} de {total} rellenas.',
      'ann.rowClue': 'Fila {row}: {clue}.',
      'ann.colClue': 'Columna {col}: {clue}.',
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
