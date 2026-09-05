/**
 * Lightweight i18n for accessible audio games.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
 * 2-letter prefix → fallback ('en').
 *
 * Dictionaries are keyed by short locale id ('en', 'es', ...). New languages
 * are added by extending the `dictionaries` and `localeNames` objects below.
 *
 * DOM strings: annotate with `data-i18n="key"` (textContent),
 * `data-i18n-html="key"` (innerHTML, for fragments containing inline tags
 * like <kbd>), or `data-i18n-attr="aria-label:key;placeholder:key"`.
 *
 * Runtime strings: call app.i18n.t('key', {param: 'val'}). Templates use
 * {name} placeholders.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'lucky.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Lucky Strike',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Lucky Strike',
      'menu.subtitle': 'An audio arcade shooter. The more you shoot, the likelier you explode.',
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

      // Game screen
      'game.aria': 'Game',
      'hud.score': 'Score',
      'hud.chance': 'Destroy chance',
      'hud.saves': 'Saves',

      // In-game announcements
      'ann.start': 'It is 2039. The robots are coming — defend the factory!',
      'ann.score': 'Score {score}.',
      'ann.chance': 'Destroy chance {chance} percent.',
      'ann.chanceSaves': 'Destroy chance {chance} percent. {saves} saves.',
      'ann.radarOn': 'Radar enabled.',
      'ann.radarOff': 'Radar disabled.',
      'ann.radarDead': 'Radar disabled permanently!',
      'ann.saved': 'Saved from certain death! The shot was not fired.',
      'ann.rapidOn': 'Rapid fire! 8 seconds.',
      'ann.rapidOff': 'Rapid fire over.',
      'ann.puSave': 'Save banked.',
      'ann.puPoints': '5000 points!',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.scoreSaved': 'Score saved.',
      'ann.postPrompt': 'Post your score to the online leaderboard?',
      'ann.onlineRank': 'Online rank {rank}.',
      'ann.onlineError': 'Could not reach the online leaderboard.',
      'ann.gameOver': 'Game over. Score {score}.',
      'ann.gameOverHigh': 'Game over. New high score: {score}!',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game over',
      'go.exploded': 'Your weapon exploded!',
      'go.reached': 'A robot reached you!',
      'gameover.stats': 'Thank you for playing Lucky Strike! Your score was {score}, with a destroy chance of {chance} percent. Today you killed {kills} robots.',
      'gameover.line0': 'Well, that was electrifying.',
      'gameover.line1': 'The robots send their regards.',
      'gameover.line2': 'Maybe read the empathy core manual next time.',
      'gameover.line3': 'Your weapon had one job. So did you.',
      'gameover.line4': 'Scrap metal: 1. Junior developer: 0.',
      'gameover.line5': 'On the bright side, the factory insurance is excellent.',
      'gameover.line6': 'You have been promoted to spare parts.',
      'gameover.line7': 'The robots filed your performance review. It is glowing. Literally.',
      'gameover.line8': 'Somewhere, the CEO is updating his resume.',
      'gameover.line9': 'Better luck next time! Maybe…',
      'gameover.rankAt': 'That makes the local top 10, at position {rank}! Enter your name to save it.',
      'gameover.name': 'Your name',
      'gameover.nameRequired': 'Enter a name first.',
      'gameover.save': 'Save score',
      'gameover.continue': 'Continue',
      'post.title': 'Post your score online?',
      'post.yes': 'Post online',
      'post.no': 'No thanks',

      // Online status
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': 'Could not reach the online leaderboard. Your score is saved locally.',
      'online.viewBoard': 'View the online leaderboard',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. The robots are waiting.',
      'highscores.entry': '{rank}. {name} — {score} ({kills} robots)',
      'highscores.back': 'Back',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Defend the factory. Do not trust your own weapon.',
      'help.story1': 'It is the year 2039. You are a junior developer at Superior Robots LLC, a company that deploys robots for every situation: cleaning bots, guide bots, service bots. Then the CEO had the brilliant idea to build robots for the military — and hired you and a handful of junior interns to code their empathy core. What could go wrong?',
      'help.story2': 'The robots are after you. Grab your beam shooter and defend the factory: robots march toward you from ahead, so slide left and right to line up with them and shoot them down before any of them reaches you.',
      'help.story3': 'Your beam shooter runs on a very volatile battery. Every shot raises the chance it explodes in your hands by 0.3 percent, and every stray beam that hits nothing adds another 0.5. It starts at 1 percent — you can lose on your very first shot. The higher the chance, the faster the robots come, and the more points each kill is worth. This game is impossible to win. What is your highest score?',
      'help.h.move': '<kbd>Left</kbd> / <kbd>Right</kbd> arrows (hold): slide your beam shooter. Gamepad: stick or d-pad.',
      'help.h.shoot': '<kbd>Space</kbd> or <kbd>Ctrl</kbd>: shoot. Gamepad: A button.',
      'help.h.radar': '<kbd>R</kbd>: toggle the locator radar — it ticks while an enemy is lined up with you. Once your destroy chance passes 10 percent, the radar shuts down for good.',
      'help.h.superbot': 'The <strong>superbot</strong> hums a melodic tone and is worth double points. From time to time it whirs, beeps, and teleports somewhere else.',
      'help.h.powerups': '<strong>Powerups</strong> glide across the field between you and the robots — shoot them as they pass. The buzzing machine grants 8 seconds of rapid fire that destroys any lined-up robot without raising your destroy chance. The bell banks a save that absorbs one would-be explosion (the shot is not fired — shoot again!). The coin melody is worth 5000 points.',
      'help.h.status': '<kbd>S</kbd> or <kbd>F1</kbd>: hear your score. <kbd>C</kbd> or <kbd>F2</kbd>: hear your destroy chance and saves.',
      'help.h.pause': '<kbd>Escape</kbd>: pause.',
      'help.audio': 'Play with headphones. Robots approach from ahead: their position in the stereo field tells you where to slide, and their loudness tells you how close they are.',
      'help.back': 'Back',

      // Learn the sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each cue on its own.',
      'learn.robotHum': 'Robot — engine hum',
      'learn.superbotHum': 'Superbot — melodic hum',
      'learn.robotStep': 'Robot — footstep',
      'learn.superbotStep': 'Superbot — heavy footstep',
      'learn.taunt': 'Robot — taunt',
      'learn.superTaunt': 'Superbot — taunt',
      'learn.teleport': 'Superbot — teleport',
      'learn.destroy': 'Robot destroyed',
      'learn.superDestroy': 'Superbot destroyed',
      'learn.shoot': 'Your shot',
      'learn.radar': 'Radar tick',
      'learn.puRapid': 'Powerup — rapid fire',
      'learn.puSave': 'Powerup — save (bell)',
      'learn.puPoints': 'Powerup — points (coins)',
      'learn.saved': 'Save consumed',
      'learn.explosion': 'Your weapon explodes',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Spatial test
      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm left, right, front and back.',
      'test.north': 'Play front',
      'test.east': 'Play right',
      'test.south': 'Play behind',
      'test.west': 'Play left',
      'test.ring': 'Play full ring',
      'test.back': 'Back',
    },

    es: {
      // <head>
      'doc.title': 'Suerte de Muerte',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'Suerte de Muerte',
      'menu.subtitle': 'Un arcade de audio. Cuanto más disparas, más fácil es que explotes.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',
      'menu.learn': 'Aprende los sonidos',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Game screen
      'game.aria': 'Juego',
      'hud.score': 'Puntos',
      'hud.chance': 'Posibilidad de explotar',
      'hud.saves': 'Salvavidas',

      // In-game announcements
      'ann.start': 'Es el año 2039. ¡Llegan los robots: defiende la fábrica!',
      'ann.score': 'Puntuación: {score}.',
      'ann.chance': 'Posibilidad de explotar: {chance} por ciento.',
      'ann.chanceSaves': 'Posibilidad de explotar: {chance} por ciento. {saves} salvavidas.',
      'ann.radarOn': 'Radar activado.',
      'ann.radarOff': 'Radar desactivado.',
      'ann.radarDead': '¡Radar desactivado para siempre!',
      'ann.saved': '¡Salvado de una muerte segura! El disparo no ha salido.',
      'ann.rapidOn': '¡Supermetralleta! 8 segundos.',
      'ann.rapidOff': 'Se acabó la supermetralleta.',
      'ann.puSave': 'Salvavidas guardado.',
      'ann.puPoints': '¡5000 puntos!',
      'ann.paused': 'Pausa.',
      'ann.resumed': 'Seguimos.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.postPrompt': '¿Publicar tu puntuación en la tabla online?',
      'ann.onlineRank': 'Posición online: {rank}.',
      'ann.onlineError': 'No se pudo conectar con la tabla online.',
      'ann.gameOver': 'Fin del juego. Puntuación: {score}.',
      'ann.gameOverHigh': 'Fin del juego. ¡Nuevo récord: {score}!',

      // Pause
      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar',
      'pause.menu': 'Menú principal',

      // Game over
      'gameover.aria': 'Fin del juego',
      'gameover.title': 'Fin del juego',
      'go.exploded': '¡Tu arma ha explotado!',
      'go.reached': '¡Un robot te ha alcanzado!',
      'gameover.stats': '¡Gracias por jugar a Suerte de Muerte! Tu puntuación fue de {score}, con una posibilidad de explotar del {chance} por ciento. Hoy has matado {kills} robots.',
      'gameover.line0': 'Bueno, ha sido electrizante.',
      'gameover.line1': 'Los robots te mandan recuerdos.',
      'gameover.line2': 'La próxima vez léete el manual del núcleo de empatía.',
      'gameover.line3': 'Tu arma tenía un solo trabajo. Tú también.',
      'gameover.line4': 'Chatarra: 1. Programador junior: 0.',
      'gameover.line5': 'Lo bueno es que el seguro de la fábrica es estupendo.',
      'gameover.line6': 'Has sido ascendido a piezas de repuesto.',
      'gameover.line7': 'Los robots ya han escrito tu evaluación de desempeño. Brillante. Literalmente.',
      'gameover.line8': 'En algún lugar, Carlos Lefe está actualizando su currículum.',
      'gameover.line9': '¡Buena suerte para la próxima… muerte!',
      'gameover.rankAt': '¡Entras en el top 10 local, en la posición {rank}! Escribe tu nombre para guardarla.',
      'gameover.name': 'Tu nombre',
      'gameover.nameRequired': 'Escribe primero un nombre.',
      'gameover.save': 'Guardar puntuación',
      'gameover.continue': 'Continuar',
      'post.title': '¿Publicar tu puntuación online?',
      'post.yes': 'Publicar online',
      'post.no': 'No, gracias',

      // Online status
      'online.posting': 'Publicando tu puntuación…',
      'online.rank': 'Posición online: n.º {rank}',
      'online.error': 'No se pudo conectar con la tabla online. Tu puntuación queda guardada en este dispositivo.',
      'online.viewBoard': 'Ver la tabla online',

      // High scores
      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. Los robots esperan.',
      'highscores.entry': '{rank}. {name} — {score} ({kills} robots)',
      'highscores.back': 'Atrás',

      // Help
      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Defiende la fábrica. No te fíes de tu propia arma.',
      'help.story1': 'Es el año 2039. Eres un programador junior en Robotes Molones, una empresa especializada en desplegar robots para todo tipo de situaciones: robots de limpieza, robots guía, robots de servicio. Hasta que Carlos Lefe, el jefe, tuvo la gran idea de fabricar robots militares — y os contrató a ti y a un puñado de juniors para programar su núcleo de empatía. ¿Qué podía salir mal?',
      'help.story2': '¡Han llegado los robots! Coge tu lanzarrayos y defiende la fábrica: los robots avanzan hacia ti desde el frente, así que deslízate a izquierda y derecha para alinearte con ellos y derríbalos antes de que alguno te alcance.',
      'help.story3': 'Tu lanzarrayos funciona con una batería muy volátil. Cada disparo aumenta un 0,3 por ciento la posibilidad de que te explote en las manos, y cada rayo perdido que no toca nada suma otro 0,5. Empieza en el 1 por ciento: puedes perder con tu primer disparo. Cuanto más alto el porcentaje, más rápido vienen los robots — y más puntos vale cada uno. Este juego no se puede ganar. ¿Cuál es tu máxima puntuación?',
      'help.h.move': 'Flechas <kbd>izquierda</kbd> / <kbd>derecha</kbd> (mantén pulsado): desliza tu lanzarrayos. Mando: palanca o cruceta.',
      'help.h.shoot': '<kbd>Espacio</kbd> o <kbd>Control</kbd>: disparar. Mando: botón A.',
      'help.h.radar': '<kbd>R</kbd>: activa el radar localizador — hace tic mientras un enemigo está alineado contigo. Cuando tu posibilidad de explotar pase del 10 por ciento, el radar se apaga para siempre.',
      'help.h.superbot': 'El <strong>superbot</strong> emite un zumbido melódico y vale el doble de puntos. De vez en cuando zumba, pita y se teletransporta a otro lugar.',
      'help.h.powerups': 'Los <strong>bonus</strong> cruzan el campo entre tú y los robots — dispárales cuando pasen. La máquina que zumba te da 8 segundos de supermetralleta que destruye a cualquier robot alineado sin aumentar tu posibilidad de explotar. La campana guarda un salvavidas que absorbe una explosión (¡el disparo no sale, dispara otra vez!). La melodía de monedas vale 5000 puntos.',
      'help.h.status': '<kbd>S</kbd> o <kbd>F1</kbd>: escucha tu puntuación. <kbd>C</kbd> o <kbd>F2</kbd>: escucha tu posibilidad de explotar y tus salvavidas.',
      'help.h.pause': '<kbd>Escape</kbd>: pausa.',
      'help.audio': 'Juega con auriculares. Los robots se acercan de frente: su posición en el campo estéreo te dice hacia dónde deslizarte, y su volumen te dice lo cerca que están.',
      'help.back': 'Atrás',

      // Learn the sounds
      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Escucha cada sonido por separado.',
      'learn.robotHum': 'Robot — motor',
      'learn.superbotHum': 'Superbot — zumbido melódico',
      'learn.robotStep': 'Robot — pasos',
      'learn.superbotStep': 'Superbot — pasos pesados',
      'learn.taunt': 'Robot — burla',
      'learn.superTaunt': 'Superbot — burla',
      'learn.teleport': 'Superbot — teletransporte',
      'learn.destroy': 'Robot destruido',
      'learn.superDestroy': 'Superbot destruido',
      'learn.shoot': 'Tu disparo',
      'learn.radar': 'Tic del radar',
      'learn.puRapid': 'Bonus — supermetralleta',
      'learn.puSave': 'Bonus — salvavidas (campana)',
      'learn.puPoints': 'Bonus — puntos (monedas)',
      'learn.saved': 'Salvavidas consumido',
      'learn.explosion': 'Tu arma explota',
      'learn.over': 'Fin del juego',
      'learn.back': 'Atrás',

      // Spatial test
      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma izquierda, derecha, delante y detrás.',
      'test.north': 'Sonar delante',
      'test.east': 'Sonar a la derecha',
      'test.south': 'Sonar detrás',
      'test.west': 'Sonar a la izquierda',
      'test.ring': 'Sonar en círculo',
      'test.back': 'Atrás',
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
