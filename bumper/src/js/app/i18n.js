/**
 * Lightweight i18n for the bumper-cars UI.
 *
 * Resolution order on boot: localStorage('bumper.lang') → navigator.language
 * 2-letter prefix → fallback ('en').
 *
 * Dictionaries are keyed by short locale id ('en', 'es', ...). New languages
 * are added by extending the `dictionaries` and `localeNames` objects below.
 *
 * DOM strings: annotate with `data-i18n="key"` (textContent),
 * `data-i18n-html="key"` (innerHTML, for fragments containing inline tags
 * like <kbd>), or `data-i18n-attr="aria-label:key;placeholder:key"`.
 *
 * Runtime strings: call app.i18n.t('key', {param: 'val'}). Templates use
 * {name} placeholders.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'bumper.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Bumper Cars — accessible audio arena',

      // Splash
      'splash.instruction': 'Press any key to begin',
      'splash.author': 'audio-first arena',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Bumper Cars',
      'menu.subtitle': 'An audio-first accessible arena.',
      'menu.chill': 'Chill mode — classic bumper cars',
      'menu.arcade': 'Arcade mode — pickups, bullets, mines',
      'menu.multi': 'Multiplayer — host or join',
      'menu.learn': 'Learn the sounds',
      'menu.help': 'Help',
      'menu.language': 'Language',
      'menu.footerSuffix': ' · headphones strongly recommended',

      // Language screen
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',

      // Setup (single-player)
      'setup.aria': 'Single-player setup',
      'setup.titleChill': 'Single player',
      'setup.titleArcade': 'Arcade',
      'setup.subtitleChill': 'Choose how many AI opponents to face. Zero is sandbox mode for practising movement and learning the audio.',
      'setup.subtitleArcade': 'Choose how many AI opponents to face. Pickups appear in the arena: health, shields, bullets, and mines.',
      'setup.ai0': 'Sandbox — no opponents',
      'setup.ai1': '1 opponent',
      'setup.ai2': '2 opponents',
      'setup.ai3': '3 opponents',
      'setup.ai4': '4 opponents',
      'setup.ai5': '5 opponents (full arena)',
      'setup.back': 'Back',

      // Multiplayer
      'mp.aria': 'Multiplayer',
      'mp.title': 'Multiplayer',
      'mp.subtitle': '2 to 6 players. Peer-to-peer over the internet. Choose chill, arcade, or deathmatch in the lobby.',
      'mp.nameLabel': 'Your name:',
      'mp.host': 'Host a game',
      'mp.joinForm': 'Join with room code',
      'mp.backMenu': 'Back to main menu',
      'mp.codeLabel': 'Room code:',
      'mp.connect': 'Connect',
      'mp.cancel': 'Back',
      'mp.lobbyShare': 'Share this with friends so they can join.',
      'mp.lobbyRoomPrefix': 'Room code: ',
      'mp.start': 'Start round',
      'mp.leave': 'Leave room',
      'mp.modeLegend': 'Game mode',
      'mp.durationLegend': 'Round length',
      'mp.modeChill': 'Chill mode',
      'mp.modeArcade': 'Arcade mode',
      'mp.modeDeathmatch': 'Deathmatch',
      'mp.clientModeSelected': 'Host selected {mode}.',
      'mp.duration3': '3 min',
      'mp.duration10': '10 min',
      'mp.duration15': '15 min',
      'mp.durationLabel1': '1 minute',
      'mp.durationLabelN': '{minutes} minutes',
      'mp.clientDurationSelected': 'Host set round length to {label}.',
      'mp.copyLink': 'Copy invite link',
      'mp.linkCopied': 'Invite link copied to clipboard.',
      'mp.linkCopyFailed': 'Could not copy. Link is: {link}',
      'mp.joiningRoom': 'Joining room {code}. Type your name and press Connect.',
      'mp.unavailable': 'Networking is unavailable. Check that PeerJS loaded.',
      'mp.creating': 'Creating room…',
      'mp.couldNotHost': 'Could not host.',
      'mp.couldNotConnect': 'Could not connect.',
      'mp.hostingRoom': 'Hosting room {code}. Waiting for players.',
      'mp.connecting': 'Connecting to {code}…',
      'mp.enterCode': 'Enter a room code.',
      'mp.enterName': 'Enter a name first.',
      'mp.connected': 'Connected. Waiting for host to start.',
      'mp.left': 'Left the room.',
      'mp.peerJoined': '{name} joined.',
      'mp.peerLeft': '{name} left.',
      'mp.connectionClosed': 'Connection closed.',
      'mp.disconnected': 'Disconnected. Returning to menu.',
      'mp.needTwo': 'Need at least 2 players to start. Share the room code.',
      'mp.tooMany': 'Too many players. Maximum 6.',
      'mp.tagHost': 'host',
      'mp.tagYou': 'you',
      'mp.statusHostNeed': '{count} of 6 players. Need at least 2 to start.',
      'mp.statusHostReady': '{count} of 6 players. Ready to start.',
      'mp.statusClient1': '{count} player in the room. Waiting for host…',
      'mp.statusClientN': '{count} players in the room. Waiting for host…',

      // Game HUD / accessibility
      'game.aria': 'Game arena',
      'game.instructions': 'Arrow keys drive. Q is a targeting sweep of opponents. Space honks the horn. In arcade and deathmatch, W sweeps pickups, A S D fire bullets, F drops a mine, G activates a speed burst, H teleports you to a random open spot, and F3 reads your inventory. F6 reads the time remaining in deathmatch. Press Escape to pause.',
      'game.health': 'Health: ',
      'game.score': 'Score: ',
      'game.cars': 'Cars left: ',
      'game.ended': 'Game ended.',
      'game.outOfBullets': 'Out of bullets.',
      'game.bulletCooldown1': 'Wait 1 second.',
      'game.bulletCooldownN': 'Wait {seconds} seconds.',
      'game.cantPlaceMine': 'Cannot place mine right now.',
      'game.noMines': 'No mines.',
      'game.boostNotReady': 'Boost still active.',
      'game.noBoosts': 'No boosts.',
      'game.cantTeleport': 'Cannot teleport right now.',
      'game.noTeleports': 'No teleports.',

      // Game-over
      'gameOver.aria': 'Round over',
      'gameOver.titleWin': 'You won!',
      'gameOver.titleLose': 'Round over',
      'gameOver.resultWin': 'Last car running.',
      'gameOver.resultLose': 'Better luck next round.',
      'gameOver.resultWinDm': 'Top of the leaderboard.',
      'gameOver.resultLoseDm': 'Better luck next round.',
      'gameOver.score': 'Score',
      'gameOver.best': 'Personal Best',
      'gameOver.rematch': 'Play again',
      'gameOver.menu': 'Back to main menu',
      'gameOver.summaryWin': 'You won. Score {score}. Personal best {best}.',
      'gameOver.summaryLose': 'Round over. Score {score}. Personal best {best}.',
      'gameOver.standings': 'Final standings',
      'gameOver.standingNameYou': '{label} (you)',
      'gameOver.standingTagWinner': 'survived',
      'gameOver.standingTagOut': 'eliminated',
      'gameOver.standingsAnnounce': 'Final standings: {list}.',

      // Help
      'help.aria': 'Help',
      'help.title': 'How to play',
      'help.controls': 'Controls',
      'help.controlUp': '<kbd>Up</kbd> — accelerate forward',
      'help.controlDown': '<kbd>Down</kbd> — light reverse pedal (slow)',
      'help.controlSteer': '<kbd>Left</kbd> <kbd>Right</kbd> — steer',
      'help.controlSweep': '<kbd>Q</kbd> — announce all nearby cars and their bearing',
      'help.controlHorn': '<kbd>Space</kbd> — honk the horn (heard by other players from your position)',
      'help.controlReadouts': '<kbd>F1</kbd> score · <kbd>F2</kbd> cars left · <kbd>F4</kbd> health · <kbd>F6</kbd> time remaining',
      'help.controlEscape': '<kbd>Escape</kbd> — pause / back',
      'help.controlConfirm': '<kbd>Enter</kbd> / <kbd>Space</kbd> — confirm in menus',
      'help.wasdNote': 'WASD is reserved for item-mode actions (see below) so it does nothing while driving in chill mode. Use the arrow keys.',
      'help.howSounds': 'How it sounds',
      'help.sounds1': 'Each car has its own engine sound, located in space. Cars in front of you sound brighter; cars behind sound darker. A high parking-sensor beep speeds up as a car gets close.',
      'help.sounds2': 'Walls hum continuously from their direction — quiet when you\'re far, building to a loud whoosh as you approach.',
      'help.sounds3': 'Hitting walls or other cars costs health. Bigger impacts cost more. When your health hits zero, your car is out — but the round continues so you can listen to the rest.',
      'help.goal': 'Goal',
      'help.goalText': 'In chill and arcade, be the last car running. In deathmatch, score the most points before the timer runs out. Damage you deal scores points; so do eliminations.',
      'help.arcade': 'Arcade and deathmatch items',
      'help.arcadeIntro': 'Both arcade and deathmatch put pickups around the arena. Each pickup loops a distinctive sound at its position so you can navigate to it. Drive over a pickup to grab it.',
      'help.pickupHealth': '<strong>Health pack</strong> — bell chimes. +25 health, no upper limit. Stack enough of them and you become a tank.',
      'help.pickupShield': '<strong>Forcefield</strong> — elastic boing. Stacks. Each shield negates the next bump (no damage taken; aggressor still scores).',
      'help.pickupBullets': '<strong>Bullets</strong> — aggressive sawtooth boing. Grants 3–6 bullets. Fire with <kbd>A</kbd> (left), <kbd>S</kbd> (center), <kbd>D</kbd> (right) to nudge the aim.',
      'help.pickupMine': '<strong>Trap mine</strong> — subtle ticking. Press <kbd>F</kbd> to drop one behind you. Persists until something runs into it.',
      'help.pickupSpeed': '<strong>Speed burst</strong> — fast revving whir. Press <kbd>G</kbd> to use one. Doubles your top speed and acceleration for 3 seconds — perfect for chasing down or ramming someone.',
      'help.pickupTeleport': '<strong>Teleport</strong> — shimmering high warble. Press <kbd>H</kbd> to use one. Snaps you to a random open spot in the arena, well clear of any wall — handy for breaking out of a corner trap.',
      'help.arcadeHotkeysIntro': 'Item-mode hotkeys (arcade and deathmatch):',
      'help.hotkeyW': '<kbd>W</kbd> — sweep all pickups on the field with bearing and range',
      'help.hotkeyASD': '<kbd>A</kbd> / <kbd>S</kbd> / <kbd>D</kbd> — fire a bullet (left / center / right nudge)',
      'help.hotkeyF': '<kbd>F</kbd> — drop a mine behind you',
      'help.hotkeyG': '<kbd>G</kbd> — activate a speed burst (3 seconds)',
      'help.hotkeyH': '<kbd>H</kbd> — teleport to a random open spot in the arena',
      'help.hotkeyF3': '<kbd>F3</kbd> — read your inventory',
      'help.aiNote': 'AI cars also grab pickups and use them — listen for the announcements.',
      'help.deathmatch': 'Deathmatch (multiplayer-only)',
      'help.deathmatchIntro': 'Deathmatch adds the full item layer (pickups, bullets, mines, shields, speed bursts, teleports) but eliminations are not final: a downed car respawns at a random open spot after three seconds with full health. The round ends on a host-picked timer (three, ten, or fifteen minutes); winner is the car with the highest score at time-out.',
      'help.deathmatchTime': 'Press <kbd>F6</kbd> at any time to hear the round time remaining. Spoken warnings also fire at one minute, thirty seconds, and ten seconds before time-out.',
      'help.back': 'Back',

      // Learn the sounds
      'learn.aria': 'Learn the game sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Press a button to preview each sound.',
      'learn.back': 'Back',
      'learn.uiFocus': 'UI focus tick',
      'learn.uiBack': 'UI back tick',
      'learn.roundStart': 'Round start chimes',
      'learn.roundEndWin': 'Round end (you win)',
      'learn.roundEndLose': 'Round end (you lose)',
      'learn.collisionLight': 'Light collision',
      'learn.collisionHeavy': 'Heavy collision',
      'learn.scoringSmall': 'Scoring chime — small hit',
      'learn.scoringBig': 'Scoring chime — big hit',
      'learn.buzzerLight': 'Buzzer — you got hit (light)',
      'learn.buzzerHard': 'Buzzer — you got hit (hard)',
      'learn.wallScrape': 'Wall scrape',
      'learn.elimination': 'Elimination',
      'learn.heartbeat': 'Heartbeat (low health)',
      'learn.pickupHealth': 'Arcade — health pack pickup',
      'learn.pickupShield': 'Arcade — shield pickup',
      'learn.pickupBullets': 'Arcade — bullets pickup',
      'learn.pickupMine': 'Arcade — mine pickup',
      'learn.pickupSpeed': 'Arcade — speed-burst pickup',
      'learn.pickupTeleport': 'Arcade — teleport pickup',
      'learn.teleport': 'Arcade — teleport activated (heard at old position)',
      'learn.boostActivated': 'Arcade — speed burst activated',
      'learn.boostExpired': 'Arcade — speed burst ends',
      'learn.shieldBlock': 'Arcade — shield blocks a bump',
      'learn.explosion': 'Arcade — explosion (bullet hit / mine)',
      'learn.proximityFront': 'Targeting beep — opponent in front',
      'learn.proximityBehind': 'Targeting beep — opponent behind',
      'learn.wallProximity': 'Wall whoosh — far → near',
      'learn.engine': 'Engine: {color} car',

      // Car colour names (used in announcements: "You are the red car.")
      'color.red': 'red',
      'color.blue': 'blue',
      'color.green': 'green',
      'color.yellow': 'yellow',
      'color.purple': 'purple',
      'color.orange': 'orange',

      // Live-region announcements (game)
      'ann.you': 'You',
      'ann.youKilledBy': 'You are eliminated. Watching the round. Press 1 to 6 to switch view.',
      'ann.spectatorWatching': 'Watching {label}.',
      'ann.spectatorEliminated': '{label} is eliminated.',
      'ann.spectatorNoSlot': 'No car in slot {n}.',
      'ann.youKilledOther': 'You eliminated {label}.',
      'ann.otherKilled': '{label} eliminated.',
      'ann.youHitOther': 'You hit {label}! {damage} damage. {label} at {health} health.',
      'ann.youHitOtherShielded': 'Your hit on {label} was absorbed by their shield. {shieldsPart}',
      'ann.shieldsLeft1': '1 shield left.',
      'ann.shieldsLeftN': '{count} shields left.',
      'ann.noShieldsLeft': 'No shields left.',
      'ann.youGotHit': 'You were hit by {label}! {damage} damage. {health} health left.',
      'ann.youGotHitShielded': 'Shield absorbed hit from {label}. {shieldsPart}',
      'ann.youHitWall': 'You hit a wall! {damage} damage.',
      'ann.youWonFinal': 'You won. Final score {score}.',
      'ann.roundOverFinal': 'Round over. Final score {score}.',
      'ann.score': 'Score {score}.',
      'ann.health': 'Health {health}.',
      'ann.youEliminated': 'You are eliminated.',
      'ann.carsRemaining1': '1 car remaining.',
      'ann.carsRemainingN': '{count} cars remaining.',
      'ann.noInventoryChill': 'No inventory in chill mode.',
      'ann.inventory': 'Inventory: {parts}.',
      'ann.shieldsPart1': '1 shield',
      'ann.shieldsPartN': '{count} shields',
      'ann.bulletsPart1': '1 bullet',
      'ann.bulletsPartN': '{count} bullets',
      'ann.minesPart1': '1 mine',
      'ann.minesPartN': '{count} mines',
      'ann.boostsPart1': '1 boost',
      'ann.boostsPartN': '{count} boosts',
      'ann.teleportsPart1': '1 teleport',
      'ann.teleportsPartN': '{count} teleports',
      'ann.noPickupsChill': 'No pickups in chill mode.',
      'ann.noPickupsField': 'No pickups on the field.',
      'ann.pickupsList1': '1 pickup. {lines}.',
      'ann.pickupsListN': '{count} pickups. {lines}.',
      'ann.youAreColor': ' You are the {color} car.',
      'ann.mpRound1': 'Multiplayer round. 1 opponent.{colorLine} Go.',
      'ann.mpRoundN': 'Multiplayer round. {count} opponents.{colorLine} Go.',
      'ann.mpRound1Arcade': 'Multiplayer arcade. 1 opponent.{colorLine} Go.',
      'ann.mpRoundNArcade': 'Multiplayer arcade. {count} opponents.{colorLine} Go.',
      'ann.mpRound1Deathmatch': 'Deathmatch! 1 opponent.{colorLine} {durationLabel}. Pickups, bullets, and mines on the field. Respawn after death. Go.',
      'ann.mpRoundNDeathmatch': 'Deathmatch! {count} opponents.{colorLine} {durationLabel}. Pickups, bullets, and mines on the field. Respawn after death. Go.',
      'ann.youDmRespawnIn': 'You are down. Respawning in {seconds} seconds.',
      'ann.otherDmDown': '{label} down.',
      'ann.youRespawn': 'Respawned.',
      'ann.otherRespawn': '{label} respawned.',
      'ann.dmWarn60': 'One minute remaining.',
      'ann.dmWarn30': 'Thirty seconds remaining.',
      'ann.dmWarn10': 'Ten seconds remaining.',
      // F6 readout: time remaining. Bare variants are used to compose
      // "{minPart} {secPart}" without leading "Time remaining:" so the
      // composite reads as one phrase.
      'ann.durationLabel1': 'One minute',
      'ann.durationLabelN': '{minutes} minutes',
      'ann.noTimeLimit': 'No time limit.',
      'ann.timeRemainingSec1': '1 second remaining.',
      'ann.timeRemainingSecN': '{seconds} seconds remaining.',
      'ann.timeRemainingMin1': '1 minute remaining.',
      'ann.timeRemainingMinN': '{minutes} minutes remaining.',
      'ann.timeRemainingMinSec': '{minPart} {secPart} remaining.',
      'ann.timeRemainingMin1Bare': '1 minute',
      'ann.timeRemainingMinNBare': '{minutes} minutes',
      'ann.timeRemainingSec1Bare': '1 second',
      'ann.timeRemainingSecNBare': '{seconds} seconds',
      'ann.sandboxArcade': 'Arcade sandbox. Drive freely. Pickups will appear.',
      'ann.sandboxChill': 'Sandbox mode. Drive freely.',
      'ann.roundStart1': 'Round start. 1 opponent. Go.',
      'ann.roundStartN': 'Round start. {count} opponents. Go.',
      'ann.roundStart1Arcade': 'Arcade. Round start. 1 opponent. Go.',
      'ann.roundStartNArcade': 'Arcade. Round start. {count} opponents. Go.',
      'ann.leaverForfeit': '{label} left the round.',
      'ann.kindDirect': 'direct hit',
      'ann.kindGraze': 'graze',
      'ann.kindDirectCap': 'Direct hit',
      'ann.kindGrazeCap': 'Graze',
      'ann.someone': 'Someone',
      'ann.bulletYouHit': 'You were hit by bullet from {owner} for {damage} damage! {kind}.',
      'ann.bulletOtherHit': '{victim} hit by bullet from {owner} for {damage} damage. {kind}.',
      'ann.bulletYouDodged': 'You dodged bullet from {owner}.',
      'ann.bulletOtherDodged': '{target} dodges bullet from {owner}.',
      'ann.bulletFiresAtYou': '{label} fires aiming at you.',
      'ann.bulletFiresAt': '{label} fires aiming at {target}.',
      'ann.bulletFires': '{label} fires.',
      'ann.mineDropped': 'Mine dropped. {count} left.',
      'ann.mineDroppedBy': '{label} drops a mine.',
      'ann.mineYouHitOwn': 'You hit {ownerLabel} for {damage} damage!',
      'ann.mineOtherHit': '{victim} hit {ownerLabel} for {damage} damage.',
      'ann.mineOwnerYou': 'your mine',
      'ann.mineOwnerOther': '{label}\'s mine',
      'ann.mineOwnerUnknown': 'a mine',
      'ann.healthPackYou': 'Health pack. +{amount}. Now {health} health.',
      'ann.healthPackOther': '{label} picks up a health pack. Now {health} health.',
      'ann.shieldYou1': 'Shield. 1 shield ready.',
      'ann.shieldYouN': 'Shield. {count} shields ready.',
      'ann.shieldOther': '{label} picks up a shield. Has {count}.',
      'ann.bulletsYou': 'Bullets. +{amount}. {total} total.',
      'ann.bulletsOther': '{label} picks up bullets. Has {count}.',
      'ann.mineYou1': 'Mine. 1 mine ready.',
      'ann.mineYouN': 'Mine. {count} mines ready.',
      'ann.mineOther': '{label} picks up a mine. Has {count}.',
      'ann.boostYou1': 'Speed burst. 1 boost ready.',
      'ann.boostYouN': 'Speed burst. {count} boosts ready.',
      'ann.boostOther': '{label} picks up a speed burst. Has {count}.',
      'ann.boostUseYou': 'Boost! Three seconds.',
      'ann.boostUseOther': '{label} boosts!',
      'ann.teleportYou1': 'Teleport. 1 teleport ready.',
      'ann.teleportYouN': 'Teleport. {count} teleports ready.',
      'ann.teleportOther': '{label} picks up a teleport. Has {count}.',
      'ann.teleportUseYou': 'Teleport! New position.',
      'ann.teleportUseOther': '{label} teleports away.',

      // Default labels
      'label.you': 'You',
      'label.ai': 'AI {n}',
      'label.car': 'Car {n}',
      'label.host': 'Host',
      'label.player': 'Player',

      // Pickup labels (used in announcePickups sweep)
      'pickup.health': 'health pack',
      'pickup.shield': 'shield',
      'pickup.bullets': 'bullets',
      'pickup.mine': 'mine',
      'pickup.speed': 'speed burst',
      'pickup.teleport': 'teleport',

      // Arena bearings
      'arena.onTopOfYou': 'right on top of you',
      'arena.bearing.front': 'in front',
      'arena.bearing.frontLeft': 'front-left',
      'arena.bearing.left': 'to the left',
      'arena.bearing.behindLeft': 'behind-left',
      'arena.bearing.behind': 'behind you',
      'arena.bearing.behindRight': 'behind-right',
      'arena.bearing.right': 'to the right',
      'arena.bearing.frontRight': 'front-right',
      'arena.range.veryClose': 'very close',
      'arena.range.close': 'close',
      'arena.range.midRange': 'mid range',
      'arena.range.far': 'far',
      'arena.bearingFmt': '{bearing}, {range}',

      // Targeting commentary
      'target.chasing': '{label} is chasing you',
      'target.fleeing': '{label} is running',
      'target.approaching': '{label} is closing in',
      'target.leaving': '{label} is backing off',
      'target.circling': '{label} is circling',
      'target.idle': '{label} stopped',
      'target.changedDirection': '{label} changed direction',
      'target.shortFront': 'in front',
      'target.shortLeft': 'on your left',
      'target.shortBehind': 'behind you',
      'target.shortRight': 'on your right',
      'target.commentaryFmt': '{phrase}, {bearing}, {health} health.',
      'target.sweepLine': '{label}: {bearing}, {motion}, {health} health',
      'target.motion.approaching': 'approaching',
      'target.motion.movingAway': 'moving away',
      'target.motion.circling': 'circling',
      'target.noOthers': 'No other cars.',
      'target.youEliminated': 'You are eliminated.',
    },

    es: {
      // <head>
      'doc.title': 'Bumper Cars — arena de audio accesible',

      // Splash
      'splash.instruction': 'Pulsa cualquier tecla para empezar',
      'splash.author': 'arena de audio',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'Bumper Cars',
      'menu.subtitle': 'Una arena accesible centrada en el audio.',
      'menu.chill': 'Modo tranquilo — coches de choque clásicos',
      'menu.arcade': 'Modo arcade — bonus, balas, minas',
      'menu.multi': 'Multijugador — crear o unirse',
      'menu.learn': 'Aprende los sonidos',
      'menu.help': 'Ayuda',
      'menu.language': 'Idioma',
      'menu.footerSuffix': ' · se recomiendan auriculares',

      // Language screen
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',

      // Setup (single-player)
      'setup.aria': 'Configuración de un jugador',
      'setup.titleChill': 'Un jugador',
      'setup.titleArcade': 'Arcade',
      'setup.subtitleChill': 'Elige cuántos rivales de IA quieres enfrentar. Cero es modo libre para practicar el movimiento y aprender el audio.',
      'setup.subtitleArcade': 'Elige cuántos rivales de IA quieres enfrentar. En la arena aparecen bonus: salud, escudos, balas y minas.',
      'setup.ai0': 'Modo libre — sin rivales',
      'setup.ai1': '1 rival',
      'setup.ai2': '2 rivales',
      'setup.ai3': '3 rivales',
      'setup.ai4': '4 rivales',
      'setup.ai5': '5 rivales (arena llena)',
      'setup.back': 'Atrás',

      // Multiplayer
      'mp.aria': 'Multijugador',
      'mp.title': 'Multijugador',
      'mp.subtitle': 'De 2 a 6 jugadores. Punto a punto por internet. Elige tranquilo, arcade o combate a muerte en la sala.',
      'mp.nameLabel': 'Tu nombre:',
      'mp.host': 'Crear partida',
      'mp.joinForm': 'Unirse con código de sala',
      'mp.backMenu': 'Volver al menú principal',
      'mp.codeLabel': 'Código de sala:',
      'mp.connect': 'Conectar',
      'mp.cancel': 'Atrás',
      'mp.lobbyShare': 'Compártelo para que tus amigos se unan.',
      'mp.lobbyRoomPrefix': 'Código de sala: ',
      'mp.start': 'Empezar ronda',
      'mp.leave': 'Salir de la sala',
      'mp.modeLegend': 'Modo de juego',
      'mp.durationLegend': 'Duración de la ronda',
      'mp.modeChill': 'Modo tranquilo',
      'mp.modeArcade': 'Modo arcade',
      'mp.modeDeathmatch': 'Combate a muerte',
      'mp.clientModeSelected': 'El anfitrión ha elegido {mode}.',
      'mp.duration3': '3 min',
      'mp.duration10': '10 min',
      'mp.duration15': '15 min',
      'mp.durationLabel1': '1 minuto',
      'mp.durationLabelN': '{minutes} minutos',
      'mp.clientDurationSelected': 'El anfitrión ha fijado la duración en {label}.',
      'mp.copyLink': 'Copiar enlace de invitación',
      'mp.linkCopied': 'Enlace de invitación copiado al portapapeles.',
      'mp.linkCopyFailed': 'No se pudo copiar. El enlace es: {link}',
      'mp.joiningRoom': 'Uniéndose a la sala {code}. Escribe tu nombre y pulsa Conectar.',
      'mp.unavailable': 'La red no está disponible. Comprueba que PeerJS se haya cargado.',
      'mp.creating': 'Creando sala…',
      'mp.couldNotHost': 'No se pudo crear la sala.',
      'mp.couldNotConnect': 'No se pudo conectar.',
      'mp.hostingRoom': 'Sala creada {code}. Esperando jugadores.',
      'mp.connecting': 'Conectando con {code}…',
      'mp.enterCode': 'Introduce un código de sala.',
      'mp.enterName': 'Introduce un nombre primero.',
      'mp.connected': 'Conectado. Esperando a que el anfitrión empiece.',
      'mp.left': 'Has salido de la sala.',
      'mp.peerJoined': '{name} se ha unido.',
      'mp.peerLeft': '{name} se ha ido.',
      'mp.connectionClosed': 'Conexión cerrada.',
      'mp.disconnected': 'Desconectado. Volviendo al menú.',
      'mp.needTwo': 'Hacen falta al menos 2 jugadores. Comparte el código de sala.',
      'mp.tooMany': 'Demasiados jugadores. Máximo 6.',
      'mp.tagHost': 'anfitrión',
      'mp.tagYou': 'tú',
      'mp.statusHostNeed': '{count} de 6 jugadores. Hacen falta al menos 2 para empezar.',
      'mp.statusHostReady': '{count} de 6 jugadores. Listo para empezar.',
      'mp.statusClient1': '{count} jugador en la sala. Esperando al anfitrión…',
      'mp.statusClientN': '{count} jugadores en la sala. Esperando al anfitrión…',

      // Game HUD / accessibility
      'game.aria': 'Arena de juego',
      'game.instructions': 'Las flechas conducen. Q hace un barrido de rivales. Espacio toca la bocina. En arcade y combate a muerte, W barre los bonus, A S D disparan balas, F deja una mina, G activa el turbo, H te teletransporta a un punto despejado al azar y F3 lee tu inventario. F6 lee el tiempo restante en combate a muerte. Pulsa Escape para pausar.',
      'game.health': 'Salud: ',
      'game.score': 'Puntos: ',
      'game.cars': 'Coches: ',
      'game.ended': 'Partida terminada.',
      'game.outOfBullets': 'Sin balas.',
      'game.bulletCooldown1': 'Espera 1 segundo.',
      'game.bulletCooldownN': 'Espera {seconds} segundos.',
      'game.cantPlaceMine': 'No puedes colocar una mina ahora.',
      'game.noMines': 'No tienes minas.',
      'game.boostNotReady': 'El turbo sigue activo.',
      'game.noBoosts': 'Sin turbos.',
      'game.cantTeleport': 'No puedes teletransportarte ahora.',
      'game.noTeleports': 'Sin teletransportes.',

      // Game-over
      'gameOver.aria': 'Ronda terminada',
      'gameOver.titleWin': '¡Has ganado!',
      'gameOver.titleLose': 'Ronda terminada',
      'gameOver.resultWin': 'Último coche en pie.',
      'gameOver.resultLose': 'Más suerte la próxima.',
      'gameOver.resultWinDm': 'Primero en la clasificación.',
      'gameOver.resultLoseDm': 'Más suerte la próxima.',
      'gameOver.score': 'Puntos',
      'gameOver.best': 'Récord personal',
      'gameOver.rematch': 'Jugar otra vez',
      'gameOver.menu': 'Volver al menú principal',
      'gameOver.summaryWin': 'Has ganado. Puntos {score}. Récord personal {best}.',
      'gameOver.summaryLose': 'Ronda terminada. Puntos {score}. Récord personal {best}.',
      'gameOver.standings': 'Clasificación final',
      'gameOver.standingNameYou': '{label} (tú)',
      'gameOver.standingTagWinner': 'sobrevivió',
      'gameOver.standingTagOut': 'eliminado',
      'gameOver.standingsAnnounce': 'Clasificación final: {list}.',

      // Help
      'help.aria': 'Ayuda',
      'help.title': 'Cómo se juega',
      'help.controls': 'Controles',
      'help.controlUp': '<kbd>Arriba</kbd> — acelerar adelante',
      'help.controlDown': '<kbd>Abajo</kbd> — marcha atrás suave (lenta)',
      'help.controlSteer': '<kbd>Izquierda</kbd> <kbd>Derecha</kbd> — girar',
      'help.controlSweep': '<kbd>Q</kbd> — anuncia los coches cercanos y su rumbo',
      'help.controlHorn': '<kbd>Espacio</kbd> — toca la bocina (los demás la oyen desde tu posición)',
      'help.controlReadouts': '<kbd>F1</kbd> puntos · <kbd>F2</kbd> coches restantes · <kbd>F4</kbd> salud · <kbd>F6</kbd> tiempo restante',
      'help.controlEscape': '<kbd>Escape</kbd> — pausa / atrás',
      'help.controlConfirm': '<kbd>Enter</kbd> / <kbd>Espacio</kbd> — confirmar en menús',
      'help.wasdNote': 'WASD está reservado para acciones de los modos con objetos (ver más abajo); en modo tranquilo no hace nada al conducir. Usa las flechas.',
      'help.howSounds': 'Cómo suena',
      'help.sounds1': 'Cada coche tiene su propio sonido de motor, situado en el espacio. Los coches que tienes delante suenan más brillantes; los de detrás suenan más oscuros. Un pitido tipo sensor de aparcamiento se acelera cuando un coche se acerca.',
      'help.sounds2': 'Las paredes zumban continuamente desde su dirección — bajo cuando estás lejos, hasta un fuerte silbido cuando te acercas.',
      'help.sounds3': 'Chocar con paredes u otros coches resta salud. Los impactos grandes restan más. Cuando tu salud llega a cero, tu coche queda eliminado — pero la ronda continúa para que escuches el resto.',
      'help.goal': 'Objetivo',
      'help.goalText': 'En tranquilo y arcade, sé el último coche en pie. En combate a muerte, suma más puntos antes de que se acabe el tiempo. El daño que infliges suma puntos; las eliminaciones también.',
      'help.arcade': 'Objetos en arcade y combate a muerte',
      'help.arcadeIntro': 'Tanto el modo arcade como el combate a muerte añaden bonus repartidos por la arena. Cada bonus emite un sonido distintivo en su posición para que puedas guiarte hasta él. Pasa por encima para cogerlo.',
      'help.pickupHealth': '<strong>Botiquín</strong> — campanitas. +25 de salud, sin límite. Apila suficientes y serás un tanque.',
      'help.pickupShield': '<strong>Campo de fuerza</strong> — boing elástico. Acumulable. Cada escudo anula el siguiente choque (sin daño; el agresor sigue puntuando).',
      'help.pickupBullets': '<strong>Balas</strong> — boing agresivo de sierra. Da entre 3 y 6 balas. Dispara con <kbd>A</kbd> (izquierda), <kbd>S</kbd> (centro), <kbd>D</kbd> (derecha) para ajustar la puntería.',
      'help.pickupMine': '<strong>Mina trampa</strong> — tictac sutil. Pulsa <kbd>F</kbd> para soltar una detrás. Permanece hasta que algo pasa por encima.',
      'help.pickupSpeed': '<strong>Turbo</strong> — zumbido acelerado. Pulsa <kbd>G</kbd> para usar uno. Duplica tu velocidad punta y aceleración durante 3 segundos — ideal para perseguir o embestir.',
      'help.pickupTeleport': '<strong>Teletransporte</strong> — trino agudo brillante. Pulsa <kbd>H</kbd> para usar uno. Te lleva a un punto despejado al azar de la arena, lejos de las paredes — útil para salir de una trampa en una esquina.',
      'help.arcadeHotkeysIntro': 'Atajos de los modos con objetos (arcade y combate a muerte):',
      'help.hotkeyW': '<kbd>W</kbd> — barre todos los bonus del campo con rumbo y distancia',
      'help.hotkeyASD': '<kbd>A</kbd> / <kbd>S</kbd> / <kbd>D</kbd> — disparar una bala (izquierda / centro / derecha)',
      'help.hotkeyF': '<kbd>F</kbd> — deja una mina detrás',
      'help.hotkeyG': '<kbd>G</kbd> — activa un turbo (3 segundos)',
      'help.hotkeyH': '<kbd>H</kbd> — teletranspórtate a un punto despejado al azar de la arena',
      'help.hotkeyF3': '<kbd>F3</kbd> — lee tu inventario',
      'help.aiNote': 'Los coches de IA también recogen objetos y los usan — atento a los anuncios.',
      'help.deathmatch': 'Combate a muerte (solo multijugador)',
      'help.deathmatchIntro': 'El combate a muerte añade toda la capa de objetos (bonus, balas, minas, escudos, turbos, teletransportes), pero las eliminaciones no son definitivas: el coche reaparece en un sitio despejado al azar tras tres segundos, con la salud al máximo. La ronda termina con un temporizador que elige el anfitrión (tres, diez o quince minutos); gana el coche con más puntos al acabar el tiempo.',
      'help.deathmatchTime': 'Pulsa <kbd>F6</kbd> en cualquier momento para oír el tiempo restante de la ronda. También se anuncian avisos a un minuto, treinta segundos y diez segundos del final.',
      'help.back': 'Atrás',

      // Learn the sounds
      'learn.aria': 'Aprende los sonidos del juego',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Pulsa un botón para escuchar cada sonido.',
      'learn.back': 'Atrás',
      'learn.uiFocus': 'Tic de foco de UI',
      'learn.uiBack': 'Tic de retroceso de UI',
      'learn.roundStart': 'Campanas de inicio de ronda',
      'learn.roundEndWin': 'Fin de ronda (ganas)',
      'learn.roundEndLose': 'Fin de ronda (pierdes)',
      'learn.collisionLight': 'Choque ligero',
      'learn.collisionHeavy': 'Choque fuerte',
      'learn.scoringSmall': 'Tono de puntuación — golpe pequeño',
      'learn.scoringBig': 'Tono de puntuación — golpe grande',
      'learn.buzzerLight': 'Zumbido — te golpean (ligero)',
      'learn.buzzerHard': 'Zumbido — te golpean (fuerte)',
      'learn.wallScrape': 'Roce con la pared',
      'learn.elimination': 'Eliminación',
      'learn.heartbeat': 'Latidos (poca salud)',
      'learn.pickupHealth': 'Arcade — recoger botiquín',
      'learn.pickupShield': 'Arcade — recoger escudo',
      'learn.pickupBullets': 'Arcade — recoger balas',
      'learn.pickupMine': 'Arcade — recoger mina',
      'learn.pickupSpeed': 'Arcade — recoger turbo',
      'learn.pickupTeleport': 'Arcade — recoger teletransporte',
      'learn.teleport': 'Arcade — teletransporte activado (se oye en la posición antigua)',
      'learn.boostActivated': 'Arcade — turbo activado',
      'learn.boostExpired': 'Arcade — fin del turbo',
      'learn.shieldBlock': 'Arcade — el escudo bloquea un golpe',
      'learn.explosion': 'Arcade — explosión (bala / mina)',
      'learn.proximityFront': 'Pitido de objetivo — rival delante',
      'learn.proximityBehind': 'Pitido de objetivo — rival detrás',
      'learn.wallProximity': 'Silbido de pared — lejos → cerca',
      'learn.engine': 'Motor: coche {color}',

      // Car colour names
      'color.red': 'rojo',
      'color.blue': 'azul',
      'color.green': 'verde',
      'color.yellow': 'amarillo',
      'color.purple': 'morado',
      'color.orange': 'naranja',

      // Live-region announcements (game)
      'ann.you': 'Tú',
      'ann.youKilledBy': 'Estás eliminado. Mirando la ronda. Pulsa de 1 a 6 para cambiar de vista.',
      'ann.spectatorWatching': 'Mirando a {label}.',
      'ann.spectatorEliminated': '{label} está eliminado.',
      'ann.spectatorNoSlot': 'No hay coche en el puesto {n}.',
      'ann.youKilledOther': 'Has eliminado a {label}.',
      'ann.otherKilled': '{label} eliminado.',
      'ann.youHitOther': '¡Has golpeado a {label}! {damage} de daño. {label} con {health} de salud.',
      'ann.youHitOtherShielded': 'Tu golpe a {label} fue absorbido por su escudo. {shieldsPart}',
      'ann.shieldsLeft1': 'Queda 1 escudo.',
      'ann.shieldsLeftN': 'Quedan {count} escudos.',
      'ann.noShieldsLeft': 'No quedan escudos.',
      'ann.youGotHit': '¡Te ha golpeado {label}! {damage} de daño. {health} de salud restante.',
      'ann.youGotHitShielded': 'El escudo absorbió el golpe de {label}. {shieldsPart}',
      'ann.youHitWall': '¡Has chocado con la pared! {damage} de daño.',
      'ann.youWonFinal': 'Has ganado. Puntuación final {score}.',
      'ann.roundOverFinal': 'Ronda terminada. Puntuación final {score}.',
      'ann.score': 'Puntos {score}.',
      'ann.health': 'Salud {health}.',
      'ann.youEliminated': 'Estás eliminado.',
      'ann.carsRemaining1': 'Queda 1 coche.',
      'ann.carsRemainingN': 'Quedan {count} coches.',
      'ann.noInventoryChill': 'No hay inventario en modo tranquilo.',
      'ann.inventory': 'Inventario: {parts}.',
      'ann.shieldsPart1': '1 escudo',
      'ann.shieldsPartN': '{count} escudos',
      'ann.bulletsPart1': '1 bala',
      'ann.bulletsPartN': '{count} balas',
      'ann.minesPart1': '1 mina',
      'ann.minesPartN': '{count} minas',
      'ann.boostsPart1': '1 turbo',
      'ann.boostsPartN': '{count} turbos',
      'ann.teleportsPart1': '1 teletransporte',
      'ann.teleportsPartN': '{count} teletransportes',
      'ann.noPickupsChill': 'No hay bonus en modo tranquilo.',
      'ann.noPickupsField': 'No hay bonus en el campo.',
      'ann.pickupsList1': '1 bonus. {lines}.',
      'ann.pickupsListN': '{count} bonus. {lines}.',
      'ann.youAreColor': ' Eres el coche {color}.',
      'ann.mpRound1': 'Ronda multijugador. 1 rival.{colorLine} Vamos.',
      'ann.mpRoundN': 'Ronda multijugador. {count} rivales.{colorLine} Vamos.',
      'ann.mpRound1Arcade': 'Multijugador arcade. 1 rival.{colorLine} Vamos.',
      'ann.mpRoundNArcade': 'Multijugador arcade. {count} rivales.{colorLine} Vamos.',
      'ann.mpRound1Deathmatch': '¡Combate a muerte! 1 rival.{colorLine} {durationLabel}. Hay bonus, balas y minas en el campo. Reapareces tras morir. ¡Vamos!',
      'ann.mpRoundNDeathmatch': '¡Combate a muerte! {count} rivales.{colorLine} {durationLabel}. Hay bonus, balas y minas en el campo. Reapareces tras morir. ¡Vamos!',
      'ann.youDmRespawnIn': 'Has caído. Reapareces en {seconds} segundos.',
      'ann.otherDmDown': '{label} ha caído.',
      'ann.youRespawn': 'Reaparición.',
      'ann.otherRespawn': '{label} reaparece.',
      'ann.dmWarn60': 'Queda un minuto.',
      'ann.dmWarn30': 'Quedan treinta segundos.',
      'ann.dmWarn10': 'Quedan diez segundos.',
      'ann.durationLabel1': 'Un minuto',
      'ann.durationLabelN': '{minutes} minutos',
      'ann.noTimeLimit': 'Sin límite de tiempo.',
      'ann.timeRemainingSec1': 'Queda 1 segundo.',
      'ann.timeRemainingSecN': 'Quedan {seconds} segundos.',
      'ann.timeRemainingMin1': 'Queda 1 minuto.',
      'ann.timeRemainingMinN': 'Quedan {minutes} minutos.',
      'ann.timeRemainingMinSec': 'Quedan {minPart} y {secPart}.',
      'ann.timeRemainingMin1Bare': '1 minuto',
      'ann.timeRemainingMinNBare': '{minutes} minutos',
      'ann.timeRemainingSec1Bare': '1 segundo',
      'ann.timeRemainingSecNBare': '{seconds} segundos',
      'ann.sandboxArcade': 'Modo libre arcade. Conduce libremente. Aparecerán bonus.',
      'ann.sandboxChill': 'Modo libre. Conduce libremente.',
      'ann.roundStart1': 'Empieza la ronda. 1 rival. Vamos.',
      'ann.roundStartN': 'Empieza la ronda. {count} rivales. Vamos.',
      'ann.roundStart1Arcade': 'Arcade. Empieza la ronda. 1 rival. Vamos.',
      'ann.roundStartNArcade': 'Arcade. Empieza la ronda. {count} rivales. Vamos.',
      'ann.leaverForfeit': '{label} se ha ido de la ronda.',
      'ann.kindDirect': 'impacto directo',
      'ann.kindGraze': 'rasguño',
      'ann.kindDirectCap': 'Impacto directo',
      'ann.kindGrazeCap': 'Rasguño',
      'ann.someone': 'Alguien',
      'ann.bulletYouHit': '¡Te ha alcanzado una bala de {owner} por {damage} de daño! {kind}.',
      'ann.bulletOtherHit': '{victim} alcanzado por una bala de {owner} por {damage} de daño. {kind}.',
      'ann.bulletYouDodged': 'Has esquivado una bala de {owner}.',
      'ann.bulletOtherDodged': '{target} esquiva una bala de {owner}.',
      'ann.bulletFiresAtYou': '{label} dispara apuntándote.',
      'ann.bulletFiresAt': '{label} dispara apuntando a {target}.',
      'ann.bulletFires': '{label} dispara.',
      'ann.mineDropped': 'Mina soltada. Quedan {count}.',
      'ann.mineDroppedBy': '{label} suelta una mina.',
      'ann.mineYouHitOwn': '¡Has alcanzado {ownerLabel} por {damage} de daño!',
      'ann.mineOtherHit': '{victim} ha pisado {ownerLabel} por {damage} de daño.',
      'ann.mineOwnerYou': 'tu mina',
      'ann.mineOwnerOther': 'la mina de {label}',
      'ann.mineOwnerUnknown': 'una mina',
      'ann.healthPackYou': 'Botiquín. +{amount}. Ahora {health} de salud.',
      'ann.healthPackOther': '{label} recoge un botiquín. Ahora {health} de salud.',
      'ann.shieldYou1': 'Escudo. 1 escudo listo.',
      'ann.shieldYouN': 'Escudo. {count} escudos listos.',
      'ann.shieldOther': '{label} recoge un escudo. Tiene {count}.',
      'ann.bulletsYou': 'Balas. +{amount}. {total} en total.',
      'ann.bulletsOther': '{label} recoge balas. Tiene {count}.',
      'ann.mineYou1': 'Mina. 1 mina lista.',
      'ann.mineYouN': 'Mina. {count} minas listas.',
      'ann.mineOther': '{label} recoge una mina. Tiene {count}.',
      'ann.boostYou1': 'Turbo. 1 turbo listo.',
      'ann.boostYouN': 'Turbo. {count} turbos listos.',
      'ann.boostOther': '{label} recoge un turbo. Tiene {count}.',
      'ann.boostUseYou': '¡Turbo! Tres segundos.',
      'ann.boostUseOther': '¡{label} usa el turbo!',
      'ann.teleportYou1': 'Teletransporte. 1 teletransporte listo.',
      'ann.teleportYouN': 'Teletransporte. {count} teletransportes listos.',
      'ann.teleportOther': '{label} recoge un teletransporte. Tiene {count}.',
      'ann.teleportUseYou': '¡Teletransporte! Nueva posición.',
      'ann.teleportUseOther': '{label} se teletransporta.',

      // Default labels
      'label.you': 'Tú',
      'label.ai': 'IA {n}',
      'label.car': 'Coche {n}',
      'label.host': 'Anfitrión',
      'label.player': 'Jugador',

      // Pickup labels
      'pickup.health': 'botiquín',
      'pickup.shield': 'escudo',
      'pickup.bullets': 'balas',
      'pickup.mine': 'mina',
      'pickup.speed': 'turbo',
      'pickup.teleport': 'teletransporte',

      // Arena bearings
      'arena.onTopOfYou': 'justo encima de ti',
      'arena.bearing.front': 'delante',
      'arena.bearing.frontLeft': 'delante a la izquierda',
      'arena.bearing.left': 'a la izquierda',
      'arena.bearing.behindLeft': 'detrás a la izquierda',
      'arena.bearing.behind': 'detrás',
      'arena.bearing.behindRight': 'detrás a la derecha',
      'arena.bearing.right': 'a la derecha',
      'arena.bearing.frontRight': 'delante a la derecha',
      'arena.range.veryClose': 'muy cerca',
      'arena.range.close': 'cerca',
      'arena.range.midRange': 'media distancia',
      'arena.range.far': 'lejos',
      'arena.bearingFmt': '{bearing}, {range}',

      // Targeting commentary
      'target.chasing': '{label} te está persiguiendo',
      'target.fleeing': '{label} huye',
      'target.approaching': '{label} se acerca',
      'target.leaving': '{label} se aleja',
      'target.circling': '{label} ronda',
      'target.idle': '{label} parado',
      'target.changedDirection': '{label} cambió de dirección',
      'target.shortFront': 'delante',
      'target.shortLeft': 'a tu izquierda',
      'target.shortBehind': 'detrás de ti',
      'target.shortRight': 'a tu derecha',
      'target.commentaryFmt': '{phrase}, {bearing}, {health} de salud.',
      'target.sweepLine': '{label}: {bearing}, {motion}, {health} de salud',
      'target.motion.approaching': 'acercándose',
      'target.motion.movingAway': 'alejándose',
      'target.motion.circling': 'rondando',
      'target.noOthers': 'No hay otros coches.',
      'target.youEliminated': 'Estás eliminado.',
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

    // Document title is special-cased.
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
