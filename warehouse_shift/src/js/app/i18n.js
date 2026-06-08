app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'warehouseShift.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'ann.blockedCrate': 'Blocked. That crate has no room to move.',
      'ann.blockedWall': 'Blocked by wall.',
      'ann.crate': 'crate',
      'ann.crateMoved': 'Crate moved. {placed} of {total} placed.',
      'ann.crateOnGoal': 'crate on a goal',
      'ann.cratePlaced': 'Crate seated. {placed} of {total} placed.',
      'ann.cursorGoal': 'Goal pad underfoot.',
      'ann.deadlock': 'Warning. That crate may be trapped in a corner.',
      'ann.emptyGoal': 'empty goal',
      'ann.help': 'Help. Warehouse Shift is a Sokoban-style warehouse puzzle. Audio is positional: north is always in front.',
      'ann.levelSolved': '{level} solved in {moves} moves, {pushes} pushes, {time}.',
      'ann.levelSolvedBest': 'New best. {level} solved in {moves} moves, {pushes} pushes, {time}.',
      'ann.levelStart': 'Level {number}. {level}. Use arrows or gamepad to move and push crates onto the goal pads.',
      'ann.map': '{level}. Grid {width} by {height}. {crates} crates. Open directions: {open}.',
      'ann.noTarget': 'No active target.',
      'ann.none': 'none',
      'ann.paused': 'Paused.',
      'ann.restart': 'Restarted {level}.',
      'ann.scanCrate': '{dir}: crate in {distance}.',
      'ann.scanCrateGoal': '{dir}: crate on a goal in {distance}.',
      'ann.scanGoal': '{dir}: empty goal in {distance}.',
      'ann.scanWall': '{dir}: wall in {distance}.',
      'ann.status': '{level}. {moves} moves, {pushes} pushes, {undos} undos. {placed} of {total} crates placed. Time {time}.',
      'ann.here': 'right here',
      'ann.stepAxis': '{dir} {count}',
      'ann.target': 'target',
      'ann.targetStatus': '{target}, {steps}.',
      'ann.undo': 'Undo. Back to {moves} moves.',
      'ann.undoEmpty': 'Nothing to undo.',

      'clear.best': 'Best',
      'clear.bestValue': '{moves} moves, {pushes} pushes, {undos} undos, {time}',
      'clear.level': 'Level',
      'clear.moves': 'Moves',
      'clear.newBest': 'New best',
      'clear.pushes': 'Pushes',
      'clear.solved': 'Solved',
      'clear.time': 'Time',
      'clear.title': 'Shift Complete',
      'clear.undos': 'Undos',

      'dir.east': 'east',
      'dir.north': 'north',
      'dir.south': 'south',
      'dir.west': 'west',

      'doc.title': 'Warehouse Shift',

      'game.aria': 'Warehouse Shift game board',

      'help.aria': 'How to play Warehouse Shift',
      'help.back': 'Back',
      'help.audio1': 'The listener is screen-locked. North is always in front, east is always right, south is behind, and west is left.',
      'help.audio2': 'A procedural warehouse rumble runs while you play: floor vibration, ventilation, distant compressors, pallet shifts, and soft electrical hum evolve over time. Crates have a darker wooden synth tone. Empty goals ring brighter. Blocked movement hits from the blocked tile.',
      'help.audio3': 'The current target pings every few seconds. Press Tab or F2 to cycle the target between unsolved crates and empty goals.',
      'help.controls1': '<kbd>Arrow keys</kbd> or gamepad D-pad move one tile. Walk into a crate to push it if the space beyond is clear.',
      'help.controls2': '<kbd>Space</kbd> scans north, east, south, and west. <kbd>F1</kbd> reads status. <kbd>F3</kbd> repeats the scan. <kbd>F4</kbd> reads the map summary.',
      'help.controls3': '<kbd>U</kbd> or <kbd>Z</kbd> undo. <kbd>R</kbd> restarts the level. <kbd>Escape</kbd> pauses.',
      'help.goal1': 'Push every crate onto a goal pad. A level is solved only when every crate is seated on a goal.',
      'help.goal2': 'The challenge is planning. A crate pushed into a wall corner can become impossible to recover unless that corner is a goal.',
      'help.headingAudio': 'Audio map',
      'help.headingControls': 'Controls',
      'help.headingGoal': 'Goal',
      'help.subtitle': 'A hard, audio-first warehouse puzzle about planning pushes before you move.',
      'help.title': 'How to Play',

      'hud.level': 'Level',
      'hud.levelValue': '{number}. {name}',
      'hud.moves': 'Moves',
      'hud.placed': 'Placed',
      'hud.placedValue': '{placed}/{total}',
      'hud.pushes': 'Pushes',
      'hud.target': 'Target',
      'hud.time': 'Time',

      'language.aria': 'Choose language',
      'language.back': 'Back',
      'language.button': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.title': 'Language',

      'levels.aria': 'Choose level',
      'levels.back': 'Back',
      'levels.best': 'Best: {moves} moves, {pushes} pushes, {time}',
      'levels.button': 'Levels',
      'levels.item': '{number}. {name}',
      'levels.locked': 'Locked',
      'levels.subtitle': 'Solved levels unlock the next shift. Best scores favor fewer moves, then fewer pushes.',
      'levels.title': 'Level Select',
      'levels.unsolved': 'Unsolved',

      'menu.aria': 'Main menu',
      'menu.help': 'How to Play',
      'menu.start': 'Start Shift',
      'menu.subtitle': 'Audio-first Sokoban in a synth warehouse.',
      'menu.title': 'Warehouse Shift',

      'pause.aria': 'Paused',
      'pause.levels': 'Level Select',
      'pause.menu': 'Main Menu',
      'pause.restart': 'Restart Level',
      'pause.resume': 'Resume',
      'pause.title': 'Paused',

      'ui.levels': 'Level Select',
      'ui.menu': 'Main Menu',
      'ui.next': 'Next Level',
      'ui.retry': 'Retry',
    },

    es: {
      'ann.blockedCrate': 'Bloqueado. Esa caja no tiene espacio para moverse.',
      'ann.blockedWall': 'Bloqueado por una pared.',
      'ann.crate': 'caja',
      'ann.crateMoved': 'Caja movida. {placed} de {total} colocadas.',
      'ann.crateOnGoal': 'caja sobre un objetivo',
      'ann.cratePlaced': 'Caja encajada. {placed} de {total} colocadas.',
      'ann.cursorGoal': 'Objetivo bajo tus pies.',
      'ann.deadlock': 'Aviso. Esa caja puede estar atrapada en una esquina.',
      'ann.emptyGoal': 'objetivo vacío',
      'ann.help': 'Ayuda. Warehouse Shift es un puzle de almacén tipo Sokoban. El audio es posicional: el norte siempre está delante.',
      'ann.levelSolved': '{level} resuelto en {moves} movimientos, {pushes} empujes, {time}.',
      'ann.levelSolvedBest': 'Nuevo récord. {level} resuelto en {moves} movimientos, {pushes} empujes, {time}.',
      'ann.levelStart': 'Nivel {number}. {level}. Usa las flechas o la cruceta para moverte y empujar cajas hasta los objetivos.',
      'ann.map': '{level}. Cuadrícula de {width} por {height}. {crates} cajas. Direcciones abiertas: {open}.',
      'ann.noTarget': 'No hay objetivo activo.',
      'ann.none': 'ninguna',
      'ann.paused': 'Pausa.',
      'ann.restart': '{level} reiniciado.',
      'ann.scanCrate': '{dir}: caja a {distance}.',
      'ann.scanCrateGoal': '{dir}: caja sobre objetivo a {distance}.',
      'ann.scanGoal': '{dir}: objetivo vacío a {distance}.',
      'ann.scanWall': '{dir}: pared a {distance}.',
      'ann.status': '{level}. {moves} movimientos, {pushes} empujes, {undos} deshacer. {placed} de {total} cajas colocadas. Tiempo {time}.',
      'ann.here': 'aquí mismo',
      'ann.stepAxis': '{dir} {count}',
      'ann.target': 'objetivo',
      'ann.targetStatus': '{target}, {steps}.',
      'ann.undo': 'Deshecho. Vuelves a {moves} movimientos.',
      'ann.undoEmpty': 'Nada que deshacer.',

      'clear.best': 'Mejor',
      'clear.bestValue': '{moves} movimientos, {pushes} empujes, {undos} deshacer, {time}',
      'clear.level': 'Nivel',
      'clear.moves': 'Movimientos',
      'clear.newBest': 'Nuevo récord',
      'clear.pushes': 'Empujes',
      'clear.solved': 'Resuelto',
      'clear.time': 'Tiempo',
      'clear.title': 'Turno completo',
      'clear.undos': 'Deshacer',

      'dir.east': 'este',
      'dir.north': 'norte',
      'dir.south': 'sur',
      'dir.west': 'oeste',

      'doc.title': 'Warehouse Shift',

      'game.aria': 'Tablero de Warehouse Shift',

      'help.aria': 'Cómo jugar a Warehouse Shift',
      'help.back': 'Atrás',
      'help.audio1': 'El oyente está fijado a la pantalla. El norte siempre está delante, el este a la derecha, el sur detrás y el oeste a la izquierda.',
      'help.audio2': 'Mientras juegas suena un retumbo procedural de almacén: vibración del suelo, ventilación, compresores lejanos, palés que se mueven y un zumbido eléctrico suave evolucionan con el tiempo. Las cajas tienen un tono de madera más oscuro. Los objetivos vacíos suenan más brillantes. Un movimiento bloqueado golpea desde la casilla bloqueada.',
      'help.audio3': 'El objetivo actual emite pulsos cada pocos segundos. Pulsa Tab o F2 para alternar entre cajas sin resolver y objetivos vacíos.',
      'help.controls1': '<kbd>Flechas</kbd> o cruceta: mover una casilla. Camina contra una caja para empujarla si la casilla siguiente está libre.',
      'help.controls2': '<kbd>Espacio</kbd> explora norte, este, sur y oeste. <kbd>F1</kbd> lee el estado. <kbd>F3</kbd> repite la exploración. <kbd>F4</kbd> lee el resumen del mapa.',
      'help.controls3': '<kbd>U</kbd> o <kbd>Z</kbd> deshace. <kbd>R</kbd> reinicia el nivel. <kbd>Escape</kbd> pausa.',
      'help.goal1': 'Empuja todas las cajas hasta los objetivos. El nivel solo queda resuelto cuando cada caja está colocada sobre un objetivo.',
      'help.goal2': 'El reto es planificar. Una caja empujada a una esquina de pared puede quedar perdida si esa esquina no es un objetivo.',
      'help.headingAudio': 'Mapa sonoro',
      'help.headingControls': 'Controles',
      'help.headingGoal': 'Objetivo',
      'help.subtitle': 'Un puzle de almacén difícil y audio-first sobre planificar antes de empujar.',
      'help.title': 'Cómo jugar',

      'hud.level': 'Nivel',
      'hud.levelValue': '{number}. {name}',
      'hud.moves': 'Movimientos',
      'hud.placed': 'Colocadas',
      'hud.placedValue': '{placed}/{total}',
      'hud.pushes': 'Empujes',
      'hud.target': 'Objetivo',
      'hud.time': 'Tiempo',

      'language.aria': 'Elegir idioma',
      'language.back': 'Atrás',
      'language.button': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.title': 'Idioma',

      'levels.aria': 'Elegir nivel',
      'levels.back': 'Atrás',
      'levels.best': 'Mejor: {moves} movimientos, {pushes} empujes, {time}',
      'levels.button': 'Niveles',
      'levels.item': '{number}. {name}',
      'levels.locked': 'Bloqueado',
      'levels.subtitle': 'Cada nivel resuelto desbloquea el siguiente turno. El récord valora menos movimientos y luego menos empujes.',
      'levels.title': 'Selección de nivel',
      'levels.unsolved': 'Sin resolver',

      'menu.aria': 'Menú principal',
      'menu.help': 'Cómo jugar',
      'menu.start': 'Empezar turno',
      'menu.subtitle': 'Sokoban audio-first en un almacén de sintetizadores.',
      'menu.title': 'Warehouse Shift',

      'pause.aria': 'Pausa',
      'pause.levels': 'Selección de nivel',
      'pause.menu': 'Menú principal',
      'pause.restart': 'Reiniciar nivel',
      'pause.resume': 'Continuar',
      'pause.title': 'Pausa',

      'ui.levels': 'Selección de nivel',
      'ui.menu': 'Menú principal',
      'ui.next': 'Siguiente nivel',
      'ui.retry': 'Reintentar',
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

    const fallback = dictionaries[FALLBACK]
    if (fallback && fallback[key] != null) return fallback[key]

    return key
  }

  function format(template, params) {
    if (!params) return template

    return String(template).replace(/\{(\w+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(params, key) && params[key] != null ? params[key] : match
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
    applyDom,
    available: () => Object.keys(dictionaries).map((id) => ({id, name: localeNames[id] || id})),
    detect,
    locale: () => current,
    localeName: (id) => localeNames[id] || id,
    onChange,
    setLocale,
    t,
  }
})()
