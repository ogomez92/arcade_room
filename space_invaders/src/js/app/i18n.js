/**
 * Lightweight i18n for accessible audio games.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
 * 2-letter prefix → fallback ('en').
 *
 * Per-locale phrase pools (announcer flavor) are AUTHORED INDEPENDENTLY
 * for each language — never translate them. Each pool is shaped for the
 * language's idiomatic feel; English leans clipped/military, Spanish
 * leans dramatic/cinematic.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'si.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  // Independent flavor pools per locale. Picked at random when announced.
  const FLAVOR = {
    en: {
      perfectChain: [
        'Perfect chain!',
        'Clean run!',
        'Spotless!',
      ],
      goodKill: [
        'Splash one!',
        'Direct hit!',
        'Target down!',
        'Tagged!',
      ],
      bounce: [
        'Bounced off!',
        'No effect!',
        'Wrong weapon!',
      ],
      lowEnergy: [
        'Energy critical!',
        'Shields buckling!',
        'Reactor red!',
      ],
      civilianDown: [
        'Civilian down!',
        'Friendly hit!',
        'You shot a freighter!',
      ],
      breach: [
        'Hull breached!',
        'They got through!',
        'Direct strike!',
      ],
    },
    es: {
      perfectChain: [
        '¡Cadena perfecta!',
        '¡Limpio!',
        '¡Bordado!',
      ],
      goodKill: [
        '¡Abatido!',
        '¡Directo!',
        '¡Cae uno!',
        '¡Marcado!',
      ],
      bounce: [
        '¡Rebotó!',
        '¡No le hace nada!',
        '¡Arma equivocada!',
      ],
      lowEnergy: [
        '¡Energía crítica!',
        '¡Escudos al rojo!',
        '¡Reactor en rojo!',
      ],
      civilianDown: [
        '¡Civil abatido!',
        '¡Diste a un carguero!',
        '¡Fuego amigo!',
      ],
      breach: [
        '¡Casco perforado!',
        '¡Pasaron!',
        '¡Impacto directo!',
      ],
    },
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Space Invaders!',

      // Splash
      'splash.author': 'an audio-first arcade by Oriol Gómez',
      'splash.instruction': 'Press any key to begin',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Space Invaders!',
      'menu.subtitle': 'Hold the line. Identify the ship by ear; pick the matching weapon; fire on the centred target.',
      'menu.start': 'Start Run',
      'menu.learn': 'Learn Sounds',
      'menu.highscores': 'High Scores',
      'menu.help': 'How to Play',
      'menu.quit': 'Quit',

      // Game HUD
      'game.aria': 'Gunner station',
      'game.statusScore': 'Score: {score}',
      'game.statusWave': 'Wave: {wave}',
      'game.statusLives': 'Lives: {lives}',
      'game.statusEnergy': 'Energy: {energy}%',
      'game.statusWeapon': 'Weapon: {weapon}',
      'game.statusChain': 'Chain ×{mult}',
      'game.statusChainNone': 'Chain reset',
      'game.paused': 'Paused',
      'game.weaponPulse': 'Pulse',
      'game.weaponBeam': 'Beam',
      'game.weaponMissile': 'Missile',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.menu': 'Main Menu',

      // Help screen
      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.controls': 'Controls',
      'help.controlAim': '<kbd>Left</kbd> / <kbd>Right</kbd> (or <kbd>A</kbd>/<kbd>D</kbd>) — pan the crosshair across the stereo field.',
      'help.controlFire': '<kbd>Space</kbd> — fire the current weapon.',
      'help.controlWeapon': '<kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> — switch to Pulse / Beam / Missile (once unlocked). <kbd>Q</kbd> / <kbd>E</kbd> cycle weapons.',
      'help.controlPause': '<kbd>Esc</kbd> — pause and return to menu.',
      'help.statusHotkeys': 'Status Hotkeys',
      'help.statusF1': '<kbd>F1</kbd> — current score.',
      'help.statusF2': '<kbd>F2</kbd> — lives remaining.',
      'help.statusF3': '<kbd>F3</kbd> — energy and current wave.',
      'help.statusF4': '<kbd>F4</kbd> — class of the next chain-tagged ship.',
      'help.objective': 'How it works',
      'help.objectiveBody': 'You are fixed at the centre of the stereo field. Ships approach from off-screen — you hear them long before they get close. Identify the ship by ear, pick the matching weapon, pan the crosshair onto its position, and fire. A bounce <strong>thud</strong> means you picked the wrong weapon.',
      'help.matchupTitle': 'Weapon vs Ship',
      'help.matchupPulse': '<strong>Pulse</strong> — beats Scouts (bright, fast tick-tick). Half damage on Bombers. Bounces off Battleships.',
      'help.matchupBeam': '<strong>Beam</strong> — beats Bombers (low rumble + bell). Half damage on Battleships. Bounces off Scouts.',
      'help.matchupMissile': '<strong>Missile</strong> — beats Battleships (heavy detuned drone). Half damage on Scouts. Bounces off Bombers.',
      'help.civiliansTitle': 'Civilians',
      'help.civiliansBody': 'From wave 4, civilian freighters join the field. They sound <strong>harmonic</strong> — a soft major-third dyad on triangle. Shooting one costs −500 points and a life, and breaks any active chain.',
      'help.energyTitle': 'Energy + Shields',
      'help.energyBody': 'A single 0–100 meter feeds your shots and your shields. Spray and you will run dry; hold trigger discipline and energy regenerates after 0.4 seconds of silence. A low-energy siren wails when you drop below 30% and clears past 50%.',
      'help.shieldsBody': '<strong>Shields are automatic — there is no key to press.</strong> Every hostile that reaches you spends 25 energy first; you hear a metallic ring and the announcer says "Shield held." If energy is below 25 when one reaches you, you lose a life instead, energy resets to 50, and you hear the heavy breach impact.',
      'help.chainTitle': 'Chain Combo',
      'help.chainBody': 'From wave 5, five ships per wave are tagged with the famous <strong>Close Encounters of the Third Kind</strong> 5-note motif — re, mi, do, do (low), sol. Kill them in that order for a ×1 → ×5 score multiplier. Out-of-order kill, civilian hit, or letting a tagged ship reach you — chain breaks. Clear a wave with chain unbroken for a perfect-chain bonus.',
      'help.back': 'Back',

      // Learn screen
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn Sounds',
      'learn.subtitle': 'Press a button to hear each cue on its own.',
      'learn.scout': 'Scout (use Pulse)',
      'learn.bomber': 'Bomber (use Beam)',
      'learn.battleship': 'Battleship (use Missile)',
      'learn.civilian': 'Civilian (do NOT shoot)',
      'learn.weaponPulse': 'Weapon — Pulse',
      'learn.weaponBeam': 'Weapon — Beam',
      'learn.weaponMissile': 'Weapon — Missile',
      'learn.hit': 'Shot — hit',
      'learn.miss': 'Shot — miss',
      'learn.bounce': 'Wrong-class bounce',
      'learn.lowEnergy': 'Low-energy siren',
      'learn.shieldRefill': 'Shield refill',
      'learn.shieldHit': 'Shield held (hit absorbed)',
      'learn.breach': 'Hull breach (life lost)',
      'learn.kill': 'Ship explosion (kill)',
      'learn.extraLife': 'Extra life',
      'learn.waveStart': 'Wave start sting',
      'learn.waveClear': 'Wave clear sting',
      'learn.aim': 'Aim crosshair tone (your position)',
      'learn.chain1': 'Chain tag 1 (re)',
      'learn.chain2': 'Chain tag 2 (mi)',
      'learn.chain3': 'Chain tag 3 (do)',
      'learn.chain4': 'Chain tag 4 (do, low)',
      'learn.chain5': 'Chain tag 5 (sol)',
      'learn.urgency': 'Approach urgency (close)',
      'learn.back': 'Back',

      // Test screen (#test diagnostic)
      'test.aria': 'Audio orientation test',
      'test.title': 'Audio Test',
      'test.subtitle': 'A tick plays hard left, then centre, then hard right.',
      'test.left': 'Hard left',
      'test.centre': 'Centre',
      'test.right': 'Hard right',
      'test.run': 'Run sequence',
      'test.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High Scores',
      'highscores.empty': 'No runs yet.',
      'highscores.back': 'Back',
      'highscores.entry': '{rank}. {name} — {score} (wave {wave})',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Hull lost',
      'gameover.score': 'Final score: {score}',
      'gameover.wave': 'Reached wave: {wave}',
      'gameover.kills': 'Ships down: {kills}',
      'gameover.bestChain': 'Best chain: ×{mult}',
      'gameover.namePrompt': 'Enter your name (3 letters works great):',
      'gameover.save': 'Save',
      'gameover.restart': 'Try Again',
      'gameover.menu': 'Main Menu',

      // Announcer
      'ann.score': 'Score {score}',
      'ann.lives': '{lives} lives remaining',
      'ann.energy': 'Energy {energy} percent, wave {wave}',
      'ann.nextChain': 'Next chain ship is {label}',
      'ann.nextChainNone': 'No chain ship currently tagged',
      'ann.waveStart': 'Wave {wave}',
      'ann.waveClear': 'Wave clear, plus {bonus} points',
      'ann.waveSurvived': '{ships} ships through — wave survived, no bonus',
      'ann.perfectChain': 'Perfect chain bonus, plus {bonus}',
      'ann.weaponSwitch': '{weapon}',
      'ann.civilianTutorial': 'Civilians inbound. Listen for the soft major-third dyad — do not shoot them.',
      'ann.chainTutorial': 'Chain tags now active. Kill ships in pitch order for combo.',
      'ann.bomberTutorial': 'Bombers inbound — low rumble with a bell strike. Press 2 for the Beam.',
      'ann.battleshipTutorial': 'Battleships inbound — heavy detuned drone. Press 3 for the Missile.',
      'ann.weaponUnlocked': '{weapon} unlocked',
      'ann.weaponLocked': '{weapon} not yet unlocked',
      'ann.bounceHint': 'Bounced off {kind} — use {weapon}',
      'ann.bouncePartial': 'Glancing hit on {kind} — {weapon} is stronger',
      'ann.shieldHeld': 'Shield held — {energy} percent energy',
      'ann.energyTick': 'Energy {percent} percent',
      'ann.energyCritical': 'Energy critical',
      'ann.energyRecovered': 'Energy recovered',
      'ann.chainAdvance': 'Chain times {mult}',
      'ann.chainBroken': 'Chain broken',
      'ann.aimEdgeLeft': 'Aim at left edge',
      'ann.aimEdgeRight': 'Aim at right edge',
      'ann.aimCentre': 'Aim centred',

      // Bare class names (clean, no parentheticals — for announcements)
      'class.scout': 'Scout',
      'class.bomber': 'Bomber',
      'class.battleship': 'Battleship',
      'class.civilian': 'Civilian',
      'ann.gameOver': 'Hull lost. End of run.',
      'ann.paused': 'Paused',
      'ann.resumed': 'Resuming',
      'ann.lostLife': 'Hit. {lives} remaining.',
      'ann.extraLife': 'Extra life',
    },

    es: {
      // <head>
      'doc.title': '¡Invasores!',

      // Splash
      'splash.author': 'arcade audio-first de Oriol Gómez',
      'splash.instruction': 'Pulsa cualquier tecla para empezar',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': '¡Invasores!',
      'menu.subtitle': 'Aguanta la línea. Identifica la nave por el oído, elige el arma adecuada y dispara cuando esté centrada.',
      'menu.start': 'Empezar partida',
      'menu.learn': 'Aprender sonidos',
      'menu.highscores': 'Mejores marcas',
      'menu.help': 'Cómo se juega',
      'menu.quit': 'Salir',

      // Game HUD
      'game.aria': 'Puesto de tirador',
      'game.statusScore': 'Puntos: {score}',
      'game.statusWave': 'Oleada: {wave}',
      'game.statusLives': 'Vidas: {lives}',
      'game.statusEnergy': 'Energía: {energy}%',
      'game.statusWeapon': 'Arma: {weapon}',
      'game.statusChain': 'Cadena ×{mult}',
      'game.statusChainNone': 'Cadena rota',
      'game.paused': 'En pausa',
      'game.weaponPulse': 'Pulso',
      'game.weaponBeam': 'Rayo',
      'game.weaponMissile': 'Misil',

      // Pause
      'pause.aria': 'En pausa',
      'pause.title': 'En pausa',
      'pause.resume': 'Continuar',
      'pause.menu': 'Menú principal',

      // Help screen
      'help.aria': 'Cómo se juega',
      'help.title': 'Cómo se juega',
      'help.controls': 'Controles',
      'help.controlAim': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> (o <kbd>A</kbd>/<kbd>D</kbd>) — mueve la mira por el campo estéreo.',
      'help.controlFire': '<kbd>Espacio</kbd> — disparar el arma seleccionada.',
      'help.controlWeapon': '<kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> — cambia a Pulso / Rayo / Misil (cuando los desbloqueas). <kbd>Q</kbd> / <kbd>E</kbd> alternan armas.',
      'help.controlPause': '<kbd>Esc</kbd> — pausa y vuelta al menú.',
      'help.statusHotkeys': 'Teclas de información',
      'help.statusF1': '<kbd>F1</kbd> — puntuación actual.',
      'help.statusF2': '<kbd>F2</kbd> — vidas restantes.',
      'help.statusF3': '<kbd>F3</kbd> — energía y oleada actual.',
      'help.statusF4': '<kbd>F4</kbd> — clase de la siguiente nave de cadena.',
      'help.objective': 'Cómo funciona',
      'help.objectiveBody': 'Estás fijo en el centro del campo estéreo. Las naves vienen de fuera de pantalla — las oyes mucho antes de que lleguen cerca. Identifica la nave por el oído, elige el arma adecuada, mueve la mira hasta su posición y dispara. Un <strong>golpe seco</strong> de rebote significa que has elegido mal el arma.',
      'help.matchupTitle': 'Arma frente a nave',
      'help.matchupPulse': '<strong>Pulso</strong> — gana a los Cazas (tic-tic brillante y rápido). Daño a la mitad contra Bombarderos. Rebota en los Acorazados.',
      'help.matchupBeam': '<strong>Rayo</strong> — gana a los Bombarderos (retumbo grave y campana). Daño a la mitad contra Acorazados. Rebota en los Cazas.',
      'help.matchupMissile': '<strong>Misil</strong> — gana a los Acorazados (zumbido pesado y desafinado). Daño a la mitad contra Cazas. Rebota en los Bombarderos.',
      'help.civiliansTitle': 'Civiles',
      'help.civiliansBody': 'A partir de la oleada 4 entran cargueros civiles. Suenan <strong>armónicos</strong> — una tercera mayor suave en triángulo. Dispararles cuesta −500 puntos y una vida, y rompe cualquier cadena activa.',
      'help.energyTitle': 'Energía + escudos',
      'help.energyBody': 'Un único medidor de 0 a 100 alimenta tus disparos y tus escudos. Si rocías, te quedas seco; si disparas con cabeza, la energía se regenera tras 0,4 segundos en silencio. Una sirena de emergencia avisa por debajo del 30% y desaparece al superar el 50%.',
      'help.shieldsBody': '<strong>Los escudos son automáticos — no hay tecla que pulsar.</strong> Cada nave hostil que te alcanza gasta 25 puntos de energía; oyes un timbre metálico y el anunciador dice «Escudo aguanta». Si la energía está por debajo de 25 cuando llega una nave, pierdes una vida, la energía se reinicia a 50 y oyes el impacto pesado del casco.',
      'help.chainTitle': 'Cadena de combo',
      'help.chainBody': 'A partir de la oleada 5, cinco naves por oleada llevan el famoso motivo de 5 notas de <strong>Encuentros en la Tercera Fase</strong> — re, mi, do, do (grave), sol. Mátalas en ese orden para un multiplicador ×1 → ×5. Matar fuera de orden, alcanzar a un civil o dejar pasar una nave de cadena rompe el combo. Limpia la oleada sin romper la cadena para un bonus de cadena perfecta.',
      'help.back': 'Atrás',

      // Learn screen
      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprender sonidos',
      'learn.subtitle': 'Pulsa cada botón para oír el sonido aislado.',
      'learn.scout': 'Caza (usa Pulso)',
      'learn.bomber': 'Bombardero (usa Rayo)',
      'learn.battleship': 'Acorazado (usa Misil)',
      'learn.civilian': 'Civil (NO disparar)',
      'learn.weaponPulse': 'Arma — Pulso',
      'learn.weaponBeam': 'Arma — Rayo',
      'learn.weaponMissile': 'Arma — Misil',
      'learn.hit': 'Disparo — impacto',
      'learn.miss': 'Disparo — fallo',
      'learn.bounce': 'Rebote (arma equivocada)',
      'learn.lowEnergy': 'Sirena de energía baja',
      'learn.shieldRefill': 'Recarga de escudo',
      'learn.shieldHit': 'Escudo aguanta (impacto absorbido)',
      'learn.breach': 'Casco perforado (vida perdida)',
      'learn.kill': 'Explosión de nave (abatida)',
      'learn.extraLife': 'Vida extra',
      'learn.waveStart': 'Inicio de oleada',
      'learn.waveClear': 'Oleada limpia',
      'learn.aim': 'Tono de mira (tu posición)',
      'learn.chain1': 'Etiqueta cadena 1 (re)',
      'learn.chain2': 'Etiqueta cadena 2 (mi)',
      'learn.chain3': 'Etiqueta cadena 3 (do)',
      'learn.chain4': 'Etiqueta cadena 4 (do, grave)',
      'learn.chain5': 'Etiqueta cadena 5 (sol)',
      'learn.urgency': 'Urgencia de aproximación (cerca)',
      'learn.back': 'Atrás',

      // Test screen
      'test.aria': 'Prueba de orientación de audio',
      'test.title': 'Prueba de audio',
      'test.subtitle': 'Suena un tic a la izquierda, después al centro, después a la derecha.',
      'test.left': 'Izquierda',
      'test.centre': 'Centro',
      'test.right': 'Derecha',
      'test.run': 'Ejecutar secuencia',
      'test.back': 'Atrás',

      // High scores
      'highscores.aria': 'Mejores marcas',
      'highscores.title': 'Mejores marcas',
      'highscores.empty': 'Aún no hay partidas.',
      'highscores.back': 'Atrás',
      'highscores.entry': '{rank}. {name} — {score} (oleada {wave})',

      // Game over
      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Casco perdido',
      'gameover.score': 'Puntuación final: {score}',
      'gameover.wave': 'Oleada alcanzada: {wave}',
      'gameover.kills': 'Naves abatidas: {kills}',
      'gameover.bestChain': 'Mejor cadena: ×{mult}',
      'gameover.namePrompt': 'Pon tu nombre (con 3 letras va bien):',
      'gameover.save': 'Guardar',
      'gameover.restart': 'Otra vez',
      'gameover.menu': 'Menú principal',

      // Announcer
      'ann.score': 'Puntos {score}',
      'ann.lives': '{lives} vidas restantes',
      'ann.energy': 'Energía {energy} por ciento, oleada {wave}',
      'ann.nextChain': 'Próxima nave de cadena: {label}',
      'ann.nextChainNone': 'Sin nave de cadena marcada',
      'ann.waveStart': 'Oleada {wave}',
      'ann.waveClear': 'Oleada limpia, más {bonus} puntos',
      'ann.waveSurvived': '{ships} naves pasaron — oleada superada, sin bonus',
      'ann.perfectChain': 'Cadena perfecta, más {bonus}',
      'ann.weaponSwitch': '{weapon}',
      'ann.civilianTutorial': 'Llegan civiles. Escucha la tercera mayor suave — no les dispares.',
      'ann.chainTutorial': 'Etiquetas de cadena activas. Mata las naves en orden de tono para combinar.',
      'ann.bomberTutorial': 'Llegan Bombarderos — retumbo grave y campana. Pulsa 2 para el Rayo.',
      'ann.battleshipTutorial': 'Llegan Acorazados — zumbido pesado y desafinado. Pulsa 3 para el Misil.',
      'ann.weaponUnlocked': '{weapon} desbloqueado',
      'ann.weaponLocked': '{weapon} aún no desbloqueado',
      'ann.bounceHint': 'Rebotó en {kind} — usa {weapon}',
      'ann.bouncePartial': 'Golpe leve a {kind} — {weapon} es más eficaz',
      'ann.shieldHeld': 'Escudo aguanta — {energy} por ciento de energía',
      'ann.energyTick': 'Energía {percent} por ciento',
      'ann.energyCritical': '¡Energía crítica!',
      'ann.energyRecovered': 'Energía recuperada',
      'ann.chainAdvance': 'Cadena por {mult}',
      'ann.chainBroken': 'Cadena rota',
      'ann.aimEdgeLeft': 'Mira al borde izquierdo',
      'ann.aimEdgeRight': 'Mira al borde derecho',
      'ann.aimCentre': 'Mira al centro',

      // Nombres de clase sin paréntesis (para anuncios)
      'class.scout': 'Caza',
      'class.bomber': 'Bombardero',
      'class.battleship': 'Acorazado',
      'class.civilian': 'Civil',
      'ann.gameOver': 'Casco perdido. Fin de la partida.',
      'ann.paused': 'En pausa',
      'ann.resumed': 'Reanudando',
      'ann.lostLife': 'Impacto. {lives} restantes.',
      'ann.extraLife': 'Vida extra',
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

  function flavor(category) {
    const pool = (FLAVOR[current] && FLAVOR[current][category])
      || (FLAVOR[FALLBACK] && FLAVOR[FALLBACK][category])
      || []
    if (!pool.length) return ''
    return pool[Math.floor(Math.random() * pool.length)]
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
    flavor,
  }
})()
