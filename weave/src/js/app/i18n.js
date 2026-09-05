/**
 * Lightweight i18n for Weave. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'weave.lang'

  const localeNames = {en: 'English', es: 'Español'}

  const dictionaries = {
    en: {
      'doc.title': 'Weave',

      'menu.aria': 'Main menu',
      'menu.title': 'Weave',
      'menu.subtitle': 'Connect each pair of matching threads across the loom — and fill every cell.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Weave loom',
      'hud.score': 'Score',
      'hud.level': 'Level',
      'hud.moves': 'Moves',
      'hud.threads': 'Threads',

      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Connect every colour and fill the loom.',
      'help.intro': 'The loom is a grid. Each colour appears twice, as two anchor cells with the same instrument sound. Stand on an anchor and grab it, then move to draw a thread of that colour, one cell at a time, to its twin anchor — threads cannot cross each other or themselves. You win when every colour is connected AND every cell is covered. Each thread step (and each step back) spends a move from a budget set just above the shortest solution, so it is always winnable; waste too many and the run ends.',
      'help.h.move': '<kbd>Arrow keys</kbd>, <kbd>WASD</kbd> or <kbd>numpad</kbd> — move. North is in front, south behind, east right, west left. While holding a thread, moving draws or retracts it.',
      'help.h.grab': '<kbd>Enter</kbd> or <kbd>Space</kbd> — grab the anchor (or thread tip) under you to start drawing; press again to let go.',
      'help.h.draw': 'While holding a colour, move into an empty cell to extend, or back onto your own thread to retract. Reach the twin anchor to connect.',
      'help.h.scan': '<kbd>C</kbd> — scan the cross: hear the current cell and its four neighbours by compass. Each colour has its own timbre; empty is a soft tick, the edge a dull thud.',
      'help.h.locate': '<kbd>E</kbd> — play a beacon at both anchors of every still-loose colour, so you can hear where they are. <kbd>F2</kbd> — say your position.',
      'help.h.status': '<kbd>F1</kbd> score, level, moves, threads · <kbd>F3</kbd> threads connected and cells uncovered · <kbd>F4</kbd> moves left.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: a colour is recognised by its instrument timbre, played from the compass direction of the cell. Lay a thread and you hear its colour; reach the twin and it rings out. Sounds behind you (to the south) are a little muffled.',
      'help.back': 'Back',

      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Go weave a few looms!',
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
      'learn.colors': 'The six thread colours',
      'learn.cross': 'Cross scan (sample)',
      'learn.connect': 'Thread connected',
      'learn.clear': 'Loom woven (level clear)',
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

      'color.bell': 'bell', 'color.pluck': 'pluck', 'color.marimba': 'marimba',
      'color.glass': 'glass', 'color.reed': 'reed', 'color.bass': 'bass',
      'cell.edge': 'edge', 'cell.empty': 'empty',
      'cell.anchor': '{color} anchor', 'cell.thread': '{color} thread',

      'ann.levelStart': 'Level {level}. {size} by {size} loom, {colors} threads, {budget} moves. Connect every colour and fill the loom.',
      'ann.cell': '{col}, {row}: {what}.',
      'ann.edge': 'Edge.',
      'ann.grab': 'Holding {color}. Draw to its twin anchor.',
      'ann.resume': 'Resumed {color}.',
      'ann.grabFail': 'Nothing to grab. Stand on an anchor or a thread tip.',
      'ann.release': 'Let go.',
      'ann.draw': '{col}, {row}.',
      'ann.retract': 'Back to {col}, {row}.',
      'ann.connect': '{color} connected! {n} of {total}. {empty} cells uncovered.',
      'ann.blocked': 'Blocked.',
      'ann.locating': 'Locating loose threads.',
      'ann.status': 'Score {score}, level {level}, {moves} moves, {n} of {total} threads.',
      'ann.locate': 'Column {col}, row {row}, of {size}. {active}',
      'ann.holding': 'Holding {color}.',
      'ann.empty': 'Hands empty.',
      'ann.progress': '{n} of {total} threads connected. {empty} cells uncovered.',
      'ann.moves': '{moves} moves left. {active}',
      'ann.levelClear': 'Loom woven! Plus {bonus} points. Level {level} complete.',
      'ann.gameOver': 'Out of moves. Final score {score}.',
      'ann.gameOverHigh': 'Out of moves. New high score, {score}!',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Telar',

      'menu.aria': 'Menú principal',
      'menu.title': 'Telar',
      'menu.subtitle': 'Conecta cada par de hilos iguales por el telar — y cubre todas las celdas.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Telar',
      'hud.score': 'Puntos',
      'hud.level': 'Nivel',
      'hud.moves': 'Jugadas',
      'hud.threads': 'Hilos',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Conecta cada color y llena el telar.',
      'help.intro': 'El telar es una cuadrícula. Cada color aparece dos veces, como dos celdas ancla con el mismo sonido de instrumento. Ponte sobre un ancla y agárrala, luego muévete para trazar un hilo de ese color, celda a celda, hasta su ancla gemela — los hilos no pueden cruzarse entre sí ni consigo mismos. Ganas cuando cada color está conectado Y todas las celdas están cubiertas. Cada paso de hilo (y cada paso atrás) gasta una jugada de un presupuesto fijado justo por encima de la solución más corta, así que siempre tiene solución; malgasta demasiadas y la partida termina.',
      'help.h.move': '<kbd>Flechas</kbd>, <kbd>WASD</kbd> o <kbd>teclado numérico</kbd> — moverse. El norte al frente, el sur detrás, el este a la derecha, el oeste a la izquierda. Con un hilo en mano, moverse lo traza o lo retrae.',
      'help.h.grab': '<kbd>Enter</kbd> o <kbd>Espacio</kbd> — agarra el ancla (o la punta del hilo) bajo ti para empezar a trazar; púlsalo de nuevo para soltar.',
      'help.h.draw': 'Con un color en mano, muévete a una celda vacía para extender, o atrás sobre tu propio hilo para retraer. Llega al ancla gemela para conectar.',
      'help.h.scan': '<kbd>C</kbd> — escanea la cruz: escucha la celda actual y sus cuatro vecinas por brújula. Cada color tiene su timbre; vacío es un toque suave, el borde un golpe sordo.',
      'help.h.locate': '<kbd>E</kbd> — suena un faro en las dos anclas de cada color aún suelto, para oír dónde están. <kbd>F2</kbd> — di tu posición.',
      'help.h.status': '<kbd>F1</kbd> puntos, nivel, jugadas, hilos · <kbd>F3</kbd> hilos conectados y celdas sin cubrir · <kbd>F4</kbd> jugadas restantes.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: un color se reconoce por su timbre de instrumento, sonando desde la dirección de la celda en la brújula. Traza un hilo y oyes su color; llega a su gemela y suena con fuerza. Los sonidos detrás de ti (al sur) suenan algo apagados.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. Ve a tejer unos telares!',
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
      'learn.colors': 'Los seis colores de hilo',
      'learn.cross': 'Escaneo de cruz (muestra)',
      'learn.connect': 'Hilo conectado',
      'learn.clear': 'Telar tejido (nivel)',
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

      'color.bell': 'campana', 'color.pluck': 'cuerda', 'color.marimba': 'marimba',
      'color.glass': 'cristal', 'color.reed': 'caña', 'color.bass': 'bajo',
      'cell.edge': 'borde', 'cell.empty': 'vacío',
      'cell.anchor': 'ancla {color}', 'cell.thread': 'hilo {color}',

      'ann.levelStart': 'Nivel {level}. Telar de {size} por {size}, {colors} hilos, {budget} jugadas. Conecta cada color y llena el telar.',
      'ann.cell': '{col}, {row}: {what}.',
      'ann.edge': 'Borde.',
      'ann.grab': 'Sostienes {color}. Traza hasta su ancla gemela.',
      'ann.resume': '{color} retomado.',
      'ann.grabFail': 'Nada que agarrar. Ponte sobre un ancla o la punta de un hilo.',
      'ann.release': 'Soltado.',
      'ann.draw': '{col}, {row}.',
      'ann.retract': 'Vuelta a {col}, {row}.',
      'ann.connect': '¡{color} conectado! {n} de {total}. Quedan {empty} celdas.',
      'ann.blocked': 'Bloqueado.',
      'ann.locating': 'Localizando hilos sueltos.',
      'ann.status': 'Puntos {score}, nivel {level}, {moves} jugadas, {n} de {total} hilos.',
      'ann.locate': 'Columna {col}, fila {row}, de {size}. {active}',
      'ann.holding': 'Sostienes {color}.',
      'ann.empty': 'Manos vacías.',
      'ann.progress': '{n} de {total} hilos conectados. {empty} celdas sin cubrir.',
      'ann.moves': '{moves} jugadas restantes. {active}',
      'ann.levelClear': '¡Telar tejido! Más {bonus} puntos. Nivel {level} completado.',
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
