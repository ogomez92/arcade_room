/**
 * Lightweight i18n for RIVET. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'rivet.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Rivet',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Rivet',
      'menu.subtitle': 'An audio girder climb. Scale the scaffold to the top, jumping the barrels that tumble down at you and out-climbing the fireball that hunts you up the ladders.',
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
      'game.aria': 'The scaffold',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.level': 'Level',
      'hud.height': 'Height',

      // Directions
      'dir.left': 'left', 'dir.right': 'right', 'dir.here': 'right here',
      'vert.above': 'above', 'vert.below': 'below', 'vert.same': 'your girder',

      // Causes
      'cause.barrel': 'flattened by a barrel', 'cause.fireball': 'caught by the fireball',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Climb to the top. Jump the barrels. Out-run the fireball.',
      'help.intro': 'You climb a scaffold of girders linked by ladders, from the bottom to the top. The view is from the side and never turns — a sound on your right is on your right, and HEIGHT is carried by pitch: a faint tone always sings your own girder, and threats ring higher if they are above you, lower if below. Run along a girder to reach its one ladder (a beacon ticks toward it), then climb. Barrels tumble down the girders toward you — JUMP and they pass under you (a clean hop scores). After a moment a FIREBALL appears at the bottom and hunts you up the ladders; a jump will NOT save you from it — only climbing away will, so keep moving up. Reach the top girder to clear the level; a faster scaffold follows. Three lives.',
      'help.h.move': '<kbd>Left</kbd> / <kbd>Right</kbd> — run along the girder.',
      'help.h.climb': '<kbd>Up</kbd> / <kbd>Down</kbd> — climb a ladder (only where one is; a beacon ticks toward the way up, and you hear when you are standing on it).',
      'help.h.jump': '<kbd>Space</kbd> — jump. A barrel passing under you while you are airborne is dodged (and scores a hop). You cannot climb mid-jump.',
      'help.h.fireball': 'The <strong>fireball</strong> crackles and climbs after you. Jumping does not clear it — climb to a higher girder and keep ahead of it.',
      'help.h.height': 'A faint tone is your current girder. Barrels and the fireball ring higher when above you, lower when below; same pitch means same girder — the real danger.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> nearest threat · <kbd>F3</kbd> the ladder up · <kbd>F4</kbd> your height.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Horizontal position is straight stereo — left is your left ear, right your right. The ladder beacon ticks toward the way up. A barrel on your own girder is loud and urgent; ones on other girders are fainter. Climb fast: the fireball never stops.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best climbs on this device.',
      'highscores.empty': 'No scores yet. Start climbing!',
      'highscores.entry': '#{rank}. {name} — {score} points, reached level {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused', 'pause.title': 'Paused', 'pause.resume': 'Resume',
      'pause.restart': 'Restart run', 'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Fell',
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
      'learn.barrel': 'Barrel on your girder (right)',
      'learn.barrelOther': 'Barrel above, off to the left',
      'learn.fireball': 'Fireball (left, below)',
      'learn.ladder': 'Ladder beacon (to the right)',
      'learn.atladder': 'You are at the ladder',
      'learn.summit': 'Top reached',
      'learn.jump': 'Jump',
      'learn.hop': 'A barrel passes under you',
      'learn.climb': 'Climbing a ladder',
      'learn.hurt': 'You are hit',
      'learn.clear': 'Level cleared',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Spatial test
      'test.aria': 'Stereo and height test',
      'test.title': 'Stereo / height test',
      'test.subtitle': 'Confirm: left is left, right is right, higher rings higher, lower rings lower.',
      'test.north': 'Play higher',
      'test.east': 'Play right',
      'test.south': 'Play lower',
      'test.west': 'Play left',
      'test.ring': 'Play all four',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Announcements
      'ann.fireball': 'A fireball appears below — climb!',
      'ann.fireballAt': 'Fireball {dir}, {vert}.',
      'ann.barrelAt': 'Barrel {dir}, {vert}.',
      'ann.clear': 'Nothing close.',
      'ann.atTop': 'Top girder.',
      'ann.ladderHere': 'Ladder right here — climb up.',
      'ann.ladderAt': 'Ladder up {n} to the {dir}.',
      'ann.height': 'Girder {row} of {rows}.',
      'ann.status': 'Score {score}, {lives} lives, level {level}, girder {row} of {rows}.',
      'ann.hurt': 'You were {cause}! {lives} lives left.',
      'ann.hurtLast': 'You were {cause}! No lives left.',
      'ann.levelClear': 'Top reached! Level {level} clear, time bonus {bonus}.',
      'ann.levelStart': 'Level {level}. Climb!',
      'ann.gameOver': 'Fell. Final score {score}.',
      'ann.gameOverHigh': 'Fell. New high score, {score}!',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Rivet',

      'menu.aria': 'Menú principal',
      'menu.title': 'Rivet',
      'menu.subtitle': 'Una escalada de vigas por audio. Sube el andamio hasta la cima, salta los barriles que caen rodando hacia ti y escapa del bola de fuego que te persigue por las escaleras.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'El andamio',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.level': 'Nivel',
      'hud.height': 'Altura',

      'dir.left': 'izquierda', 'dir.right': 'derecha', 'dir.here': 'justo aquí',
      'vert.above': 'arriba', 'vert.below': 'abajo', 'vert.same': 'tu viga',

      'cause.barrel': 'aplastado por un barril', 'cause.fireball': 'atrapado por la bola de fuego',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Sube a la cima. Salta los barriles. Escapa de la bola de fuego.',
      'help.intro': 'Subes un andamio de vigas unidas por escaleras, de abajo arriba. La vista es de lado y nunca gira: un sonido a tu derecha está a tu derecha, y la ALTURA va en el tono: un tono tenue canta siempre tu propia viga, y las amenazas suenan más agudas si están por encima y más graves si están por debajo. Corre por una viga hasta su única escalera (un faro marca el camino) y sube. Los barriles caen rodando hacia ti: SALTA y pasan por debajo (un salto limpio puntúa). Tras un momento aparece una BOLA DE FUEGO abajo y te persigue por las escaleras; saltar NO te salva de ella, solo subir, así que sigue trepando. Llega a la viga más alta para superar el nivel; sigue uno más rápido. Tres vidas.',
      'help.h.move': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> — corre por la viga.',
      'help.h.climb': '<kbd>Arriba</kbd> / <kbd>Abajo</kbd> — sube una escalera (solo donde la hay; un faro marca el camino y oyes cuando estás sobre ella).',
      'help.h.jump': '<kbd>Espacio</kbd> — salta. Un barril que pasa por debajo mientras estás en el aire se esquiva (y puntúa). No puedes subir en pleno salto.',
      'help.h.fireball': 'La <strong>bola de fuego</strong> crepita y trepa tras de ti. Saltar no la quita: sube a una viga más alta y mantente por delante.',
      'help.h.height': 'Un tono tenue es tu viga actual. Los barriles y la bola suenan más agudos por encima de ti, más graves por debajo; mismo tono = misma viga: el peligro real.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> amenaza más cercana · <kbd>F3</kbd> la escalera de subida · <kbd>F4</kbd> tu altura.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'La posición horizontal es estéreo puro: izquierda es tu oído izquierdo, derecha el derecho. El faro de la escalera marca el camino. Un barril en tu viga suena fuerte y urgente; los de otras vigas, más tenues. Sube rápido: la bola de fuego no para.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores escaladas en este dispositivo.',
      'highscores.empty': '¡Aún no hay puntuaciones. A trepar!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, nivel {wave}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa', 'pause.title': 'Pausa', 'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida', 'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Caíste',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.barrel': 'Barril en tu viga (derecha)',
      'learn.barrelOther': 'Barril arriba, a la izquierda',
      'learn.fireball': 'Bola de fuego (izquierda, abajo)',
      'learn.ladder': 'Faro de la escalera (a la derecha)',
      'learn.atladder': 'Estás en la escalera',
      'learn.summit': 'Cima alcanzada',
      'learn.jump': 'Salto',
      'learn.hop': 'Un barril pasa por debajo de ti',
      'learn.climb': 'Subiendo una escalera',
      'learn.hurt': 'Te golpean',
      'learn.clear': 'Nivel superado',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de estéreo y altura',
      'test.title': 'Prueba estéreo / altura',
      'test.subtitle': 'Confirma: izquierda es izquierda, derecha es derecha, más alto suena más agudo, más bajo más grave.',
      'test.north': 'Sonar más alto',
      'test.east': 'Sonar a la derecha',
      'test.south': 'Sonar más bajo',
      'test.west': 'Sonar a la izquierda',
      'test.ring': 'Sonar los cuatro',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.fireball': '¡Aparece una bola de fuego abajo, trepa!',
      'ann.fireballAt': 'Bola de fuego a la {dir}, {vert}.',
      'ann.barrelAt': 'Barril a la {dir}, {vert}.',
      'ann.clear': 'Nada cerca.',
      'ann.atTop': 'Viga más alta.',
      'ann.ladderHere': 'Escalera justo aquí: sube.',
      'ann.ladderAt': 'Escalera de subida {n} a la {dir}.',
      'ann.height': 'Viga {row} de {rows}.',
      'ann.status': 'Puntos {score}, {lives} vidas, nivel {level}, viga {row} de {rows}.',
      'ann.hurt': '¡Fuiste {cause}! Quedan {lives} vidas.',
      'ann.hurtLast': '¡Fuiste {cause}! Sin vidas.',
      'ann.levelClear': '¡Cima alcanzada! Nivel {level} superado, bono de tiempo {bonus}.',
      'ann.levelStart': 'Nivel {level}. ¡Trepa!',
      'ann.gameOver': 'Caíste. Puntuación final {score}.',
      'ann.gameOverHigh': 'Caíste. ¡Nuevo récord, {score}!',
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
