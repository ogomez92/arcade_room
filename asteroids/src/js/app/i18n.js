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
      'menu.start': 'Start (Classic)',
      'menu.arcade': 'Arcade Mode (Powerups)',
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
      'help.controlFire': '<kbd>S</kbd> centre / <kbd>A</kbd> left / <kbd>D</kbd> right — fire (max 4 bullets in flight). <kbd>Space</kbd> — detonate a proton bomb (Arcade Mode)',
      'help.controlAimLock': '<kbd>Tab</kbd> — snap-aim at the most dangerous threat (closing rocks beat drifting ones; UFO bullets and UFOs are prioritised over rocks; your velocity is unchanged so you still have to handle existing drift)',
      'help.controlHyperspace': '<kbd>Shift</kbd> — hyperspace jump (1 in 6 chance of self-destruct)',
      'help.controlPause': '<kbd>Esc</kbd> — pause / back',
      'help.audioIntro': 'The audio listener is locked to the ship — turn the ship and the world sweeps around you.',
      'help.audioLarge': 'Large rocks: low triangle rumble.',
      'help.audioMedium': 'Medium rocks: mid-pitched saw drone.',
      'help.audioSmall': 'Small rocks: high square tone.',
      'help.audioUfo': 'UFO: pulsing tone — big and slow, or small and fast.',
      'help.statusKeys': 'Status hotkeys: <kbd>F1</kbd> score, <kbd>F2</kbd> wave, <kbd>F3</kbd> heading, <kbd>F4</kbd> nearest threat, <kbd>F5</kbd> inventory.',
      'help.arcadeIntro': 'Arcade Mode adds powerups that spawn near you and drift across the field. They vanish after about 22 seconds if you don\'t pick them up. Each has its own sound — audition them on the Learn Sounds screen.',
      'help.arcadeRapidFire': 'Rapid Fire — for 15 seconds, hold a fire key (<kbd>A</kbd>/<kbd>S</kbd>/<kbd>D</kbd>) to fire continuously (no 4-bullet cap).',
      'help.arcadeBigShots': 'Big Shots — for 15 seconds, your bullets are much bigger and easier to hit with.',
      'help.arcadeScoreBonus': 'Score Bonus — instant random bonus, scales with the current wave.',
      'help.arcadeRockSpawn': 'Rock Spawn — spawns 10 small rocks anywhere in the field. Risk/reward.',
      'help.arcadeScoreMultiplier': 'Score Multiplier — for 18 seconds, every point you score is multiplied by the current wave number.',
      'help.arcadeExtraLife': 'Extra Life — instantly grants one extra life.',
      'help.arcadeProtonBomb': 'Proton Bomb — collected into a stackable inventory. Press <kbd>Space</kbd> to detonate one: it vaporises every rock, UFO and enemy bullet in a wide radius. Press <kbd>F5</kbd> to check how many you hold.',
      'help.arcadeShield': 'Shield — absorbs the next hit that would destroy your ship, then is spent.',
      'help.arcadeTab': '<kbd>Tab</kbd> in Arcade Mode aims at the current powerup if one is on the field, otherwise at the most dangerous threat as in Classic.',
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
      'learn.ufoBullet': 'UFO bullet (incoming fire)',
      'learn.hyperspace': 'Hyperspace jump',
      'learn.death': 'Death dirge',
      'learn.waveClear': 'Wave clear',
      'learn.bonusLife': 'Bonus life',
      'learn.pwrRapidFire': 'Powerup — Rapid Fire',
      'learn.pwrBigShots': 'Powerup — Big Shots',
      'learn.pwrScoreBonus': 'Powerup — Score Bonus',
      'learn.pwrRockSpawn': 'Powerup — Rock Spawn',
      'learn.pwrScoreMultiplier': 'Powerup — Score Multiplier',
      'learn.pwrExtraLife': 'Powerup — Extra Life',
      'learn.pwrProtonBomb': 'Powerup — Proton Bomb',
      'learn.pwrShield': 'Powerup — Shield',
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
      'ann.deathRockLarge': 'Ship destroyed. You crashed into a large rock.',
      'ann.deathRockMedium': 'Ship destroyed. You crashed into a medium rock.',
      'ann.deathRockSmall': 'Ship destroyed. You crashed into a small rock.',
      'ann.deathUfo': 'Ship destroyed. You collided with a UFO.',
      'ann.deathUfoBullet': 'Ship destroyed. Hit by enemy fire.',
      'ann.deathHyperspace': 'Ship destroyed. Hyperspace failure.',
      'ann.gameOver': 'Game over.',
      'ann.playing': 'Playing {label}.',
      'ann.kindLarge': 'large rock',
      'ann.kindMedium': 'medium rock',
      'ann.kindSmall': 'small rock',
      'ann.kindUfoBig': 'big UFO',
      'ann.kindUfoSmall': 'small UFO',
      'ann.kindUfoBullet': 'UFO bullet',
      'ann.kindPwrRapidFire': 'rapid-fire powerup',
      'ann.kindPwrBigShots': 'big-shots powerup',
      'ann.kindPwrScoreBonus': 'score-bonus powerup',
      'ann.kindPwrRockSpawn': 'rock-spawn powerup',
      'ann.kindPwrScoreMultiplier': 'score-multiplier powerup',
      'ann.kindPwrExtraLife': 'extra-life powerup',
      'ann.kindPwrProtonBomb': 'proton-bomb powerup',
      'ann.kindPwrShield': 'shield powerup',

      // Powerups
      'ann.pwrSpawnRapidFire': 'Rapid-fire powerup on the field.',
      'ann.pwrSpawnBigShots': 'Big-shots powerup on the field.',
      'ann.pwrSpawnScoreBonus': 'Score-bonus powerup on the field.',
      'ann.pwrSpawnRockSpawn': 'Rock-spawn powerup on the field.',
      'ann.pwrSpawnScoreMultiplier': 'Score-multiplier powerup on the field.',
      'ann.pwrSpawnExtraLife': 'Extra-life powerup on the field.',
      'ann.pwrSpawnProtonBomb': 'Proton-bomb powerup on the field.',
      'ann.pwrSpawnShield': 'Shield powerup on the field.',
      'ann.pwrGone': 'Powerup gone.',
      'ann.pwrRapidFire': 'Rapid fire!',
      'ann.pwrRapidFireEnd': 'Rapid fire ended.',
      'ann.pwrBigShots': 'Big shots!',
      'ann.pwrBigShotsEnd': 'Big shots ended.',
      'ann.pwrScoreBonus': 'Bonus: {points} points.',
      'ann.pwrRockSpawn': 'Rocks incoming!',
      'ann.pwrScoreMultiplier': 'Score multiplier active!',
      'ann.pwrScoreMultiplierEnd': 'Score multiplier ended.',
      'ann.pwrExtraLife': 'Extra life!',
      'ann.pwrProtonBomb': 'Proton bomb collected.',
      'ann.pwrShield': 'Shield up!',
      'ann.bombFired': 'Proton bomb detonated. {count} cleared.',
      'ann.bombEmpty': 'No proton bombs in inventory.',
      'ann.shieldBlock': 'Shield absorbed the hit.',
      'ann.inventory': 'Inventory: {bombs} proton bombs, {shields} shields.',
      'ann.debugArmed': 'Debug grant key armed.',
      'ann.debugBomb': 'Debug: proton bomb granted. {bombs} in inventory.',
      'ann.debugShield': 'Debug: shield granted.',

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
      'menu.start': 'Empezar (Clásico)',
      'menu.arcade': 'Modo Arcade (Potenciadores)',
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
      'help.controlFire': '<kbd>S</kbd> centro / <kbd>A</kbd> izquierda / <kbd>D</kbd> derecha — disparar (máx. 4 balas en vuelo). <kbd>Espacio</kbd> — detonar una bomba de protones (Modo Arcade)',
      'help.controlAimLock': '<kbd>Tab</kbd> — apuntar a la amenaza más peligrosa (las rocas que se acercan tienen prioridad sobre las que se alejan; las balas y los OVNIs tienen prioridad sobre las rocas; la velocidad no cambia, así que sigues arrastrando con tu inercia)',
      'help.controlHyperspace': '<kbd>Mayús</kbd> — hiperespacio (1 entre 6 de fallar)',
      'help.controlPause': '<kbd>Esc</kbd> — pausa / atrás',
      'help.audioIntro': 'El oyente sigue a la nave — cuando giras, el mundo gira en tus oídos.',
      'help.audioLarge': 'Rocas grandes: triángulo grave.',
      'help.audioMedium': 'Rocas medianas: sierra media.',
      'help.audioSmall': 'Rocas pequeñas: cuadrada aguda.',
      'help.audioUfo': 'OVNI: tono pulsante — grande lento, o pequeño rápido.',
      'help.statusKeys': 'Atajos de estado: <kbd>F1</kbd> puntos, <kbd>F2</kbd> oleada, <kbd>F3</kbd> rumbo, <kbd>F4</kbd> amenaza más cercana, <kbd>F5</kbd> inventario.',
      'help.arcadeIntro': 'El Modo Arcade añade potenciadores que aparecen cerca de ti y se desplazan por el campo. Desaparecen al cabo de unos 22 segundos si no los recoges. Cada uno tiene su sonido propio — pruébalos en la pantalla Aprender Sonidos.',
      'help.arcadeRapidFire': 'Fuego Rápido — durante 15 segundos, mantén pulsada una tecla de disparo (<kbd>A</kbd>/<kbd>S</kbd>/<kbd>D</kbd>) para disparar sin parar (sin el límite de 4 balas).',
      'help.arcadeBigShots': 'Balas Grandes — durante 15 segundos, tus balas son mucho más grandes y fáciles de acertar.',
      'help.arcadeScoreBonus': 'Puntos Extra — bonus aleatorio inmediato, multiplicado por la oleada actual.',
      'help.arcadeRockSpawn': 'Lluvia de Rocas — aparecen 10 rocas pequeñas en cualquier parte del campo. Riesgo y recompensa.',
      'help.arcadeScoreMultiplier': 'Multiplicador de Puntos — durante 18 segundos, cada punto que consigas se multiplica por el número de la oleada actual.',
      'help.arcadeExtraLife': 'Vida Extra — concede al instante una vida adicional.',
      'help.arcadeProtonBomb': 'Bomba de Protones — se guarda en un inventario acumulable. Pulsa <kbd>Espacio</kbd> para detonar una: vaporiza todas las rocas, OVNIs y balas enemigas en un amplio radio. Pulsa <kbd>F5</kbd> para ver cuántas tienes.',
      'help.arcadeShield': 'Escudo — absorbe el próximo impacto que destruiría tu nave, y luego se gasta.',
      'help.arcadeTab': '<kbd>Tab</kbd> en Modo Arcade apunta al potenciador si hay uno en el campo; si no, apunta a la amenaza más peligrosa como en el modo Clásico.',
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
      'learn.ufoBullet': 'Bala de OVNI (fuego entrante)',
      'learn.hyperspace': 'Hiperespacio',
      'learn.death': 'Muerte',
      'learn.waveClear': 'Oleada superada',
      'learn.bonusLife': 'Vida extra',
      'learn.pwrRapidFire': 'Potenciador — Fuego Rápido',
      'learn.pwrBigShots': 'Potenciador — Balas Grandes',
      'learn.pwrScoreBonus': 'Potenciador — Puntos Extra',
      'learn.pwrRockSpawn': 'Potenciador — Lluvia de Rocas',
      'learn.pwrScoreMultiplier': 'Potenciador — Multiplicador de Puntos',
      'learn.pwrExtraLife': 'Potenciador — Vida Extra',
      'learn.pwrProtonBomb': 'Potenciador — Bomba de Protones',
      'learn.pwrShield': 'Potenciador — Escudo',
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
      'ann.deathRockLarge': 'Nave destruida. Chocaste con una roca grande.',
      'ann.deathRockMedium': 'Nave destruida. Chocaste con una roca mediana.',
      'ann.deathRockSmall': 'Nave destruida. Chocaste con una roca pequeña.',
      'ann.deathUfo': 'Nave destruida. Chocaste con un OVNI.',
      'ann.deathUfoBullet': 'Nave destruida. Te alcanzó el fuego enemigo.',
      'ann.deathHyperspace': 'Nave destruida. Fallo de hiperespacio.',
      'ann.gameOver': 'Fin de la partida.',
      'ann.playing': 'Reproduciendo {label}.',
      'ann.kindLarge': 'roca grande',
      'ann.kindMedium': 'roca mediana',
      'ann.kindSmall': 'roca pequeña',
      'ann.kindUfoBig': 'OVNI grande',
      'ann.kindUfoSmall': 'OVNI pequeño',
      'ann.kindUfoBullet': 'bala de OVNI',
      'ann.kindPwrRapidFire': 'potenciador de fuego rápido',
      'ann.kindPwrBigShots': 'potenciador de balas grandes',
      'ann.kindPwrScoreBonus': 'potenciador de puntos extra',
      'ann.kindPwrRockSpawn': 'potenciador de lluvia de rocas',
      'ann.kindPwrScoreMultiplier': 'potenciador de multiplicador de puntos',
      'ann.kindPwrExtraLife': 'potenciador de vida extra',
      'ann.kindPwrProtonBomb': 'potenciador de bomba de protones',
      'ann.kindPwrShield': 'potenciador de escudo',

      'ann.pwrSpawnRapidFire': 'Potenciador de fuego rápido en el campo.',
      'ann.pwrSpawnBigShots': 'Potenciador de balas grandes en el campo.',
      'ann.pwrSpawnScoreBonus': 'Potenciador de puntos extra en el campo.',
      'ann.pwrSpawnRockSpawn': 'Potenciador de lluvia de rocas en el campo.',
      'ann.pwrSpawnScoreMultiplier': 'Potenciador de multiplicador de puntos en el campo.',
      'ann.pwrSpawnExtraLife': 'Potenciador de vida extra en el campo.',
      'ann.pwrSpawnProtonBomb': 'Potenciador de bomba de protones en el campo.',
      'ann.pwrSpawnShield': 'Potenciador de escudo en el campo.',
      'ann.pwrGone': 'Potenciador desaparecido.',
      'ann.pwrRapidFire': '¡Fuego rápido!',
      'ann.pwrRapidFireEnd': 'Se acabó el fuego rápido.',
      'ann.pwrBigShots': '¡Balas grandes!',
      'ann.pwrBigShotsEnd': 'Se acabaron las balas grandes.',
      'ann.pwrScoreBonus': 'Bonus: {points} puntos.',
      'ann.pwrRockSpawn': '¡Lluvia de rocas!',
      'ann.pwrScoreMultiplier': '¡Multiplicador de puntos activo!',
      'ann.pwrScoreMultiplierEnd': 'Se acabó el multiplicador de puntos.',
      'ann.pwrExtraLife': '¡Vida extra!',
      'ann.pwrProtonBomb': 'Bomba de protones recogida.',
      'ann.pwrShield': '¡Escudo activado!',
      'ann.bombFired': 'Bomba de protones detonada. {count} eliminados.',
      'ann.bombEmpty': 'No tienes bombas de protones.',
      'ann.shieldBlock': 'El escudo absorbió el impacto.',
      'ann.inventory': 'Inventario: {bombs} bombas de protones, {shields} escudos.',
      'ann.debugArmed': 'Tecla de depuración activada.',
      'ann.debugBomb': 'Depuración: bomba de protones concedida. {bombs} en el inventario.',
      'ann.debugShield': 'Depuración: escudo concedido.',

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
