/**
 * Lightweight i18n for accessible audio games. See bumper/template for the
 * canonical implementation; only the STORAGE_KEY and dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'combat.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Mech Duel',

      'splash.author': 'Accessible audio combat',
      'splash.instruction': 'Press Enter or click to begin',
      'splash.welcome': 'Welcome to Mech Duel. Press Enter or click anywhere to begin.',

      'menu.aria': 'Main menu',
      'menu.title': 'Mech Duel — Main Menu',
      'menu.instructions': 'Use arrow keys or Tab to navigate, Enter to select.',
      'menu.playAi': 'Play vs computer',
      'menu.host': 'Host an online duel',
      'menu.join': 'Join an online duel',
      'menu.learn': 'Learn game sounds',
      'menu.manual': 'How to play',
      'menu.language': 'Language',
      'menu.welcome': 'Main menu. Play versus computer, host or join an online duel, learn game sounds, or read how to play.',
      'menu.helpRead': 'How to play: Up and down arrows change speed. Left and right arrows turn. Shift plus left or right snaps to a cardinal direction. Space jumps or activates jetpack. F is primary weapon, R is secondary. Shift plus F or R switches sonar target. H reports your status, Q reports the opponent. Escape pauses. Use Tab and Enter to navigate menus.',

      'mech.aria': 'Choose a mech',
      'mech.title': 'Choose your mech',
      'mech.subtitle': 'Use left and right arrows to cycle mechs, up and down arrows or Tab to move between sections, Enter to select. Press P to preview the engine sound. Press Escape to go back.',
      'mech.prev': 'Previous mech',
      'mech.preview': 'Preview engine',
      'mech.next': 'Next mech',
      'mech.confirm': 'Confirm this mech',
      'mech.back': 'Back',
      'mech.welcome': 'Choose your mech. {first}. Press next or previous to browse, confirm to select, or preview to hear the engine.',
      'mech.selected': '{name} selected.',
      'mech.describe': '{name}. {description}',
      'mech.stat.health': 'Health',
      'mech.stat.topSpeed': 'Top speed',
      'mech.stat.turnRate': 'Turn rate',
      'mech.stat.size': 'Size',
      'mech.stat.mobility': 'Mobility',
      'mech.stat.primary': 'Primary',
      'mech.stat.secondary': 'Secondary',
      'mech.stat.unit.metersPerSecond': 'm/s',
      'mech.stat.unit.radPerSecond': 'rad/s',
      'mech.stat.unit.meters': 'm',
      'mech.mobility.jetpack': 'Jetpack',
      'mech.mobility.jump': 'Jump',
      'mech.mobility.ground': 'Ground',
      'mech.scout.name': 'Scout',
      'mech.scout.description': 'Lightweight recon mech. Very fast and nimble, low health. Machine gun and homing missile. Has a jetpack.',
      'mech.striker.name': 'Striker',
      'mech.striker.description': 'Balanced assault mech. Reliable pistol and brutal melee strike. Can jump.',
      'mech.juggernaut.name': 'Juggernaut',
      'mech.juggernaut.description': 'Heavy tank mech. Slow but very tough. Rail cannon and shotgun. Cannot jump.',
      'mech.phantom.name': 'Phantom',
      'mech.phantom.description': 'Infiltrator mech. Medium speed with a disruptor beam and homing missile. Has a jetpack.',
      'mech.brawler.name': 'Brawler',
      'mech.brawler.description': 'Close-combat specialist. Melee strike and ram boost. Jumps high.',
      'weapon.pistol.name': 'Pistol',
      'weapon.pistol.description': 'Straight shot, moderate damage, short cooldown.',
      'weapon.machinegun.name': 'Machine gun',
      'weapon.machinegun.description': 'Rapid fire, low damage per bullet, can hold to fire.',
      'weapon.shotgun.name': 'Shotgun',
      'weapon.shotgun.description': 'Spread of pellets, strong up close.',
      'weapon.rail.name': 'Rail cannon',
      'weapon.rail.description': 'Huge single slug, very long cooldown.',
      'weapon.homing.name': 'Homing missile',
      'weapon.homing.description': 'Slow missile that tracks the enemy. Long reload.',
      'weapon.disruptor.name': 'Disruptor beam',
      'weapon.disruptor.description': 'Short-range beam that stuns the enemy engine briefly.',
      'weapon.melee.name': 'Melee strike',
      'weapon.melee.description': 'Powerful close-range hit with knockback.',
      'weapon.boost.name': 'Ram boost',
      'weapon.boost.description': 'Short burst of forward thrust. Great for ramming.',
      'dir.directlyAhead': 'directly ahead',
      'dir.directlyBehind': 'directly behind',
      'dir.frontLeft': 'to your front left',
      'dir.left': 'to your left',
      'dir.rearLeft': 'to your rear left',
      'dir.frontRight': 'to your front right',
      'dir.right': 'to your right',
      'dir.rearRight': 'to your rear right',

      'mp.aria': 'Online multiplayer',
      'mp.title': 'Online multiplayer',
      'mp.codePrompt': 'Your room code is:',
      'mp.copyCode': 'Copy room code',
      'mp.codeLabel': 'Enter room code:',
      'mp.connect': 'Connect',
      'mp.back': 'Back to menu',
      'mp.hostingCode': 'Room code is {code}. Waiting for opponent.',
      'mp.enterCode': 'Enter the room code your opponent gave you, then press Connect.',
      'mp.invalidCode': 'Please enter a valid room code.',
      'mp.codeCopied': 'Code copied to clipboard.',
      'mp.peerUnavailable': 'PeerJS library is not available. Online play requires an internet connection.',
      'mp.creatingRoom': 'Creating room...',
      'mp.roomReady': 'Room ready. Share the code with your opponent.',
      'mp.error': 'Error: {type}',
      'mp.connecting': 'Connecting...',
      'mp.connected': 'Connected.',
      'mp.disconnected': 'Disconnected.',
      'mp.connectionError': 'Connection error: {type}',
      'mp.opponentReady': 'Opponent ready. Choose a mech.',

      'learn.aria': 'Learn game sounds',
      'learn.title': 'Learn game sounds',
      'learn.subtitle': 'Select a sound cue to hear it. Use this menu to get familiar with the audio cues used during combat.',
      'learn.back': 'Back to menu',
      'learn.welcome': 'Learn game sounds. Select a sound to hear it. Each sound is played in front of you so you can practice locating it.',
      'learn.entry': '{name}. {description}',
      'learn.s.pistol.name': 'Pistol',
      'learn.s.pistol.desc': 'Quick descending tone. Fired by the Striker.',
      'learn.s.machinegun.name': 'Machine gun',
      'learn.s.machinegun.desc': 'Sharp rattling bursts. Fired by the Scout.',
      'learn.s.shotgun.name': 'Shotgun',
      'learn.s.shotgun.desc': 'Low roar of spread pellets. Fired by the Juggernaut.',
      'learn.s.rail.name': 'Rail cannon',
      'learn.s.rail.desc': 'Deep sweeping crack. Fired by the Juggernaut.',
      'learn.s.missile.name': 'Homing missile',
      'learn.s.missile.desc': 'Rising whoosh. Fired by Scout and Phantom.',
      'learn.s.disruptor.name': 'Disruptor beam',
      'learn.s.disruptor.desc': 'Warbling high tone. Fired by the Phantom. Stuns the engine.',
      'learn.s.disruptor_hit.name': 'Disruptor hit',
      'learn.s.disruptor_hit.desc': 'Falling shimmer. You cannot move for a moment.',
      'learn.s.melee.name': 'Melee strike',
      'learn.s.melee.desc': 'Low thudding swing. Fired by Striker and Brawler.',
      'learn.s.melee_hit.name': 'Melee impact',
      'learn.s.melee_hit.desc': 'Muffled thud when a melee lands.',
      'learn.s.boost.name': 'Ram boost',
      'learn.s.boost.desc': 'Rising roar. Used by the Brawler to charge forward.',
      'learn.s.impact.name': 'Projectile impact',
      'learn.s.impact.desc': 'Small burst when a bullet hits something.',
      'learn.s.explosion.name': 'Explosion',
      'learn.s.explosion.desc': 'Dull roar, for missile hits and ramming collisions.',
      'learn.s.wallHit.name': 'Wall crash',
      'learn.s.wallHit.desc': "You've driven into a wall. You take damage.",
      'learn.s.damage.name': 'Taking damage',
      'learn.s.damage.desc': 'Low buzz when you are hit.',
      'learn.s.jump.name': 'Jump / jetpack',
      'learn.s.jump.desc': 'Rising chirp for a jump or jetpack activation.',
      'learn.s.land.name': 'Landing',
      'learn.s.land.desc': 'Heavy thud when your mech lands.',
      'learn.s.step.name': 'Footstep',
      'learn.s.step.desc': 'Subtle thump when a legged mech walks.',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',

      'game.aria': 'Combat arena',
      'game.title': 'Mech Duel combat',
      'game.yourMech': 'Your mech:',
      'game.yourHealth': 'Your health:',
      'game.opponent': 'Opponent:',
      'game.opponentHealth': 'Opponent health:',
      'game.speed': 'Speed:',
      'game.heading': 'Heading:',
      'game.sonar': 'Sonar:',
      'game.help': 'Up and down arrows change speed. Left and right arrows turn. Shift plus left or right snaps to cardinal direction. Space jumps or activates jetpack. F fires primary weapon. R fires secondary. Shift plus F or R switches sonar mode. H announces your status. Q announces the opponent\'s distance and direction. Escape pauses.',

      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.welcome': 'Paused. Choose resume or quit to menu.',
      'pause.resume': 'Resume',
      'pause.quit': 'Quit to menu',

      'gameover.aria': 'Game over',
      'gameover.title': 'Game over',
      'gameover.titleWin': 'Victory!',
      'gameover.titleLose': 'Defeat.',
      'gameover.rematch': 'Rematch',
      'gameover.menu': 'Back to main menu',
      'gameover.win': 'Victory! You destroyed the opponent.',
      'gameover.lose': 'Defeat. Your mech has been destroyed.',
      'gameover.full': '{title}. {msg}',

      // Runtime announcements
      'ann.boost': 'Boost engaged',
      'ann.meleeHit': 'Melee landed! {damage} damage',
      'ann.meleeTaken': 'Melee strike! {damage} damage taken',
      'ann.collision': 'Collision! You took {you}, dealt {them}',
      'ann.combatStart': 'Combat start. You are piloting the {playerMech} against the {opponentMech}. Opponent is {distance} meters away. Close the distance carefully.',
      'ann.opponentStatus': 'Opponent {distance} meters {dir}. Opponent health {hp}.',
      'ann.selfStatus': 'Health {hp}. Speed {speed}. Heading {heading}.',
      'ann.sonarPrimary': 'Sonar switched to primary range',
      'ann.sonarSecondary': 'Sonar switched to secondary range',
      'ann.snapTo': 'Snapped to {name}',
      'ann.wallImpact': 'Wall impact, {damage} damage',
      'ann.youHit': 'Hit! {damage} damage taken',
      'ann.youDealt': 'You hit. {damage} damage',

      'sonar.primary': 'primary',
      'sonar.secondary': 'secondary',

      'dir.north': 'north',
      'dir.northEast': 'north-east',
      'dir.east': 'east',
      'dir.southEast': 'south-east',
      'dir.south': 'south',
      'dir.southWest': 'south-west',
      'dir.west': 'west',
      'dir.northWest': 'north-west',
    },

    es: {
      'doc.title': 'Mech Duel',

      'splash.author': 'Combate audio accesible',
      'splash.instruction': 'Pulsa Enter o haz clic para empezar',
      'splash.welcome': 'Bienvenido a Mech Duel. Pulsa Enter o haz clic en cualquier sitio para empezar.',

      'menu.aria': 'Menú principal',
      'menu.title': 'Mech Duel — Menú principal',
      'menu.instructions': 'Usa las flechas o Tab para navegar, Enter para elegir.',
      'menu.playAi': 'Jugar contra el ordenador',
      'menu.host': 'Crear duelo en línea',
      'menu.join': 'Unirse a un duelo en línea',
      'menu.learn': 'Aprende los sonidos',
      'menu.manual': 'Cómo se juega',
      'menu.language': 'Idioma',
      'menu.welcome': 'Menú principal. Juega contra el ordenador, crea o únete a un duelo en línea, aprende los sonidos del juego o lee cómo se juega.',
      'menu.helpRead': 'Cómo se juega: Flechas arriba y abajo cambian la velocidad. Izquierda y derecha giran. Mayúsculas + izquierda o derecha alinean a un punto cardinal. Espacio salta o activa el jetpack. F es arma primaria, R secundaria. Mayúsculas + F o R cambia el objetivo del sónar. H informa de tu estado, Q del rival. Escape pausa. Usa Tab y Enter para navegar los menús.',

      'mech.aria': 'Elige un mech',
      'mech.title': 'Elige tu mech',
      'mech.subtitle': 'Usa flechas izquierda y derecha para cambiar de mech, arriba/abajo o Tab para moverte entre secciones, Enter para elegir. Pulsa P para previsualizar el motor. Pulsa Escape para volver.',
      'mech.prev': 'Mech anterior',
      'mech.preview': 'Previsualizar motor',
      'mech.next': 'Mech siguiente',
      'mech.confirm': 'Elegir este mech',
      'mech.back': 'Atrás',
      'mech.welcome': 'Elige tu mech. {first}. Pulsa siguiente o anterior para hojear, confirmar para elegir, o previsualizar para oír el motor.',
      'mech.selected': '{name} seleccionado.',
      'mech.describe': '{name}. {description}',
      'mech.stat.health': 'Vida',
      'mech.stat.topSpeed': 'Velocidad máxima',
      'mech.stat.turnRate': 'Giro',
      'mech.stat.size': 'Tamaño',
      'mech.stat.mobility': 'Movilidad',
      'mech.stat.primary': 'Primaria',
      'mech.stat.secondary': 'Secundaria',
      'mech.stat.unit.metersPerSecond': 'm/s',
      'mech.stat.unit.radPerSecond': 'rad/s',
      'mech.stat.unit.meters': 'm',
      'mech.mobility.jetpack': 'Jetpack',
      'mech.mobility.jump': 'Salto',
      'mech.mobility.ground': 'Suelo',
      'mech.scout.name': 'Scout',
      'mech.scout.description': 'Mech ligero de reconocimiento. Muy rápido y ágil, poca vida. Ametralladora y misil teledirigido. Tiene jetpack.',
      'mech.striker.name': 'Striker',
      'mech.striker.description': 'Mech de asalto equilibrado. Pistola fiable y golpe cuerpo a cuerpo brutal. Puede saltar.',
      'mech.juggernaut.name': 'Juggernaut',
      'mech.juggernaut.description': 'Mech tanque pesado. Lento pero muy resistente. Cañón de raíl y escopeta. No puede saltar.',
      'mech.phantom.name': 'Phantom',
      'mech.phantom.description': 'Mech infiltrador. Velocidad media con rayo disruptor y misil teledirigido. Tiene jetpack.',
      'mech.brawler.name': 'Brawler',
      'mech.brawler.description': 'Especialista en cuerpo a cuerpo. Golpe melee y embestida. Salta alto.',
      'weapon.pistol.name': 'Pistola',
      'weapon.pistol.description': 'Disparo recto, daño moderado, recarga corta.',
      'weapon.machinegun.name': 'Ametralladora',
      'weapon.machinegun.description': 'Disparo rápido, poco daño por bala, fuego mantenido.',
      'weapon.shotgun.name': 'Escopeta',
      'weapon.shotgun.description': 'Dispersión de perdigones, fuerte de cerca.',
      'weapon.rail.name': 'Cañón de raíl',
      'weapon.rail.description': 'Una bala enorme, recarga muy larga.',
      'weapon.homing.name': 'Misil teledirigido',
      'weapon.homing.description': 'Misil lento que persigue al enemigo. Recarga larga.',
      'weapon.disruptor.name': 'Rayo disruptor',
      'weapon.disruptor.description': 'Rayo de corto alcance que aturde el motor enemigo brevemente.',
      'weapon.melee.name': 'Golpe cuerpo a cuerpo',
      'weapon.melee.description': 'Golpe potente de corto alcance con retroceso.',
      'weapon.boost.name': 'Embestida',
      'weapon.boost.description': 'Ráfaga corta de empuje. Ideal para embestir.',
      'dir.directlyAhead': 'justo delante',
      'dir.directlyBehind': 'justo detrás',
      'dir.frontLeft': 'al frente izquierda',
      'dir.left': 'a tu izquierda',
      'dir.rearLeft': 'detrás a la izquierda',
      'dir.frontRight': 'al frente derecha',
      'dir.right': 'a tu derecha',
      'dir.rearRight': 'detrás a la derecha',

      'mp.aria': 'Multijugador en línea',
      'mp.title': 'Multijugador en línea',
      'mp.codePrompt': 'Tu código de sala es:',
      'mp.copyCode': 'Copiar código',
      'mp.codeLabel': 'Introduce el código de sala:',
      'mp.connect': 'Conectar',
      'mp.back': 'Volver al menú',
      'mp.hostingCode': 'Código de sala: {code}. Esperando rival.',
      'mp.enterCode': 'Introduce el código que te dio tu rival y pulsa Conectar.',
      'mp.invalidCode': 'Introduce un código de sala válido.',
      'mp.codeCopied': 'Código copiado al portapapeles.',
      'mp.peerUnavailable': 'La biblioteca PeerJS no está disponible. El juego en línea requiere conexión a internet.',
      'mp.creatingRoom': 'Creando sala...',
      'mp.roomReady': 'Sala lista. Comparte el código con tu rival.',
      'mp.error': 'Error: {type}',
      'mp.connecting': 'Conectando...',
      'mp.connected': 'Conectado.',
      'mp.disconnected': 'Desconectado.',
      'mp.connectionError': 'Error de conexión: {type}',
      'mp.opponentReady': 'Rival listo. Elige un mech.',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Selecciona un sonido para oírlo. Usa este menú para familiarizarte con los sonidos del combate.',
      'learn.back': 'Volver al menú',
      'learn.welcome': 'Aprende los sonidos. Selecciona uno para oírlo. Cada sonido suena delante de ti para que practiques localizarlo.',
      'learn.entry': '{name}. {description}',
      'learn.s.pistol.name': 'Pistola',
      'learn.s.pistol.desc': 'Tono descendente rápido. La dispara el Striker.',
      'learn.s.machinegun.name': 'Ametralladora',
      'learn.s.machinegun.desc': 'Ráfagas secas y traqueteantes. La dispara el Scout.',
      'learn.s.shotgun.name': 'Escopeta',
      'learn.s.shotgun.desc': 'Bramido grave de perdigones. La dispara el Juggernaut.',
      'learn.s.rail.name': 'Cañón de raíl',
      'learn.s.rail.desc': 'Crujido profundo y barrido. La dispara el Juggernaut.',
      'learn.s.missile.name': 'Misil teledirigido',
      'learn.s.missile.desc': 'Silbido ascendente. Lo disparan Scout y Phantom.',
      'learn.s.disruptor.name': 'Rayo disruptor',
      'learn.s.disruptor.desc': 'Tono agudo trinante. Lo dispara el Phantom. Aturde el motor.',
      'learn.s.disruptor_hit.name': 'Impacto de disruptor',
      'learn.s.disruptor_hit.desc': 'Reverberación descendente. No puedes moverte un momento.',
      'learn.s.melee.name': 'Golpe cuerpo a cuerpo',
      'learn.s.melee.desc': 'Vaivén grave y sordo. Lo usan Striker y Brawler.',
      'learn.s.melee_hit.name': 'Impacto cuerpo a cuerpo',
      'learn.s.melee_hit.desc': 'Golpe sordo cuando conecta el cuerpo a cuerpo.',
      'learn.s.boost.name': 'Embestida',
      'learn.s.boost.desc': 'Rugido ascendente. Lo usa el Brawler para cargar.',
      'learn.s.impact.name': 'Impacto de proyectil',
      'learn.s.impact.desc': 'Pequeña explosión cuando una bala alcanza algo.',
      'learn.s.explosion.name': 'Explosión',
      'learn.s.explosion.desc': 'Bramido sordo, para misiles y colisiones.',
      'learn.s.wallHit.name': 'Choque contra muro',
      'learn.s.wallHit.desc': 'Has chocado contra un muro. Recibes daño.',
      'learn.s.damage.name': 'Recibiendo daño',
      'learn.s.damage.desc': 'Zumbido grave cuando te alcanzan.',
      'learn.s.jump.name': 'Salto / jetpack',
      'learn.s.jump.desc': 'Chirrido ascendente al saltar o activar el jetpack.',
      'learn.s.land.name': 'Aterrizaje',
      'learn.s.land.desc': 'Golpe pesado al aterrizar el mech.',
      'learn.s.step.name': 'Pisada',
      'learn.s.step.desc': 'Golpe sutil al andar un mech con piernas.',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',

      'game.aria': 'Arena de combate',
      'game.title': 'Combate de Mech Duel',
      'game.yourMech': 'Tu mech:',
      'game.yourHealth': 'Tu vida:',
      'game.opponent': 'Rival:',
      'game.opponentHealth': 'Vida del rival:',
      'game.speed': 'Velocidad:',
      'game.heading': 'Rumbo:',
      'game.sonar': 'Sónar:',
      'game.help': 'Flechas arriba y abajo cambian velocidad. Izquierda y derecha giran. Mayús + izquierda/derecha alinea a un punto cardinal. Espacio salta o activa el jetpack. F dispara arma primaria. R dispara secundaria. Mayús + F o R cambia el sónar. H anuncia tu estado. Q anuncia distancia y dirección del rival. Escape pausa.',

      'pause.aria': 'En pausa',
      'pause.title': 'En pausa',
      'pause.welcome': 'En pausa. Elige reanudar o salir al menú.',
      'pause.resume': 'Reanudar',
      'pause.quit': 'Salir al menú',

      'gameover.aria': 'Fin del juego',
      'gameover.title': 'Fin del juego',
      'gameover.titleWin': '¡Victoria!',
      'gameover.titleLose': 'Derrota.',
      'gameover.rematch': 'Revancha',
      'gameover.menu': 'Volver al menú principal',
      'gameover.win': '¡Victoria! Has destruido al rival.',
      'gameover.lose': 'Derrota. Tu mech ha sido destruido.',
      'gameover.full': '{title}. {msg}',

      'ann.boost': 'Turbo activado',
      'ann.meleeHit': '¡Cuerpo a cuerpo conectado! {damage} de daño',
      'ann.meleeTaken': '¡Golpe cuerpo a cuerpo! {damage} de daño recibido',
      'ann.collision': '¡Colisión! Recibes {you}, infliges {them}',
      'ann.combatStart': 'Comienza el combate. Pilotas el {playerMech} contra el {opponentMech}. El rival está a {distance} metros. Acércate con cuidado.',
      'ann.opponentStatus': 'Rival a {distance} metros, {dir}. Vida del rival {hp}.',
      'ann.selfStatus': 'Vida {hp}. Velocidad {speed}. Rumbo {heading}.',
      'ann.sonarPrimary': 'Sónar cambiado a alcance primario',
      'ann.sonarSecondary': 'Sónar cambiado a alcance secundario',
      'ann.snapTo': 'Alineado al {name}',
      'ann.wallImpact': 'Impacto contra muro, {damage} de daño',
      'ann.youHit': '¡Impacto! {damage} de daño recibido',
      'ann.youDealt': 'Has acertado. {damage} de daño',

      'sonar.primary': 'primario',
      'sonar.secondary': 'secundario',

      'dir.north': 'norte',
      'dir.northEast': 'noreste',
      'dir.east': 'este',
      'dir.southEast': 'sureste',
      'dir.south': 'sur',
      'dir.southWest': 'suroeste',
      'dir.west': 'oeste',
      'dir.northWest': 'noroeste',
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
