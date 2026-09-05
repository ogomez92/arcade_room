/**
 * Lightweight i18n for SKITTER. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'skitter.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Skitter',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Skitter',
      'menu.subtitle': 'An audio Centipede. A segmented creature winds down toward your line — slide your gun and shoot up its column to break it apart before it reaches you.',
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
      'game.aria': 'The grid',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.wave': 'Wave',
      'hud.combo': 'Combo',

      // Creature parts + proximity words
      'part.head': 'head',
      'part.body': 'body',
      'prox.far': 'far up',
      'prox.mid': 'closing in',
      'prox.near': 'almost at your line',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Break the creature apart before it reaches your line.',
      'help.intro': 'A segmented creature crawls in from the top of a grid and winds down toward your gun at the bottom. Each link ticks from its column — left is always your left, right always your right, and it never rotates — and the ticks get higher, louder and faster as the creature nears your line. The bright leading tick is the head; the softer one is its tail. Slide your gun to a column and fire up it to destroy the lowest link there. Let any link reach the bottom and it breaches your line, costing a life. Three lives; clear the whole creature to face a longer, faster one.',
      'help.h.move': '<kbd>Left</kbd> / <kbd>Right</kbd> (or <kbd>A</kbd> / <kbd>D</kbd>) — slide your gun between columns. Hold to sweep.',
      'help.h.fire': 'Hold <kbd>Space</kbd> or <kbd>Enter</kbd> — fire up your current column. A shot destroys the lowest link in that column.',
      'help.h.lock': 'When a link sits in your column you hear a clean lock beep — that is your cue to fire. Sweep until you hear it.',
      'help.h.split': 'Shoot the <strong>head</strong> and the creature just shortens. Shoot a <strong>middle</strong> link and it SPLITS into two creatures that each turn around — more targets, more pressure. Heads score more.',
      'help.h.creature': 'The head ticks bright and high; the tail ticks soft and low. The higher and faster the ticks, the closer that link is to your line.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> nearest link · <kbd>F3</kbd> best combo · <kbd>F4</kbd> gun column.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'You cannot shoot every column at once, so read where the creature is heading and cut off the head — or split it and mop up. A link reaching your line is a heavy alarm and breaks your combo. The whole creature is in front of you; left and right are your ears.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Go hold the line!',
      'highscores.entry': '#{rank}. {name} — {score} points, reached wave {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart run',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Overrun',
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
      'learn.headFar': 'Head — far up (top row)',
      'learn.headNear': 'Head — almost at your line',
      'learn.body': 'Body link',
      'learn.left': 'Creature — far left',
      'learn.right': 'Creature — far right',
      'learn.shot': 'Your shot',
      'learn.kill': 'Link destroyed',
      'learn.killHead': 'Head destroyed',
      'learn.split': 'Creature split in two',
      'learn.lock': 'Aim locked on column',
      'learn.breach': 'Link breached your line (damage)',
      'learn.wave': 'Wave cleared',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Spatial test
      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm the field: front is up the grid, right is east, behind is south, left is west.',
      'test.north': 'Play front (up the grid)',
      'test.east': 'Play right',
      'test.south': 'Play behind',
      'test.west': 'Play left',
      'test.ring': 'Play full ring',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Announcements
      'ann.combo': 'Combo {combo}!',
      'ann.breach': 'Breach on column {col}! {lives} lives left.',
      'ann.breachLast': 'Breach on column {col}! No lives left.',
      'ann.waveStart': 'Wave {wave}.',
      'ann.waveClear': 'Wave {wave} cleared! Plus {bonus} points.',
      'ann.gameOver': 'Overrun. Final score {score}.',
      'ann.gameOverHigh': 'Overrun. New high score, {score}!',
      'ann.status': 'Score {score}, {lives} lives, wave {wave}, combo {combo}.',
      'ann.nearest': 'Column {col}, {what}, {prox}. {n} links on the grid.',
      'ann.allClear': 'Grid clear.',
      'ann.best': 'Best combo {combo}.',
      'ann.gun': 'Gun on column {col}.',
      'ann.gunLocked': 'Gun on column {col}, target in line.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Skitter',

      'menu.aria': 'Menú principal',
      'menu.title': 'Skitter',
      'menu.subtitle': 'Un Centipede de audio. Una criatura segmentada serpentea hacia tu línea: desliza tu cañón y dispara por su columna para despedazarla antes de que te alcance.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'La rejilla',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.wave': 'Oleada',
      'hud.combo': 'Combo',

      'part.head': 'cabeza',
      'part.body': 'cuerpo',
      'prox.far': 'arriba lejos',
      'prox.mid': 'acercándose',
      'prox.near': 'casi en tu línea',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Despedaza la criatura antes de que llegue a tu línea.',
      'help.intro': 'Una criatura segmentada entra por arriba de una rejilla y serpentea hacia tu cañón abajo. Cada eslabón suena desde su columna —la izquierda siempre es tu izquierda, la derecha tu derecha, y nunca gira— y los chasquidos se vuelven más agudos, fuertes y rápidos al acercarse a tu línea. El chasquido brillante que va al frente es la cabeza; el más suave es la cola. Desliza tu cañón a una columna y dispara hacia arriba para destruir el eslabón más bajo allí. Si un eslabón llega abajo, rompe tu línea y cuesta una vida. Tres vidas; limpia toda la criatura para enfrentar una más larga y rápida.',
      'help.h.move': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> (o <kbd>A</kbd> / <kbd>D</kbd>) — desliza tu cañón entre columnas. Mantén para barrer.',
      'help.h.fire': 'Mantén <kbd>Espacio</kbd> o <kbd>Enter</kbd> — dispara por tu columna actual. El disparo destruye el eslabón más bajo de esa columna.',
      'help.h.lock': 'Cuando un eslabón está en tu columna oyes un pitido de fijación: esa es tu señal para disparar. Barre hasta oírlo.',
      'help.h.split': 'Dispara a la <strong>cabeza</strong> y la criatura solo se acorta. Dispara a un eslabón <strong>central</strong> y se PARTE en dos criaturas que se dan la vuelta: más objetivos, más presión. Las cabezas puntúan más.',
      'help.h.creature': 'La cabeza suena brillante y aguda; la cola suena suave y grave. Cuanto más agudos y rápidos los chasquidos, más cerca está ese eslabón de tu línea.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> eslabón más cercano · <kbd>F3</kbd> mejor combo · <kbd>F4</kbd> columna del cañón.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'No puedes disparar a todas las columnas a la vez, así que lee hacia dónde va la criatura y corta la cabeza, o pártela y limpia. Un eslabón que llega a tu línea es una alarma grave y rompe tu combo. Toda la criatura está frente a ti; izquierda y derecha son tus oídos.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Aguanta la línea!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, oleada {wave}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida',
      'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Arrollado',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.headFar': 'Cabeza — arriba lejos',
      'learn.headNear': 'Cabeza — casi en tu línea',
      'learn.body': 'Eslabón del cuerpo',
      'learn.left': 'Criatura — extrema izquierda',
      'learn.right': 'Criatura — extrema derecha',
      'learn.shot': 'Tu disparo',
      'learn.kill': 'Eslabón destruido',
      'learn.killHead': 'Cabeza destruida',
      'learn.split': 'Criatura partida en dos',
      'learn.lock': 'Fijación en la columna',
      'learn.breach': 'Eslabón rompió tu línea (daño)',
      'learn.wave': 'Oleada superada',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma el campo: al frente es arriba de la rejilla, derecha es este, detrás es sur, izquierda es oeste.',
      'test.north': 'Sonar al frente (arriba)',
      'test.east': 'Sonar a la derecha',
      'test.south': 'Sonar detrás',
      'test.west': 'Sonar a la izquierda',
      'test.ring': 'Sonar el anillo completo',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.combo': '¡Combo {combo}!',
      'ann.breach': '¡Brecha en la columna {col}! Quedan {lives} vidas.',
      'ann.breachLast': '¡Brecha en la columna {col}! Sin vidas.',
      'ann.waveStart': 'Oleada {wave}.',
      'ann.waveClear': '¡Oleada {wave} superada! Más {bonus} puntos.',
      'ann.gameOver': 'Arrollado. Puntuación final {score}.',
      'ann.gameOverHigh': 'Arrollado. ¡Nuevo récord, {score}!',
      'ann.status': 'Puntos {score}, {lives} vidas, oleada {wave}, combo {combo}.',
      'ann.nearest': 'Columna {col}, {what}, {prox}. {n} eslabones en la rejilla.',
      'ann.allClear': 'Rejilla despejada.',
      'ann.best': 'Mejor combo {combo}.',
      'ann.gun': 'Cañón en la columna {col}.',
      'ann.gunLocked': 'Cañón en la columna {col}, objetivo en línea.',
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
