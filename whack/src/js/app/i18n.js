/**
 * Lightweight i18n for WHACK. Shared implementation across the collection;
 * only STORAGE_KEY and the dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'whack.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Whack',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Whack',
      'menu.subtitle': 'An audio-first whack-a-mole. Nine burrows around you — smack the one you hear before it ducks, but never the decoy.',
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
      'game.aria': 'The field',
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.level': 'Level',
      'hud.combo': 'Combo',

      // Burrow positions (3x3 field)
      'hole.nw': 'northwest',
      'hole.n': 'north',
      'hole.ne': 'northeast',
      'hole.w': 'west',
      'hole.c': 'centre',
      'hole.e': 'east',
      'hole.sw': 'southwest',
      'hole.s': 'south',
      'hole.se': 'southeast',

      // Critter kinds (for the field readout)
      'kind.mole': 'critter',
      'kind.golden': 'golden',
      'kind.decoy': 'decoy',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Hear it, place it, smack it — but never the decoy.',
      'help.intro': 'Nine burrows sit in a 3 by 3 field around you, and the field never turns. A burrow’s row sets its pitch (north is high, centre is middle, south is low) and its column sets its side (west is left, east is right) — so every burrow has its own sound. A critter pops up and ticks from its burrow; the tick speeds up as it gets ready to duck back down. Smack that burrow’s key before it does. Let one duck away un-smacked and it costs a life. Some pops are decoys that tick like a primed bomb — smack one and it costs a life, so leave decoys alone. Golden critters shimmer, are worth far more and supercharge your combo, but they don’t stay up long. The longer you last the faster and more crowded the field gets. Five lives.',
      'help.h.keys': 'Smack a burrow with the <kbd>numpad</kbd>: <kbd>7 8 9 / 4 5 6 / 1 2 3</kbd> map straight onto the 3 by 3 field.',
      'help.h.alt': 'No numpad? The <kbd>Q W E / A S D / Z X C</kbd> keys cover the same nine burrows in the same layout.',
      'help.h.fast': 'Smack early in a critter’s window for a speed bonus; chain clean smacks to raise your combo multiplier (up to 10x).',
      'help.h.decoy': 'Decoys tick low and harsh like a bomb. Never smack one. They duck away harmlessly on their own.',
      'help.h.status': '<kbd>F1</kbd> score, lives, level and combo · <kbd>F2</kbd> what’s up right now · <kbd>F3</kbd> best combo.',
      'help.h.pause': '<kbd>Escape</kbd> — pause.',
      'help.audio': 'A clean smack lands a wooden thwack and a squeak; a critter that gets away whooshes back into the ground; smacking a decoy is a harsh buzzer. Sounds to the south (behind you) are slightly muffled — pitch tells north from south when your ears can’t.',
      'help.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Grab a mallet!',
      'highscores.entry': '#{rank}. {name} — {score} points, level {level}',
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

      // Learn the sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each cue on its own.',
      'learn.moleN': 'Critter pops — north (high)',
      'learn.moleC': 'Critter pops — centre (mid)',
      'learn.moleS': 'Critter pops — south (low)',
      'learn.wiggle': 'Critter tick (about to duck)',
      'learn.golden': 'Golden critter (northeast)',
      'learn.decoy': 'Decoy — do not smack (southwest)',
      'learn.whack': 'Clean smack',
      'learn.whackGold': 'Golden smacked',
      'learn.miss': 'Critter got away',
      'learn.decoyHit': 'Smacked a decoy (penalty)',
      'learn.whiff': 'Whiff — empty ground',
      'learn.level': 'Level up',
      'learn.over': 'Game over',
      'learn.back': 'Back',

      // Spatial test
      'test.aria': 'Spatial audio test',
      'test.title': 'Spatial audio test',
      'test.subtitle': 'Confirm the field: front is north, right is east, behind is south, left is west.',
      'test.north': 'Play north (front)',
      'test.east': 'Play east (right)',
      'test.south': 'Play south (behind)',
      'test.west': 'Play west (left)',
      'test.centre': 'Play centre',
      'test.sweep': 'Sweep all nine burrows',
      'test.ring': 'Play north · east · south · west',
      'test.back': 'Back',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard. Saved locally.",
      'online.viewBoard': 'View the leaderboard',

      // Announcements
      'ann.golden': 'Golden! Plus {gained}.',
      'ann.combo': 'Combo {combo}!',
      'ann.miss': 'Got away at {dir}. {lives} lives left.',
      'ann.missLast': 'Got away at {dir}. No lives left.',
      'ann.decoy': 'Decoy! {lives} lives left.',
      'ann.decoyLast': 'Decoy! No lives left.',
      'ann.levelUp': 'Level {level}!',
      'ann.gameOver': 'Game over. Final score {score}.',
      'ann.gameOverHigh': 'Game over. New high score, {score}!',
      'ann.status': 'Score {score}, {lives} lives, level {level}, combo {combo}.',
      'ann.field': 'Up: {items}.',
      'ann.upItem': '{kind} {dir}',
      'ann.allClear': 'All burrows clear.',
      'ann.best': 'Best combo {combo}. {hits} smacked.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank number {rank}.',
      'ann.onlineError': 'Leaderboard unavailable. Saved on this device.',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
    },

    es: {
      'doc.title': 'Whack',

      'menu.aria': 'Menú principal',
      'menu.title': 'Whack',
      'menu.subtitle': 'Un golpea-topos sonoro. Nueve madrigueras a tu alrededor: golpea la que oigas antes de que se esconda, pero nunca el señuelo.',
      'menu.start': 'Empezar',
      'menu.help': 'Cómo jugar',
      'menu.highscores': 'Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'El campo',
      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.level': 'Nivel',
      'hud.combo': 'Combo',

      'hole.nw': 'noroeste',
      'hole.n': 'norte',
      'hole.ne': 'noreste',
      'hole.w': 'oeste',
      'hole.c': 'centro',
      'hole.e': 'este',
      'hole.sw': 'suroeste',
      'hole.s': 'sur',
      'hole.se': 'sureste',

      'kind.mole': 'topo',
      'kind.golden': 'dorado',
      'kind.decoy': 'señuelo',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Óyelo, ubícalo, golpéalo, pero nunca el señuelo.',
      'help.intro': 'Nueve madrigueras forman un campo de 3 por 3 a tu alrededor, y el campo no gira nunca. La fila de cada madriguera fija su tono (el norte agudo, el centro medio, el sur grave) y su columna fija el lado (el oeste a la izquierda, el este a la derecha): así cada madriguera suena distinta. Un topo asoma y repica desde su madriguera; el repique se acelera cuando va a esconderse. Golpea la tecla de esa madriguera antes de que lo haga. Si uno se esconde sin golpear, cuesta una vida. Algunos asomos son señuelos que repican grave y áspero como una bomba cebada: golpear uno cuesta una vida, así que déjalos en paz. Los topos dorados brillan, valen mucho más y disparan tu combo, pero duran poco. Cuanto más aguantes, más rápido y abarrotado se vuelve el campo. Cinco vidas.',
      'help.h.keys': 'Golpea una madriguera con el <kbd>teclado numérico</kbd>: <kbd>7 8 9 / 4 5 6 / 1 2 3</kbd> calcan el campo de 3 por 3.',
      'help.h.alt': '¿Sin teclado numérico? Las teclas <kbd>Q W E / A S D / Z X C</kbd> cubren las mismas nueve madrigueras en la misma disposición.',
      'help.h.fast': 'Golpea pronto dentro de la ventana del topo para un bono de velocidad; encadena golpes limpios para subir tu multiplicador de combo (hasta 10x).',
      'help.h.decoy': 'Los señuelos repican grave y áspero como una bomba. Nunca los golpees. Se esconden solos sin hacer daño.',
      'help.h.status': '<kbd>F1</kbd> puntos, vidas, nivel y combo · <kbd>F2</kbd> qué hay asomado ahora · <kbd>F3</kbd> mejor combo.',
      'help.h.pause': '<kbd>Escape</kbd> — pausa.',
      'help.audio': 'Un golpe limpio suena a mazazo de madera y un chillido; un topo que escapa se hunde con un soplido en la tierra; golpear un señuelo es un zumbido áspero. Los sonidos del sur (detrás de ti) suenan algo apagados: el tono distingue norte de sur cuando el oído no puede.',
      'help.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Coge el mazo!',
      'highscores.entry': '#{rank}. {name} — {score} puntos, nivel {level}',
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
      'learn.moleN': 'Topo asoma — norte (agudo)',
      'learn.moleC': 'Topo asoma — centro (medio)',
      'learn.moleS': 'Topo asoma — sur (grave)',
      'learn.wiggle': 'Repique del topo (va a esconderse)',
      'learn.golden': 'Topo dorado (noreste)',
      'learn.decoy': 'Señuelo — no golpear (suroeste)',
      'learn.whack': 'Golpe limpio',
      'learn.whackGold': 'Dorado golpeado',
      'learn.miss': 'El topo escapó',
      'learn.decoyHit': 'Golpeaste un señuelo (castigo)',
      'learn.whiff': 'Fallo — tierra vacía',
      'learn.level': 'Subes de nivel',
      'learn.over': 'Fin de la partida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba de audio espacial',
      'test.title': 'Prueba de audio espacial',
      'test.subtitle': 'Confirma el campo: al frente es norte, derecha este, detrás sur, izquierda oeste.',
      'test.north': 'Sonar al norte (frente)',
      'test.east': 'Sonar al este (derecha)',
      'test.south': 'Sonar al sur (detrás)',
      'test.west': 'Sonar al oeste (izquierda)',
      'test.centre': 'Sonar el centro',
      'test.sweep': 'Recorrer las nueve madrigueras',
      'test.ring': 'Sonar norte · este · sur · oeste',
      'test.back': 'Atrás',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo conectar con la clasificación. Guardado localmente.',
      'online.viewBoard': 'Ver la clasificación',

      'ann.golden': '¡Dorado! Más {gained}.',
      'ann.combo': '¡Combo {combo}!',
      'ann.miss': 'Escapó al {dir}. Quedan {lives} vidas.',
      'ann.missLast': 'Escapó al {dir}. Sin vidas.',
      'ann.decoy': '¡Señuelo! Quedan {lives} vidas.',
      'ann.decoyLast': '¡Señuelo! Sin vidas.',
      'ann.levelUp': '¡Nivel {level}!',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}.',
      'ann.gameOverHigh': 'Fin de la partida. ¡Nuevo récord, {score}!',
      'ann.status': 'Puntos {score}, {lives} vidas, nivel {level}, combo {combo}.',
      'ann.field': 'Asomado: {items}.',
      'ann.upItem': '{kind} {dir}',
      'ann.allClear': 'Madrigueras despejadas.',
      'ann.best': 'Mejor combo {combo}. {hits} golpeados.',
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
