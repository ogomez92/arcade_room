/**
 * Lightweight i18n for Sigil. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'sigil.lang'

  const localeNames = {en: 'English', es: 'Español'}

  const dictionaries = {
    en: {
      'doc.title': 'Sigil',

      'menu.aria': 'Main menu',
      'menu.title': 'Sigil',
      'menu.subtitle': 'Crack the hidden sigil: place the right tone at each point of the compass by deduction.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Sigil ring',
      'hud.score': 'Score',
      'hud.level': 'Level',
      'hud.attempts': 'Attempts',
      'hud.ring': 'Ring',

      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Deduce the hidden sigil.',
      'help.intro': 'A hidden sigil places one of several tones at each point around the compass — north, east, south, west, and at higher levels the diagonals too, up to all eight. Each tone is an instrument timbre. Build a guess by selecting a point and choosing its tone, then try the sigil. It answers with two numbers: how many points are EXACTLY right (right tone, right point), and how many are the right tone in the wrong point. Cross-reference your past tries to deduce the whole sigil before your attempts run out. Tones may repeat.',
      'help.h.orbit': '<kbd>Left</kbd> / <kbd>Right</kbd> — orbit the ring to the previous / next point. You hear its current tone from that compass direction (north is in front, east to the right, and so on).',
      'help.h.cycle': '<kbd>Up</kbd> / <kbd>Down</kbd> — change the selected point\'s tone.',
      'help.h.submit': '<kbd>Enter</kbd> or <kbd>Space</kbd> — try the sigil. Bright pings count the exact hits; duller ticks count the right-tone-wrong-point partials.',
      'help.h.play': '<kbd>C</kbd> — play your current guess: each tone sweeps around the ring from its point.',
      'help.h.review': '<kbd>Q</kbd> / <kbd>E</kbd> — step back and forth through your past tries; each replays its tones and its result so you can deduce.',
      'help.h.status': '<kbd>F1</kbd> score, level, attempts left · <kbd>F2</kbd> selected point and tone · <kbd>F3</kbd> read the whole guess · <kbd>F4</kbd> last result.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Audio guide: every point of the sigil sounds from its true compass direction, so you can hear the shape of your guess sweep around you. A tone is recognised by its instrument timbre. Crack the sigil and the ring rings out in triumph; fail, and the true sigil is revealed before the run ends.',
      'help.back': 'Back',

      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Go crack a few sigils!',
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
      'learn.colors': 'The six tones',
      'learn.feedback': 'A result: 2 exact, 1 partial',
      'learn.clear': 'Sigil cracked (level clear)',
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
      'dir.n': 'north', 'dir.ne': 'north-east', 'dir.e': 'east', 'dir.se': 'south-east',
      'dir.s': 'south', 'dir.sw': 'south-west', 'dir.w': 'west', 'dir.nw': 'north-west',

      'ann.levelStart': 'Level {level}. {positions} points, {colors} tones, {guesses} attempts. Crack the sigil.',
      'ann.select': '{dir}: {tone}.',
      'ann.glyph': '{dir}: {tone}.',
      'ann.submit': '{exact} exact, {partial} partial. {left} attempts left.',
      'ann.guess': 'Guess: {guess}.',
      'ann.review': 'Try {index} of {total}: {guess}. {exact} exact, {partial} partial.',
      'ann.noAttempts': 'No tries yet.',
      'ann.levelClear': 'Sigil cracked! Plus {bonus} points. Level {level} done.',
      'ann.revealed': 'Out of attempts. The sigil was: {guess}.',
      'ann.gameOver': 'Game over. Final score {score}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.status': 'Score {score}, level {level}, {left} attempts left, {positions} points, {colors} tones.',
      'ann.selected': '{dir}: {tone}.',
      'ann.last': 'Last result: {exact} exact, {partial} partial.',
      'ann.noLast': 'No result yet.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Sigilo',

      'menu.aria': 'Menú principal',
      'menu.title': 'Sigilo',
      'menu.subtitle': 'Descifra el sigilo oculto: coloca el tono correcto en cada punto de la brújula por deducción.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Anillo del sigilo',
      'hud.score': 'Puntos',
      'hud.level': 'Nivel',
      'hud.attempts': 'Intentos',
      'hud.ring': 'Anillo',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Deduce el sigilo oculto.',
      'help.intro': 'Un sigilo oculto coloca uno de varios tonos en cada punto de la brújula — norte, este, sur, oeste, y en niveles altos también las diagonales, hasta los ocho. Cada tono es un timbre de instrumento. Construye una propuesta seleccionando un punto y eligiendo su tono, luego prueba el sigilo. Responde con dos números: cuántos puntos son EXACTOS (tono correcto, punto correcto) y cuántos son el tono correcto en el punto equivocado. Cruza tus intentos pasados para deducir el sigilo entero antes de quedarte sin intentos. Los tonos pueden repetirse.',
      'help.h.orbit': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> — orbita el anillo al punto anterior / siguiente. Oyes su tono actual desde esa dirección de la brújula (el norte al frente, el este a la derecha, etc.).',
      'help.h.cycle': '<kbd>Arriba</kbd> / <kbd>Abajo</kbd> — cambia el tono del punto seleccionado.',
      'help.h.submit': '<kbd>Enter</kbd> o <kbd>Espacio</kbd> — prueba el sigilo. Pitidos brillantes cuentan los aciertos exactos; toques apagados cuentan los de tono correcto en punto equivocado.',
      'help.h.play': '<kbd>C</kbd> — reproduce tu propuesta actual: cada tono recorre el anillo desde su punto.',
      'help.h.review': '<kbd>Q</kbd> / <kbd>E</kbd> — recorre adelante y atrás tus intentos pasados; cada uno repite sus tonos y su resultado para deducir.',
      'help.h.status': '<kbd>F1</kbd> puntos, nivel, intentos restantes · <kbd>F2</kbd> punto y tono seleccionados · <kbd>F3</kbd> lee toda la propuesta · <kbd>F4</kbd> último resultado.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Guía de sonido: cada punto del sigilo suena desde su dirección real en la brújula, así oyes la forma de tu propuesta girar a tu alrededor. Un tono se reconoce por su timbre de instrumento. Descifra el sigilo y el anillo suena triunfante; falla, y el sigilo verdadero se revela antes de terminar.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. Ve a descifrar unos sigilos!',
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
      'learn.colors': 'Los seis tonos',
      'learn.feedback': 'Un resultado: 2 exactos, 1 parcial',
      'learn.clear': 'Sigilo descifrado (nivel)',
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
      'dir.n': 'norte', 'dir.ne': 'noreste', 'dir.e': 'este', 'dir.se': 'sureste',
      'dir.s': 'sur', 'dir.sw': 'suroeste', 'dir.w': 'oeste', 'dir.nw': 'noroeste',

      'ann.levelStart': 'Nivel {level}. {positions} puntos, {colors} tonos, {guesses} intentos. Descifra el sigilo.',
      'ann.select': '{dir}: {tone}.',
      'ann.glyph': '{dir}: {tone}.',
      'ann.submit': '{exact} exactos, {partial} parciales. {left} intentos restantes.',
      'ann.guess': 'Propuesta: {guess}.',
      'ann.review': 'Intento {index} de {total}: {guess}. {exact} exactos, {partial} parciales.',
      'ann.noAttempts': 'Aún no hay intentos.',
      'ann.levelClear': '¡Sigilo descifrado! Más {bonus} puntos. Nivel {level} superado.',
      'ann.revealed': 'Sin intentos. El sigilo era: {guess}.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
      'ann.status': 'Puntos {score}, nivel {level}, {left} intentos restantes, {positions} puntos, {colors} tonos.',
      'ann.selected': '{dir}: {tone}.',
      'ann.last': 'Último resultado: {exact} exactos, {partial} parciales.',
      'ann.noLast': 'Aún no hay resultado.',
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
