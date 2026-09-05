/**
 * Lightweight i18n for TALON. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'talon.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Talon',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Talon',
      'menu.subtitle': 'An audio joust in the sky. Flap to fight gravity and steer your altitude; unseat each rider by meeting it at its own height when it reaches you.',
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
      'game.aria': 'The sky',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.wave': 'Wave',
      'hud.combo': 'Combo',

      // Compass directions
      'dir.n': 'north', 'dir.ne': 'northeast', 'dir.e': 'east', 'dir.se': 'southeast',
      'dir.s': 'south', 'dir.sw': 'southwest', 'dir.w': 'west', 'dir.nw': 'northwest',

      // Proximity + relative height
      'prox.far': 'far out', 'prox.mid': 'closing in', 'prox.near': 'almost on you',
      'rel.above': 'above you, climb', 'rel.below': 'below you, ease down', 'rel.level': 'level with you',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Flap to fly. Meet a rider at its height to unseat it.',
      'help.intro': 'You ride a flying mount. A continuous wing-tone tells you your ALTITUDE — its pitch rises as you climb. Tap to FLAP: each beat lifts you, and gravity pulls you back down, so you bob and must keep flapping to stay high. Enemy riders close in from the eight compass bearings — north is ahead, south behind, east right, west left, and it never rotates. Each rider blips from its direction at a pitch equal to ITS altitude. When one reaches you, you UNSEAT it only if you MEET it at its height (your altitude within a band of its); too high OR too low and it unseats YOU. As a clash nears, the rider\'s blip turns bright when you are matched, or harsh when you are not — climb or ease down to its pitch, or evade. Three lives.',
      'help.h.flap': 'Tap <kbd>Space</kbd> (or <kbd>Up</kbd>) — flap. Tap faster to climb; stop to glide down. Your wing-tone\'s pitch is your altitude — steer it onto the rider\'s pitch.',
      'help.h.clash': 'A rider reaching you is a joust: meet it within a band of its height and you unseat it (score); too high or too low and you take a hit. A bright blip = matched; a harsh blip = move your altitude toward its pitch.',
      'help.h.evade': '<kbd>Shift</kbd> / <kbd>Enter</kbd> — evade the most imminent rider when you cannot climb above it in time. The helm needs a moment to answer again.',
      'help.h.stamina': 'Flapping spends STAMINA, which refills slowly. Fly high too long and you run out — a flap then gives no lift and you sink. Climb to meet high soarers, then glide low to recover among the swoopers.',
      'help.h.enemies': 'Three riders by ear: a low fast <strong>swooper</strong>, a mid <strong>glider</strong>, and a high slow <strong>soarer</strong> (climb hard for it). Pitch tells you how high each flies.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> nearest rider (and if it is above or below you) · <kbd>F3</kbd> best combo · <kbd>F4</kbd> altitude and stamina.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Steer your wing-tone onto the incoming rider\'s pitch and let the clash come, or evade what you cannot reach in time. There is no safe altitude — a low swooper needs you low, a high soarer needs you high — and stamina stops you camping, so you are always adjusting. Sounds to the south (behind you) are muffled.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best flights on this device.',
      'highscores.empty': 'No scores yet. Take to the sky!',
      'highscores.entry': '#{rank}. {name} — {score} points, reached wave {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused', 'pause.title': 'Paused', 'pause.resume': 'Resume',
      'pause.restart': 'Restart run', 'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Grounded',
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
      'learn.swooper': 'Swooper — low, fast (east)',
      'learn.glider': 'Glider — mid height (north)',
      'learn.soarer': 'Soarer — high, slow (south)',
      'learn.safe': 'Clash — matched at its height (safe)',
      'learn.threat': 'Clash — not matched (threat)',
      'learn.flap': 'Your wing-beat',
      'learn.unseat': 'You unseat a rider',
      'learn.hit': 'You get unseated (damage)',
      'learn.evade': 'You evade a clash',
      'learn.wave': 'Wave cleared',
      'learn.over': 'Game over',
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
      'ann.combo': 'Combo {combo}!',
      'ann.hit': '{dir} rider unseats you! {lives} lives left.',
      'ann.hitLast': '{dir} rider unseats you! No lives left.',
      'ann.waveStart': 'Wave {wave}.',
      'ann.waveClear': 'Wave {wave} cleared! Plus {bonus} points.',
      'ann.gameOver': 'Grounded. Final score {score}.',
      'ann.gameOverHigh': 'Grounded. New high score, {score}!',
      'ann.status': 'Score {score}, {lives} lives, wave {wave}, combo {combo}, altitude {alt} percent, stamina {stam} percent.',
      'ann.nearest': 'Nearest {dir}, {rel}, {prox}. {n} riders aloft.',
      'ann.allClear': 'Sky clear.',
      'ann.best': 'Best combo {combo}.',
      'ann.altitude': 'Altitude {alt} percent, stamina {stam} percent.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Talon',

      'menu.aria': 'Menú principal',
      'menu.title': 'Talon',
      'menu.subtitle': 'Una justa aérea por audio. Aletea para luchar contra la gravedad y gobernar tu altura; derriba a cada jinete encontrándolo a su propia altura cuando te alcanza.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'El cielo',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.wave': 'Oleada',
      'hud.combo': 'Combo',

      'dir.n': 'norte', 'dir.ne': 'noreste', 'dir.e': 'este', 'dir.se': 'sureste',
      'dir.s': 'sur', 'dir.sw': 'suroeste', 'dir.w': 'oeste', 'dir.nw': 'noroeste',

      'prox.far': 'lejos', 'prox.mid': 'acercándose', 'prox.near': 'casi encima',
      'rel.above': 'por encima de ti, sube', 'rel.below': 'por debajo de ti, baja', 'rel.level': 'a tu altura',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Aletea para volar. Encuentra a un jinete a su altura para derribarlo.',
      'help.intro': 'Montas una bestia voladora. Un tono de alas continuo te indica tu ALTURA: su tono sube al ascender. Pulsa para ALETEAR: cada batida te eleva y la gravedad te baja, así que oscilas y debes seguir aleteando para mantenerte alto. Los jinetes enemigos se acercan desde las ocho direcciones de la brújula: el norte al frente, el sur detrás, el este a la derecha, el oeste a la izquierda, y nunca gira. Cada jinete suena desde su dirección a un tono igual a SU altura. Cuando uno te alcanza, lo DERRIBAS solo si lo ENCUENTRAS a su altura (tu altura dentro de un margen de la suya); demasiado alto O demasiado bajo y te derriba a TI. Al acercarse el choque, su pitido se vuelve brillante si coincides, o áspero si no: sube o baja hasta su tono, o esquiva. Tres vidas.',
      'help.h.flap': 'Pulsa <kbd>Espacio</kbd> (o <kbd>Arriba</kbd>) — aletea. Pulsa más rápido para subir; deja de pulsar para planear. El tono de tus alas es tu altura: llévalo al tono del jinete.',
      'help.h.clash': 'Un jinete que te alcanza es una justa: encuéntralo dentro de un margen de su altura y lo derribas (puntos); demasiado alto o bajo y recibes un golpe. Pitido brillante = coincides; pitido áspero = mueve tu altura hacia su tono.',
      'help.h.evade': '<kbd>Shift</kbd> / <kbd>Enter</kbd> — esquiva al jinete más inminente cuando no puedas subir por encima a tiempo. El timón tarda un instante en responder.',
      'help.h.stamina': 'Aletear gasta RESISTENCIA, que se recarga despacio. Si vuelas alto demasiado tiempo se agota: un aleteo entonces no eleva y caes. Sube para los jinetes altos y luego planea bajo para recuperarte entre los rasantes.',
      'help.h.enemies': 'Tres jinetes de oído: un <strong>rasante</strong> bajo y rápido, un <strong>planeador</strong> medio y un <strong>elevado</strong> alto y lento (sube fuerte por él). El tono indica a qué altura vuela cada uno.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> jinete más cercano (y si está por encima o por debajo) · <kbd>F3</kbd> mejor combo · <kbd>F4</kbd> altura y resistencia.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Lleva el tono de tus alas hasta el pitido del jinete entrante y deja que llegue el choque, o esquiva lo que no alcances a tiempo. No hay altura segura: un rasante bajo te quiere abajo, un elevado alto te quiere arriba, y la resistencia te impide acampar, así que siempre estás ajustando. Los sonidos del sur (detrás) suenan apagados.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores vuelos en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. Al cielo!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, oleada {wave}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa', 'pause.title': 'Pausa', 'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida', 'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Derribado',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.swooper': 'Rasante — bajo y rápido (este)',
      'learn.glider': 'Planeador — altura media (norte)',
      'learn.soarer': 'Elevado — alto y lento (sur)',
      'learn.safe': 'Choque — coincides con su altura (a salvo)',
      'learn.threat': 'Choque — no coincides (amenaza)',
      'learn.flap': 'Tu aleteo',
      'learn.unseat': 'Derribas a un jinete',
      'learn.hit': 'Te derriban (daño)',
      'learn.evade': 'Esquivas un choque',
      'learn.wave': 'Oleada superada',
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

      'ann.combo': '¡Combo {combo}!',
      'ann.hit': '¡El jinete del {dir} te derriba! Quedan {lives} vidas.',
      'ann.hitLast': '¡El jinete del {dir} te derriba! Sin vidas.',
      'ann.waveStart': 'Oleada {wave}.',
      'ann.waveClear': '¡Oleada {wave} superada! Más {bonus} puntos.',
      'ann.gameOver': 'Derribado. Puntuación final {score}.',
      'ann.gameOverHigh': 'Derribado. ¡Nuevo récord, {score}!',
      'ann.status': 'Puntos {score}, {lives} vidas, oleada {wave}, combo {combo}, altura {alt} por ciento, resistencia {stam} por ciento.',
      'ann.nearest': 'Más cercano al {dir}, {rel}, {prox}. {n} jinetes en el aire.',
      'ann.allClear': 'Cielo despejado.',
      'ann.best': 'Mejor combo {combo}.',
      'ann.altitude': 'Altura {alt} por ciento, resistencia {stam} por ciento.',
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
