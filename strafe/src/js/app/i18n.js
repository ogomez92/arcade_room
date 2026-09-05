/**
 * Lightweight i18n for STRAFE. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'strafe.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Strafe',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Strafe',
      'menu.subtitle': 'An audio run-and-gun. Hold the line: gun down the foes charging in from ahead — low on the ground, high in the air — and duck the shells they lob. Clear each sector to push deeper.',
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
      'game.aria': 'The front line',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.wave': 'Sector',
      'hud.combo': 'Combo',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Gun down the ground and air foes; duck the shells.',
      'help.intro': 'You hold a front line. Foes charge in from ahead in two height lanes: a GROUND lane (a low growl) and an AIR lane (a high whine). The view is from the side and never turns — a foe far ahead sits to your right and slides toward centre as it closes, so pan is distance and pitch is the lane. FIRE the matching lane to gun the nearest one down before it reaches you; any foe that gets through costs a life. Mixed in, the enemy LOBS shells — a wobbling whistle — which you cannot shoot: DUCK as one lands. Clear a sector\'s quota to push into a faster one. Three lives.',
      'help.h.fireGround': '<kbd>Space</kbd> (or <kbd>J</kbd>) — fire at the GROUND lane (the low growl). Hold to keep firing; the gun has a short cooldown.',
      'help.h.fireAir': '<kbd>Up</kbd> (or <kbd>K</kbd>) — fire at the AIR lane (the high whine).',
      'help.h.duck': '<kbd>Down</kbd> (or <kbd>S</kbd>) — duck a lobbed shell. Tap it just as the whistle bears down; you cannot shoot shells.',
      'help.h.lanes': 'Pitch tells the lane (low = ground, high = air); pan + loudness tell the distance. A foe nearly on you blips fast and centred — fire now.',
      'help.h.shells': 'A shell has a wobbling whistle, distinct from the foes. It is unshootable — only a duck saves you.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> / <kbd>F4</kbd> threats by lane · <kbd>F3</kbd> best combo.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Two guns, two lanes — keep both clear. Pairs arrive in both lanes at once the deeper you go, so you fire ground and air in quick succession. A clean run never lets a foe through and ducks every shell; combos multiply your score.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best pushes on this device.',
      'highscores.empty': 'No scores yet. Hold the line!',
      'highscores.entry': '#{rank}. {name} — {score} points, reached sector {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused', 'pause.title': 'Paused', 'pause.resume': 'Resume',
      'pause.restart': 'Restart run', 'pause.menu': 'Main menu',

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
      'learn.ground': 'Ground foe (low) — shoot ground',
      'learn.air': 'Air foe (high) — shoot air',
      'learn.shell': 'Lobbed shell — duck!',
      'learn.fireGround': 'Your ground shot',
      'learn.fireAir': 'Your air shot',
      'learn.kill': 'A foe drops',
      'learn.duck': 'You duck',
      'learn.dodge': 'A shell whistles over',
      'learn.hit': 'You take a hit',
      'learn.wave': 'Sector cleared',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Spatial test
      'test.aria': 'Stereo and distance test',
      'test.title': 'Stereo / distance test',
      'test.subtitle': 'Confirm: far ahead is to your right and slides to centre as it nears.',
      'test.east': 'Play far ahead (right)',
      'test.south': 'Play mid range',
      'test.north': 'Play right on you (centre)',
      'test.ring': 'Play an approach',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Announcements
      'ann.combo': 'Combo {combo}!',
      'ann.leakGround': 'A ground foe broke through! {lives} lives left.',
      'ann.leakAir': 'An air foe broke through! {lives} lives left.',
      'ann.hitShell': 'Shell hit! {lives} lives left.',
      'ann.hitLast': 'Overrun! No lives left.',
      'ann.waveClear': 'Sector {wave} cleared!',
      'ann.waveStart': 'Sector {wave}. Hold the line!',
      'ann.status': 'Score {score}, {lives} lives, sector {wave}, combo {combo}.',
      'ann.threats': '{ground} on the ground, {air} in the air, {shells} shells incoming.',
      'ann.best': 'Best combo {combo}.',
      'ann.gameOver': 'Overrun. Final score {score}.',
      'ann.gameOverHigh': 'Overrun. New high score, {score}!',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Strafe',

      'menu.aria': 'Menú principal',
      'menu.title': 'Strafe',
      'menu.subtitle': 'Un run-and-gun por audio. Aguanta la línea: abate a los enemigos que cargan de frente —bajos por el suelo, altos por el aire— y agáchate ante los proyectiles que lanzan. Limpia cada sector para avanzar.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'La línea de frente',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.wave': 'Sector',
      'hud.combo': 'Combo',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Abate a los enemigos de tierra y aire; agáchate ante los proyectiles.',
      'help.intro': 'Aguantas una línea de frente. Los enemigos cargan de frente en dos alturas: la línea de TIERRA (un gruñido grave) y la de AIRE (un silbido agudo). La vista es de lado y nunca gira: un enemigo lejano está a tu derecha y se desliza hacia el centro al acercarse, así que el paneo es distancia y el tono es la línea. DISPARA a la línea correspondiente para abatir al más cercano antes de que te alcance; cualquiera que pase te cuesta una vida. Mezclados, lanzan PROYECTILES —un silbido tembloroso— que no puedes disparar: AGÁCHATE cuando uno caiga. Limpia el cupo de un sector para avanzar a otro más rápido. Tres vidas.',
      'help.h.fireGround': '<kbd>Espacio</kbd> (o <kbd>J</kbd>) — dispara a la línea de TIERRA (el gruñido grave). Mantén para seguir disparando; el arma tiene un breve enfriamiento.',
      'help.h.fireAir': '<kbd>Arriba</kbd> (o <kbd>K</kbd>) — dispara a la línea de AIRE (el silbido agudo).',
      'help.h.duck': '<kbd>Abajo</kbd> (o <kbd>S</kbd>) — agáchate ante un proyectil. Púlsalo justo cuando el silbido se cierne; los proyectiles no se pueden disparar.',
      'help.h.lanes': 'El tono indica la línea (grave = tierra, agudo = aire); el paneo y el volumen indican la distancia. Un enemigo casi encima pita rápido y centrado: dispara ya.',
      'help.h.shells': 'Un proyectil tiene un silbido tembloroso, distinto de los enemigos. No se puede disparar: solo agacharse te salva.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> / <kbd>F4</kbd> amenazas por línea · <kbd>F3</kbd> mejor combo.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Dos armas, dos líneas: mantén ambas despejadas. Cuanto más avanzas, llegan parejas en ambas líneas a la vez, así que disparas a tierra y aire en rápida sucesión. Una racha limpia no deja pasar a nadie y esquiva todos los proyectiles; los combos multiplican tu puntuación.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores avances en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. Aguanta la línea!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, sector {wave}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa', 'pause.title': 'Pausa', 'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida', 'pause.menu': 'Menú principal',

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
      'learn.ground': 'Enemigo de tierra (grave) — dispara a tierra',
      'learn.air': 'Enemigo de aire (agudo) — dispara al aire',
      'learn.shell': 'Proyectil lanzado — ¡agáchate!',
      'learn.fireGround': 'Tu disparo a tierra',
      'learn.fireAir': 'Tu disparo al aire',
      'learn.kill': 'Cae un enemigo',
      'learn.duck': 'Te agachas',
      'learn.dodge': 'Un proyectil pasa silbando',
      'learn.hit': 'Recibes un impacto',
      'learn.wave': 'Sector despejado',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de estéreo y distancia',
      'test.title': 'Prueba estéreo / distancia',
      'test.subtitle': 'Confirma: lo lejano está a tu derecha y se desliza al centro al acercarse.',
      'test.east': 'Sonar lejos al frente (derecha)',
      'test.south': 'Sonar a media distancia',
      'test.north': 'Sonar justo encima (centro)',
      'test.ring': 'Sonar una aproximación',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.combo': '¡Combo {combo}!',
      'ann.leakGround': '¡Un enemigo de tierra pasó! Quedan {lives} vidas.',
      'ann.leakAir': '¡Un enemigo de aire pasó! Quedan {lives} vidas.',
      'ann.hitShell': '¡Impacto de proyectil! Quedan {lives} vidas.',
      'ann.hitLast': '¡Arrollado! Sin vidas.',
      'ann.waveClear': '¡Sector {wave} despejado!',
      'ann.waveStart': 'Sector {wave}. ¡Aguanta!',
      'ann.status': 'Puntos {score}, {lives} vidas, sector {wave}, combo {combo}.',
      'ann.threats': '{ground} en tierra, {air} en aire, {shells} proyectiles entrantes.',
      'ann.best': 'Mejor combo {combo}.',
      'ann.gameOver': 'Arrollado. Puntuación final {score}.',
      'ann.gameOverHigh': 'Arrollado. ¡Nuevo récord, {score}!',
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
