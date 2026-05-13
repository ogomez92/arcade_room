/**
 * Lightweight i18n for Asteroids — en + es. Shared structure with every
 * other accessible-audio game; only STORAGE_KEY and dictionaries change.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'asteroids.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Asteroids',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Asteroids',
      'menu.subtitle': 'Audio-first arcade. Rotate, thrust, fire — and try not to drift into a rock.',
      'menu.start': 'Start',
      'menu.highscores': 'High Scores',
      'menu.help': 'How to Play',
      'menu.learn': 'Learn Sounds',
      'menu.quit': 'Quit',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game / HUD
      'game.aria': 'Asteroids — game in progress',
      'hud.score':  'Score: {score}',
      'hud.lives':  'Lives: {lives}',
      'hud.wave':   'Wave: {wave}',
      'hud.asteroids': 'Rocks: {count}',

      // Gameover
      'gameover.aria': 'Game over',
      'gameover.title': 'Game Over',
      'gameover.subtitle': 'Final score: {score} — wave {wave}',
      'gameover.namePrompt': 'New high score! Enter your name:',
      'gameover.namePlaceholder': 'Player',
      'gameover.submit': 'Save',
      'gameover.skip': 'Skip',
      'gameover.menu': 'Main Menu',
      'gameover.again': 'Play Again',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High Scores',
      'highscores.subtitle': 'Top 10 runs.',
      'highscores.subtitleOnline': 'Top 10 — global leaderboard.',
      'highscores.subtitleLocal': 'Top 10 — this device only (offline).',
      'highscores.subtitleLoading': 'Top 10 — loading global leaderboard…',
      'highscores.empty': 'No scores yet — go set one.',
      'highscores.row': '#{rank}: {name} — {score} (wave {wave})',
      'highscores.back': 'Back',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.intro': 'You pilot a ship through a wraparound field of rocks. Each rock you destroy splits into two smaller ones; finish them all to clear the wave. Movement is Newtonian — there is no friction, so you keep drifting until you brake. <kbd>Up</kbd> accelerates you in whichever direction you are currently facing; <kbd>Down</kbd> brakes by slowing your current velocity (it never pushes you backward — at a standstill it does nothing).',
      'help.controlRotate': '<kbd>Left</kbd> / <kbd>Right</kbd> — rotate ship',
      'help.controlThrust': '<kbd>Up</kbd> — accelerate forward (in current facing direction)',
      'help.controlReverse': '<kbd>Down</kbd> — brake (slows current velocity; no reverse)',
      'help.controlFire': '<kbd>Space</kbd> — fire (max 4 bullets in flight)',
      'help.controlAimLock': '<kbd>Tab</kbd> — snap-aim at the most dangerous threat (closing rocks beat drifting ones; UFO bullets and UFOs are prioritised over rocks; your velocity is unchanged so you still have to handle existing drift)',
      'help.controlHyperspace': '<kbd>Shift</kbd> — hyperspace jump (1 in 6 chance of self-destruct)',
      'help.controlPause': '<kbd>Esc</kbd> — pause / back',
      'help.audioIntro': 'The audio listener is locked to the ship — turn the ship and the world sweeps around you.',
      'help.audioLarge': 'Large rocks: low triangle rumble.',
      'help.audioMedium': 'Medium rocks: mid-pitched saw drone.',
      'help.audioSmall': 'Small rocks: high square tone.',
      'help.audioUfo': 'UFO: pulsing tone — big and slow, or small and fast.',
      'help.statusKeys': 'Status hotkeys: <kbd>F1</kbd> score, <kbd>F2</kbd> wave, <kbd>F3</kbd> heading, <kbd>F4</kbd> nearest threat.',
      'help.back': 'Back',

      // Learn sounds
      'learn.aria': 'Learn sounds',
      'learn.title': 'Learn the Sounds',
      'learn.subtitle': 'Audition each cue before you play.',
      'learn.large': 'Large asteroid',
      'learn.medium': 'Medium asteroid',
      'learn.small': 'Small asteroid',
      'learn.bullet': 'Bullet fire',
      'learn.ufoBig': 'Big UFO pulse',
      'learn.ufoSmall': 'Small UFO pulse',
      'learn.hyperspace': 'Hyperspace jump',
      'learn.death': 'Death dirge',
      'learn.waveClear': 'Wave clear',
      'learn.bonusLife': 'Bonus life',
      'learn.back': 'Back',

      // Diagnostic test
      'test.aria': 'Audio test',
      'test.title': 'Audio Test',
      'test.subtitle': 'Verify left/right/front/behind by ear.',
      'test.intro': 'Four ticks will play: front, right, behind, left. Front should sound ahead, right on your right ear, behind muffled and lower, left on your left ear.',
      'test.dirFront': 'Front',
      'test.dirRight': 'Right',
      'test.dirBehind': 'Behind',
      'test.dirLeft': 'Left',
      'test.replay': 'Replay',
      'test.back': 'Back',

      // Announcer
      'ann.score': 'Score {score}, {lives} lives, wave {wave}.',
      'ann.wave': 'Wave {wave}. {count} rocks remain.',
      'ann.heading': 'Heading {direction}, speed {speed}.',
      'ann.nearest': 'Nearest threat: {kind} {direction}, distance {distance}.',
      'ann.nearestNone': 'No threats nearby.',
      'ann.lockedOn': 'Locked on {kind}, distance {distance}.',
      'ann.onlineRank': 'Global rank {rank}.',
      'ann.bonusLife': 'Bonus life.',
      'ann.extraLife': 'Extra life awarded.',
      'ann.waveStart': 'Wave {wave}.',
      'ann.waveClear': 'Wave cleared.',
      'ann.ufoIncoming': 'UFO inbound.',
      'ann.ufoBig': 'Big UFO.',
      'ann.ufoSmall': 'Small UFO.',
      'ann.ufoGone': 'UFO gone.',
      'ann.hyperspace': 'Hyperspace.',
      'ann.hyperspaceDeath': 'Bad jump.',
      'ann.death': 'Ship destroyed.',
      'ann.gameOver': 'Game over.',
      'ann.playing': 'Playing {label}.',
      'ann.kindLarge': 'large rock',
      'ann.kindMedium': 'medium rock',
      'ann.kindSmall': 'small rock',
      'ann.kindUfoBig': 'big UFO',
      'ann.kindUfoSmall': 'small UFO',
      'ann.kindUfoBullet': 'UFO bullet',

      // Compass
      'dir.N':  'north',
      'dir.NE': 'north-east',
      'dir.E':  'east',
      'dir.SE': 'south-east',
      'dir.S':  'south',
      'dir.SW': 'south-west',
      'dir.W':  'west',
      'dir.NW': 'north-west',
    },

    es: {
      'doc.title': 'Asteroides',

      'menu.aria': 'Menú principal',
      'menu.title': 'Asteroides',
      'menu.subtitle': 'Arcade audio-primero. Gira, empuja, dispara — y procura no chocar.',
      'menu.start': 'Empezar',
      'menu.highscores': 'Récords',
      'menu.help': 'Cómo Jugar',
      'menu.learn': 'Aprender Sonidos',
      'menu.quit': 'Salir',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Asteroides — partida en curso',
      'hud.score':  'Puntos: {score}',
      'hud.lives':  'Vidas: {lives}',
      'hud.wave':   'Oleada: {wave}',
      'hud.asteroids': 'Rocas: {count}',

      'gameover.aria': 'Fin de partida',
      'gameover.title': 'Fin de Partida',
      'gameover.subtitle': 'Puntos finales: {score} — oleada {wave}',
      'gameover.namePrompt': '¡Nuevo récord! Escribe tu nombre:',
      'gameover.namePlaceholder': 'Piloto',
      'gameover.submit': 'Guardar',
      'gameover.skip': 'Saltar',
      'gameover.menu': 'Menú Principal',
      'gameover.again': 'Jugar de Nuevo',

      'highscores.aria': 'Récords',
      'highscores.title': 'Récords',
      'highscores.subtitle': 'Las 10 mejores partidas.',
      'highscores.subtitleOnline': 'Top 10 — tabla global.',
      'highscores.subtitleLocal': 'Top 10 — solo este dispositivo (sin conexión).',
      'highscores.subtitleLoading': 'Top 10 — cargando tabla global…',
      'highscores.empty': 'Aún no hay récords — sé el primero.',
      'highscores.row': '#{rank}: {name} — {score} (oleada {wave})',
      'highscores.back': 'Atrás',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo Jugar',
      'help.intro': 'Pilotas una nave en un campo de rocas con bordes que se enrollan. Cada roca destruida se parte en dos más pequeñas; acaba con todas para superar la oleada. El movimiento es newtoniano — no hay fricción, así que sigues deslizándote hasta que frenas. <kbd>Arriba</kbd> acelera en la dirección a la que apuntas; <kbd>Abajo</kbd> frena reduciendo tu velocidad actual (nunca te empuja hacia atrás — si estás parado no hace nada).',
      'help.controlRotate': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> — girar la nave',
      'help.controlThrust': '<kbd>Arriba</kbd> — acelerar en la dirección de apuntado',
      'help.controlReverse': '<kbd>Abajo</kbd> — frenar (reduce la velocidad; no marcha atrás)',
      'help.controlFire': '<kbd>Espacio</kbd> — disparar (máx. 4 balas en vuelo)',
      'help.controlAimLock': '<kbd>Tab</kbd> — apuntar a la amenaza más peligrosa (las rocas que se acercan tienen prioridad sobre las que se alejan; las balas y los OVNIs tienen prioridad sobre las rocas; la velocidad no cambia, así que sigues arrastrando con tu inercia)',
      'help.controlHyperspace': '<kbd>Mayús</kbd> — hiperespacio (1 entre 6 de fallar)',
      'help.controlPause': '<kbd>Esc</kbd> — pausa / atrás',
      'help.audioIntro': 'El oyente sigue a la nave — cuando giras, el mundo gira en tus oídos.',
      'help.audioLarge': 'Rocas grandes: triángulo grave.',
      'help.audioMedium': 'Rocas medianas: sierra media.',
      'help.audioSmall': 'Rocas pequeñas: cuadrada aguda.',
      'help.audioUfo': 'OVNI: tono pulsante — grande lento, o pequeño rápido.',
      'help.statusKeys': 'Atajos de estado: <kbd>F1</kbd> puntos, <kbd>F2</kbd> oleada, <kbd>F3</kbd> rumbo, <kbd>F4</kbd> amenaza más cercana.',
      'help.back': 'Atrás',

      'learn.aria': 'Aprender sonidos',
      'learn.title': 'Aprende los Sonidos',
      'learn.subtitle': 'Escucha cada señal antes de jugar.',
      'learn.large': 'Asteroide grande',
      'learn.medium': 'Asteroide mediano',
      'learn.small': 'Asteroide pequeño',
      'learn.bullet': 'Disparo',
      'learn.ufoBig': 'OVNI grande',
      'learn.ufoSmall': 'OVNI pequeño',
      'learn.hyperspace': 'Hiperespacio',
      'learn.death': 'Muerte',
      'learn.waveClear': 'Oleada superada',
      'learn.bonusLife': 'Vida extra',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio',
      'test.title': 'Prueba de Audio',
      'test.subtitle': 'Comprueba izquierda/derecha/delante/detrás.',
      'test.intro': 'Sonarán cuatro toques: delante, derecha, detrás, izquierda. Delante debe sonar al frente, derecha en tu oído derecho, detrás más apagado y grave, izquierda en tu oído izquierdo.',
      'test.dirFront': 'Delante',
      'test.dirRight': 'Derecha',
      'test.dirBehind': 'Detrás',
      'test.dirLeft': 'Izquierda',
      'test.replay': 'Repetir',
      'test.back': 'Atrás',

      'ann.score': 'Puntos {score}, {lives} vidas, oleada {wave}.',
      'ann.wave': 'Oleada {wave}. Quedan {count} rocas.',
      'ann.heading': 'Rumbo {direction}, velocidad {speed}.',
      'ann.nearest': 'Amenaza más cercana: {kind} al {direction}, distancia {distance}.',
      'ann.nearestNone': 'Sin amenazas cercanas.',
      'ann.lockedOn': 'Apuntando a {kind}, distancia {distance}.',
      'ann.onlineRank': 'Posición global {rank}.',
      'ann.bonusLife': 'Vida extra.',
      'ann.extraLife': 'Vida extra concedida.',
      'ann.waveStart': 'Oleada {wave}.',
      'ann.waveClear': 'Oleada superada.',
      'ann.ufoIncoming': 'OVNI a la vista.',
      'ann.ufoBig': 'OVNI grande.',
      'ann.ufoSmall': 'OVNI pequeño.',
      'ann.ufoGone': 'OVNI fuera.',
      'ann.hyperspace': 'Hiperespacio.',
      'ann.hyperspaceDeath': 'Salto fallido.',
      'ann.death': 'Nave destruida.',
      'ann.gameOver': 'Fin de la partida.',
      'ann.playing': 'Reproduciendo {label}.',
      'ann.kindLarge': 'roca grande',
      'ann.kindMedium': 'roca mediana',
      'ann.kindSmall': 'roca pequeña',
      'ann.kindUfoBig': 'OVNI grande',
      'ann.kindUfoSmall': 'OVNI pequeño',
      'ann.kindUfoBullet': 'bala de OVNI',

      'dir.N':  'norte',
      'dir.NE': 'noreste',
      'dir.E':  'este',
      'dir.SE': 'sureste',
      'dir.S':  'sur',
      'dir.SW': 'suroeste',
      'dir.W':  'oeste',
      'dir.NW': 'noroeste',
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
