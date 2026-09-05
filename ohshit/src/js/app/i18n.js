/**
 * Lightweight i18n for OH SHIT! Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'ohshit.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Oh Shit!',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Oh Shit!',
      'menu.subtitle': 'Collect items, dodge falling rocks, jump cannonballs, and mind the crumbling floor. See how long you can stay alive.',
      'menu.start': 'Start',
      'menu.runner': 'Runner minigame',
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
      'game.aria': 'The yard',
      'hud.score': 'Score',
      'hud.steps': 'Steps',
      'hud.time': 'Time',
      'hud.covers': 'Covers',
      'hud.level': 'Level',

      // Directions
      'dir.left': 'left',
      'dir.right': 'right',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Collect. Dodge. Jump. Survive.',
      'help.intro': 'You walk a strip of concrete between two walls. Everything is placed in the stereo image: a sound to your left is to your left, and it slides to the centre as you approach it. Rocks fall from the sky with a descending whistle — get out from under them! Each rock that hits the ground deposits an item: usually a score item (bling-bling chime, picked up by walking over it, gone after 10 seconds), sometimes a power-up (a ringing bell, gone after just 6 seconds). Cannons appear over time, creaking where they sit, and fire balls you must JUMP over — a ball that reaches a wall dies harmlessly, and there is a way to destroy a cannon, if you can work it out. Pits open at random: you get 2 seconds of crumbling floor as a warning, then a windy hole that kills anything that walks into it — jump across, or seal it for good with a pit cover from the crumbly-sounding edge square. One life. Your score is the number of items you collect.',
      'help.h.move': '<kbd>Left</kbd> / <kbd>Right</kbd> arrows (or <kbd>A</kbd>/<kbd>D</kbd>) — walk.',
      'help.h.jump': '<kbd>Space</kbd> or <kbd>Up</kbd> — jump. Use it for cannonballs and pits. It will NOT save you from a rock on the head.',
      'help.h.keys': '<kbd>C</kbd> — how many pit covers you carry · <kbd>F</kbd> — use a pit cover (stand on a pit edge) · <kbd>S</kbd> — current score · <kbd>T</kbd> — time survived · <kbd>F1</kbd> — full status · <kbd>Escape</kbd> — pause.',
      'help.h.powerups': 'Power-ups: SUPER SPEED (15 seconds), INVINCIBILITY (15 seconds — rocks, pits and balls cannot touch you), PIT COVERS (the only item that stacks), and the ROCK STORM — it strips your other buffs and throws rocks at you for 10 seconds, but survive it and you earn 4 pit covers plus 25 seconds of invincibility and super speed. Storms only appear after 3 minutes of play.',
      'help.h.pits': 'A pit between you and a cannon eats the cannonballs. Rocks that fall into a pit are swallowed — no item for you.',
      'help.h.runner': 'THE RUNNER: jump 100 cannonballs in total and a trial of the runner minigame may interrupt one of your games. Clear its first level to unlock it on the menu. In the runner a floating cannonball chases you from the left — never jump over it, or you are disqualified. Sprint right, jump pits and oncoming balls, and rack up steps.',
      'help.audio': 'Every hazard tells you where it is by pan and what it is by timbre: rocks whistle down, score items bling, power-ups ring like bells, cannons creak and boom, balls whoosh closer and closer, pits breathe wind, and crumbling floor crackles underfoot. Play "Learn the sounds" from the menu before your first game.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best games on this device.',
      'highscores.runnerHead': 'Runner minigame',
      'highscores.empty': 'No scores yet.',
      'highscores.entry': '#{rank} {name} — {score} items, {meta} seconds',
      'highscores.entryRunner': '#{rank} {name} — {score} steps, level {meta}',
      'highscores.back': 'Back',

      // Learn the sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each cue on its own.',
      'learn.step': 'Footstep (concrete)',
      'learn.edge': 'Footstep (pit edge)',
      'learn.jump': 'Jump',
      'learn.rockfall': 'A rock falling, then landing',
      'learn.scoreitem': 'Score item (bling)',
      'learn.powerbell': 'Power-up (bell)',
      'learn.pickupScore': 'Collecting a score item',
      'learn.pickupPower': 'Collecting a power-up',
      'learn.cannon': 'A cannon: creak, then fire',
      'learn.ball': 'A cannonball approaching',
      'learn.ballJumped': 'Jumping a cannonball',
      'learn.ballWall': 'A ball dying against the wall',
      'learn.crumble': 'Floor crumbling, pit opening',
      'learn.wind': 'An open pit (wind)',
      'learn.cover': 'Sealing a pit with a cover',
      'learn.fall': 'Falling into a pit',
      'learn.storm': 'A rock storm beginning',
      'learn.chaser': 'The runner’s chaser closing in',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart game',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game over',
      'gameover.titleRunner': 'Run over',
      'gameover.titleDq': 'Disqualified',
      'gameover.dqText': 'You jumped the chaser. No score for you.',
      'gameover.score': 'You collected {score} items and survived {time} seconds.',
      'gameover.scoreRunner': '{steps} steps, reached level {level}.',
      'gameover.subtitle': 'That makes your local top 10! Enter your name to save it.',
      'gameover.rankAt': 'That makes your local top 10 — position {rank}! Enter your name to save it.',
      'gameover.postableMsg': 'Great run! Enter your name to post it to the online board.',
      'gameover.postPrompt': 'Post this score to the online scoreboard?',
      'gameover.postYes': 'Post online',
      'gameover.postNo': 'No thanks',
      'gameover.name': 'Your name',
      'gameover.save': 'Save score',
      'gameover.continue': 'Continue',
      'gameover.nameRequired': 'Enter a name first.',

      // Online board
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': 'Couldn’t reach the leaderboard. Saved locally.',
      'online.viewBoard': 'View the leaderboard',
      'online.tooLow': 'Scores above {min} steps can be posted to the online board.',

      // Announcements
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.scoreSaved': 'Score saved.',
      'ann.postPrompt': 'You can post this score to the online board. Post it?',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.score': 'Score {score}.',
      'ann.time': '{time} seconds.',
      'ann.covers': '{covers} pit covers.',
      'ann.status': 'Score {score}, {time} seconds, {covers} covers.',
      'ann.threat.ball': 'Cannonball {dist} squares to the {side}!',
      'ann.threat.pit': 'Pit {dist} squares to the {side}.',
      'ann.clear': 'No immediate threats.',
      'ann.noCovers': 'No pit covers.',
      'ann.notAtEdge': 'Stand on a pit edge to use a cover.',
      'ann.pitSealed': 'Pit sealed! {covers} covers left.',
      'ann.gotCover': 'Pit cover! You carry {covers}.',
      'ann.got.superSpeed': 'Super speed!',
      'ann.got.invincibility': 'Invincibility!',
      'ann.got.rockStorm': 'Rock storm! Survive ten seconds!',
      'ann.expired.superSpeed': 'Speed back to normal.',
      'ann.expired.invincibility': 'Invincibility over.',
      'ann.stormSurvived': 'Storm survived! 4 pit covers, plus 25 seconds of invincibility and super speed. You carry {covers} covers.',
      'ann.cannonAppear': 'A cannon has appeared to the {side}!',
      'ann.cannonDestroyed': 'The rock crushed the cannon!',
      'ann.jumpCount': '{count} cannonballs jumped in total.',
      'ann.milestone': '100 cannonballs jumped! Keep playing — the runner may call on you.',
      'ann.crumbleUnderfoot': 'The floor is crumbling beneath you! Move!',
      'ann.death.rock': 'A rock landed on your head.',
      'ann.death.ball': 'A cannonball smashed into you.',
      'ann.death.pit': 'You fell into a pit.',
      'ann.gameOver': 'Game over. {score} items, {time} seconds survived.',
      'ann.gameOverRank': 'Game over. {score} items, {time} seconds survived. Local top 10, position {rank}!',
      'ann.runnerOffer': 'The runner calls! Sprint right, jump what comes, and never jump the chaser behind you.',
      'ann.runnerReturn': 'Back to your game. Two seconds of grace.',
      'ann.runnerUnlocked': 'Level complete — the runner is UNLOCKED! Find it on the main menu.',
      'ann.rLevel': 'Level {level}. {len} squares to the end. Go!',
      'ann.rLevelCannons': 'Level {level}. {len} squares, {cannons} cannons on the course. Go!',
      'ann.rLevelClear': 'Level {level} complete!',
      'ann.rDq': 'DISQUALIFIED! You jumped the chaser. The run is void.',
      'ann.rDeath.chaser': 'The chaser caught you.',
      'ann.rDeath.ball': 'A cannonball smashed into you.',
      'ann.rDeath.pit': 'You fell into a pit.',
      'ann.rDeath.rock': 'A rock landed on your head.',
      'ann.rOver': 'Run over. {steps} steps, level {level}.',
      'ann.rOverRank': 'Run over. {steps} steps, level {level}. Local top 10, position {rank}!',
      'ann.rOverDq': 'Disqualified. No score.',
      'ann.rCannonPassed': 'Cannon passed — it’s gone.',
      'ann.rNoCovers': 'No pit covers in the runner.',
      'ann.rSteps': '{steps} steps.',
      'ann.rStatus': '{steps} steps, level {level}.',
    },

    es: {
      'doc.title': 'Oh Shit!',

      // Menú
      'menu.aria': 'Menú principal',
      'menu.title': 'Oh Shit!',
      'menu.subtitle': 'Recoge objetos, esquiva rocas, salta balas de cañón y cuidado con el suelo que se desmorona. A ver cuánto sobrevives.',
      'menu.start': 'Jugar',
      'menu.runner': 'Minijuego del corredor',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',
      'menu.learn': 'Aprende los sonidos',

      // Selector de idioma
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma de los menús y anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Juego / HUD
      'game.aria': 'El patio',
      'hud.score': 'Puntos',
      'hud.steps': 'Pasos',
      'hud.time': 'Tiempo',
      'hud.covers': 'Tapas',
      'hud.level': 'Nivel',

      // Direcciones
      'dir.left': 'izquierda',
      'dir.right': 'derecha',

      // Ayuda
      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Recoge. Esquiva. Salta. Sobrevive.',
      'help.intro': 'Caminas por una franja de hormigón entre dos muros. Todo se coloca en la imagen estéreo: un sonido a tu izquierda está a tu izquierda, y se desliza hacia el centro cuando te acercas. Las rocas caen del cielo con un silbido descendente — ¡quítate de debajo! Cada roca que toca el suelo deposita un objeto: normalmente un objeto de puntos (campanilleo bling-bling, se recoge pasando por encima, desaparece a los 10 segundos), a veces un potenciador (una campana, desaparece en solo 6 segundos). Con el tiempo aparecen cañones, que chirrían donde están, y disparan balas que debes SALTAR — una bala que llega a un muro muere sin hacer daño, y hay una forma de destruir un cañón, si la descubres. Los pozos se abren al azar: tienes 2 segundos de suelo desmoronándose como aviso, y luego un agujero con viento que mata a quien lo pise — sáltalo, o séllalo para siempre con una tapa desde el borde de sonido quebradizo. Una vida. Tu puntuación es el número de objetos recogidos.',
      'help.h.move': 'Flechas <kbd>izquierda</kbd> / <kbd>derecha</kbd> (o <kbd>A</kbd>/<kbd>D</kbd>) — caminar.',
      'help.h.jump': '<kbd>Espacio</kbd> o <kbd>arriba</kbd> — saltar. Sirve para balas y pozos. NO te salvará de una roca en la cabeza.',
      'help.h.keys': '<kbd>C</kbd> — cuántas tapas llevas · <kbd>F</kbd> — usar una tapa (de pie en el borde de un pozo) · <kbd>S</kbd> — puntuación · <kbd>T</kbd> — tiempo sobrevivido · <kbd>F1</kbd> — estado completo · <kbd>Escape</kbd> — pausa.',
      'help.h.powerups': 'Potenciadores: SUPERVELOCIDAD (15 segundos), INVENCIBILIDAD (15 segundos — rocas, pozos y balas no te tocan), TAPAS DE POZO (el único objeto acumulable), y la TORMENTA DE ROCAS — elimina tus otros potenciadores y te lanza rocas durante 10 segundos, pero sobrevívela y ganas 4 tapas más 25 segundos de invencibilidad y supervelocidad. Las tormentas solo aparecen tras 3 minutos de juego.',
      'help.h.pits': 'Un pozo entre tú y un cañón se traga las balas. Las rocas que caen en un pozo desaparecen — sin objeto para ti.',
      'help.h.runner': 'EL CORREDOR: salta 100 balas de cañón en total y una prueba del minijuego podrá interrumpir una de tus partidas. Supera su primer nivel para desbloquearlo en el menú. En el corredor una bala flotante te persigue desde la izquierda — nunca la saltes, o quedarás descalificado. Corre a la derecha, salta pozos y balas, y acumula pasos.',
      'help.audio': 'Cada peligro te dice dónde está por el paneo y qué es por el timbre: las rocas silban al caer, los objetos hacen bling, los potenciadores suenan a campana, los cañones chirrían y truenan, las balas resoplan cada vez más cerca, los pozos respiran viento y el suelo que se desmorona cruje bajo tus pies. Juega a "Aprende los sonidos" antes de tu primera partida.',
      'help.back': 'Atrás',

      // Puntuaciones
      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.runnerHead': 'Minijuego del corredor',
      'highscores.empty': 'Aún no hay puntuaciones.',
      'highscores.entry': '#{rank} {name} — {score} objetos, {meta} segundos',
      'highscores.entryRunner': '#{rank} {name} — {score} pasos, nivel {meta}',
      'highscores.back': 'Atrás',

      // Aprende los sonidos
      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Escucha cada señal por separado.',
      'learn.step': 'Paso (hormigón)',
      'learn.edge': 'Paso (borde de pozo)',
      'learn.jump': 'Salto',
      'learn.rockfall': 'Una roca cayendo y aterrizando',
      'learn.scoreitem': 'Objeto de puntos (bling)',
      'learn.powerbell': 'Potenciador (campana)',
      'learn.pickupScore': 'Recoger un objeto de puntos',
      'learn.pickupPower': 'Recoger un potenciador',
      'learn.cannon': 'Un cañón: chirrido y disparo',
      'learn.ball': 'Una bala acercándose',
      'learn.ballJumped': 'Saltar una bala',
      'learn.ballWall': 'Una bala muriendo contra el muro',
      'learn.crumble': 'Suelo desmoronándose, pozo abriéndose',
      'learn.wind': 'Un pozo abierto (viento)',
      'learn.cover': 'Sellar un pozo con una tapa',
      'learn.fall': 'Caer en un pozo',
      'learn.storm': 'Una tormenta de rocas empezando',
      'learn.chaser': 'El perseguidor del corredor acercándose',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      // Pausa
      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida',
      'pause.menu': 'Menú principal',

      // Fin de partida
      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Fin de la partida',
      'gameover.titleRunner': 'Fin de la carrera',
      'gameover.titleDq': 'Descalificado',
      'gameover.dqText': 'Saltaste al perseguidor. Te quedas sin puntuación.',
      'gameover.score': 'Recogiste {score} objetos y sobreviviste {time} segundos.',
      'gameover.scoreRunner': '{steps} pasos, llegaste al nivel {level}.',
      'gameover.subtitle': '¡Entra en tu top 10 local! Escribe tu nombre para guardarla.',
      'gameover.rankAt': '¡Entra en tu top 10 local — puesto {rank}! Escribe tu nombre para guardarla.',
      'gameover.postableMsg': '¡Gran partida! Escribe tu nombre para publicarla en la clasificación en línea.',
      'gameover.postPrompt': '¿Publicar esta puntuación en la clasificación en línea?',
      'gameover.postYes': 'Publicar en línea',
      'gameover.postNo': 'No, gracias',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar puntuación',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe primero un nombre.',

      // Clasificación en línea
      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',
      'online.tooLow': 'Solo se pueden publicar puntuaciones de más de {min} pasos.',

      // Anuncios
      'ann.paused': 'Pausa.',
      'ann.resumed': 'Reanudado.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.postPrompt': 'Puedes publicar esta puntuación en la clasificación en línea. ¿Publicarla?',
      'ann.onlineRank': 'Puesto en línea número {rank}.',
      'ann.onlineError': 'Clasificación no disponible. Guardado en este dispositivo.',
      'ann.score': 'Puntos: {score}.',
      'ann.time': '{time} segundos.',
      'ann.covers': '{covers} tapas de pozo.',
      'ann.status': 'Puntos {score}, {time} segundos, {covers} tapas.',
      'ann.threat.ball': '¡Bala a {dist} casillas a la {side}!',
      'ann.threat.pit': 'Pozo a {dist} casillas a la {side}.',
      'ann.clear': 'Sin amenazas inmediatas.',
      'ann.noCovers': 'No tienes tapas de pozo.',
      'ann.notAtEdge': 'Ponte en el borde de un pozo para usar una tapa.',
      'ann.pitSealed': '¡Pozo sellado! Te quedan {covers} tapas.',
      'ann.gotCover': '¡Tapa de pozo! Llevas {covers}.',
      'ann.got.superSpeed': '¡Supervelocidad!',
      'ann.got.invincibility': '¡Invencibilidad!',
      'ann.got.rockStorm': '¡Tormenta de rocas! ¡Sobrevive diez segundos!',
      'ann.expired.superSpeed': 'Velocidad normal.',
      'ann.expired.invincibility': 'Fin de la invencibilidad.',
      'ann.stormSurvived': '¡Tormenta superada! 4 tapas, más 25 segundos de invencibilidad y supervelocidad. Llevas {covers} tapas.',
      'ann.cannonAppear': '¡Ha aparecido un cañón a la {side}!',
      'ann.cannonDestroyed': '¡La roca aplastó el cañón!',
      'ann.jumpCount': '{count} balas saltadas en total.',
      'ann.milestone': '¡100 balas saltadas! Sigue jugando — el corredor puede llamarte.',
      'ann.crumbleUnderfoot': '¡El suelo se desmorona bajo tus pies! ¡Muévete!',
      'ann.death.rock': 'Una roca te cayó en la cabeza.',
      'ann.death.ball': 'Una bala de cañón te arrolló.',
      'ann.death.pit': 'Caíste en un pozo.',
      'ann.gameOver': 'Fin de la partida. {score} objetos, {time} segundos.',
      'ann.gameOverRank': 'Fin de la partida. {score} objetos, {time} segundos. ¡Top 10 local, puesto {rank}!',
      'ann.runnerOffer': '¡El corredor te llama! Corre a la derecha, salta lo que venga, y nunca saltes al perseguidor.',
      'ann.runnerReturn': 'De vuelta a tu partida. Dos segundos de gracia.',
      'ann.runnerUnlocked': 'Nivel superado — ¡el corredor está DESBLOQUEADO! Está en el menú principal.',
      'ann.rLevel': 'Nivel {level}. {len} casillas hasta el final. ¡Corre!',
      'ann.rLevelCannons': 'Nivel {level}. {len} casillas, {cannons} cañones en el camino. ¡Corre!',
      'ann.rLevelClear': '¡Nivel {level} superado!',
      'ann.rDq': '¡DESCALIFICADO! Saltaste al perseguidor. La carrera no cuenta.',
      'ann.rDeath.chaser': 'El perseguidor te alcanzó.',
      'ann.rDeath.ball': 'Una bala de cañón te arrolló.',
      'ann.rDeath.pit': 'Caíste en un pozo.',
      'ann.rDeath.rock': 'Una roca te cayó en la cabeza.',
      'ann.rOver': 'Fin de la carrera. {steps} pasos, nivel {level}.',
      'ann.rOverRank': 'Fin de la carrera. {steps} pasos, nivel {level}. ¡Top 10 local, puesto {rank}!',
      'ann.rOverDq': 'Descalificado. Sin puntuación.',
      'ann.rCannonPassed': 'Cañón superado — desapareció.',
      'ann.rNoCovers': 'En el corredor no hay tapas de pozo.',
      'ann.rSteps': '{steps} pasos.',
      'ann.rStatus': '{steps} pasos, nivel {level}.',
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
