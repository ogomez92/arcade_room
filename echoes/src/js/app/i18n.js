/**
 * Lightweight i18n for Echoes. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'echoes.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Echoes',

      'menu.aria': 'Main menu',
      'menu.title': 'Echoes',
      'menu.subtitle': 'A sound-memory game. Flip cells to hear hidden tones and match the pairs.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Echoes grid',
      'hud.score': 'Score',
      'hud.level': 'Level',
      'hud.flips': 'Flips left',
      'hud.pairs': 'Pairs left',

      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Match every pair before your flips run out.',
      'help.intro': 'A grid of cells each hides a sound. Flip one to hear its tone, then flip another to try to match it. Two cells with the same sound stay revealed; a mismatch is shown briefly, then both hide again — so remember where each sound was. Match every pair to clear the board and move to a bigger one. Each flip spends from a limited budget; run out before clearing and the run ends.',
      'help.h.move': '<kbd>Arrow keys</kbd> or <kbd>numpad</kbd> — move the cursor.',
      'help.h.flip': '<kbd>Enter</kbd> or <kbd>Space</kbd> — flip the current cell.',
      'help.h.cell': '<kbd>C</kbd> — describe the current cell (and replay it if it is face up or matched).',
      'help.h.locate': '<kbd>F2</kbd> — say your column and row, with a tone whose pitch is your row and whose side is your column.',
      'help.h.status': '<kbd>F1</kbd> score, level and flips left · <kbd>F3</kbd> pairs left.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: every pair is a distinct instrument and pitch — match by recognising the same sound twice. A cell sounds from the left or right depending on its column. Your movement beacon is world-fixed: higher pitch means a row to the north, lower means south; left or right means west or east. A bright rising chime is a match; a short falling tone is a mismatch.',
      'help.back': 'Back',

      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Go match some echoes!',
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
      'learn.timbres': 'Sample instruments',
      'learn.match': 'A matched pair',
      'learn.mismatch': 'A mismatch',
      'learn.clear': 'Board cleared',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm the world-fixed cue: north is high, south is low, east is right, west is left.',
      'test.north': 'Play north (high)',
      'test.east': 'Play east (right)',
      'test.south': 'Play south (low)',
      'test.west': 'Play west (left)',
      'test.ring': 'Play full ring',
      'test.back': 'Back',

      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      'ann.levelStart': 'Level {level}. {cols} by {rows}, {pairs} pairs.',
      'ann.cellCovered': 'Covered',
      'ann.cellUp': 'Face up',
      'ann.cellMatched': 'Matched',
      'ann.cellEdge': 'Edge',
      'ann.match': 'Match!',
      'ann.mismatch': 'No match.',
      'ann.levelClear': 'Board cleared! Plus {bonus} points. Level {level} done.',
      'ann.gameOver': 'Game over. Final score {score}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.status': 'Score {score}, level {level}, {flips} flips left.',
      'ann.locate': 'Column {col} of {cols}, row {row} of {rows}.',
      'ann.pairs': '{remaining} of {total} pairs left.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
    },

    es: {
      'doc.title': 'Echoes',

      'menu.aria': 'Menú principal',
      'menu.title': 'Echoes',
      'menu.subtitle': 'Un juego de memoria sonora. Voltea celdas para oír tonos ocultos y empareja.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Cuadrícula de Echoes',
      'hud.score': 'Puntos',
      'hud.level': 'Nivel',
      'hud.flips': 'Volteos restantes',
      'hud.pairs': 'Parejas restantes',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Empareja todas las parejas antes de quedarte sin volteos.',
      'help.intro': 'Una cuadrícula de celdas, cada una esconde un sonido. Voltea una para oír su tono y voltea otra para intentar emparejarla. Dos celdas con el mismo sonido quedan reveladas; un fallo se muestra un instante y luego ambas se ocultan otra vez, así que recuerda dónde estaba cada sonido. Empareja todas las parejas para despejar el tablero y pasar a uno más grande. Cada volteo gasta de un presupuesto limitado; si se agota antes de despejar, termina la partida.',
      'help.h.move': '<kbd>Flechas</kbd> o <kbd>teclado numérico</kbd> — mueve el cursor.',
      'help.h.flip': '<kbd>Enter</kbd> o <kbd>Espacio</kbd> — voltea la celda actual.',
      'help.h.cell': '<kbd>C</kbd> — describe la celda actual (y la repite si está revelada o emparejada).',
      'help.h.locate': '<kbd>F2</kbd> — di tu columna y fila, con un tono cuya altura es tu fila y cuyo lado es tu columna.',
      'help.h.status': '<kbd>F1</kbd> puntos, nivel y volteos restantes · <kbd>F3</kbd> parejas restantes.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: cada pareja es un instrumento y un tono distintos: empareja reconociendo el mismo sonido dos veces. Una celda suena a la izquierda o a la derecha según su columna. Tu baliza de movimiento es fija respecto al mundo: más agudo significa una fila al norte, más grave al sur; izquierda o derecha es oeste u este. Un repique brillante ascendente es un acierto; un tono breve descendente es un fallo.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. Empareja unos ecos!',
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
      'learn.timbres': 'Instrumentos de muestra',
      'learn.match': 'Una pareja acertada',
      'learn.mismatch': 'Un fallo',
      'learn.clear': 'Tablero despejado',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma la señal fija: el norte es agudo, el sur grave, el este a la derecha, el oeste a la izquierda.',
      'test.north': 'Sonar al norte (agudo)',
      'test.east': 'Sonar al este (derecha)',
      'test.south': 'Sonar al sur (grave)',
      'test.west': 'Sonar al oeste (izquierda)',
      'test.ring': 'Sonar el anillo completo',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.levelStart': 'Nivel {level}. {cols} por {rows}, {pairs} parejas.',
      'ann.cellCovered': 'Cubierta',
      'ann.cellUp': 'Revelada',
      'ann.cellMatched': 'Emparejada',
      'ann.cellEdge': 'Borde',
      'ann.match': '¡Pareja!',
      'ann.mismatch': 'No coincide.',
      'ann.levelClear': '¡Tablero despejado! Más {bonus} puntos. Nivel {level} completado.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
      'ann.status': 'Puntos {score}, nivel {level}, {flips} volteos restantes.',
      'ann.locate': 'Columna {col} de {cols}, fila {row} de {rows}.',
      'ann.pairs': '{remaining} de {total} parejas restantes.',
      'ann.paused': 'Pausa.',
      'ann.resumed': 'Reanudado.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.onlineRank': 'Puesto en línea número {rank}.',
      'ann.onlineError': 'Clasificación no disponible. Guardado en este dispositivo.',
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

  function t(key, params) { return format(lookup(key, current), params) }

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
