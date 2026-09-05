/**
 * Lightweight i18n for Span. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'span.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Span',

      'menu.aria': 'Main menu',
      'menu.title': 'Span',
      'menu.subtitle': 'Audio bridges. Connect every island into one network so each island carries exactly its number of bridges.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Span board',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.level': 'Level',
      'hud.moves': 'Moves',
      'hud.left': 'Unsolved',

      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Bridge every island into one network.',
      'help.intro': 'A bridges puzzle (Hashiwokakero). Islands sit on a grid, each showing a number. Build bridges — straight, horizontal or vertical, one or two between a pair — so that every island carries exactly its number of bridges, no two bridges cross, and all the islands join into a single connected network. Every puzzle is generated from a real network, so a solution always exists. You have a generous move budget; run out and the puzzle is failed, costing one of three lives. Solve it to climb to a bigger board.',
      'help.h.move': '<kbd>Arrow keys</kbd> / <kbd>WASD</kbd> / <kbd>numpad</kbd> — hop the cursor to the next island north, south, east, or west.',
      'help.h.bridge': '<kbd>Enter</kbd> — select the island, then press a <kbd>direction</kbd> to add a bridge that way; pressing again makes it a double, a third time removes it.',
      'help.h.shortcut': '<kbd>Shift</kbd> + a <kbd>direction</kbd> — cycle the bridge that way from the current island in one step, without selecting first.',
      'help.h.scan': '<kbd>Space</kbd> — scan the compass: each direction plays a cue — silence-ish for open water, a soft pip for a reachable island with no bridge yet, a taut tone (doubled for two bridges) for an existing bridge.',
      'help.h.describe': '<kbd>C</kbd> — describe the current island: its number, how many bridges it has, and what lies in each direction.',
      'help.h.analysis': '<kbd>F2</kbd> — list the islands that don’t yet carry their number.',
      'help.h.status': '<kbd>F1</kbd> score, lives, moves left, islands unsolved · <kbd>F3</kbd> progress · <kbd>F4</kbd> describe the current island.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: an island’s position tone pans to its column and rises in pitch toward the north (top). The compass scan and each bridge you build come from their true direction around you — north in front, south behind, east to your right, west to your left — and sounds behind you are muffled. A soft shimmer when you land on an island means it already carries exactly its number.',
      'help.back': 'Back',

      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Connect a few islands!',
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
      'learn.island': 'An island (position tone)',
      'learn.scan': 'Scan the compass (N bridge, E open, S double)',
      'learn.bridge': 'Build a bridge',
      'learn.double': 'Build a double bridge',
      'learn.cross': 'Blocked: would cross',
      'learn.satisfied': 'Island satisfied',
      'learn.select': 'Select an island',
      'learn.clear': 'Puzzle solved',
      'learn.fail': 'Out of moves',
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

      'ann.levelStart': 'Level {level}. {size} by {size}, {islands} islands, {moves} moves. Connect them all.',
      'ann.island': 'Island column {col}, row {row}. Needs {target}, has {current}.',
      'ann.satisfied': 'Satisfied.',
      'ann.selectedPrefix': 'Selected.',
      'ann.deselected': 'Deselected.',
      'ann.noNeighbor': 'No island that way.',
      'ann.cross': 'Blocked — a bridge is in the way.',
      'ann.bridge': 'Bridge {dir}: {count}.',
      'ann.clear': 'All connected! Level {level} solved, plus {bonus} points.',
      'ann.fail': 'Out of moves — puzzle failed. {lives} lives left.',
      'ann.failLast': 'Out of moves — no lives left.',
      'ann.gameOver': 'Game over. Final score {score}, reached level {level}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.status': 'Level {level}. Score {score}. {lives} lives. {moves} moves left. {left} islands unsolved.',
      'ann.analysis': '{n} islands unsolved. {list}.',
      'ann.unCell': 'column {col} row {row} has {current} of {target}',
      'ann.allDone': 'Every island carries its number.',
      'ann.progress': '{left} of {total} islands unsolved. {moves} moves left.',
      'ann.dirInfo': '{dir}: an island needing {target}, {count} bridges.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Span',

      'menu.aria': 'Menú principal',
      'menu.title': 'Span',
      'menu.subtitle': 'Puentes sonoros. Conecta todas las islas en una sola red para que cada isla lleve exactamente su número de puentes.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Tablero de Span',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.level': 'Nivel',
      'hud.moves': 'Movimientos',
      'hud.left': 'Sin resolver',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Conecta todas las islas en una sola red.',
      'help.intro': 'Un puzle de puentes (Hashiwokakero). Las islas están en una cuadrícula, cada una con un número. Construye puentes — rectos, horizontales o verticales, uno o dos entre un par — de modo que cada isla lleve exactamente su número de puentes, que ningún puente cruce a otro, y que todas las islas queden conectadas en una sola red. Cada puzle se genera a partir de una red real, así que siempre hay solución. Tienes un margen de movimientos generoso; si se agota, el puzle se pierde y gastas una de tres vidas. Resuélvelo para subir a un tablero mayor.',
      'help.h.move': '<kbd>Flechas</kbd> / <kbd>WASD</kbd> / <kbd>teclado numérico</kbd> — salta el cursor a la siguiente isla al norte, sur, este u oeste.',
      'help.h.bridge': '<kbd>Enter</kbd> — selecciona la isla y luego pulsa una <kbd>dirección</kbd> para añadir un puente; otra vez lo hace doble, una tercera lo quita.',
      'help.h.shortcut': '<kbd>Mayús</kbd> + una <kbd>dirección</kbd> — alterna el puente en esa dirección desde la isla actual de un paso, sin seleccionar antes.',
      'help.h.scan': '<kbd>Espacio</kbd> — escanea la brújula: cada dirección suena — casi silencio para agua abierta, un pip suave para una isla alcanzable sin puente, un tono tenso (doble si hay dos) para un puente existente.',
      'help.h.describe': '<kbd>C</kbd> — describe la isla actual: su número, cuántos puentes tiene y qué hay en cada dirección.',
      'help.h.analysis': '<kbd>F2</kbd> — lista las islas que aún no llevan su número.',
      'help.h.status': '<kbd>F1</kbd> puntos, vidas, movimientos, islas sin resolver · <kbd>F3</kbd> progreso · <kbd>F4</kbd> describe la isla actual.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: el tono de posición de una isla se desplaza a su columna y sube de tono hacia el norte (arriba). El escaneo de la brújula y cada puente que construyes vienen de su verdadera dirección a tu alrededor — el norte al frente, el sur detrás, el este a la derecha, el oeste a la izquierda — y los sonidos a tu espalda suenan apagados. Un brillo suave al llegar a una isla significa que ya lleva exactamente su número.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Conecta unas islas!',
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
      'learn.island': 'Una isla (tono de posición)',
      'learn.scan': 'Escanear la brújula (N puente, E abierto, S doble)',
      'learn.bridge': 'Construir un puente',
      'learn.double': 'Construir un puente doble',
      'learn.cross': 'Bloqueado: cruzaría',
      'learn.satisfied': 'Isla satisfecha',
      'learn.select': 'Seleccionar una isla',
      'learn.clear': 'Puzle resuelto',
      'learn.fail': 'Sin movimientos',
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

      'ann.levelStart': 'Nivel {level}. {size} por {size}, {islands} islas, {moves} movimientos. Conéctalas todas.',
      'ann.island': 'Isla columna {col}, fila {row}. Necesita {target}, tiene {current}.',
      'ann.satisfied': 'Satisfecha.',
      'ann.selectedPrefix': 'Seleccionada.',
      'ann.deselected': 'Deseleccionada.',
      'ann.noNeighbor': 'No hay isla por ahí.',
      'ann.cross': 'Bloqueado: hay un puente en medio.',
      'ann.bridge': 'Puente al {dir}: {count}.',
      'ann.clear': '¡Todo conectado! Nivel {level} resuelto, más {bonus} puntos.',
      'ann.fail': 'Sin movimientos: puzle perdido. Quedan {lives} vidas.',
      'ann.failLast': 'Sin movimientos: sin vidas.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}, nivel {level}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
      'ann.status': 'Nivel {level}. Puntos {score}. {lives} vidas. {moves} movimientos. {left} islas sin resolver.',
      'ann.analysis': '{n} islas sin resolver. {list}.',
      'ann.unCell': 'columna {col} fila {row} tiene {current} de {target}',
      'ann.allDone': 'Todas las islas llevan su número.',
      'ann.progress': '{left} de {total} islas sin resolver. {moves} movimientos.',
      'ann.dirInfo': '{dir}: una isla que necesita {target}, {count} puentes.',
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
