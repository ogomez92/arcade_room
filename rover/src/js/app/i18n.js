/**
 * Lightweight i18n for ROVER. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'rover.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Rover',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Rover',
      'menu.subtitle': 'An audio moon-buggy run. Your rover rolls across the surface; jump the craters, shoot the rocks and UFOs, and see how far you get before you wreck.',
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
      'game.aria': 'The lunar surface',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.dist': 'Metres',
      'hud.tier': 'Sector',

      // Hazard names
      'type.crater': 'crater', 'type.rock': 'rock', 'type.ufo': 'UFO',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Jump the craters. Shoot the rest.',
      'help.intro': 'Your moon buggy auto-scrolls forward; hazards approach from ahead. The view never rotates — ahead is always to your right in the stereo image (sliding to centre as it arrives), ground hazards sound LOW and air hazards sound HIGH. Three hazards: a CRATER (a gap — you must JUMP it; it cannot be shot), a ROCK (JUMP over it OR shoot it forward), and a UFO (flying — SHOOT IT UP; jumping will not save you). You have ONE cannon: aim it forward or up, and it needs a moment to recharge between shots — so a tight cluster of UFOs can outpace it. Miss a hazard and you wreck, losing a life. Three lives; the surface gets faster and busier the further you go. Score is distance plus what you destroy.',
      'help.h.jump': '<kbd>Space</kbd> (or <kbd>W</kbd>) — JUMP. You stay airborne briefly, then must land before you can jump again, so time it — you cannot just hold it.',
      'help.h.fwd': '<kbd>Right arrow</kbd> (or <kbd>J</kbd>) — fire the cannon FORWARD, destroying the nearest rock ahead.',
      'help.h.up': '<kbd>Up arrow</kbd> (or <kbd>K</kbd>) — fire the cannon UP, destroying the nearest UFO.',
      'help.h.hazards': 'Crater = jump only. Rock = jump or forward-shot. UFO = up-shot only. Listen for low (ground) vs high (air), and the timbre tells crater from rock.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> nearest ground hazard · <kbd>F3</kbd> nearest UFO · <kbd>F4</kbd> cannon + jump state.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Each hazard blips faster and louder as it nears, panned from the right toward centre as it arrives. A sharp tick fires the moment it enters your action window — jump or shoot then. A low engine rumble rises with your speed. Behind you (already passed) is to the left.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No runs yet. Hit the dust!',
      'highscores.entry': '#{rank}. {name} — {score} points, {wave} m',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused', 'pause.title': 'Paused', 'pause.resume': 'Resume',
      'pause.restart': 'Restart run', 'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Wrecked',
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
      'learn.crater': 'Crater (jump it)',
      'learn.rock': 'Rock (jump or shoot)',
      'learn.ufo': 'UFO (shoot up)',
      'learn.imminentG': 'Act-now tick (ground)',
      'learn.imminentA': 'Act-now tick (air)',
      'learn.jump': 'Jump',
      'learn.shotFwd': 'Forward cannon',
      'learn.shotUp': 'Up cannon',
      'learn.kill': 'A hit',
      'learn.crash': 'A crash',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Stereo test
      'test.aria': 'Stereo audio test',
      'test.title': 'Stereo audio test',
      'test.subtitle': 'Confirm: ahead is to the right, behind is to the left, ground is low, air is high.',
      'test.ahead': 'Play ahead (right)',
      'test.behind': 'Play behind (left)',
      'test.ground': 'Play ground (low)',
      'test.air': 'Play air (high)',
      'test.ring': 'Play all',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Announcements
      'ann.crash': 'Wrecked on a {type}! {lives} lives left.',
      'ann.crashLast': 'Wrecked on a {type}! No lives left.',
      'ann.tierUp': 'Sector {tier}. Faster now!',
      'ann.status': 'Score {score}, {lives} lives, {dist} metres, sector {tier}.',
      'ann.ground': 'Nearest ground: {type}, {dist} ahead.',
      'ann.clearGround': 'Ground clear.',
      'ann.air': 'UFO {dist} ahead.',
      'ann.clearAir': 'No UFOs.',
      'ann.cannonReady': 'Cannon ready.',
      'ann.cannonCharging': 'Cannon charging.',
      'ann.airborne': 'Airborne.',
      'ann.grounded': 'On the ground.',
      'ann.gameOver': 'Wrecked. {dist} metres, score {score}.',
      'ann.gameOverHigh': 'Wrecked. New high score, {score}, at {dist} metres!',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Rover',

      'menu.aria': 'Menú principal',
      'menu.title': 'Rover',
      'menu.subtitle': 'Una carrera en buggy lunar por audio. Tu rover avanza por la superficie; salta los cráteres, dispara a las rocas y los OVNIs, y mira hasta dónde llegas antes de estrellarte.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'La superficie lunar',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.dist': 'Metros',
      'hud.tier': 'Sector',

      'type.crater': 'cráter', 'type.rock': 'roca', 'type.ufo': 'OVNI',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Salta los cráteres. Dispara al resto.',
      'help.intro': 'Tu buggy lunar avanza solo; los peligros vienen de frente. La vista nunca gira: lo de delante suena a tu derecha en la imagen estéreo (desplazándose al centro al llegar), los peligros de suelo suenan GRAVES y los de aire AGUDOS. Tres peligros: un CRÁTER (un hueco — debes SALTARLO; no se puede disparar), una ROCA (SALTA o dispárale al frente) y un OVNI (vuela — DISPÁRALE HACIA ARRIBA; saltar no te salva). Tienes UN cañón: apúntalo al frente o arriba, y tarda un momento en recargar entre disparos, así que un grupo cerrado de OVNIs puede superarlo. Falla un peligro y te estrellas, perdiendo una vida. Tres vidas; la superficie se vuelve más rápida y concurrida cuanto más avanzas. La puntuación es distancia más lo que destruyes.',
      'help.h.jump': '<kbd>Espacio</kbd> (o <kbd>W</kbd>) — SALTAR. Quedas en el aire un instante y luego debes aterrizar antes de saltar de nuevo, así que mídelo — no puedes mantenerlo.',
      'help.h.fwd': '<kbd>Flecha derecha</kbd> (o <kbd>J</kbd>) — dispara el cañón AL FRENTE, destruyendo la roca más cercana.',
      'help.h.up': '<kbd>Flecha arriba</kbd> (o <kbd>K</kbd>) — dispara el cañón ARRIBA, destruyendo el OVNI más cercano.',
      'help.h.hazards': 'Cráter = solo saltar. Roca = saltar o disparo al frente. OVNI = solo disparo arriba. Escucha grave (suelo) vs agudo (aire), y el timbre distingue cráter de roca.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> peligro de suelo más cercano · <kbd>F3</kbd> OVNI más cercano · <kbd>F4</kbd> estado del cañón y el salto.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Cada peligro pita más rápido y fuerte al acercarse, desplazándose de la derecha al centro al llegar. Un tic agudo suena en cuanto entra en tu ventana de acción — salta o dispara entonces. Un grave rumor de motor sube con tu velocidad. Lo que ya pasaste queda a la izquierda.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores carreras en este dispositivo.',
      'highscores.empty': '¡Aún no hay carreras. A levantar polvo!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, {wave} m',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa', 'pause.title': 'Pausa', 'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar carrera', 'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Destrozado',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.crater': 'Cráter (sáltalo)',
      'learn.rock': 'Roca (salta o dispara)',
      'learn.ufo': 'OVNI (dispara arriba)',
      'learn.imminentG': 'Tic de acción (suelo)',
      'learn.imminentA': 'Tic de acción (aire)',
      'learn.jump': 'Salto',
      'learn.shotFwd': 'Cañón al frente',
      'learn.shotUp': 'Cañón arriba',
      'learn.kill': 'Un impacto',
      'learn.crash': 'Un choque',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio estéreo',
      'test.title': 'Prueba de audio estéreo',
      'test.subtitle': 'Confirma: lo de delante a la derecha, lo de atrás a la izquierda, suelo grave, aire agudo.',
      'test.ahead': 'Sonar delante (derecha)',
      'test.behind': 'Sonar detrás (izquierda)',
      'test.ground': 'Sonar suelo (grave)',
      'test.air': 'Sonar aire (agudo)',
      'test.ring': 'Sonar todo',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.crash': '¡Destrozado por un {type}! Quedan {lives} vidas.',
      'ann.crashLast': '¡Destrozado por un {type}! Sin vidas.',
      'ann.tierUp': 'Sector {tier}. ¡Más rápido!',
      'ann.status': 'Puntos {score}, {lives} vidas, {dist} metros, sector {tier}.',
      'ann.ground': 'Suelo más cercano: {type}, a {dist}.',
      'ann.clearGround': 'Suelo despejado.',
      'ann.air': 'OVNI a {dist}.',
      'ann.clearAir': 'Sin OVNIs.',
      'ann.cannonReady': 'Cañón listo.',
      'ann.cannonCharging': 'Cañón cargando.',
      'ann.airborne': 'En el aire.',
      'ann.grounded': 'En el suelo.',
      'ann.gameOver': 'Destrozado. {dist} metros, puntuación {score}.',
      'ann.gameOverHigh': '¡Destrozado. Nuevo récord, {score}, a {dist} metros!',
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
