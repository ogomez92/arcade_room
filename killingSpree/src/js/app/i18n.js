/**
 * Lightweight i18n for accessible audio games (shared implementation).
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
 * 2-letter prefix → fallback ('en').
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'killingSpree.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Killing Spree',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Killing Spree',
      'menu.subtitle': 'Keep the car in the middle. Take the curves. Run them down.',
      'menu.start': 'Start driving',
      'menu.help': 'How to play',
      'menu.learn': 'Learn the sounds',
      'menu.highscores': 'High scores',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game
      'game.aria': 'Driving',
      'hud.score': 'Score',
      'hud.health': 'Health',
      'hud.level': 'Level',
      'hud.speed': 'km/h',
      'hud.combo': 'Combo',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.titleCrash': 'Wrecked',
      'gameover.titleDrain': 'The engine gave out',
      'gameover.score': 'Score: {score}',
      'gameover.detail': '{kills} pedestrians, level {level}, best combo ×{combo}, {distance} m driven.',
      'gameover.rankAt': 'A new high score, position {rank}. Enter your name to save it.',
      'gameover.name': 'Your name',
      'gameover.save': 'Save score',
      'gameover.nameRequired': 'Please enter a name first.',
      'gameover.postPrompt': 'Post this score to the online scoreboard?',
      'gameover.postYes': 'Post online',
      'gameover.postNo': 'No thanks',
      'gameover.again': 'Drive again',
      'gameover.continue': 'Main menu',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': 'Couldn’t reach the online scoreboard. Your score is saved on this device.',
      'online.viewBoard': 'View the online scoreboard',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'An arcade driving game played by ear.',
      'help.intro': 'You are behind the wheel of a wreck that only runs on blood. Health drains all the time and only pedestrians refill it. Keep the car in the middle of the road, take every curve at a speed the tyres can hold, and line up as many people as you can. Hit a barrier and the health drops hard, the faster the harder.',
      'help.h.steer': '<kbd>Left</kbd> and <kbd>Right</kbd> arrows (or <kbd>A</kbd>/<kbd>D</kbd>, or a gamepad stick) steer. Tap for fine corrections; holding the key winds on full lock and squeals the tyres.',
      'help.h.speed': '<kbd>Up</kbd> (or <kbd>W</kbd>, right trigger) accelerates, <kbd>Down</kbd> (or <kbd>S</kbd>, left trigger) brakes. The engine climbs through five gears; the wind tells you the rest.',
      'help.h.pan': '<strong>Your engine is your position.</strong> It sits in the middle when you are centred. Hear it drift right and you are right of centre: steer left until it is back in the middle. A rumble strip growls on the side you are about to leave the road.',
      'help.h.road': '<strong>The road voice</strong> is an airy whistle that plays on the side the road bends toward, higher the tighter the bend. Steer toward the road voice and away from your engine pan.',
      'help.h.pacenote': '<strong>Pacenotes:</strong> a few seconds before each curve you hear a whoosh and one to four pips on the curve’s side. One pip: lift off. Two: brake a little. Three: brake hard. Four: hairpin, crawl.',
      'help.h.squeal': '<strong>Tyre squeal</strong> means you are at the limit of grip. Lift off. Keep pushing and the car understeers wide toward the outside barrier.',
      'help.h.peds': '<strong>Pedestrians</strong> talk, whistle, ring, jog along the shoulder or wait at the kerb and step out in front of you. Each one pans by where they stand relative to your bonnet and gets louder as you close. A soft tick means one is lined up. Faster hits heal and score more; combos multiply until you miss one or hit a wall.',
      'help.h.keys': 'Status keys: <kbd>F1</kbd> speed and gear, <kbd>F2</kbd> health, <kbd>F3</kbd> score and combo, <kbd>F4</kbd> level and distance, <kbd>F5</kbd> the next curve. <kbd>Escape</kbd> pauses.',
      'help.audio': 'Every sound is synthesised on the fly. Visit Learn the sounds to hear each cue on its own before you drive.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best sprees on this device.',
      'highscores.entry': '{rank}. {name} — {score} points, level {level}',
      'highscores.empty': 'No scores yet. Go make a mess.',
      'highscores.back': 'Back',

      // Learn the sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each cue on its own.',
      'learn.engineStart': 'Starting the engine',
      'learn.engine': 'Accelerating through the gears, drifting left and right',
      'learn.panLeft': 'Your car drifting LEFT of centre (steer right)',
      'learn.panRight': 'Your car drifting RIGHT of centre (steer left)',
      'learn.roadLeft': 'Road voice: a LEFT curve, tightening then easing',
      'learn.roadRight': 'Road voice: a RIGHT curve, tightening then easing',
      'learn.callout1': 'Pacenote: left, easy (one pip)',
      'learn.callout2': 'Pacenote: right, medium (two pips)',
      'learn.callout3': 'Pacenote: left, tight (three pips)',
      'learn.callout4': 'Pacenote: right, hairpin (four pips)',
      'learn.squeal': 'Tyres at the limit, then sliding',
      'learn.rumble': 'Rumble strip on the right shoulder',
      'learn.scrape': 'Scraping the right barrier',
      'learn.crash': 'Hitting the right barrier',
      'learn.talker': 'A pedestrian talking, slightly left',
      'learn.whistler': 'A pedestrian whistling, slightly right',
      'learn.phone': 'A phone ringing, to the left',
      'learn.jogger': 'A jogger on the right shoulder',
      'learn.crosser': 'Someone at the right kerb stepping out to cross',
      'learn.lock': 'A pedestrian lined up with your bonnet',
      'learn.hit': 'Hitting a pedestrian',
      'learn.hitCombo': 'Hitting a pedestrian at combo six',
      'learn.nearMiss': 'A near miss',
      'learn.comboLost': 'Combo lost',
      'learn.gearShift': 'Gear change',
      'learn.levelUp': 'Level up',
      'learn.healthLow': 'Health low (heartbeat)',
      'learn.gameOver': 'Game over',
      'learn.back': 'Back',

      // Directions and curve tiers
      'dir.left': 'left',
      'dir.right': 'right',
      'curve.tier1': 'easy',
      'curve.tier2': 'medium',
      'curve.tier3': 'tight',
      'curve.tier4': 'hairpin',

      // Announcements
      'ann.start': 'Engine on. Level {level}. Go.',
      'ann.resumed': 'Resumed.',
      'ann.paused': 'Paused.',
      'ann.callout': '{dir}, {tier}',
      'ann.points': '{points}',
      'ann.combo': '×{combo}, {points}',
      'ann.comboLost': 'Combo ×{combo} lost.',
      'ann.crash': 'Crash. Health {health}.',
      'ann.scrape': 'Scraping the {side} barrier.',
      'ann.levelUp': 'Level {level}.',
      'ann.healthLow': 'Health low, {health}.',
      'ann.death.crash': 'Wrecked.',
      'ann.death.drain': 'The engine gave out.',
      'ann.gameOver': 'Game over. Score {score}, {kills} pedestrians, level {level}.',
      'ann.gameOverRank': 'Game over. Score {score}, {kills} pedestrians, level {level}. New high score, position {rank}.',
      'ann.speed': '{kmh} kilometres per hour, gear {gear}.',
      'ann.health': 'Health {health} percent.',
      'ann.score': 'Score {score}. {kills} hit, {misses} missed, combo {combo}.',
      'ann.level': 'Level {level}, {distance} metres.',
      'ann.nextCurve': 'Next curve: {dir}, {tier}, in {dist} metres. Safe at about {speed}.',
      'ann.inCurve': 'In a {tier} {dir} curve. Safe at about {speed}.',
      'ann.noCurve': 'Straight road ahead.',
      'ann.scoreSaved': 'Score saved.',
      'ann.postPrompt': 'Post this score online? Choose Post online or No thanks.',
      'ann.onlineRank': 'Posted. Online rank {rank}.',
      'ann.onlineError': 'Could not reach the online scoreboard.',
    },

    es: {
      'doc.title': 'Killing Spree',

      'menu.aria': 'Menú principal',
      'menu.title': 'Killing Spree',
      'menu.subtitle': 'Mantén el coche en el centro. Toma las curvas. Atropéllalos.',
      'menu.start': 'Conducir',
      'menu.help': 'Cómo jugar',
      'menu.learn': 'Aprender los sonidos',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Conduciendo',
      'hud.score': 'Puntos',
      'hud.health': 'Salud',
      'hud.level': 'Nivel',
      'hud.speed': 'km/h',
      'hud.combo': 'Combo',

      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar',
      'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.titleCrash': 'Siniestro total',
      'gameover.titleDrain': 'El motor se apagó',
      'gameover.score': 'Puntos: {score}',
      'gameover.detail': '{kills} peatones, nivel {level}, mejor combo ×{combo}, {distance} m recorridos.',
      'gameover.rankAt': 'Nuevo récord, posición {rank}. Escribe tu nombre para guardarlo.',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.nameRequired': 'Escribe un nombre primero.',
      'gameover.postPrompt': '¿Publicar esta puntuación en la tabla online?',
      'gameover.postYes': 'Publicar online',
      'gameover.postNo': 'No, gracias',
      'gameover.again': 'Conducir otra vez',
      'gameover.continue': 'Menú principal',

      'online.posting': 'Publicando tu puntuación…',
      'online.rank': 'Puesto online: #{rank}',
      'online.error': 'No se pudo conectar con la tabla online. Tu puntuación queda guardada en este dispositivo.',
      'online.viewBoard': 'Ver la tabla online',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Un arcade de conducción que se juega de oído.',
      'help.intro': 'Conduces una chatarra que solo funciona con sangre. La salud baja sin parar y solo los peatones la recuperan. Mantén el coche en el centro de la carretera, toma cada curva a una velocidad que los neumáticos aguanten y alinea a toda la gente que puedas. Si tocas una barrera, la salud cae de golpe: cuanto más rápido, peor.',
      'help.h.steer': 'Las flechas <kbd>Izquierda</kbd> y <kbd>Derecha</kbd> (o <kbd>A</kbd>/<kbd>D</kbd>, o el stick del mando) giran. Toca para correcciones finas; si mantienes la tecla, el volante va a tope y los neumáticos chirrían.',
      'help.h.speed': '<kbd>Arriba</kbd> (o <kbd>W</kbd>, gatillo derecho) acelera, <kbd>Abajo</kbd> (o <kbd>S</kbd>, gatillo izquierdo) frena. El motor sube por cinco marchas; el viento te cuenta el resto.',
      'help.h.pan': '<strong>Tu motor es tu posición.</strong> Suena en el centro cuando vas centrado. Si lo oyes irse a la derecha, estás a la derecha del centro: gira a la izquierda hasta devolverlo al centro. Una banda sonora rugosa suena por el lado por el que te estás saliendo.',
      'help.h.road': '<strong>La voz de la carretera</strong> es un silbido de aire que suena por el lado hacia el que gira la carretera, más agudo cuanto más cerrada es la curva. Gira hacia la voz de la carretera y alejándote de tu motor.',
      'help.h.pacenote': '<strong>Avisos de curva:</strong> unos segundos antes de cada curva oyes un soplido y de uno a cuatro pitidos por su lado. Un pitido: levanta el pie. Dos: frena un poco. Tres: frena fuerte. Cuatro: horquilla, ve a paso de tortuga.',
      'help.h.squeal': '<strong>El chirrido de neumáticos</strong> significa que vas al límite del agarre. Levanta el pie. Si sigues empujando, el coche se abre hacia la barrera exterior.',
      'help.h.peds': '<strong>Los peatones</strong> hablan, silban, suenan como teléfonos, corren por el arcén o esperan en el bordillo y cruzan delante de ti. Cada uno suena por el lado en que está respecto a tu capó y sube de volumen al acercarte. Un tic suave indica que tienes uno alineado. Los golpes rápidos curan y puntúan más; el combo multiplica hasta que fallas uno o tocas una pared.',
      'help.h.keys': 'Teclas de estado: <kbd>F1</kbd> velocidad y marcha, <kbd>F2</kbd> salud, <kbd>F3</kbd> puntos y combo, <kbd>F4</kbd> nivel y distancia, <kbd>F5</kbd> la próxima curva. <kbd>Escape</kbd> pausa.',
      'help.audio': 'Todos los sonidos se sintetizan al vuelo. Entra en Aprender los sonidos para escuchar cada señal por separado antes de conducir.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.entry': '{rank}. {name} — {score} puntos, nivel {level}',
      'highscores.empty': 'Aún no hay puntuaciones. Ve a hacer estragos.',
      'highscores.back': 'Atrás',

      'learn.aria': 'Aprender los sonidos',
      'learn.title': 'Aprender los sonidos',
      'learn.subtitle': 'Escucha cada señal por separado.',
      'learn.engineStart': 'Arrancando el motor',
      'learn.engine': 'Acelerando por las marchas, derivando a izquierda y derecha',
      'learn.panLeft': 'Tu coche se va a la IZQUIERDA del centro (gira a la derecha)',
      'learn.panRight': 'Tu coche se va a la DERECHA del centro (gira a la izquierda)',
      'learn.roadLeft': 'Voz de la carretera: curva a la IZQUIERDA, se cierra y luego se abre',
      'learn.roadRight': 'Voz de la carretera: curva a la DERECHA, se cierra y luego se abre',
      'learn.callout1': 'Aviso: izquierda, fácil (un pitido)',
      'learn.callout2': 'Aviso: derecha, media (dos pitidos)',
      'learn.callout3': 'Aviso: izquierda, cerrada (tres pitidos)',
      'learn.callout4': 'Aviso: derecha, horquilla (cuatro pitidos)',
      'learn.squeal': 'Neumáticos al límite, luego derrapando',
      'learn.rumble': 'Banda rugosa en el arcén derecho',
      'learn.scrape': 'Rozando la barrera derecha',
      'learn.crash': 'Chocando contra la barrera derecha',
      'learn.talker': 'Un peatón hablando, un poco a la izquierda',
      'learn.whistler': 'Un peatón silbando, un poco a la derecha',
      'learn.phone': 'Un teléfono sonando, a la izquierda',
      'learn.jogger': 'Un corredor en el arcén derecho',
      'learn.crosser': 'Alguien en el bordillo derecho que sale a cruzar',
      'learn.lock': 'Un peatón alineado con tu capó',
      'learn.hit': 'Atropellando a un peatón',
      'learn.hitCombo': 'Atropellando con combo seis',
      'learn.nearMiss': 'Por los pelos',
      'learn.comboLost': 'Combo perdido',
      'learn.gearShift': 'Cambio de marcha',
      'learn.levelUp': 'Subida de nivel',
      'learn.healthLow': 'Salud baja (latido)',
      'learn.gameOver': 'Fin de la partida',
      'learn.back': 'Atrás',

      'dir.left': 'izquierda',
      'dir.right': 'derecha',
      'curve.tier1': 'fácil',
      'curve.tier2': 'media',
      'curve.tier3': 'cerrada',
      'curve.tier4': 'horquilla',

      'ann.start': 'Motor en marcha. Nivel {level}. Adelante.',
      'ann.resumed': 'Continuamos.',
      'ann.paused': 'Pausa.',
      'ann.callout': '{dir}, {tier}',
      'ann.points': '{points}',
      'ann.combo': '×{combo}, {points}',
      'ann.comboLost': 'Combo ×{combo} perdido.',
      'ann.crash': 'Choque. Salud {health}.',
      'ann.scrape': 'Rozando la barrera {side}.',
      'ann.levelUp': 'Nivel {level}.',
      'ann.healthLow': 'Salud baja, {health}.',
      'ann.death.crash': 'Siniestro total.',
      'ann.death.drain': 'El motor se apagó.',
      'ann.gameOver': 'Fin de la partida. {score} puntos, {kills} peatones, nivel {level}.',
      'ann.gameOverRank': 'Fin de la partida. {score} puntos, {kills} peatones, nivel {level}. Nuevo récord, posición {rank}.',
      'ann.speed': '{kmh} kilómetros por hora, marcha {gear}.',
      'ann.health': 'Salud {health} por ciento.',
      'ann.score': '{score} puntos. {kills} atropellados, {misses} fallados, combo {combo}.',
      'ann.level': 'Nivel {level}, {distance} metros.',
      'ann.nextCurve': 'Próxima curva: {dir}, {tier}, a {dist} metros. Segura a unos {speed}.',
      'ann.inCurve': 'En una curva {tier} a la {dir}. Segura a unos {speed}.',
      'ann.noCurve': 'Recta por delante.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.postPrompt': '¿Publicar la puntuación online? Elige Publicar online o No, gracias.',
      'ann.onlineRank': 'Publicada. Puesto online {rank}.',
      'ann.onlineError': 'No se pudo conectar con la tabla online.',
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
