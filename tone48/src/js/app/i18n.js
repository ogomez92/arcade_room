/**
 * Lightweight i18n for Meld. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'tone48.lang'

  const localeNames = {en: 'English', es: 'Español'}

  const dictionaries = {
    en: {
      'doc.title': 'tone48',

      'menu.aria': 'Main menu',
      'menu.title': 'tone48',
      'menu.subtitle': 'Slide the tones together; equal tones meld into one a step higher. Build the highest tone you can.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'tone48 board',
      'hud.score': 'Score',
      'hud.best': 'Best',
      'hud.free': 'Free',
      'hud.tiles': 'Tones',

      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Meld matching tones into ever-higher ones.',
      'help.intro': 'The board is a grid of tones laid out around you — each one sounds from its own compass cell, and the higher its value the higher its pitch. Swipe in a compass direction and every tone slides that way; when two equal tones collide they MELD into one of double the value, a step higher in pitch. After any move that changes the board, a new low tone appears in an empty cell. Plan your moves to keep the board open and build the highest tone you can; the run ends when the board is full and nothing can meld. (It is the 2048 puzzle, heard.)',
      'help.h.cursor': '<kbd>Arrow keys</kbd>, <kbd>WASD</kbd> or <kbd>numpad</kbd> — move the inspection cursor one cell. The cell you land on sounds from its compass position (pitch by value) and its value is spoken. The cursor only reads the board; it never moves the tones.',
      'help.h.move': '<kbd>Shift</kbd> + <kbd>arrow keys</kbd> or <kbd>WASD</kbd> — swipe north, east, south or west. North is in front, south behind, east right, west left. Every tone slides that way and equal tones meld.',
      'help.h.scan': '<kbd>C</kbd> — scan the whole board: each tone sounds in turn from its cell around you (north-west tones front-left, south-east behind-right), pitch by value, empty cells a faint tick.',
      'help.h.rows': '<kbd>1</kbd>–<kbd>4</kbd> — scan a single row (1 is the north row) and hear its values spoken.',
      'help.h.status': '<kbd>F1</kbd> score and best · <kbd>F2</kbd> best tone and where it sits · <kbd>F3</kbd> free cells and tones on the board · <kbd>F4</kbd> last move.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: a move whooshes in the direction you swiped; each meld is the two tones rising into one a step higher, played from the cell where they joined; a new tone drops in with a soft tick. Reach a new highest tone and a bright flourish rings out.',
      'help.back': 'Back',

      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Go build a big tone!',
      'highscores.entry': '#{rank}. {name} — {score} points, best tone 2^{level}',
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
      'learn.ladder': 'The tone ladder (2 up to 256)',
      'learn.meld': 'A meld (two tones become one higher)',
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

      'dir.n': 'north', 'dir.e': 'east', 'dir.s': 'south', 'dir.w': 'west',
      'cell.empty': 'empty',

      'ann.cursor': 'Tone {value}, column {col}, row {row}.',
      'ann.cursorEmpty': 'Empty, column {col}, row {row}.',
      'ann.start': 'New board. {size} by {size}, {tiles} tones.',
      'ann.move': 'Slid {dir}. +{gained}. {free} free.',
      'ann.spawn': 'New tone ({value}) at column {col}, row {row}.',
      'ann.milestone': '{tile}! New best tone.',
      'ann.noMove': 'No change — nothing slides that way.',
      'ann.board': '{tiles} tones, {free} free, best {best}.',
      'ann.row': 'Row {row}: {values}.',
      'ann.status': 'Score {score}, best tone {best}.',
      'ann.best': 'Best tone {tile}, at column {col}, row {row}.',
      'ann.free': '{free} free cells, {tiles} tones on the board.',
      'ann.last': 'Last move: {dir}, +{gained}, {melds} melds.',
      'ann.noLast': 'No move yet.',
      'ann.stuck': 'No moves left. The board is full.',
      'ann.gameOver': 'Game over. Final score {score}, best tone {tile}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}! Best tone {tile}.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank: number {rank}.',
      'ann.onlineError': "Couldn't reach the leaderboard; saved locally.",
    },

    es: {
      'doc.title': 'tone48',

      'menu.aria': 'Menú principal',
      'menu.title': 'tone48',
      'menu.subtitle': 'Desliza los tonos juntos; tonos iguales se funden en uno un paso más alto. Construye el tono más alto que puedas.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Tablero de tone48',
      'hud.score': 'Puntos',
      'hud.best': 'Mejor',
      'hud.free': 'Libres',
      'hud.tiles': 'Tonos',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Funde tonos iguales en otros cada vez más altos.',
      'help.intro': 'El tablero es una cuadrícula de tonos a tu alrededor — cada uno suena desde su propia celda de la brújula, y cuanto mayor su valor, más agudo su tono. Desliza en una dirección de la brújula y todos los tonos se mueven hacia allí; cuando dos tonos iguales chocan se FUNDEN en uno del doble de valor, un paso más agudo. Tras cualquier movimiento que cambie el tablero, aparece un tono bajo nuevo en una celda vacía. Planifica para mantener el tablero abierto y construir el tono más alto posible; la partida termina cuando el tablero está lleno y nada puede fundirse. (Es el rompecabezas 2048, en sonido.)',
      'help.h.cursor': '<kbd>Flechas</kbd>, <kbd>WASD</kbd> o <kbd>teclado numérico</kbd> — mueve el cursor de inspección una celda. La celda donde caes suena desde su posición en la brújula (tono según valor) y se dice su valor. El cursor solo lee el tablero; nunca mueve los tonos.',
      'help.h.move': '<kbd>Mayús</kbd> + <kbd>flechas</kbd> o <kbd>WASD</kbd> — desliza al norte, este, sur u oeste. El norte al frente, el sur detrás, el este a la derecha, el oeste a la izquierda. Todos los tonos se deslizan y los iguales se funden.',
      'help.h.scan': '<kbd>C</kbd> — escanea todo el tablero: cada tono suena por turno desde su celda a tu alrededor (los del noroeste al frente-izquierda, los del sureste detrás-derecha), tono según valor, las celdas vacías un toque tenue.',
      'help.h.rows': '<kbd>1</kbd>–<kbd>4</kbd> — escanea una sola fila (la 1 es la del norte) y escucha sus valores hablados.',
      'help.h.status': '<kbd>F1</kbd> puntos y mejor · <kbd>F2</kbd> mejor tono y dónde está · <kbd>F3</kbd> celdas libres y tonos en el tablero · <kbd>F4</kbd> último movimiento.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: un movimiento silba en la dirección deslizada; cada fusión son los dos tonos subiendo a uno un paso más alto, desde la celda donde se unieron; un tono nuevo cae con un toque suave. Alcanza un nuevo tono más alto y suena un destello brillante.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. Ve a construir un tono grande!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, mejor tono 2^{level}',
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
      'learn.ladder': 'La escalera de tonos (2 hasta 256)',
      'learn.meld': 'Una fusión (dos tonos se vuelven uno más alto)',
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
      'cell.empty': 'vacío',

      'ann.cursor': 'Tono {value}, columna {col}, fila {row}.',
      'ann.cursorEmpty': 'Vacío, columna {col}, fila {row}.',
      'ann.start': 'Tablero nuevo. {size} por {size}, {tiles} tonos.',
      'ann.move': 'Deslizado al {dir}. +{gained}. {free} libres.',
      'ann.spawn': 'Tono nuevo ({value}) en columna {col}, fila {row}.',
      'ann.milestone': '¡{tile}! Nuevo mejor tono.',
      'ann.noMove': 'Sin cambios — nada se desliza por ahí.',
      'ann.board': '{tiles} tonos, {free} libres, mejor {best}.',
      'ann.row': 'Fila {row}: {values}.',
      'ann.status': 'Puntos {score}, mejor tono {best}.',
      'ann.best': 'Mejor tono {tile}, en columna {col}, fila {row}.',
      'ann.free': '{free} celdas libres, {tiles} tonos en el tablero.',
      'ann.last': 'Último movimiento: {dir}, +{gained}, {melds} fusiones.',
      'ann.noLast': 'Aún no hay movimiento.',
      'ann.stuck': 'No quedan movimientos. El tablero está lleno.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}, mejor tono {tile}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}! Mejor tono {tile}.',
      'ann.paused': 'Pausa.',
      'ann.resumed': 'Reanudado.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.onlineRank': 'Puesto en línea: número {rank}.',
      'ann.onlineError': 'No se pudo conectar con la clasificación; guardado localmente.',
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
    if (browser) { const short = browser.slice(0, 2); if (dictionaries[short]) return short }
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
      Object.prototype.hasOwnProperty.call(params, k) && params[k] != null ? params[k] : m)
  }
  function t(key, params) { return format(lookup(key, current), params) }

  function applyDom(root) {
    const scope = root || document
    if (scope === document) {
      document.title = t('doc.title')
      document.documentElement.lang = current
    }
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n'); if (key) el.textContent = t(key)
    })
    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html'); if (key) el.innerHTML = t(key)
    })
    scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr'); if (!spec) return
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
