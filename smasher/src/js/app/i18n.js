/**
 * Lightweight i18n for Smasher. Canonical collection implementation; only
 * STORAGE_KEY and the dictionaries differ from other games.
 *
 * Resolution on boot: localStorage(STORAGE_KEY) -> navigator.language prefix ->
 * 'en'. Annotate DOM with data-i18n / data-i18n-html / data-i18n-attr; call
 * app.i18n.t('key', {param}) for runtime strings.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'smasher.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Smasher',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Smasher',
      'menu.subtitle': 'Throw balls, smash things, beat the clock.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.learn': 'Learn the sounds',
      'menu.highscores': 'High scores',

      // Language
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game
      'game.aria': 'Game',
      'hud.score': 'Score',
      'hud.time': 'Time',
      'hud.streak': 'Combo',
      'hud.target': 'Target',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Time up',
      'gameover.title': "Time's up!",
      'gameover.score': 'Score: {score} — best combo {streak}',
      'gameover.subtitle': 'That made the top ten! Enter your name to save it.',
      'gameover.name': 'Your name',
      'gameover.save': 'Save score',
      'gameover.continue': 'Continue',
      'gameover.nameRequired': 'Please enter a name to save your score.',
      'gameover.postPrompt': 'Post this score to the online scoreboard?',
      'gameover.postYes': 'Post online',
      'gameover.postNo': 'No thanks',

      // Online leaderboard
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': 'Couldn’t reach the leaderboard. Saved on this device.',
      'online.viewBoard': 'View the leaderboard',

      // How to play
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Smash as much as you can in 60 seconds.',
      'help.intro': 'Objects line the lane around you. Each hums a note: the higher the pitch, the smaller the object. Its position in the stereo field is where it is relative to you.',
      'help.h.move': '<strong>Move:</strong> <kbd>Left</kbd> / <kbd>Right</kbd> arrows (or <kbd>A</kbd> / <kbd>D</kbd>) to walk along the lane.',
      'help.h.center': '<strong>Aim:</strong> line an object up in the <strong>centre</strong> of the stereo field. It brightens and clicks when it locks to centre — that is your target.',
      'help.h.throw': '<strong>Throw:</strong> press <kbd>1</kbd>–<kbd>5</kbd> to throw a ball of that size at the centre.',
      'help.h.size': '<strong>Size matters:</strong> a ball must be at least as big as the object or it just bounces off. A <strong>perfect</strong> size match (small ball on small object) scores the most; oversized balls score less.',
      'help.h.combo': '<strong>Combos:</strong> big balls hit a <strong>wider</strong> area. Catch two or three objects in one throw for a double or triple smash worth far more.',
      'help.h.gold': '<strong>Gold</strong> objects shimmer — smash one with a perfectly matched ball for a big bonus.',
      'help.h.hazard': '<strong>Hazards</strong> buzz harshly — catching one in a wide throw spoils the throw, breaks your combo and costs points.',
      'help.h.streak': '<strong>Keep smashing</strong> to raise your combo multiplier. Bouncing or letting the field go quiet resets it.',
      'help.h.status': '<strong>Status:</strong> <kbd>F1</kbd> score &amp; time, <kbd>F2</kbd> centred target, <kbd>F3</kbd> nearby objects, <kbd>F4</kbd> combo.',
      'help.h.pause': '<strong>Pause:</strong> <kbd>Escape</kbd>.',
      'help.audio': 'Headphones are strongly recommended: left and right, and the pitch of each object, are the whole game.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.entry': '{rank}. {name} — {score} (combo {streak})',
      'highscores.empty': 'No scores yet. Go smash something!',
      'highscores.back': 'Back',

      // Learn the sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each cue on its own.',
      'learn.small': 'Small object (high pitch)',
      'learn.big': 'Big object (low pitch)',
      'learn.left': 'Object on your left',
      'learn.right': 'Object on your right',
      'learn.gold': 'Gold object (shimmer)',
      'learn.hazard': 'Hazard (buzz — avoid)',
      'learn.throw': 'Throwing a ball',
      'learn.smash': 'A perfect smash',
      'learn.bounce': 'A ball bouncing off (too small)',
      'learn.combo': 'A triple combo',
      'learn.over': "Time's up",
      'learn.back': 'Back',

      // Stereo test
      'test.aria': 'Stereo test',
      'test.title': 'Stereo audio test',
      'test.subtitle': 'Confirm left, right, and pitch.',
      'test.left': 'Play far left',
      'test.center': 'Play centre',
      'test.right': 'Play far right',
      'test.small': 'Play small (high)',
      'test.big': 'Play big (low)',
      'test.sweep': 'Sweep left to right',
      'test.back': 'Back',

      // Announcements
      'ann.go': 'Go!',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.doubleSmash': 'Double smash! Plus {points}.',
      'ann.tripleSmash': 'Triple smash! Plus {points}.',
      'ann.megaSmash': '{n}-object smash! Plus {points}.',
      'ann.goldSmash': 'Gold! Plus {points}.',
      'ann.perfect': 'Perfect. Plus {points}.',
      'ann.multiplier': 'Combo times {mult}.',
      'ann.bounce': 'Bounced off a size {size}. Throw bigger.',
      'ann.hazard': 'Hazard! Minus {penalty}.',
      'ann.timeWarn': 'Ten seconds left!',
      'ann.over': "Time's up. Final score {score}.",
      'ann.overHigh': "Time's up. New high score, {score}!",
      'ann.scoreSaved': 'Score saved.',
      'ann.postPrompt': 'You can post this score to the online board. Post it?',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.status': 'Score {score}, {time} seconds left, combo times {mult}.',
      'ann.target': 'Centred: size {size}. Throw ball {ball}. {type}',
      'ann.targetNone': 'Nothing centred. Move to line one up.',
      'ann.typeGold': 'Gold.',
      'ann.typeHazard': 'Hazard — do not throw.',
      'ann.fieldSize': '{n} size {size}',
      'ann.fieldEmpty': 'Nothing nearby.',
      'ann.fieldGold': '{n} gold.',
      'ann.fieldHazard': '{n} hazard.',
      'ann.streak': 'Combo {streak}, multiplier times {mult}.',
    },

    es: {
      'doc.title': 'Smasher',

      'menu.aria': 'Menú principal',
      'menu.title': 'Smasher',
      'menu.subtitle': 'Lanza bolas, rompe cosas, corre contra el reloj.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.learn': 'Aprende los sonidos',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Juego',
      'hud.score': 'Puntos',
      'hud.time': 'Tiempo',
      'hud.streak': 'Combo',
      'hud.target': 'Objetivo',

      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar',
      'pause.menu': 'Menú principal',

      'gameover.aria': 'Se acabó el tiempo',
      'gameover.title': '¡Se acabó el tiempo!',
      'gameover.score': 'Puntos: {score} — mejor combo {streak}',
      'gameover.subtitle': '¡Entraste en el top diez! Escribe tu nombre para guardarlo.',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre para guardar tu puntuación.',
      'gameover.postPrompt': '¿Publicar esta puntuación en la clasificación en línea?',
      'gameover.postYes': 'Publicar en línea',
      'gameover.postNo': 'No, gracias',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado en este dispositivo.',
      'online.viewBoard': 'Ver la clasificación',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Rompe todo lo que puedas en 60 segundos.',
      'help.intro': 'Los objetos bordean el carril a tu alrededor. Cada uno emite una nota: cuanto más agudo, más pequeño es el objeto. Su lugar en el campo estéreo es dónde está respecto a ti.',
      'help.h.move': '<strong>Moverse:</strong> flechas <kbd>Izquierda</kbd> / <kbd>Derecha</kbd> (o <kbd>A</kbd> / <kbd>D</kbd>) para recorrer el carril.',
      'help.h.center': '<strong>Apuntar:</strong> alinea un objeto en el <strong>centro</strong> del campo estéreo. Se ilumina y hace clic al fijarse al centro: ese es tu objetivo.',
      'help.h.throw': '<strong>Lanzar:</strong> pulsa <kbd>1</kbd>–<kbd>5</kbd> para lanzar una bola de ese tamaño al centro.',
      'help.h.size': '<strong>El tamaño importa:</strong> la bola debe ser al menos tan grande como el objeto o rebota. Un tamaño <strong>perfecto</strong> (bola pequeña en objeto pequeño) puntúa más; las bolas grandes puntúan menos.',
      'help.h.combo': '<strong>Combos:</strong> las bolas grandes cubren una zona <strong>más ancha</strong>. Alcanza dos o tres objetos en un lanzamiento para un combo doble o triple que vale mucho más.',
      'help.h.gold': 'Los objetos <strong>dorados</strong> brillan: rómpelos con una bola del tamaño exacto para una gran bonificación.',
      'help.h.hazard': 'Los <strong>peligros</strong> zumban: alcanzar uno en un lanzamiento ancho lo estropea, corta tu combo y resta puntos.',
      'help.h.streak': '<strong>Sigue rompiendo</strong> para subir tu multiplicador de combo. Rebotar o dejar el campo en silencio lo reinicia.',
      'help.h.status': '<strong>Estado:</strong> <kbd>F1</kbd> puntos y tiempo, <kbd>F2</kbd> objetivo centrado, <kbd>F3</kbd> objetos cercanos, <kbd>F4</kbd> combo.',
      'help.h.pause': '<strong>Pausa:</strong> <kbd>Escape</kbd>.',
      'help.audio': 'Se recomiendan auriculares: la izquierda y la derecha, y el tono de cada objeto, son todo el juego.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.entry': '{rank}. {name} — {score} (combo {streak})',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Ve a romper algo!',
      'highscores.back': 'Atrás',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Escucha cada señal por separado.',
      'learn.small': 'Objeto pequeño (tono agudo)',
      'learn.big': 'Objeto grande (tono grave)',
      'learn.left': 'Objeto a tu izquierda',
      'learn.right': 'Objeto a tu derecha',
      'learn.gold': 'Objeto dorado (brillo)',
      'learn.hazard': 'Peligro (zumbido — evítalo)',
      'learn.throw': 'Lanzar una bola',
      'learn.smash': 'Un golpe perfecto',
      'learn.bounce': 'Una bola rebotando (muy pequeña)',
      'learn.combo': 'Un combo triple',
      'learn.over': 'Se acabó el tiempo',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba estéreo',
      'test.title': 'Prueba de audio estéreo',
      'test.subtitle': 'Confirma izquierda, derecha y tono.',
      'test.left': 'Sonar a la izquierda',
      'test.center': 'Sonar en el centro',
      'test.right': 'Sonar a la derecha',
      'test.small': 'Sonar pequeño (agudo)',
      'test.big': 'Sonar grande (grave)',
      'test.sweep': 'Barrer de izquierda a derecha',
      'test.back': 'Atrás',

      'ann.go': '¡Ya!',
      'ann.paused': 'Pausa.',
      'ann.resumed': 'Continuando.',
      'ann.doubleSmash': '¡Golpe doble! Más {points}.',
      'ann.tripleSmash': '¡Golpe triple! Más {points}.',
      'ann.megaSmash': '¡Golpe de {n}! Más {points}.',
      'ann.goldSmash': '¡Oro! Más {points}.',
      'ann.perfect': 'Perfecto. Más {points}.',
      'ann.multiplier': 'Combo por {mult}.',
      'ann.bounce': 'Rebotó en un tamaño {size}. Lanza más grande.',
      'ann.hazard': '¡Peligro! Menos {penalty}.',
      'ann.timeWarn': '¡Quedan diez segundos!',
      'ann.over': 'Se acabó el tiempo. Puntuación final {score}.',
      'ann.overHigh': 'Se acabó el tiempo. ¡Récord, {score}!',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.postPrompt': 'Puedes publicar esta puntuación en la clasificación en línea. ¿Publicarla?',
      'ann.onlineRank': 'Puesto en línea número {rank}.',
      'ann.onlineError': 'Clasificación no disponible. Guardado en este dispositivo.',
      'ann.status': 'Puntos {score}, quedan {time} segundos, combo por {mult}.',
      'ann.target': 'Centrado: tamaño {size}. Lanza la bola {ball}. {type}',
      'ann.targetNone': 'Nada centrado. Muévete para alinear uno.',
      'ann.typeGold': 'Oro.',
      'ann.typeHazard': 'Peligro — no lances.',
      'ann.fieldSize': '{n} de tamaño {size}',
      'ann.fieldEmpty': 'Nada cerca.',
      'ann.fieldGold': '{n} de oro.',
      'ann.fieldHazard': '{n} peligro.',
      'ann.streak': 'Combo {streak}, multiplicador por {mult}.',
    },
  }

  let current = FALLBACK
  const listeners = []

  function detect() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && dictionaries[stored]) return stored
    } catch (e) { /* localStorage may be blocked */ }
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
