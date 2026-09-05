/**
 * Lightweight i18n for Minefield. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'minefield.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Minefield',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Minefield',
      'menu.subtitle': 'An audio minesweeper. Deduce where the mines are and clear the field.',
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
      'game.aria': 'Minefield grid',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.level': 'Level',
      'hud.mines': 'Mines left',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Clear every safe cell without detonating a mine.',
      'help.intro': 'You stand on a grid of buried cells. Some hide mines. Uncover a safe cell and it tells you how many of its eight neighbours are mines — count the pings, or read the spoken number. Use those numbers to deduce where mines are, flag them, and uncover the rest. Clear all safe cells to advance. Hitting a mine costs a life; lose three and the run ends.',
      'help.h.move': '<kbd>Arrow keys</kbd> or <kbd>numpad</kbd> — move the cursor north, east, south, west.',
      'help.h.dig': '<kbd>Enter</kbd> — uncover (dig) the current cell.',
      'help.h.scan': '<kbd>Space</kbd> — scan: hear the eight neighbours laid out around you by compass (north is in front, south behind, east right, west left).',
      'help.h.flag': '<kbd>F</kbd> — plant or remove a flag on a suspected mine.',
      'help.h.cell': '<kbd>C</kbd> — describe the current cell.',
      'help.h.locate': '<kbd>F2</kbd> — say your column and row, with a tone whose pitch is your row and whose side is your column.',
      'help.h.status': '<kbd>F1</kbd> score and lives · <kbd>F3</kbd> progress · <kbd>F4</kbd> mines remaining.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: in a scan, a covered cell is a soft pip, a flag is a bright double beep, a cleared empty cell is a low thud, and a numbered cell rings like a bell — higher pitch means more nearby mines. The field edge is a dull wall thud. Sounds behind you (to the south) are muffled.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Clear a few fields!',
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
      'learn.move': 'Move cursor (position tone)',
      'learn.dig0': 'Dig: open ground (0 mines)',
      'learn.dig1': 'Dig: 1 nearby mine',
      'learn.dig3': 'Dig: 3 nearby mines',
      'learn.flagon': 'Plant flag',
      'learn.flagoff': 'Remove flag',
      'learn.mine': 'Mine explosion',
      'learn.clear': 'Level clear',
      'learn.over': 'Game over',
      'learn.scan': 'Scan neighbours (sample)',
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

      // Announcements
      'ann.levelStart': 'Level {level}. {cols} by {rows}, {mines} mines.',
      'ann.cellCovered': 'Covered',
      'ann.cellFlagged': 'Flag',
      'ann.cellEmpty': 'Clear',
      'ann.cellNumber': '{n}',
      'ann.cellMine': 'Detonated mine',
      'ann.cellEdge': 'Edge',
      'ann.dig': '{n} nearby.',
      'ann.digClear': 'Clear. {opened} cells opened.',
      'ann.flagOn': 'Flag planted.',
      'ann.flagOff': 'Flag removed.',
      'ann.flagBlocked': "Can't flag an uncovered cell.",
      'ann.mineHit': 'Mine! {lives} lives left.',
      'ann.mineHitLast': 'Mine! No lives left.',
      'ann.levelClear': 'Field cleared! Plus {bonus} points. Level {level} done.',
      'ann.gameOver': 'Game over. Final score {score}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.score': 'Score {score}, {lives} lives, level {level}.',
      'ann.locate': 'Column {col} of {cols}, row {row} of {rows}.',
      'ann.progress': '{remaining} safe cells left. {mines} mines, {flags} flagged.',
      'ann.minesLeft': '{n} mines still to flag.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Campo Minado',

      'menu.aria': 'Menú principal',
      'menu.title': 'Campo Minado',
      'menu.subtitle': 'Un buscaminas sonoro. Deduce dónde están las minas y despeja el campo.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Cuadrícula del campo minado',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.level': 'Nivel',
      'hud.mines': 'Minas restantes',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Despeja todas las celdas seguras sin detonar una mina.',
      'help.intro': 'Estás sobre una cuadrícula de celdas enterradas. Algunas esconden minas. Al descubrir una celda segura te dice cuántas de sus ocho vecinas son minas: cuenta los pitidos o escucha el número hablado. Usa esos números para deducir dónde hay minas, márcalas con banderas y descubre el resto. Despeja todas las celdas seguras para avanzar. Pisar una mina cuesta una vida; pierde tres y termina la partida.',
      'help.h.move': '<kbd>Flechas</kbd> o <kbd>teclado numérico</kbd> — mueve el cursor norte, este, sur, oeste.',
      'help.h.dig': '<kbd>Enter</kbd> — descubre (excava) la celda actual.',
      'help.h.scan': '<kbd>Espacio</kbd> — escanea: escucha las ocho vecinas situadas a tu alrededor por brújula (el norte al frente, el sur detrás, el este a la derecha, el oeste a la izquierda).',
      'help.h.flag': '<kbd>F</kbd> — coloca o quita una bandera sobre una mina sospechosa.',
      'help.h.cell': '<kbd>C</kbd> — describe la celda actual.',
      'help.h.locate': '<kbd>F2</kbd> — di tu columna y fila, con un tono cuya altura es tu fila y cuyo lado es tu columna.',
      'help.h.status': '<kbd>F1</kbd> puntos y vidas · <kbd>F3</kbd> progreso · <kbd>F4</kbd> minas restantes.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: en un escaneo, una celda cubierta es un pip suave, una bandera es un doble pitido brillante, una celda vacía despejada es un golpe grave, y una celda con número suena como una campana: más agudo significa más minas cerca. El borde del campo es un golpe sordo de muro. Los sonidos detrás de ti (al sur) suenan apagados.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Despeja unos campos!',
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
      'learn.move': 'Mover cursor (tono de posición)',
      'learn.dig0': 'Excavar: terreno despejado (0 minas)',
      'learn.dig1': 'Excavar: 1 mina cerca',
      'learn.dig3': 'Excavar: 3 minas cerca',
      'learn.flagon': 'Colocar bandera',
      'learn.flagoff': 'Quitar bandera',
      'learn.mine': 'Explosión de mina',
      'learn.clear': 'Nivel despejado',
      'learn.over': 'Fin de la partida',
      'learn.scan': 'Escanear vecinas (muestra)',
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

      'ann.levelStart': 'Nivel {level}. {cols} por {rows}, {mines} minas.',
      'ann.cellCovered': 'Cubierta',
      'ann.cellFlagged': 'Bandera',
      'ann.cellEmpty': 'Despejada',
      'ann.cellNumber': '{n}',
      'ann.cellMine': 'Mina detonada',
      'ann.cellEdge': 'Borde',
      'ann.dig': '{n} cerca.',
      'ann.digClear': 'Despejado. {opened} celdas abiertas.',
      'ann.flagOn': 'Bandera colocada.',
      'ann.flagOff': 'Bandera quitada.',
      'ann.flagBlocked': 'No puedes marcar una celda descubierta.',
      'ann.mineHit': '¡Mina! Quedan {lives} vidas.',
      'ann.mineHitLast': '¡Mina! Sin vidas.',
      'ann.levelClear': '¡Campo despejado! Más {bonus} puntos. Nivel {level} completado.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
      'ann.score': 'Puntos {score}, {lives} vidas, nivel {level}.',
      'ann.locate': 'Columna {col} de {cols}, fila {row} de {rows}.',
      'ann.progress': '{remaining} celdas seguras restantes. {mines} minas, {flags} marcadas.',
      'ann.minesLeft': '{n} minas por marcar.',
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
