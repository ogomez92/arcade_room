/**
 * TAPPER! — i18n.
 *
 * Resolution order on boot: localStorage('bartender.lang') →
 * navigator.language 2-letter prefix → fallback ('en').
 *
 * Author per-locale phrase pools (announcer flavor, theme names) instead
 * of translating — translated flavor reads stilted.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'bartender.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'TAPPER!',

      // Menu
      'menu.aria': 'Main menu',
      'menu.subtitle': 'Bartender lane management. Use your ears.',
      'menu.start': 'Open the Bar',
      'menu.help': 'How to Play',
      'menu.highscores': 'High Scores',

      // Language
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game HUD
      'game.aria': 'Bar tending',
      'game.hudHint': '<kbd>↑</kbd>/<kbd>↓</kbd> change bar &nbsp; <kbd>←</kbd>/<kbd>→</kbd> walk &nbsp; <kbd>Space</kbd> hold fill / release sling. <kbd>F1</kbd>–<kbd>F4</kbd> status. <kbd>Esc</kbd> pause.',
      'game.hudTheme': 'Bar: {name}',
      'game.hudLevel': 'Level {n}',
      'game.hudScore': 'Score {n}',
      'game.hudLives': 'Lives {n}',
      'game.lanesLabel': 'Bar 1 top, bar 4 bottom. ★ = you.',

      // Theme names — keep short, used in HUD and announcer
      'theme.saloon': 'Saloon',
      'theme.discoteca': 'Discotheque',
      'theme.estadio': 'Stadium',
      'theme.yates': 'Yacht Club',

      // Announcer
      'ann.start': '{theme}, level {level}. Lives {lives}.',
      'ann.levelClear': 'Bar cleared. {score} points.',
      'ann.roundUp': 'Closing time. The night gets harder.',
      'ann.life': 'Life lost. {lives} left.',
      'ann.breach': 'Customer at the kegs! Bar {lane}.',
      'ann.shatter': 'Mug shattered on bar {lane}.',
      'ann.waste': 'Wasted drink, bar {lane}.',
      'ann.tip': 'Tip! Floor show.',
      'ann.gameOver': 'Bar closed. Final score {score}.',
      'ann.pause': 'Paused.',
      'ann.unpause': 'Back to work.',
      'ann.lane': 'Bar {lane}.',
      'ann.posKegs': 'At the kegs.',
      'ann.posDoor': 'Near the door.',
      'ann.posMid': 'Halfway down.',
      'ann.statusPos': 'Bar {lane}. {pos}.',
      'ann.statusScore': 'Score {score}, level {level}, {lives} lives.',
      'ann.statusNearest': 'Nearest customer: bar {lane}, {pct} percent toward the kegs.',
      'ann.statusNoCustomers': 'No customers right now.',
      'ann.statusEmpties': '{count} empty mugs out: bars {lanes}.',
      'ann.statusNoEmpties': 'No empty mugs returning.',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.controlsTitle': 'Controls',
      'help.controlLane': '<kbd>Up</kbd>/<kbd>Down</kbd> — switch bar (1–4).',
      'help.controlWalk': '<kbd>Left</kbd>/<kbd>Right</kbd> — walk along the bar.',
      'help.controlPour': '<kbd>Space</kbd> at the kegs — hold to fill a mug, release to sling it right.',
      'help.controlPause': '<kbd>Esc</kbd> — pause / quit.',
      'help.controlStatus': '<kbd>F1</kbd> position, <kbd>F2</kbd> score &amp; lives, <kbd>F3</kbd> nearest customer, <kbd>F4</kbd> empty mugs.',
      'help.howTitle': 'Tending the Bar',
      'help.howRule1': 'Customers enter from the right of every bar and walk slowly toward the kegs on the left. Stop them by sliding full mugs at them.',
      'help.howRule2': 'Stand at the kegs (far left of any bar). Hold Space to fill, release to sling. The mug rides the bar to the right until a customer drinks it.',
      'help.howRule3': 'Each bar has its own pitch — bar 1 (top) is highest, bar 4 (bottom) is lowest. Stereo tells you how far along the bar a sound is.',
      'help.howRule4': 'Customers fling their empty mugs back when they finish. Walk right to catch the empty before it shatters on the floor at the kegs.',
      'help.howRule5': 'Tips appear sometimes. Run over a tip for a bonus and a brief floor show — customers freeze while the music plays.',
      'help.lossTitle': 'Three Ways to Lose a Life',
      'help.lossBreach': 'A customer reaches the kegs.',
      'help.lossShatter': 'An empty mug slides past the kegs and shatters.',
      'help.lossWaste': 'A full mug reaches the door with no customer to catch it.',
      'help.lossOutro': 'Three lives. Empty the bar to clear the level. Each cycle of four bars (saloon, disco, stadium, yacht club) raises the difficulty.',
      'help.back': 'Back',

      // Game over
      'gameover.aria': 'Bar closed',
      'gameover.title': 'Bar\'s Closed',
      'gameover.summary': 'Final score {score}. Level {level}, round {round}.',
      'gameover.nameLabel': 'Your name',
      'gameover.save': 'Save Score',
      'gameover.restart': 'Open Again',
      'gameover.menu': 'Back to Menu',
      'gameover.saved': 'Saved.',
      'gameover.notQualified': 'Not a top-10 local score.',
      'gameover.nameRequired': 'Type a name first.',
      'gameover.nameInvalid': 'Use letters, digits, spaces, or . - _ ! ? * only.',
      'gameover.onlinePosting': 'Posting online…',
      'gameover.onlineSubmitted': 'Online: submitted.',
      'gameover.onlineRanked': 'Online: ranked #{rank}.',
      'gameover.onlineFailed': 'Online: couldn\'t reach the leaderboard.',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High Scores',
      'highscores.empty': 'No scores yet. Open the bar.',
      'highscores.entry': '{rank}. {name} — {score} (level {level})',
      'highscores.back': 'Back',
      'highscores.source.onlineLoading': 'Loading online scores…',
      'highscores.source.online': 'Online leaderboard',
      'highscores.source.onlineFailed': 'Couldn\'t reach the online leaderboard. Showing local scores.',
      'highscores.source.localOnly': 'Local scores.',
    },

    es: {
      'doc.title': '¡TAPPER!',

      'menu.aria': 'Menú principal',
      'menu.subtitle': 'Camarero de barra. Usa los oídos.',
      'menu.start': 'Abrir la Barra',
      'menu.help': 'Cómo se Juega',
      'menu.highscores': 'Mejores Puntuaciones',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Sirviendo cañas',
      'game.hudHint': '<kbd>↑</kbd>/<kbd>↓</kbd> cambia barra &nbsp; <kbd>←</kbd>/<kbd>→</kbd> caminar &nbsp; <kbd>Espacio</kbd> mantén llena / suelta lanza. <kbd>F1</kbd>–<kbd>F4</kbd> estado. <kbd>Esc</kbd> pausa.',
      'game.hudTheme': 'Barra: {name}',
      'game.hudLevel': 'Nivel {n}',
      'game.hudScore': 'Puntos {n}',
      'game.hudLives': 'Vidas {n}',
      'game.lanesLabel': 'Barra 1 arriba, barra 4 abajo. ★ = tú.',

      'theme.saloon': 'Tasca',
      'theme.discoteca': 'Discoteca',
      'theme.estadio': 'Estadio',
      'theme.yates': 'Club Náutico',

      'ann.start': '{theme}, nivel {level}. {lives} vidas.',
      'ann.levelClear': 'Barra despejada. {score} puntos.',
      'ann.roundUp': 'Hora de cerrar. La noche se complica.',
      'ann.life': 'Vida menos. Quedan {lives}.',
      'ann.breach': '¡Cliente en los grifos! Barra {lane}.',
      'ann.shatter': 'Vaso roto en la barra {lane}.',
      'ann.waste': 'Caña perdida en la barra {lane}.',
      'ann.tip': '¡Propina! Espectáculo.',
      'ann.gameOver': 'Cerrado. Puntuación final {score}.',
      'ann.pause': 'En pausa.',
      'ann.unpause': 'Volvemos.',
      'ann.lane': 'Barra {lane}.',
      'ann.posKegs': 'En los grifos.',
      'ann.posDoor': 'Junto a la puerta.',
      'ann.posMid': 'A media barra.',
      'ann.statusPos': 'Barra {lane}. {pos}.',
      'ann.statusScore': '{score} puntos, nivel {level}, {lives} vidas.',
      'ann.statusNearest': 'Cliente más cerca: barra {lane}, {pct} por ciento hacia los grifos.',
      'ann.statusNoCustomers': 'No hay clientes.',
      'ann.statusEmpties': '{count} vasos volviendo: barras {lanes}.',
      'ann.statusNoEmpties': 'Ningún vaso vuelve.',

      'help.aria': 'Cómo se juega',
      'help.title': 'Cómo se Juega',
      'help.controlsTitle': 'Controles',
      'help.controlLane': '<kbd>Arriba</kbd>/<kbd>Abajo</kbd> — cambiar de barra (1–4).',
      'help.controlWalk': '<kbd>Izq</kbd>/<kbd>Der</kbd> — caminar por la barra.',
      'help.controlPour': '<kbd>Espacio</kbd> en los grifos — mantén para llenar, suelta para lanzar.',
      'help.controlPause': '<kbd>Esc</kbd> — pausa / salir.',
      'help.controlStatus': '<kbd>F1</kbd> posición, <kbd>F2</kbd> puntos y vidas, <kbd>F3</kbd> cliente más próximo, <kbd>F4</kbd> vasos volviendo.',
      'help.howTitle': 'Atender la Barra',
      'help.howRule1': 'Los clientes entran por la derecha de cada barra y caminan hacia los grifos a la izquierda. Páralos lanzándoles cañas llenas.',
      'help.howRule2': 'Plántate en los grifos (extremo izquierdo de la barra). Mantén Espacio para llenar, suelta para lanzar. La caña recorre la barra hasta que un cliente la coge.',
      'help.howRule3': 'Cada barra tiene su tono — la 1 (arriba) es la más aguda, la 4 (abajo) la más grave. El estéreo te dice por dónde va cada sonido.',
      'help.howRule4': 'Los clientes te devuelven el vaso vacío al terminar. Camina a la derecha y atrápalo antes de que se rompa en los grifos.',
      'help.howRule5': 'A veces aparecen propinas. Pasa por encima para llevártela y un breve espectáculo congela a los clientes mientras suena la música.',
      'help.lossTitle': 'Tres Maneras de Perder Vida',
      'help.lossBreach': 'Un cliente llega a los grifos.',
      'help.lossShatter': 'Un vaso vacío llega a los grifos y se rompe.',
      'help.lossWaste': 'Una caña llena llega a la puerta sin cliente que la coja.',
      'help.lossOutro': 'Tres vidas. Vacía la barra para pasar de nivel. Cada vuelta de cuatro barras (tasca, discoteca, estadio, club náutico) sube la dificultad.',
      'help.back': 'Atrás',

      'gameover.aria': 'Barra cerrada',
      'gameover.title': 'Cierra la Barra',
      'gameover.summary': 'Puntuación final {score}. Nivel {level}, vuelta {round}.',
      'gameover.nameLabel': 'Tu nombre',
      'gameover.save': 'Guardar',
      'gameover.restart': 'Otra Ronda',
      'gameover.menu': 'Volver al Menú',
      'gameover.saved': 'Guardado.',
      'gameover.notQualified': 'No entra en el top 10 local.',
      'gameover.nameRequired': 'Escribe un nombre primero.',
      'gameover.nameInvalid': 'Usa letras, números, espacios o . - _ ! ? * solamente.',
      'gameover.onlinePosting': 'Publicando online…',
      'gameover.onlineSubmitted': 'Online: enviado.',
      'gameover.onlineRanked': 'Online: puesto #{rank}.',
      'gameover.onlineFailed': 'Online: no se pudo conectar.',

      'highscores.aria': 'Mejores puntuaciones',
      'highscores.title': 'Mejores Puntuaciones',
      'highscores.empty': 'Sin puntuaciones todavía. Abre la barra.',
      'highscores.entry': '{rank}. {name} — {score} (nivel {level})',
      'highscores.back': 'Atrás',
      'highscores.source.onlineLoading': 'Cargando puntuaciones online…',
      'highscores.source.online': 'Tabla online',
      'highscores.source.onlineFailed': 'No se pudo conectar con la tabla online. Mostrando locales.',
      'highscores.source.localOnly': 'Puntuaciones locales.',
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
