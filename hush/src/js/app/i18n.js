/**
 * Lightweight i18n for Hush. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'hush.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Hush',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Hush',
      'menu.subtitle': 'A grid of humming cells. Toggle them in plus-shapes until every cell falls silent.',
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
      'game.aria': 'Hush grid',
      'hud.score': 'Score',
      'hud.level': 'Level',
      'hud.moves': 'Moves',
      'hud.lit': 'Humming',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Silence every cell.',
      'help.intro': "You're on a grid of cells. Each is either humming (on) or silent (off). Press a cell and it flips that cell AND its four orthogonal neighbours — a plus shape. Your goal is total silence: every cell off. Each press spends a move from a budget set just above the puzzle's shortest solution, so it can always be solved — but waste moves and you'll run out. Undo costs nothing back. Clear the grid to advance to a bigger one.",
      'help.h.move': '<kbd>Arrow keys</kbd>, <kbd>WASD</kbd> or <kbd>numpad</kbd> — move the cursor. North is in front, south behind, east right, west left.',
      'help.h.press': '<kbd>Enter</kbd> or <kbd>Space</kbd> — press: toggle the current cell and its four neighbours.',
      'help.h.scan': '<kbd>C</kbd> — scan the cross: hear the current cell and its four neighbours laid out by compass. A humming cell is a warm tone; a silent one a soft tick.',
      'help.h.undo': '<kbd>U</kbd> or <kbd>Backspace</kbd> — undo the last press and refund the move.',
      'help.h.locate': '<kbd>F2</kbd> — say your column and row, with a tone whose pitch is your row and whose side is your column.',
      'help.h.status': '<kbd>F1</kbd> score, level, moves, humming · <kbd>F3</kbd> cells still humming · <kbd>F4</kbd> moves left.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: when you press, the five toggled cells fire outward from you by compass — cells turning on rise in pitch, cells turning off fall. Scan to read the cross before you commit. The board falls completely silent the instant you solve it.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Go quiet a few grids!',
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
      'learn.on': 'Humming cell (on)',
      'learn.off': 'Silent cell (off)',
      'learn.press': 'Press (toggle the plus)',
      'learn.scan': 'Cross scan (sample)',
      'learn.clear': 'Grid silenced (level clear)',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Spatial test
      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm the compass: front is north, right is east, behind is south, left is west.',
      'test.north': 'Play north (front)',
      'test.east': 'Play east (right)',
      'test.south': 'Play south (behind)',
      'test.west': 'Play west (left)',
      'test.ring': 'Play full ring',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Directions / cell states
      'dir.n': 'north', 'dir.e': 'east', 'dir.s': 'south', 'dir.w': 'west',
      'cell.on': 'humming', 'cell.off': 'silent',

      // Announcements
      'ann.levelStart': 'Level {level}. {size} by {size} grid, {lights} cells humming, {budget} moves. Silence them all.',
      'ann.cell': 'Column {col}, row {row}: {state}.',
      'ann.edge': 'Edge.',
      'ann.pressed': 'Pressed. {lights} cells still humming.',
      'ann.undo': 'Undone. {lights} cells still humming.',
      'ann.undoEmpty': 'Nothing to undo.',
      'ann.cross': 'Here {here}. {hum}',
      'ann.crossHum': 'Humming: {dirs}.',
      'ann.crossQuiet': 'Neighbours all silent.',
      'ann.status': 'Score {score}, level {level}, {moves} moves left, {lights} humming.',
      'ann.locate': 'Column {col}, row {row}, of {size}.',
      'ann.lights': '{lights} cells still humming.',
      'ann.moves': '{moves} moves left.',
      'ann.levelClear': 'Silence! Plus {bonus} points. Level {level} cleared.',
      'ann.gameOver': 'Out of moves. Final score {score}.',
      'ann.gameOverHigh': 'Out of moves. New high score, {score}!',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Silencio',

      'menu.aria': 'Menú principal',
      'menu.title': 'Silencio',
      'menu.subtitle': 'Una cuadrícula de celdas que zumban. Alterna en forma de cruz hasta que todas callen.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Cuadrícula de Silencio',
      'hud.score': 'Puntos',
      'hud.level': 'Nivel',
      'hud.moves': 'Jugadas',
      'hud.lit': 'Zumbando',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Haz callar todas las celdas.',
      'help.intro': 'Estás en una cuadrícula de celdas. Cada una zumba (encendida) o calla (apagada). Al pulsar una celda se invierte ESA celda Y sus cuatro vecinas ortogonales — una cruz. Tu objetivo es el silencio total: todas apagadas. Cada pulsación gasta una jugada de un presupuesto fijado justo por encima de la solución más corta, así que siempre tiene solución — pero si malgastas jugadas, te quedarás sin ellas. Deshacer no cuesta. Despeja la cuadrícula para avanzar a una mayor.',
      'help.h.move': '<kbd>Flechas</kbd>, <kbd>WASD</kbd> o <kbd>teclado numérico</kbd> — mueve el cursor. El norte al frente, el sur detrás, el este a la derecha, el oeste a la izquierda.',
      'help.h.press': '<kbd>Enter</kbd> o <kbd>Espacio</kbd> — pulsar: invierte la celda actual y sus cuatro vecinas.',
      'help.h.scan': '<kbd>C</kbd> — escanea la cruz: escucha la celda actual y sus cuatro vecinas por brújula. Una celda que zumba es un tono cálido; una en silencio, un toque suave.',
      'help.h.undo': '<kbd>U</kbd> o <kbd>Retroceso</kbd> — deshaz la última pulsación y recupera la jugada.',
      'help.h.locate': '<kbd>F2</kbd> — di tu columna y fila, con un tono cuya altura es tu fila y cuyo lado es tu columna.',
      'help.h.status': '<kbd>F1</kbd> puntos, nivel, jugadas, zumbando · <kbd>F3</kbd> celdas que aún zumban · <kbd>F4</kbd> jugadas restantes.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: al pulsar, las cinco celdas invertidas salen disparadas desde ti por brújula — las que se encienden suben de tono, las que se apagan bajan. Escanea para leer la cruz antes de decidir. La cuadrícula calla por completo en cuanto la resuelves.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. Ve a acallar unas cuadrículas!',
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
      'learn.on': 'Celda que zumba (encendida)',
      'learn.off': 'Celda en silencio (apagada)',
      'learn.press': 'Pulsar (invertir la cruz)',
      'learn.scan': 'Escaneo de cruz (muestra)',
      'learn.clear': 'Cuadrícula en silencio (nivel)',
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

      'dir.n': 'norte', 'dir.e': 'este', 'dir.s': 'sur', 'dir.w': 'oeste',
      'cell.on': 'zumbando', 'cell.off': 'en silencio',

      'ann.levelStart': 'Nivel {level}. Cuadrícula de {size} por {size}, {lights} celdas zumbando, {budget} jugadas. Acállalas todas.',
      'ann.cell': 'Columna {col}, fila {row}: {state}.',
      'ann.edge': 'Borde.',
      'ann.pressed': 'Pulsado. {lights} celdas aún zumban.',
      'ann.undo': 'Deshecho. {lights} celdas aún zumban.',
      'ann.undoEmpty': 'Nada que deshacer.',
      'ann.cross': 'Aquí {here}. {hum}',
      'ann.crossHum': 'Zumbando: {dirs}.',
      'ann.crossQuiet': 'Vecinas todas en silencio.',
      'ann.status': 'Puntos {score}, nivel {level}, {moves} jugadas, {lights} zumbando.',
      'ann.locate': 'Columna {col}, fila {row}, de {size}.',
      'ann.lights': '{lights} celdas aún zumban.',
      'ann.moves': '{moves} jugadas restantes.',
      'ann.levelClear': '¡Silencio! Más {bonus} puntos. Nivel {level} superado.',
      'ann.gameOver': 'Sin jugadas. Puntuación final {score}.',
      'ann.gameOverHigh': 'Sin jugadas. ¡Nuevo récord, {score}!',
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
