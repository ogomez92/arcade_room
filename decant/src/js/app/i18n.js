/**
 * Lightweight i18n for Decant. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'decant.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Decant',

      'menu.aria': 'Main menu',
      'menu.title': 'Decant',
      'menu.subtitle': 'A water-sort puzzle for the ears. Pour the vials until each holds a single sound.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Decant vials',
      'hud.score': 'Score',
      'hud.level': 'Level',
      'hud.moves': 'Moves left',
      'hud.sorted': 'Vials sorted',

      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Sort every vial before your moves run out.',
      'help.intro': 'A row of vials, each holding a stack of coloured liquid — and every colour is a different instrument. Pour the top run of one vial onto another vial whose top colour matches (or onto an empty one) until every vial is empty or filled with a single colour. You can always re-listen to a vial, and you can undo, so this is about planning, not memory. Each pour spends one move from a limited budget; the budget is always enough for a perfect solution, but it tightens every level. Run out before sorting them all and the run ends.',
      'help.h.move': '<kbd>Left</kbd> / <kbd>Right</kbd> (or <kbd>A</kbd> / <kbd>D</kbd>) — move along the row of vials.',
      'help.h.select': '<kbd>Enter</kbd> or <kbd>Space</kbd> — pick up a vial as the source, then press again on another vial to pour. Press the source again to put it back.',
      'help.h.undo': '<kbd>U</kbd> or <kbd>Backspace</kbd> — undo the last pour (and get the move back).',
      'help.h.scan': '<kbd>C</kbd> — listen to the current vial, bottom to top.',
      'help.h.status': '<kbd>F1</kbd> score, level and moves left · <kbd>F2</kbd> which vial you are on · <kbd>F3</kbd> vials sorted.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: each colour is its own instrument and pitch — sort by gathering the same sound together. A vial always sounds from its fixed place in the row: the leftmost vial is hard left, the rightmost is hard right, and that never changes. When you pour, the liquid whooshes from the source vial toward the destination, then the colour that landed speaks from the destination. A bright pop means a vial is finished.',
      'help.back': 'Back',

      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Go sort some vials!',
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
      'learn.colors': 'The colours (instruments)',
      'learn.pour': 'A pour, left to right',
      'learn.complete': 'A vial finished',
      'learn.clear': 'Level solved',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm the world-fixed pan: left vial is left, right vial is right.',
      'test.left': 'Play left vial',
      'test.center': 'Play centre vial',
      'test.right': 'Play right vial',
      'test.ring': 'Sweep left to right',
      'test.back': 'Back',

      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      'color.bell': 'bell',
      'color.pluck': 'pluck',
      'color.marimba': 'marimba',
      'color.glass': 'glass',
      'color.reed': 'reed',
      'color.bass': 'bass',

      'ann.levelStart': 'Level {level}. {vials} vials, {colors} colours, {budget} moves.',
      'ann.vialEmpty': 'Vial {index} of {count}: empty.',
      'ann.vialFilled': 'Vial {index} of {count}: {fill} of {cap}. Top {color}, {run}.',
      'ann.vialComplete': 'Vial {index} of {count}: done, {color}.',
      'ann.vialEdge': 'Edge.',
      'ann.pickup': 'Holding {color}, {run}. Pour where?',
      'ann.deselect': 'Put back.',
      'ann.poured': 'Poured {color} into vial {to}.',
      'ann.invalidPour': "Can't pour there.",
      'ann.selectBlocked': 'Nothing to pour here.',
      'ann.colorComplete': '{color} finished!',
      'ann.undo': 'Undone.',
      'ann.undoEmpty': 'Nothing to undo.',
      'ann.levelClear': 'Solved! Plus {bonus} points. Level {level} done.',
      'ann.gameOver': 'Out of moves. Final score {score}.',
      'ann.gameOverHigh': 'Out of moves. New high score, {score}!',
      'ann.status': 'Score {score}, level {level}, {moves} moves left.',
      'ann.locate': 'Vial {index} of {count}.',
      'ann.sorted': '{sorted} of {colors} vials sorted.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
    },

    es: {
      'doc.title': 'Decant',

      'menu.aria': 'Menú principal',
      'menu.title': 'Decant',
      'menu.subtitle': 'Un puzle de ordenar líquidos para el oído. Trasvasa los frascos hasta que cada uno tenga un solo sonido.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Frascos de Decant',
      'hud.score': 'Puntos',
      'hud.level': 'Nivel',
      'hud.moves': 'Movimientos restantes',
      'hud.sorted': 'Frascos ordenados',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Ordena todos los frascos antes de quedarte sin movimientos.',
      'help.intro': 'Una fila de frascos, cada uno con una pila de líquido de colores, y cada color es un instrumento distinto. Vierte la tanda superior de un frasco sobre otro cuyo color de arriba coincida (o sobre uno vacío) hasta que cada frasco esté vacío o lleno de un solo color. Siempre puedes volver a escuchar un frasco y puedes deshacer, así que esto va de planificar, no de memoria. Cada vertido gasta un movimiento de un presupuesto limitado; el presupuesto siempre alcanza para una solución perfecta, pero se ajusta cada nivel. Si se agota antes de ordenarlos todos, termina la partida.',
      'help.h.move': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> (o <kbd>A</kbd> / <kbd>D</kbd>) — recorre la fila de frascos.',
      'help.h.select': '<kbd>Enter</kbd> o <kbd>Espacio</kbd> — toma un frasco como origen y pulsa de nuevo en otro frasco para verter. Pulsa el origen otra vez para devolverlo.',
      'help.h.undo': '<kbd>U</kbd> o <kbd>Retroceso</kbd> — deshaz el último vertido (y recupera el movimiento).',
      'help.h.scan': '<kbd>C</kbd> — escucha el frasco actual, de abajo a arriba.',
      'help.h.status': '<kbd>F1</kbd> puntos, nivel y movimientos · <kbd>F2</kbd> en qué frasco estás · <kbd>F3</kbd> frascos ordenados.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: cada color es su propio instrumento y tono; ordena reuniendo el mismo sonido. Un frasco suena siempre desde su lugar fijo en la fila: el de más a la izquierda suena a la izquierda del todo, el de más a la derecha a la derecha del todo, y eso nunca cambia. Al verter, el líquido se desliza del frasco origen hacia el destino y luego suena el color que cayó en el destino. Un repique brillante significa que un frasco está terminado.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. Ordena unos frascos!',
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
      'learn.colors': 'Los colores (instrumentos)',
      'learn.pour': 'Un vertido, de izquierda a derecha',
      'learn.complete': 'Un frasco terminado',
      'learn.clear': 'Nivel resuelto',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma el paneo fijo: el frasco izquierdo a la izquierda, el derecho a la derecha.',
      'test.left': 'Sonar frasco izquierdo',
      'test.center': 'Sonar frasco central',
      'test.right': 'Sonar frasco derecho',
      'test.ring': 'Barrer de izquierda a derecha',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'color.bell': 'campana',
      'color.pluck': 'cuerda',
      'color.marimba': 'marimba',
      'color.glass': 'cristal',
      'color.reed': 'caña',
      'color.bass': 'bajo',

      'ann.levelStart': 'Nivel {level}. {vials} frascos, {colors} colores, {budget} movimientos.',
      'ann.vialEmpty': 'Frasco {index} de {count}: vacío.',
      'ann.vialFilled': 'Frasco {index} de {count}: {fill} de {cap}. Arriba {color}, {run}.',
      'ann.vialComplete': 'Frasco {index} de {count}: listo, {color}.',
      'ann.vialEdge': 'Borde.',
      'ann.pickup': 'Tienes {color}, {run}. ¿Dónde viertes?',
      'ann.deselect': 'Devuelto.',
      'ann.poured': 'Vertido {color} en el frasco {to}.',
      'ann.invalidPour': 'Ahí no se puede verter.',
      'ann.selectBlocked': 'Aquí no hay nada que verter.',
      'ann.colorComplete': '¡{color} terminado!',
      'ann.undo': 'Deshecho.',
      'ann.undoEmpty': 'Nada que deshacer.',
      'ann.levelClear': '¡Resuelto! Más {bonus} puntos. Nivel {level} completado.',
      'ann.gameOver': 'Sin movimientos. Puntuación final {score}.',
      'ann.gameOverHigh': 'Sin movimientos. ¡Nuevo récord, {score}!',
      'ann.status': 'Puntos {score}, nivel {level}, {moves} movimientos restantes.',
      'ann.locate': 'Frasco {index} de {count}.',
      'ann.sorted': '{sorted} de {colors} frascos ordenados.',
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
