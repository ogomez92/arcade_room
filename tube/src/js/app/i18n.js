app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'tempest-tube.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Tempest Tube',

      'menu.aria': 'Main menu',
      'menu.title': 'Tempest Tube',
      'menu.subtitle': 'Audio-first electric tube shooter. Ride the rim, fire inward, and survive the lanes as the tube gets hotter.',
      'menu.start': 'Start',
      'menu.highscores': 'High Scores',
      'menu.help': 'How to Play',
      'menu.learn': 'Learn Sounds',
      'menu.quit': 'Quit',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'Tempest Tube game in progress',
      'hud.score': 'Score: {score}',
      'hud.lives': 'Lives: {lives}',
      'hud.sector': 'Sector: {sector}',
      'hud.threats': 'Threats: {count}',

      'gameover.aria': 'Game over',
      'gameover.title': 'Game Over',
      'gameover.subtitle': 'Final score: {score} - sector {sector}',
      'gameover.namePrompt': 'Enter your name to post your score:',
      'gameover.namePlaceholder': 'Pilot',
      'gameover.nameRequired': 'Enter a name to post your score.',
      'gameover.submit': 'Post Score',
      'gameover.skip': 'Skip',
      'gameover.again': 'Play Again',
      'gameover.menu': 'Main Menu',

      'highscores.aria': 'High scores',
      'highscores.title': 'High Scores',
      'highscores.subtitle': 'Top 10 runs on this device.',
      'highscores.subtitleLocal': 'Local top 10 on this device.',
      'highscores.subtitleLoading': 'Loading the world leaderboard...',
      'highscores.subtitleOnline': 'World leaderboard for Tempest Tube.',
      'highscores.empty': 'No scores yet - go set one.',
      'highscores.onlineEmpty': 'No world scores yet - go set one.',
      'highscores.row': '#{rank}: {name} - {score} (sector {sector})',
      'highscores.back': 'Back',

      'online.posting': 'Posting your score...',
      'online.rank': 'Online rank: #{rank}',
      'online.error': 'Could not reach the leaderboard. Saved locally if it reached the local top 10.',
      'online.viewBoard': 'View the world leaderboard',

      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.intro': 'You ride the outer rim of a 16-lane electric tube. Enemies crawl outward from the center. Fire inward down your lane before they reach the rim. The run is endless: your score raises the sector, and higher sectors spawn faster and more complicated enemies.',
      'help.controlMove': '<kbd>Left</kbd>/<kbd>Right</kbd> or <kbd>A</kbd>/<kbd>D</kbd> - move one lane around the rim. Hold to keep stepping. Gamepad left stick or D-pad also moves lanes.',
      'help.controlFire': '<kbd>Space</kbd>, <kbd>Enter</kbd>, or <kbd>F</kbd> - fire an electric shot inward through the current lane. Shots travel the full tube, slightly past the center. Center an enemy sound by lane, then fire on the fast radar ping.',
      'help.scoring': '<strong>Scoring</strong> - deeper kills score more. Chain destroyed enemies within three seconds for combo x2, x3, up to x8. Tankers remember the farthest hit before they die.',
      'help.controlPause': '<kbd>Esc</kbd> or <kbd>Backspace</kbd> - pause back to the menu.',
      'help.statusKeys': '<kbd>F1</kbd> score, <kbd>F2</kbd> sector, <kbd>F3</kbd> lane, <kbd>F4</kbd> nearest threat, <kbd>F5</kbd> current-lane spike status.',
      'help.audioIntro': 'Audio rides your rim position while staying camera-locked down the tube. Same-lane threats are centered; left/right position tells which way to move around the rim.',
      'help.audioFlipper': 'Flippers are bright electric pulses that speed up as they near the rim.',
      'help.audioTanker': 'Tankers are heavy low drones. They take two hits and split into sparks in the adjacent lanes.',
      'help.audioSpark': 'Sparks are fast high fragments from tankers. Move to each adjacent spark lane and shoot once.',
      'help.audioSpiker': 'Spikers are crackling machines that build lane spikes.',
      'help.audioFuseball': 'Fuseballs are fast high arcs that jump lanes.',
      'help.audioSpike': 'Spikes crackle in their lane. A spike reaching your rim is lethal if you sit on that lane.',
      'help.audioRadar': 'Fast radar ping: your current lane has a clear enemy lined up. That ping is the shoot-now confirmation; tankers still need two hits.',
      'help.back': 'Back',

      'learn.aria': 'Learn sounds',
      'learn.title': 'Learn the Sounds',
      'learn.subtitle': 'Audition each cue before you play.',
      'learn.lane': 'Lane step',
      'learn.lineup': 'Fire-now radar ping',
      'learn.shot': 'Inward shot',
      'learn.combo': 'Combo fanfare',
      'learn.flipper': 'Flipper',
      'learn.tanker': 'Tanker',
      'learn.spark': 'Spark',
      'learn.spiker': 'Spiker',
      'learn.fuseball': 'Fuseball',
      'learn.spike': 'Spike hazard',
      'learn.destroy': 'Enemy destroyed',
      'learn.death': 'Life lost',
      'learn.back': 'Back',

      'ann.start': 'Run started. Move around the rim and fire inward.',
      'ann.score': 'Score {score}, {lives} lives, sector {sector}.',
      'ann.sector': 'Sector {sector}. {threats} threats in the tube.',
      'ann.lane': 'Lane {lane}.',
      'ann.noThreat': 'No active threats.',
      'ann.threat': 'Nearest {kind}: lane {lane}, depth {depth} percent.',
      'ann.spikeStatus': 'Current lane spike is {distance} percent toward the rim.',
      'ann.lifeLost': 'Life lost. {lives} lives remain.',
      'ann.gameOver': 'Game over.',
      'ann.sectorUp': 'Sector {sector}. The tube is getting faster.',
      'ann.playing': 'Playing {label}.',
      'ann.spikeWarning': 'Spike danger on your lane.',
      'ann.rimThreat': '{kind} on the rim.',
      'ann.combo': 'Combo x{multiplier}. {points} points. Distance {distance} percent.',
      'ann.onlineRank': 'Online rank: number {rank}.',
      'ann.onlineError': 'Could not reach the online leaderboard. Score saved locally if it reached the local top 10.',

      'kind.flipper': 'flipper',
      'kind.tanker': 'tanker',
      'kind.spiker': 'spiker',
      'kind.spark': 'spark',
      'kind.fuseball': 'fuseball',
    },

    es: {
      'doc.title': 'Tempest Tube',

      'menu.aria': 'Menú principal',
      'menu.title': 'Tempest Tube',
      'menu.subtitle': 'Disparos eléctricos audio-primero dentro de un tubo. Muévete por el borde, dispara hacia dentro y sobrevive cuando las calles se calienten.',
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

      'game.aria': 'Partida de Tempest Tube en curso',
      'hud.score': 'Puntos: {score}',
      'hud.lives': 'Vidas: {lives}',
      'hud.sector': 'Sector: {sector}',
      'hud.threats': 'Amenazas: {count}',

      'gameover.aria': 'Fin de partida',
      'gameover.title': 'Fin de Partida',
      'gameover.subtitle': 'Puntos finales: {score} - sector {sector}',
      'gameover.namePrompt': 'Escribe tu nombre para enviar tu puntuación:',
      'gameover.namePlaceholder': 'Piloto',
      'gameover.nameRequired': 'Escribe un nombre para enviar tu puntuación.',
      'gameover.submit': 'Enviar Puntuación',
      'gameover.skip': 'Saltar',
      'gameover.again': 'Jugar de Nuevo',
      'gameover.menu': 'Menú Principal',

      'highscores.aria': 'Récords',
      'highscores.title': 'Récords',
      'highscores.subtitle': 'Las 10 mejores partidas en este dispositivo.',
      'highscores.subtitleLocal': 'Las 10 mejores partidas locales en este dispositivo.',
      'highscores.subtitleLoading': 'Cargando el ránking mundial...',
      'highscores.subtitleOnline': 'Ránking mundial de Tempest Tube.',
      'highscores.empty': 'Aún no hay récords - sé el primero.',
      'highscores.onlineEmpty': 'Aún no hay puntuaciones mundiales - sé el primero.',
      'highscores.row': '#{rank}: {name} - {score} (sector {sector})',
      'highscores.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación...',
      'online.rank': 'Puesto en línea: número {rank}',
      'online.error': 'No se pudo conectar con el ránking. Guardada localmente si entró en el top 10 local.',
      'online.viewBoard': 'Ver el ránking mundial',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo Jugar',
      'help.intro': 'Vas por el borde exterior de un tubo eléctrico de 16 calles. Los enemigos avanzan desde el centro hacia fuera. Dispara hacia dentro por tu calle antes de que lleguen al borde. La partida no termina por niveles: tus puntos suben el sector, y los sectores altos generan enemigos más rápidos y complejos.',
      'help.controlMove': '<kbd>Izquierda</kbd>/<kbd>Derecha</kbd> o <kbd>A</kbd>/<kbd>D</kbd> - moverte una calle por el borde. Mantén pulsado para seguir moviéndote. El stick izquierdo o la cruceta del mando también mueven calles.',
      'help.controlFire': '<kbd>Espacio</kbd>, <kbd>Intro</kbd>, o <kbd>F</kbd> - disparar un rayo hacia dentro por tu calle. Los disparos recorren todo el tubo y un poco más allá del centro. Centra el sonido del enemigo por calle y dispara con el ping rápido de radar.',
      'help.scoring': '<strong>Puntuación</strong> - destruir enemigos más dentro del tubo da más puntos. Encadena enemigos destruidos en tres segundos para combo x2, x3, hasta x8. Los tanques recuerdan el impacto más lejano antes de morir.',
      'help.controlPause': '<kbd>Esc</kbd> o <kbd>Retroceso</kbd> - pausar y volver al menú.',
      'help.statusKeys': '<kbd>F1</kbd> puntos, <kbd>F2</kbd> sector, <kbd>F3</kbd> calle, <kbd>F4</kbd> amenaza más cercana, <kbd>F5</kbd> estado del pincho en tu calle.',
      'help.audioIntro': 'El audio sigue tu posición en el borde y mantiene la cámara hacia el fondo del tubo. Las amenazas en tu misma calle suenan centradas; la posición izquierda/derecha indica hacia dónde moverte por el borde.',
      'help.audioFlipper': 'Los flippers son pulsos eléctricos brillantes que aceleran al acercarse al borde.',
      'help.audioTanker': 'Los tanques son drones graves y pesados. Aguantan dos impactos y se dividen en chispas en las calles adyacentes.',
      'help.audioSpark': 'Las chispas son fragmentos agudos y rápidos de los tanques. Muévete a cada calle adyacente con chispa y dispara una vez.',
      'help.audioSpiker': 'Los spikers son máquinas crepitantes que construyen pinchos en una calle.',
      'help.audioFuseball': 'Los fuseballs son arcos agudos y rápidos que saltan entre calles.',
      'help.audioSpike': 'Los pinchos crepitan en su calle. Si uno llega a tu borde y estás en esa calle, mata.',
      'help.audioRadar': 'Ping rápido de radar: tu calle actual tiene alineado un enemigo despejado. Ese ping confirma que debes disparar ahora; los tanques siguen necesitando dos impactos.',
      'help.back': 'Atrás',

      'learn.aria': 'Aprender sonidos',
      'learn.title': 'Aprender los Sonidos',
      'learn.subtitle': 'Escucha cada señal antes de jugar.',
      'learn.lane': 'Paso de calle',
      'learn.lineup': 'Ping de dispara ahora',
      'learn.shot': 'Disparo hacia dentro',
      'learn.combo': 'Fanfarria de combo',
      'learn.flipper': 'Flipper',
      'learn.tanker': 'Tanque',
      'learn.spark': 'Chispa',
      'learn.spiker': 'Spiker',
      'learn.fuseball': 'Fuseball',
      'learn.spike': 'Pincho peligroso',
      'learn.destroy': 'Enemigo destruido',
      'learn.death': 'Vida perdida',
      'learn.back': 'Atrás',

      'ann.start': 'Partida empezada. Muévete por el borde y dispara hacia dentro.',
      'ann.score': 'Puntos {score}, {lives} vidas, sector {sector}.',
      'ann.sector': 'Sector {sector}. {threats} amenazas en el tubo.',
      'ann.lane': 'Calle {lane}.',
      'ann.noThreat': 'No hay amenazas activas.',
      'ann.threat': '{kind} más cercano: calle {lane}, profundidad {depth} por ciento.',
      'ann.spikeStatus': 'El pincho de tu calle está al {distance} por ciento hacia el borde.',
      'ann.lifeLost': 'Vida perdida. Quedan {lives} vidas.',
      'ann.gameOver': 'Fin de partida.',
      'ann.sectorUp': 'Sector {sector}. El tubo va más rápido.',
      'ann.playing': 'Reproduciendo {label}.',
      'ann.spikeWarning': 'Peligro de pincho en tu calle.',
      'ann.rimThreat': '{kind} en el borde.',
      'ann.combo': 'Combo x{multiplier}. {points} puntos. Distancia {distance} por ciento.',
      'ann.onlineRank': 'Puesto en línea: número {rank}.',
      'ann.onlineError': 'No se pudo conectar con el ránking en línea. Puntuación guardada localmente si entró en el top 10 local.',

      'kind.flipper': 'flipper',
      'kind.tanker': 'tanque',
      'kind.spiker': 'spiker',
      'kind.spark': 'chispa',
      'kind.fuseball': 'fuseball',
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
