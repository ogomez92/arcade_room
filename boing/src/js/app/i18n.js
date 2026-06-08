/**
 * Lightweight i18n for ALOFT. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'boing.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Boing Boing',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Boing Boing',
      'menu.subtitle': 'An audio-first bounce climber. You bounce forever; steer left and right to land on the next platform by ear, and climb as high as you can.',
      'menu.start': 'Start',
      'menu.help': 'How to play',
      'menu.highscores': 'High scores',
      'menu.learn': 'Learn the sounds',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game / HUD
      'game.aria': 'The climb',
      'hud.score': 'Score',
      'hud.height': 'Height',
      'hud.level': 'Level',
      'hud.combo': 'Combo',

      // Pad kinds
      'pad.normal': 'platform',
      'pad.spring': 'spring pad',
      'pad.moving': 'moving pad',
      'pad.breakable': 'breakable pad',

      // Directions
      'dir.left': 'left',
      'dir.centre': 'centred',
      'dir.right': 'right',

      // Proximity
      'prox.far': 'far',
      'prox.near': 'closing',
      'prox.close': 'land now',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Steer onto the beacon. Bounce. Climb.',
      'help.intro': 'You bounce upward forever and gravity pulls you back down. The only steering is left and right: you slide sideways to line yourself up with the next platform so you drop onto it and bounce higher. That platform is a beacon — you hear it to your left or right depending on where it sits, so steer until it is centred (directly under you), and it grows louder and ticks faster as you fall toward it. Land lined up and you boing on up; drift off and fall past every platform below you and you plummet. Spring pads launch you far; moving pads slide so their beacon keeps drifting; breakable pads vanish after one bounce. Floating sentinels snarl in the air above some platforms — shoot them or steer wide, because touching one ends the climb. Your score is how high you climb plus the sentinels you drop.',
      'help.h.steer': '<kbd>Left</kbd> / <kbd>Right</kbd> (or <kbd>A</kbd> / <kbd>D</kbd>) — slide sideways. Hold to keep moving; let go to coast to a stop.',
      'help.h.beacon': 'The beacon is the platform you are about to land on. Steer until it is centred, then you land on it. It speeds up just before touchdown.',
      'help.h.pads': 'A bright beacon is a spring (launches you far); a wavering one is a moving pad; a brittle one is breakable (one bounce only).',
      'help.h.shoot': '<kbd>Space</kbd> (or <kbd>Up</kbd>) — fire straight up. A sentinel snarls above a platform; shoot it before you bounce into it.',
      'help.h.status': '<kbd>F1</kbd> score, height, level, combo · <kbd>F2</kbd> the beacon and any sentinel · <kbd>F3</kbd> best combo and tally.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'A wash of wind rises with how fast you are rising or falling. The beacon sits dead ahead when you are lined up under it, and off to one side when you need to steer that way. Sentinels growl from above; a sound below and behind you is a platform you have already fallen past.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best climbs on this device.',
      'highscores.empty': 'No climbs yet. Start bouncing!',
      'highscores.entry': '#{rank}. {name} — {score} points, level {level}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart climb',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Down you go',
      'gameover.title': 'Down you go',
      'gameover.subtitle': 'Enter your name to save your score.',
      'gameover.score': 'Score: {score}',
      'gameover.name': 'Your name',
      'gameover.save': 'Save score',
      'gameover.continue': 'Continue',
      'gameover.nameRequired': 'Please enter a name first.',

      // Learn the sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each cue on its own.',
      'learn.padLeft': 'Beacon — to your left',
      'learn.padCentre': 'Beacon — centred (lined up)',
      'learn.padRight': 'Beacon — to your right',
      'learn.near': 'Beacon — about to land',
      'learn.spring': 'Spring pad (bright)',
      'learn.moving': 'Moving pad (wavering)',
      'learn.breakable': 'Breakable pad (brittle)',
      'learn.bounce': 'Bounce',
      'learn.springbounce': 'Spring launch',
      'learn.break': 'Pad shatters',
      'learn.sentinel': 'Sentinel — shoot it (growls above)',
      'learn.shootHit': 'Shot — sentinel down',
      'learn.enemyHit': 'Hit a sentinel (you fall)',
      'learn.fall': 'Falling',
      'learn.level': 'Level up',
      'learn.over': 'Down you go',
      'learn.back': 'Back',

      // Spatial test
      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm the field: ahead is up the climb, right is right, behind is below, left is left.',
      'test.front': 'Play ahead (above)',
      'test.right': 'Play right',
      'test.behind': 'Play behind (below)',
      'test.left': 'Play left',
      'test.centre': 'Play centre',
      'test.sweep': 'Sweep left · centre · right',
      'test.ring': 'Play ahead · right · behind · left',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Announcements
      'ann.shot': 'Sentinel down! Plus {gained}.',
      'ann.combo': 'Combo {combo}!',
      'ann.levelUp': 'Level {level}! Higher and trickier.',
      'ann.gameOver': 'Down you go. Height {height}, score {score}.',
      'ann.gameOverHigh': 'Down you go. New high score, {score}!',
      'ann.status': 'Score {score}, height {height}, level {level}, combo {combo}.',
      'ann.field': 'Beacon: {type}, {dir}, {prox}.',
      'ann.fieldNone': 'No platform in reach.',
      'ann.sentinelAt': 'Sentinel {dir}.',
      'ann.best': 'Best combo {combo}. {bounces} bounces, {shot} shot.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Boing Boing',

      'menu.aria': 'Menú principal',
      'menu.title': 'Boing Boing',
      'menu.subtitle': 'Un trepador de rebotes sonoro. Rebotas sin fin; muévete a izquierda y derecha para aterrizar en la siguiente plataforma de oído y sube lo más alto que puedas.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',
      'menu.learn': 'Aprende los sonidos',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'La subida',
      'hud.score': 'Puntos',
      'hud.height': 'Altura',
      'hud.level': 'Nivel',
      'hud.combo': 'Combo',

      'pad.normal': 'plataforma',
      'pad.spring': 'plataforma de resorte',
      'pad.moving': 'plataforma móvil',
      'pad.breakable': 'plataforma frágil',

      'dir.left': 'izquierda',
      'dir.centre': 'centrada',
      'dir.right': 'derecha',

      'prox.far': 'lejos',
      'prox.near': 'acercándose',
      'prox.close': 'aterriza ya',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Céntrate en la baliza. Rebota. Sube.',
      'help.intro': 'Rebotas hacia arriba sin fin y la gravedad te baja. Lo único que controlas es izquierda y derecha: te deslizas de lado para alinearte con la siguiente plataforma y caer sobre ella y rebotar más alto. Esa plataforma es una baliza: la oyes a tu izquierda o derecha según dónde esté, así que muévete hasta centrarla (justo debajo de ti); suena más fuerte y repica más rápido a medida que caes hacia ella. Aterriza alineado y rebotas hacia arriba; desvíate y cae más allá de toda plataforma y te despeñas. Las plataformas de resorte te lanzan lejos; las móviles se deslizan, así que su baliza se mueve; las frágiles desaparecen tras un rebote. Centinelas flotantes gruñen en el aire sobre algunas plataformas: dispárales o esquívalos, porque tocar uno acaba la subida. Tu puntuación es cuánto subes más los centinelas que abatas.',
      'help.h.steer': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> (o <kbd>A</kbd> / <kbd>D</kbd>) — deslízate de lado. Mantén para moverte; suelta para frenar.',
      'help.h.beacon': 'La baliza es la plataforma en la que vas a aterrizar. Muévete hasta centrarla y caerás sobre ella. Se acelera justo antes del contacto.',
      'help.h.pads': 'Una baliza brillante es un resorte (te lanza lejos); una temblorosa es una plataforma móvil; una quebradiza es frágil (un solo rebote).',
      'help.h.shoot': '<kbd>Espacio</kbd> (o <kbd>Arriba</kbd>) — dispara hacia arriba. Un centinela gruñe sobre una plataforma; dispárale antes de rebotar contra él.',
      'help.h.status': '<kbd>F1</kbd> puntos, altura, nivel, combo · <kbd>F2</kbd> la baliza y algún centinela · <kbd>F3</kbd> mejor combo y recuento.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Un soplo de viento sube según lo rápido que asciendas o caigas. La baliza suena justo al frente cuando estás alineado bajo ella, y hacia un lado cuando tienes que moverte allí. Los centinelas gruñen desde arriba; un sonido por debajo y detrás de ti es una plataforma que ya has dejado pasar.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores subidas en este dispositivo.',
      'highscores.empty': 'Aún no hay subidas. ¡A rebotar!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, nivel {level}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar subida',
      'pause.menu': 'Menú principal',

      'gameover.aria': 'Te caes',
      'gameover.title': 'Te caes',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.padLeft': 'Baliza — a tu izquierda',
      'learn.padCentre': 'Baliza — centrada (alineado)',
      'learn.padRight': 'Baliza — a tu derecha',
      'learn.near': 'Baliza — a punto de aterrizar',
      'learn.spring': 'Plataforma de resorte (brillante)',
      'learn.moving': 'Plataforma móvil (temblorosa)',
      'learn.breakable': 'Plataforma frágil (quebradiza)',
      'learn.bounce': 'Rebote',
      'learn.springbounce': 'Lanzamiento de resorte',
      'learn.break': 'La plataforma se rompe',
      'learn.sentinel': 'Centinela — dispárale (gruñe arriba)',
      'learn.shootHit': 'Disparo — centinela abatido',
      'learn.enemyHit': 'Chocaste con un centinela (caes)',
      'learn.fall': 'Cayendo',
      'learn.level': 'Subes de nivel',
      'learn.over': 'Te caes',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma el campo: al frente es subiendo, derecha es derecha, detrás es abajo, izquierda es izquierda.',
      'test.front': 'Sonar al frente (arriba)',
      'test.right': 'Sonar a la derecha',
      'test.behind': 'Sonar detrás (abajo)',
      'test.left': 'Sonar a la izquierda',
      'test.centre': 'Sonar el centro',
      'test.sweep': 'Recorrer izquierda · centro · derecha',
      'test.ring': 'Sonar frente · derecha · detrás · izquierda',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.shot': '¡Centinela abatido! Más {gained}.',
      'ann.combo': '¡Combo {combo}!',
      'ann.levelUp': '¡Nivel {level}! Más alto y más difícil.',
      'ann.gameOver': 'Te caes. Altura {height}, puntuación {score}.',
      'ann.gameOverHigh': 'Te caes. ¡Nuevo récord, {score}!',
      'ann.status': 'Puntos {score}, altura {height}, nivel {level}, combo {combo}.',
      'ann.field': 'Baliza: {type}, {dir}, {prox}.',
      'ann.fieldNone': 'Ninguna plataforma al alcance.',
      'ann.sentinelAt': 'Centinela {dir}.',
      'ann.best': 'Mejor combo {combo}. {bounces} rebotes, {shot} abatidos.',
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
