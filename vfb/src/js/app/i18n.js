/**
 * Lightweight i18n for accessible audio games. See bumper/template for the
 * canonical implementation; only the STORAGE_KEY and dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'vfb.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Villains from Beyond',

      // Splash
      'splash.author': 'Audio-first scrolling shooter',
      'splash.instruction': 'Press Enter or click to begin',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Villains from Beyond',
      'menu.instructions': 'Use arrow keys to navigate, Enter to confirm. Escape to exit.',
      'menu.start': 'Start Game',
      'menu.howto': 'How to Play',
      'menu.quit': 'Quit',
      'menu.language': 'Language',

      // Howto
      'howto.title': 'How to Play',
      'howto.intro': 'You pilot the <strong>Solvalou</strong>, an endlessly forward-scrolling ship. Aerial enemies must be shot with the <strong>zapper beam</strong>. Ground targets are destroyed with <strong>bombs</strong>. Every three levels you face a Genesis mothership boss. Game is endless: try to reach as far as you can.',
      'howto.combatHeader': 'Combat keys',
      'howto.combatZ': '<kbd>Z</kbd> — Fire zapper beam (hold to fire continuously)',
      'howto.combatX': '<kbd>X</kbd> — Drop bomb (hold to drop continuously)',
      'howto.combatC': '<kbd>C</kbd> — Anti-aircraft burst (clears all aerial enemies; finite supply)',
      'howto.combatA': '<kbd>A</kbd> — Spend 3 shieldbits for an instant clearing beam',
      'howto.moveHeader': 'Movement',
      'howto.moveLR': '<kbd>←</kbd> / <kbd>→</kbd> — Strafe left / right (lateral position 0–10)',
      'howto.moveUp': '<kbd>↑</kbd> — Speed up (faster forward scroll)',
      'howto.moveDown': '<kbd>↓</kbd> — Slow down',
      'howto.flowHeader': 'Game flow',
      'howto.flowSpace': '<kbd>Space</kbd> — Request store at end of level (level 4+, costs 15 credits)',
      'howto.flowP': '<kbd>P</kbd> — Pause / resume',
      'howto.flowEsc': '<kbd>Esc</kbd> — Quit current run, return to menu',
      'howto.flowQ': '<kbd>Q</kbd> — Rage quit (immediate game over)',
      'howto.statusHeader': 'Status announcements (spoken via screen reader)',
      'howto.statusS': '<kbd>S</kbd> — Speak current score',
      'howto.statusL': '<kbd>L</kbd> — Speak lives remaining',
      'howto.statusE': '<kbd>E</kbd> — Speak current level',
      'howto.statusB': '<kbd>B</kbd> — Speak bursts remaining',
      'howto.statusD': '<kbd>D</kbd> — Speak shieldbits remaining',
      'howto.statusM': '<kbd>M</kbd> — Speak credits',
      'howto.statusV': '<kbd>V</kbd> — Speak level progress (percent of level traveled)',
      'howto.scoringHeader': 'Scoring & progression',
      'howto.score1': 'Aerial enemies: more points the further away you kill them.',
      'howto.score2': 'Combo: chain kills within 1.5 seconds for bonus points and credits.',
      'howto.score3': 'Avoiding enemy shots gives a small bonus.',
      'howto.score4': 'Extra lives: at 20,000 points, then 60,000, 120,000, …',
      'howto.score5': 'Towers (when you hear the alarm, drop a bomb immediately): destroying a tower sets a checkpoint and gives a hefty score.',
      'howto.score6': 'Items (from scorpion ships): rapid fire, bomb area, anti-aircraft burst, beam velocity, shieldbits.',
      'howto.score7': 'Genesis mothership (every 3 levels): don\'t pass it—its forcefield kills you and clears your shields.',
      'howto.storeHeader': 'Store (after every Genesis kill, or on request)',
      'howto.store1': 'Permanent upgrades to fire rate, beam velocity, bomb area, powerup duration.',
      'howto.store2': 'Per-session limits: up to 3 lives, 5 shieldbits, 3 bursts.',
      'howto.tip': 'Use headphones for the best stereo positioning of enemies and items.',

      // Language
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',

      // Game HUD
      'game.aria': 'Game',
      'game.level': 'Level',
      'game.score': 'Score',
      'game.lives': 'Lives',
      'game.shields': 'Shields',
      'game.bursts': 'Bursts',
      'game.credits': 'Credits',
      'game.progress': 'Progress',
      'game.speed': 'Speed',
      'game.position': 'Position',
      'game.paused': 'Paused. Press P to resume.',

      // Store
      'store.aria': 'Upgrade store',
      'store.title': 'Upgrade Store',
      'store.creditsAvailable': 'Credits available:',
      'store.instructions': 'Use arrow keys to choose an upgrade. Enter to buy. Escape to leave.',
      'store.itemTpl': '{label} - {cost} credits',
      'store.notEnough': 'Not enough credits.',
      'store.purchased': 'Purchased: {label}',
      'store.upgradePowerup': 'Powerup time +3s (now {sec}s)',
      'store.upgradeZap': 'Zapper firing speed +25ms (now {ms}ms)',
      'store.upgradeBeam': 'Beam travel speed (now {value})',
      'store.upgradeBomb': 'Bomb range +1 (now {value})',
      'store.itemLife': 'Extra life',
      'store.limitLives': 'Limit 3 lives per store session',
      'store.itemShield': 'Shield bit',
      'store.limitShields': 'Limit 5 shieldbits per store session',
      'store.itemBurst': 'Anti-aircraft burst',
      'store.limitBursts': 'Limit 3 bursts per store session',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Game Over',
      'gameover.finalScore': 'Final score:',
      'gameover.reachedLevel': 'Reached level:',
      'gameover.continue': 'Continue',

      // Runtime announcements
      'ann.towerBelow': 'Tower below',
      'ann.burstGained': 'Burst gained',
      'ann.rapidFire': 'Aerial rapid fire',
      'ann.bombArea': 'Bomb area increase',
      'ann.singleShield': 'Single shieldbit',
      'ann.doubleShield': 'Double shieldbit',
      'ann.beamVelocity': 'Beam velocity increase',
      'ann.powerupEnded': 'Powerup ended',
      'ann.gameOver': 'Game over',
      'ann.livesLeft': 'Lives left: {n}',
      'ann.level': 'Level {n}',
      'ann.motherDefeated': 'Mothership defeated - entering store',
      'ann.enteringStore': 'Entering store',
      'ann.motherDetected': 'Mothership detected',
      'ann.towerDestroyed': 'Tower destroyed - checkpoint set',
    },

    es: {
      'doc.title': 'Villanos del Más Allá',

      'splash.author': 'Shooter de scroll centrado en el audio',
      'splash.instruction': 'Pulsa Enter o haz clic para empezar',

      'menu.aria': 'Menú principal',
      'menu.title': 'Villanos del Más Allá',
      'menu.instructions': 'Usa las flechas para navegar, Enter para confirmar. Escape para salir.',
      'menu.start': 'Empezar partida',
      'menu.howto': 'Cómo se juega',
      'menu.quit': 'Salir',
      'menu.language': 'Idioma',

      'howto.title': 'Cómo se juega',
      'howto.intro': 'Pilotas la <strong>Solvalou</strong>, una nave que avanza sin parar. Los enemigos aéreos se destruyen con el <strong>rayo zapper</strong>. Los objetivos en tierra se destruyen con <strong>bombas</strong>. Cada tres niveles te enfrentas a una nave nodriza Genesis. La partida es infinita: intenta llegar lo más lejos posible.',
      'howto.combatHeader': 'Teclas de combate',
      'howto.combatZ': '<kbd>Z</kbd> — Disparar rayo zapper (mantén para disparo continuo)',
      'howto.combatX': '<kbd>X</kbd> — Soltar bomba (mantén para soltar de forma continua)',
      'howto.combatC': '<kbd>C</kbd> — Ráfaga antiaérea (elimina todos los enemigos aéreos; existencias limitadas)',
      'howto.combatA': '<kbd>A</kbd> — Gasta 3 escudos para un rayo destructor instantáneo',
      'howto.moveHeader': 'Movimiento',
      'howto.moveLR': '<kbd>←</kbd> / <kbd>→</kbd> — Lateral izquierda / derecha (posición 0–10)',
      'howto.moveUp': '<kbd>↑</kbd> — Acelerar (más rápido)',
      'howto.moveDown': '<kbd>↓</kbd> — Frenar',
      'howto.flowHeader': 'Flujo de partida',
      'howto.flowSpace': '<kbd>Espacio</kbd> — Pedir tienda al fin del nivel (nivel 4+, cuesta 15 créditos)',
      'howto.flowP': '<kbd>P</kbd> — Pausar / reanudar',
      'howto.flowEsc': '<kbd>Esc</kbd> — Abandonar la partida y volver al menú',
      'howto.flowQ': '<kbd>Q</kbd> — Rendición inmediata (game over)',
      'howto.statusHeader': 'Anuncios de estado (lector de pantalla)',
      'howto.statusS': '<kbd>S</kbd> — Lee la puntuación',
      'howto.statusL': '<kbd>L</kbd> — Lee las vidas restantes',
      'howto.statusE': '<kbd>E</kbd> — Lee el nivel actual',
      'howto.statusB': '<kbd>B</kbd> — Lee las ráfagas restantes',
      'howto.statusD': '<kbd>D</kbd> — Lee los escudos restantes',
      'howto.statusM': '<kbd>M</kbd> — Lee los créditos',
      'howto.statusV': '<kbd>V</kbd> — Lee el progreso del nivel (porcentaje recorrido)',
      'howto.scoringHeader': 'Puntuación y progresión',
      'howto.score1': 'Enemigos aéreos: más puntos cuanto más lejos los derribes.',
      'howto.score2': 'Combo: encadena bajas en 1,5 segundos para puntos y créditos extra.',
      'howto.score3': 'Esquivar disparos enemigos da una bonificación pequeña.',
      'howto.score4': 'Vidas extra: a los 20.000 puntos, luego 60.000, 120.000, …',
      'howto.score5': 'Torres (cuando oigas la alarma, lanza una bomba ya): destruirla fija un punto de control y da muchos puntos.',
      'howto.score6': 'Objetos (de naves escorpión): disparo rápido, área de bomba, ráfaga AA, velocidad de rayo, escudos.',
      'howto.score7': 'Nave nodriza Genesis (cada 3 niveles): no la sobrepases — su campo de fuerza te mata y borra tus escudos.',
      'howto.storeHeader': 'Tienda (tras cada Genesis o bajo petición)',
      'howto.store1': 'Mejoras permanentes de cadencia, velocidad del rayo, área de bomba y duración de mejoras.',
      'howto.store2': 'Límites por sesión: hasta 3 vidas, 5 escudos, 3 ráfagas.',
      'howto.tip': 'Usa auriculares para una mejor posición estéreo de enemigos y objetos.',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',

      'game.aria': 'Juego',
      'game.level': 'Nivel',
      'game.score': 'Puntos',
      'game.lives': 'Vidas',
      'game.shields': 'Escudos',
      'game.bursts': 'Ráfagas',
      'game.credits': 'Créditos',
      'game.progress': 'Progreso',
      'game.speed': 'Velocidad',
      'game.position': 'Posición',
      'game.paused': 'En pausa. Pulsa P para reanudar.',

      'store.aria': 'Tienda de mejoras',
      'store.title': 'Tienda de mejoras',
      'store.creditsAvailable': 'Créditos disponibles:',
      'store.instructions': 'Usa las flechas para elegir una mejora. Enter para comprar. Escape para salir.',
      'store.itemTpl': '{label} - {cost} créditos',
      'store.notEnough': 'No tienes créditos suficientes.',
      'store.purchased': 'Comprado: {label}',
      'store.upgradePowerup': 'Tiempo de mejora +3s (ahora {sec}s)',
      'store.upgradeZap': 'Cadencia del zapper +25ms (ahora {ms}ms)',
      'store.upgradeBeam': 'Velocidad del rayo (ahora {value})',
      'store.upgradeBomb': 'Alcance de bomba +1 (ahora {value})',
      'store.itemLife': 'Vida extra',
      'store.limitLives': 'Límite de 3 vidas por sesión de tienda',
      'store.itemShield': 'Escudo',
      'store.limitShields': 'Límite de 5 escudos por sesión de tienda',
      'store.itemBurst': 'Ráfaga antiaérea',
      'store.limitBursts': 'Límite de 3 ráfagas por sesión de tienda',

      'gameover.aria': 'Fin del juego',
      'gameover.title': 'Fin del juego',
      'gameover.finalScore': 'Puntuación final:',
      'gameover.reachedLevel': 'Nivel alcanzado:',
      'gameover.continue': 'Continuar',

      'ann.towerBelow': 'Torre debajo',
      'ann.burstGained': 'Ráfaga obtenida',
      'ann.rapidFire': 'Disparo rápido aéreo',
      'ann.bombArea': 'Aumento de área de bomba',
      'ann.singleShield': 'Un escudo',
      'ann.doubleShield': 'Doble escudo',
      'ann.beamVelocity': 'Aumento de velocidad del rayo',
      'ann.powerupEnded': 'Mejora terminada',
      'ann.gameOver': 'Fin del juego',
      'ann.livesLeft': 'Vidas restantes: {n}',
      'ann.level': 'Nivel {n}',
      'ann.motherDefeated': 'Nave nodriza derrotada - entrando en la tienda',
      'ann.enteringStore': 'Entrando en la tienda',
      'ann.motherDetected': 'Nave nodriza detectada',
      'ann.towerDestroyed': 'Torre destruida - punto de control fijado',
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
