/**
 * Lightweight i18n for AIRLIFT. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'airlift.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Rescue Mission',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Rescue Mission',
      'menu.subtitle': 'An audio rescue-chopper run. Fly out to stranded survivors, hover to winch them aboard, and ferry them home to base — while ground tanks shell you from below. Save them all, wave after wave.',
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
      'game.aria': 'The rescue strip',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.wave': 'Wave',
      'hud.aboard': 'Aboard',
      'hud.bombs': 'Bombs',

      // Directions
      'dir.left': 'left', 'dir.right': 'right', 'dir.here': 'right here',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Winch up the survivors. Fly them home. Dodge the tanks.',
      'help.intro': 'You fly a rescue chopper along a horizontal strip. The view never rotates — base is always off to your LEFT (its homing tone pans left), and everything is heard by how far left or right of you it sits. Survivors are stranded out along the strip, each waving a beacon. Fly to one and HOLD STILL over it to winch them aboard — you can carry up to three at once. Then fly LEFT home to base to deliver them (a full load scores far more than one-at-a-time). Ground TANKS sit in their columns: each TAKES AIM (a rising tell from its direction), then a shell rises at its column — be somewhere else when it tops out, or DROP A BOMB on the tank first to destroy it. A shell that reaches you costs a life; three lives. Rescue every survivor in a wave to move on, faster and busier each time.',
      'help.h.fly': '<kbd>Left</kbd> / <kbd>Right</kbd> (or <kbd>A</kbd> / <kbd>D</kbd>) — fly. You hover in place the instant you stop.',
      'help.h.pickup': 'Hover STILL over a survivor (stop moving at their position) for a moment to winch them aboard — up to three.',
      'help.h.deliver': 'Fly left to BASE to drop your load. Carrying more before you deliver scores a big stacking bonus — but it is riskier.',
      'help.h.bomb': '<kbd>Space</kbd> (or <kbd>Down</kbd>) — drop a bomb straight down; it destroys any tank in your column.',
      'help.h.dodge': 'A tank takes aim with a rising tell from its direction. Move off its column before the shell tops out, or you take the hit.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> nearest survivor · <kbd>F3</kbd> nearest tank · <kbd>F4</kbd> load + survivors left + base direction.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Survivors chirp from their direction (brighter when you are right over them); the base hums to your left (more insistent when you are carrying); tanks rumble low, with a rising aim tell and a climbing shell when they fire. A pulsing rotor runs underneath.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best rescues on this device.',
      'highscores.empty': 'No rescues yet. Take off!',
      'highscores.entry': '#{rank}. {name} — {score} points, wave {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused', 'pause.title': 'Paused', 'pause.resume': 'Resume',
      'pause.restart': 'Restart run', 'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Shot down',
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
      'learn.survivor': 'Survivor (right over them)',
      'learn.survivorR': 'Survivor (to the right)',
      'learn.base': 'Base (to the left, carrying)',
      'learn.tank': 'Tank (idle)',
      'learn.tankAim': 'Tank taking aim — move!',
      'learn.tankFire': 'Tank fires (shell rising)',
      'learn.shellTop': 'Shell tops out',
      'learn.bomb': 'Drop a bomb',
      'learn.pickup': 'Winch up',
      'learn.deliver': 'Deliver to base',
      'learn.hurt': 'You take a hit',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Stereo test
      'test.aria': 'Stereo audio test',
      'test.title': 'Stereo audio test',
      'test.subtitle': 'Confirm: left is left, right is right, centre is right on you.',
      'test.left': 'Play left',
      'test.centre': 'Play centre',
      'test.right': 'Play right',
      'test.ring': 'Play all',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Announcements
      'ann.pickup': 'Aboard! {carried} with you.',
      'ann.deliver': 'Delivered {n}! {total} saved.',
      'ann.hurt': 'Hit! {lives} lives left.',
      'ann.hurtLast': 'Hit! No lives left.',
      'ann.waveClear': 'Wave {wave} — everyone saved!',
      'ann.waveStart': 'Wave {wave}. {n} to rescue.',
      'ann.status': 'Score {score}, {lives} lives, wave {wave}, {aboard} aboard, {left} still out there.',
      'ann.survivor': 'Nearest survivor {dir}, {dist} away.',
      'ann.noSurvivors': 'All aboard or delivered.',
      'ann.tank': 'Nearest tank {dir}, {dist} away.',
      'ann.noTanks': 'No tanks.',
      'ann.load': '{aboard} of {cap} aboard, {left} out there, base to the {base}.',
      'ann.gameOver': 'Shot down. {rescued} saved, score {score}.',
      'ann.gameOverHigh': 'Shot down. New high score, {score}, {rescued} saved!',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Misión de rescate',

      'menu.aria': 'Menú principal',
      'menu.title': 'Misión de rescate',
      'menu.subtitle': 'Una carrera de helicóptero de rescate por audio. Vuela hasta los supervivientes varados, sobrevuela para izarlos a bordo y llévalos a la base — mientras los tanques te disparan desde abajo. Sálvalos a todos, oleada tras oleada.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'La franja de rescate',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.wave': 'Oleada',
      'hud.aboard': 'A bordo',
      'hud.bombs': 'Bombas',

      'dir.left': 'izquierda', 'dir.right': 'derecha', 'dir.here': 'justo aquí',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Iza a los supervivientes. Llévalos a casa. Esquiva los tanques.',
      'help.intro': 'Pilotas un helicóptero de rescate por una franja horizontal. La vista nunca gira: la base siempre queda a tu IZQUIERDA (su tono guía suena a la izquierda), y todo se oye según cuán a la izquierda o derecha de ti esté. Los supervivientes están varados por la franja, cada uno con una señal. Vuela hasta uno y QUÉDATE QUIETO sobre él para izarlo — puedes llevar hasta tres a la vez. Luego vuela a la IZQUIERDA hasta la base para entregarlos (una carga llena puntúa mucho más que de uno en uno). Los TANQUES están en sus columnas: cada uno APUNTA (un tono ascendente desde su dirección) y luego un proyectil sube por su columna — no estés ahí cuando llegue arriba, o suéltale una BOMBA antes para destruirlo. Un proyectil que te alcanza cuesta una vida; tres vidas. Rescata a todos en una oleada para avanzar, más rápido y concurrido cada vez.',
      'help.h.fly': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> (o <kbd>A</kbd> / <kbd>D</kbd>) — volar. Flotas en el sitio en cuanto te detienes.',
      'help.h.pickup': 'Flota QUIETO sobre un superviviente (detente en su posición) un momento para izarlo — hasta tres.',
      'help.h.deliver': 'Vuela a la izquierda hasta la BASE para soltar tu carga. Llevar más antes de entregar da un gran bono acumulado, pero es más arriesgado.',
      'help.h.bomb': '<kbd>Espacio</kbd> (o <kbd>Abajo</kbd>) — suelta una bomba; destruye cualquier tanque en tu columna.',
      'help.h.dodge': 'Un tanque apunta con un tono ascendente desde su dirección. Sal de su columna antes de que el proyectil llegue arriba, o recibes el impacto.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> superviviente más cercano · <kbd>F3</kbd> tanque más cercano · <kbd>F4</kbd> carga + supervivientes restantes + dirección de la base.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Los supervivientes pían desde su dirección (más brillante cuando estás justo encima); la base zumba a tu izquierda (más insistente al llevar carga); los tanques retumban graves, con un tono de puntería ascendente y un proyectil que sube al disparar. Un rotor pulsante suena debajo.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores rescates en este dispositivo.',
      'highscores.empty': '¡Aún no hay rescates. A despegar!',
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
      'learn.survivor': 'Superviviente (justo encima)',
      'learn.survivorR': 'Superviviente (a la derecha)',
      'learn.base': 'Base (a la izquierda, con carga)',
      'learn.tank': 'Tanque (inactivo)',
      'learn.tankAim': 'Tanque apuntando — ¡muévete!',
      'learn.tankFire': 'El tanque dispara (proyectil subiendo)',
      'learn.shellTop': 'El proyectil llega arriba',
      'learn.bomb': 'Soltar una bomba',
      'learn.pickup': 'Izar',
      'learn.deliver': 'Entregar en la base',
      'learn.hurt': 'Recibes un impacto',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio estéreo',
      'test.title': 'Prueba de audio estéreo',
      'test.subtitle': 'Confirma: izquierda es izquierda, derecha es derecha, centro es justo sobre ti.',
      'test.left': 'Sonar a la izquierda',
      'test.centre': 'Sonar al centro',
      'test.right': 'Sonar a la derecha',
      'test.ring': 'Sonar todo',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.pickup': '¡A bordo! {carried} contigo.',
      'ann.deliver': '¡Entregados {n}! {total} salvados.',
      'ann.hurt': '¡Impacto! Quedan {lives} vidas.',
      'ann.hurtLast': '¡Impacto! Sin vidas.',
      'ann.waveClear': 'Oleada {wave} — ¡todos a salvo!',
      'ann.waveStart': 'Oleada {wave}. {n} por rescatar.',
      'ann.status': 'Puntos {score}, {lives} vidas, oleada {wave}, {aboard} a bordo, {left} aún ahí fuera.',
      'ann.survivor': 'Superviviente más cercano a la {dir}, a {dist}.',
      'ann.noSurvivors': 'Todos a bordo o entregados.',
      'ann.tank': 'Tanque más cercano a la {dir}, a {dist}.',
      'ann.noTanks': 'Sin tanques.',
      'ann.load': '{aboard} de {cap} a bordo, {left} ahí fuera, base a la {base}.',
      'ann.gameOver': 'Derribado. {rescued} salvados, puntuación {score}.',
      'ann.gameOverHigh': 'Derribado. ¡Nuevo récord, {score}, {rescued} salvados!',
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
