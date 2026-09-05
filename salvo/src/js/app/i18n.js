/**
 * Lightweight i18n for SALVO. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'salvo.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Salvo',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Salvo',
      'menu.subtitle': 'A last-stand turret shooter. Hold the centre and gun down the swarm closing in from every direction.',
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
      'game.aria': 'Battlefield',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.wave': 'Wave',
      'hud.combo': 'Combo',

      // Compass directions
      'dir.n': 'north',
      'dir.ne': 'northeast',
      'dir.e': 'east',
      'dir.se': 'southeast',
      'dir.s': 'south',
      'dir.sw': 'southwest',
      'dir.w': 'west',
      'dir.nw': 'northwest',

      // Proximity words
      'prox.far': 'far out',
      'prox.mid': 'closing in',
      'prox.near': 'almost on you',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Hold the centre. Destroy everything before it reaches you.',
      'help.intro': 'You are a gun turret at the centre of a ring. Enemies close in from the eight compass bearings — north is in front, south behind, east to your right, west to your left, and it never rotates. Each enemy pings a blip from its direction that gets faster, higher and louder as it nears. Shoot in a direction to destroy the nearest enemy there, or press the assist key to auto-target the closest threat. Let an enemy reach the centre and it costs a life. Survive the wave to face a bigger, faster one. Lose three lives and the run ends.',
      'help.h.assist': 'Hold <kbd>Space</kbd> or <kbd>Enter</kbd> — auto-fire at the nearest threat. The one-button way to play by ear.',
      'help.h.dir': 'Hold or tap <kbd>Numpad 8 9 6 3 2 1 4 7</kbd> to fire in a compass direction (N, NE, E, SE, S, SW, W, NW). Without a numpad, the <kbd>Q W E / A D / Z X C</kbd> keys cover the eight bearings (X = south).',
      'help.h.arrows': '<kbd>Arrow keys</kbd> — fire north, east, south, west (the four cardinals).',
      'help.h.enemies': 'Three foes by ear: a steady grunt, a fast high-pitched rusher (kill it first), and a slow low-growling brute that takes two shots.',
      'help.h.status': '<kbd>F1</kbd> score, lives, wave and combo · <kbd>F2</kbd> nearest threat · <kbd>F3</kbd> best combo.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'Your gun has a fire rate, so it cannot clear everything at once — prioritise the closest threats. Directional fire is faster than the assist key but a wrong bearing wastes the shot. A destroyed enemy bursts from its direction; an enemy reaching you is a heavy alarm. Sounds to the south (behind you) are muffled.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Go hold the line!',
      'highscores.entry': '#{rank}. {name} — {score} points, reached wave {wave}',
      'highscores.back': 'Back',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart run',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game over',
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
      'learn.gruntFar': 'Grunt — far out (north)',
      'learn.gruntNear': 'Grunt — almost on you (north)',
      'learn.rusher': 'Rusher — fast (east)',
      'learn.brute': 'Brute — slow, two shots (south)',
      'learn.shot': 'Your shot',
      'learn.kill': 'Enemy destroyed',
      'learn.killBrute': 'Brute destroyed',
      'learn.breach': 'Enemy reached you (damage)',
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
      'ann.breach': '{dir} breach! {lives} lives left.',
      'ann.breachLast': '{dir} breach! No lives left.',
      'ann.waveStart': 'Wave {wave}.',
      'ann.waveClear': 'Wave {wave} cleared! Plus {bonus} points.',
      'ann.gameOver': 'Game over. Final score {score}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.status': 'Score {score}, {lives} lives, wave {wave}, combo {combo}.',
      'ann.incoming': 'Nearest {dir}, {prox}. {n} on the field.',
      'ann.allClear': 'All clear.',
      'ann.best': 'Best combo {combo}.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Salvo',

      'menu.aria': 'Menú principal',
      'menu.title': 'Salvo',
      'menu.subtitle': 'Un shooter de torreta a la última. Defiende el centro y abate al enjambre que se cierra desde todas las direcciones.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Campo de batalla',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.wave': 'Oleada',
      'hud.combo': 'Combo',

      'dir.n': 'norte',
      'dir.ne': 'noreste',
      'dir.e': 'este',
      'dir.se': 'sureste',
      'dir.s': 'sur',
      'dir.sw': 'suroeste',
      'dir.w': 'oeste',
      'dir.nw': 'noroeste',

      'prox.far': 'lejos',
      'prox.mid': 'acercándose',
      'prox.near': 'casi encima',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Defiende el centro. Destruye todo antes de que te alcance.',
      'help.intro': 'Eres una torreta en el centro de un anillo. Los enemigos se acercan desde las ocho direcciones de la brújula: el norte al frente, el sur detrás, el este a tu derecha, el oeste a tu izquierda, y nunca gira. Cada enemigo emite un pitido desde su dirección que se vuelve más rápido, agudo y fuerte al acercarse. Dispara en una dirección para destruir al enemigo más cercano allí, o pulsa la tecla de asistencia para apuntar automáticamente a la amenaza más próxima. Si un enemigo llega al centro, cuesta una vida. Sobrevive a la oleada para enfrentar otra mayor y más rápida. Pierde tres vidas y termina la partida.',
      'help.h.assist': 'Mantén <kbd>Espacio</kbd> o <kbd>Enter</kbd> — dispara automáticamente a la amenaza más cercana. La forma de jugar con un botón, de oído.',
      'help.h.dir': 'Mantén o pulsa <kbd>Teclado numérico 8 9 6 3 2 1 4 7</kbd> para disparar en una dirección (N, NE, E, SE, S, SO, O, NO). Sin teclado numérico, las teclas <kbd>Q W E / A D / Z X C</kbd> cubren las ocho direcciones (X = sur).',
      'help.h.arrows': '<kbd>Flechas</kbd> — dispara al norte, este, sur y oeste (los cuatro cardinales).',
      'help.h.enemies': 'Tres enemigos de oído: un soldado constante, un veloz agudo (mátalo primero) y un coloso lento y grave que aguanta dos disparos.',
      'help.h.status': '<kbd>F1</kbd> puntos, vidas, oleada y combo · <kbd>F2</kbd> amenaza más cercana · <kbd>F3</kbd> mejor combo.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Tu arma tiene cadencia, así que no puede con todo a la vez: prioriza las amenazas cercanas. El disparo direccional es más rápido que la tecla de asistencia, pero una dirección equivocada desperdicia el tiro. Un enemigo destruido estalla desde su dirección; uno que te alcanza es una alarma grave. Los sonidos del sur (detrás de ti) suenan apagados.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Aguanta la posición!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, oleada {wave}',
      'highscores.back': 'Atrás',

      'pause.aria': 'Pausa',
      'pause.title': 'Pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar partida',
      'pause.menu': 'Menú principal',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Fin de la partida',
      'gameover.subtitle': 'Escribe tu nombre para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre primero.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.gruntFar': 'Soldado — lejos (norte)',
      'learn.gruntNear': 'Soldado — casi encima (norte)',
      'learn.rusher': 'Veloz — rápido (este)',
      'learn.brute': 'Coloso — lento, dos disparos (sur)',
      'learn.shot': 'Tu disparo',
      'learn.kill': 'Enemigo destruido',
      'learn.killBrute': 'Coloso destruido',
      'learn.breach': 'Enemigo te alcanzó (daño)',
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
      'ann.breach': '¡Brecha al {dir}! Quedan {lives} vidas.',
      'ann.breachLast': '¡Brecha al {dir}! Sin vidas.',
      'ann.waveStart': 'Oleada {wave}.',
      'ann.waveClear': '¡Oleada {wave} superada! Más {bonus} puntos.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
      'ann.status': 'Puntos {score}, {lives} vidas, oleada {wave}, combo {combo}.',
      'ann.incoming': 'Más cercano al {dir}, {prox}. {n} en el campo.',
      'ann.allClear': 'Todo despejado.',
      'ann.best': 'Mejor combo {combo}.',
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
