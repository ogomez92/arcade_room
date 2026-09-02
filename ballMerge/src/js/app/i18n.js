/**
 * Lightweight i18n for accessible audio games.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
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
 *
 * This is the canonical implementation shared across all games. To localize
 * a new game: copy this file, change STORAGE_KEY (e.g. 'pong.lang'), and
 * fill in the per-game dictionaries below.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'basket.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Basket',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Basket',
      'menu.subtitle': "Catch falling balls and crash them together. Bigger balls fall faster. Drop one and it's over.",
      'menu.start': 'Classic mode',
      'menu.help': 'How to play',
      'menu.learn': 'Learn the sounds',
      'menu.highscores': 'High scores',
      'menu.arcade': 'Arcade mode',
      'mode.classic': 'Classic',
      'mode.arcade': 'Arcade',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Game
      'game.aria': 'Game',
      'hud.round': 'Round',
      'hud.score': 'Score',
      'hud.held': 'Holding',
      'hud.progress': 'Merges',
      'hud.lives': 'Lives',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.menu': 'Main menu',

      // Game over
      'gameover.aria': 'Run over',
      'gameover.title': 'Dropped!',
      'gameover.titleWin': 'You beat the game!',
      'gameover.score': '{mode}. Score: {score}. You reached round {round}. Biggest ball: {maxMass}.',
      'gameover.scoreWin': '{mode}. Score: {score}. All {round} rounds cleared. Biggest ball: {maxMass}.',
      'gameover.subtitle': 'That made the top ten! Enter your name to save it.',
      'gameover.name': 'Your name',
      'gameover.save': 'Save score',
      'gameover.nameRequired': 'Please enter a name to save your score.',
      'gameover.postPrompt': 'Post this score to the online scoreboard?',
      'gameover.postYes': 'Post online',
      'gameover.postNo': 'No thanks',
      'gameover.continue': 'Continue',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the online scoreboard. Your score is saved on this device.",
      'online.viewBoard': 'View the online scoreboard',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No scores yet. Go catch some balls!',
      'highscores.entry': '{rank}. {name} — {score} points, round {round}',
      'highscores.entryWon': '{rank}. {name} — {score} points, beat the game',
      'highscores.back': 'Back',
      'highscores.classic': 'Classic mode',
      'highscores.arcade': 'Arcade mode',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Catch every ball. Crash them together. Never let one touch the ground.',
      'help.intro': 'You carry a basket along a lane. Balls fall from the sky. Catch a ball, then throw it up into the next one so the two crash and merge into a bigger, heavier ball — which falls faster. Merge enough balls and the round is yours. If any ball touches the ground, the run is over.',
      'help.h.move': '<strong>Run</strong> with <kbd>←</kbd> <kbd>→</kbd> (or <kbd>A</kbd> <kbd>D</kbd>, gamepad stick or d-pad). Soft footsteps confirm you are moving; a dull thud means you hit the edge of the lane.',
      'help.h.catch': '<strong>Catch</strong> by standing under a falling ball with empty hands. A ball is in your left ear when it is to your left, in your right ear when it is to your right, and dead centre when it is straight above you.',
      'help.h.throw': '<strong>Throw</strong> the ball you hold straight up with <kbd>Space</kbd>, <kbd>↑</kbd> or <kbd>Enter</kbd> (gamepad A). Heavier balls cannot be thrown as high, so the target has to come lower first.',
      'help.h.merge': '<strong>Merge</strong>: when the thrown ball hits another ball they crash and become one. The higher the merge, the more points — and the more time you have to get under the new, faster ball. Hit it dead centre and it drops straight down; hit it off-centre and it veers sideways.',
      'help.h.bump': '<strong>Bump</strong>: if a ball lands on the ball you are holding, they merge anyway — a low thud, a small hop, fewer points. It is your safety net, not your plan.',
      'help.h.size': '<strong>Size is pitch.</strong> Small balls are high and light with a quick flutter; big balls are low and round with a slow wobble and a rush of wind. Bigger balls are easier to hit, but they fall faster.',
      'help.h.ticks': '<strong>Speed is the ticking.</strong> Every falling ball ticks, and the ticks speed up as it nears your basket. A heavy ball\'s ticks pile up much faster than a light one\'s — that is how fast it will land. A ball also gets louder and brighter as it comes down.',
      'help.h.lock': '<strong>Lock</strong>: when a ball is straight above you a bright overtone joins its voice and a soft tick marks the moment. Stay in the lock to catch it.',
      'help.h.range': '<strong>In range</strong>: while you hold a ball, it hums in the centre. When a throw right now would hit, a chime plays and the hum brightens. Throw early for height, but only when it is in range.',
      'help.h.drift': '<strong>Drift</strong>: from round two balls drift sideways and bounce off the walls with a rubbery boing. Listen to which way the pan is moving and lead it.',
      'help.h.rounds': '<strong>Rounds</strong>: each round asks for more merges, bigger incoming balls, faster cadence and more drift. From round four the next ball can appear while you are still waiting for the last one. Clear ten rounds to beat the game; the score counts either way.',
      'help.h.status': '<strong>Status keys</strong>: <kbd>F1</kbd> score and round, <kbd>F2</kbd> what you are holding and whether it is in range, <kbd>F3</kbd> the balls in the air, <kbd>F4</kbd> round progress.',
      'help.h.pause': '<strong>Pause</strong> with <kbd>Escape</kbd> (gamepad Start).',
      'help.h.arcade': '<strong>Arcade mode</strong> adds lives and power-ups. You start with two extra lives: when a ball hits the ground you lose one, hear a short splat, and the same ball comes back from the sky a moment later. Drop one with no lives left and the run ends.',
      'help.h.powerups': '<strong>Power-ups</strong> hang from the ceiling, each with its own repeating jingle panned where it is: a rising triad is an <strong>extra life</strong>, a coin ding-ding is <strong>bonus points</strong>, a tick-tock is <strong>slow time</strong>, a wide swell is a <strong>wide basket</strong>. Get under it and <strong>throw a ball up into it</strong> to collect. It slowly lowers for eight seconds, its jingle hurrying at the end, then is pulled back up with a zip. Light balls reach it straight away; heavy balls have to wait for it to come down.',
      'help.h.lives': '<strong>In reach?</strong> While you hold a ball, a quick bell triplet and a fast flutter on the hum mean a throw right now would reach the power-up. Slow time and wide basket last a few seconds and end with a small cue; <kbd>F1</kbd> reads your lives.',
      'help.audio': 'Play with headphones or well-separated speakers: left and right are the whole game. The Learn the sounds screen plays every cue on its own.',
      'help.back': 'Back',

      // Learn
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each cue on its own.',
      'learn.small': 'A small ball falling',
      'learn.big': 'A big ball falling (faster)',
      'learn.left': 'A ball to your left',
      'learn.right': 'A ball to your right',
      'learn.lock': 'A ball straight above you, then caught',
      'learn.held': 'Holding a ball',
      'learn.inrange': 'Holding a ball, target comes in range',
      'learn.throw': 'Throwing',
      'learn.merge': 'Two balls merging in the air',
      'learn.bump': 'A ball merging on your basket',
      'learn.wall': 'A ball bouncing off the walls',
      'learn.clear': 'Round clear',
      'learn.drop': 'A ball hitting the ground',
      'learn.puLife': 'Power-up: extra life (then collected)',
      'learn.puBonus': 'Power-up: bonus points (then collected)',
      'learn.puSlow': 'Power-up: slow time (then collected)',
      'learn.puWide': 'Power-up: wide basket (then collected)',
      'learn.puGone': 'A power-up pulled back up',
      'learn.lifeLost': 'Losing a life (arcade)',
      'learn.back': 'Back',

      // Test
      'test.aria': 'Stereo audio test',
      'test.title': 'Stereo audio test',
      'test.subtitle': 'Confirm left, right, and pitch.',
      'test.left': 'Play far left',
      'test.center': 'Play centre',
      'test.right': 'Play far right',
      'test.small': 'Play small ball pitch',
      'test.big': 'Play big ball pitch',
      'test.sweep': 'Sweep left to right',
      'test.back': 'Back',

      // Announcements
      'ann.go': 'Go!',
      'ann.paused': 'Paused.',
      'ann.resumed': 'Resumed.',
      'ann.roundStart': 'Round {round}. Merge {merges} balls.',
      'ann.seed': 'Ball {dir}. Catch it.',
      'ann.spawn': 'Size {size}, {dir}.',
      'ann.dirLeft': 'left',
      'ann.dirRight': 'right',
      'ann.dirAbove': 'above you',
      'ann.merge': 'Size {size}. {done} of {needed}.',
      'ann.bump': 'Bumped to size {size}. {done} of {needed}.',
      'ann.roundClear': 'Round {round} clear! Ball of {size} banked, plus {points}.',
      'ann.roundClearPerfect': 'Perfect round {round}! Ball of {size} banked, plus {points}.',
      'ann.drop': 'The size {size} ball hit the ground.',
      'ann.over': 'Run over. Score {score}, round {round}.',
      'ann.overHigh': 'Run over. Score {score}, round {round}. A new high score!',
      'ann.win': 'You beat the game! Score {score}.',
      'ann.winHigh': 'You beat the game! Score {score}. A new high score!',
      'ann.status': 'Score {score}. Round {round}, {done} of {needed} merges.',
      'ann.progress': 'Round {round} of {total}. {done} of {needed} merges.',
      'ann.heldNone': 'Hands empty.',
      'ann.held': 'Holding size {size}. Not in range.',
      'ann.heldInRange': 'Holding size {size}. In range.',
      'ann.noBalls': 'Nothing in the air.',
      'ann.ball': 'Size {size}, {dir}, {alt}, {motion}.',
      'ann.altHigh': 'high',
      'ann.altMid': 'halfway',
      'ann.altLow': 'low',
      'ann.rising': 'rising',
      'ann.landsIn': 'lands in {seconds} seconds',
      'ann.scoreSaved': 'Score saved.',
      'ann.postPrompt': 'Post this score to the online scoreboard? Choose Post online or No thanks.',
      'ann.onlineRank': 'Posted. Online rank {rank}.',
      'ann.onlineError': 'Could not reach the online scoreboard. Saved locally.',
      'ann.powerup': 'Power-up: {name}, {dir}.',
      'ann.pu.life': 'extra life',
      'ann.pu.bonus': 'bonus points',
      'ann.pu.slow': 'slow time',
      'ann.pu.wide': 'wide basket',
      'ann.powerupGone': 'Power-up gone.',
      'ann.powerupStatus': 'Power-up {name}, {dir}, {seconds} seconds left.',
      'ann.collectLife': 'Extra life! Lives {lives}.',
      'ann.collectBonus': 'Bonus! Plus {points}.',
      'ann.collectSlow': 'Slow time for {seconds} seconds!',
      'ann.collectWide': 'Wide basket for {seconds} seconds!',
      'ann.effectEndSlow': 'Time back to normal.',
      'ann.effectEndWide': 'Basket back to normal.',
      'ann.lifeLost': 'Dropped! Lives {lives}. The ball comes back.',
      'ann.lifeLostLast': 'Dropped! No lives left. The ball comes back.',
      'ann.returned': 'Size {size} returns, {dir}.',
      'ann.statusArcade': 'Score {score}. Round {round}, {done} of {needed} merges. Lives {lives}.',
      'ann.heldInRangePowerup': 'Holding size {size}. Power-up in reach.',
      'ann.heldInRangeBoth': 'Holding size {size}. Ball in range, power-up in reach.',
    },

    es: {
      // <head>
      'doc.title': 'Basket',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'Basket',
      'menu.subtitle': 'Atrapa las bolas que caen y hazlas chocar entre sí. Las bolas grandes caen más rápido. Si una toca el suelo, se acabó.',
      'menu.start': 'Modo clásico',
      'menu.help': 'Cómo se juega',
      'menu.learn': 'Aprender los sonidos',
      'menu.highscores': 'Mejores puntuaciones',
      'menu.arcade': 'Modo arcade',
      'mode.classic': 'Clásico',
      'mode.arcade': 'Arcade',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Game
      'game.aria': 'Juego',
      'hud.round': 'Ronda',
      'hud.score': 'Puntos',
      'hud.held': 'En la cesta',
      'hud.progress': 'Fusiones',
      'hud.lives': 'Vidas',

      // Pause
      'pause.aria': 'En pausa',
      'pause.title': 'En pausa',
      'pause.resume': 'Continuar',
      'pause.restart': 'Reiniciar',
      'pause.menu': 'Menú principal',

      // Game over
      'gameover.aria': 'Fin de la partida',
      'gameover.title': '¡Se cayó!',
      'gameover.titleWin': '¡Has ganado!',
      'gameover.score': '{mode}. Puntos: {score}. Llegaste a la ronda {round}. Bola más grande: {maxMass}.',
      'gameover.scoreWin': '{mode}. Puntos: {score}. Las {round} rondas superadas. Bola más grande: {maxMass}.',
      'gameover.subtitle': '¡Entra en el top diez! Escribe tu nombre para guardarla.',
      'gameover.name': 'Tu nombre',
      'gameover.save': 'Guardar puntuación',
      'gameover.nameRequired': 'Escribe un nombre para guardar tu puntuación.',
      'gameover.postPrompt': '¿Publicar esta puntuación en la tabla online?',
      'gameover.postYes': 'Publicar online',
      'gameover.postNo': 'No, gracias',
      'gameover.continue': 'Continuar',

      // Online
      'online.posting': 'Publicando tu puntuación…',
      'online.rank': 'Posición online: #{rank}',
      'online.error': 'No se pudo conectar con la tabla online. Tu puntuación queda guardada en este dispositivo.',
      'online.viewBoard': 'Ver la tabla online',

      // High scores
      'highscores.aria': 'Mejores puntuaciones',
      'highscores.title': 'Mejores puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Ve a atrapar bolas!',
      'highscores.entry': '{rank}. {name} — {score} puntos, ronda {round}',
      'highscores.entryWon': '{rank}. {name} — {score} puntos, juego completado',
      'highscores.back': 'Atrás',
      'highscores.classic': 'Modo clásico',
      'highscores.arcade': 'Modo arcade',

      // Help
      'help.aria': 'Cómo se juega',
      'help.title': 'Cómo se juega',
      'help.subtitle': 'Atrapa todas las bolas. Hazlas chocar. Que ninguna toque el suelo.',
      'help.intro': 'Llevas una cesta por un carril. Del cielo caen bolas. Atrapa una y lánzala hacia arriba contra la siguiente para que choquen y se fusionen en una bola más grande y pesada, que cae más rápido. Fusiona suficientes bolas y ganas la ronda. Si alguna bola toca el suelo, la partida termina.',
      'help.h.move': '<strong>Corre</strong> con <kbd>←</kbd> <kbd>→</kbd> (o <kbd>A</kbd> <kbd>D</kbd>, palanca o cruceta del mando). Unos pasos suaves confirman que te mueves; un golpe sordo indica que has llegado al borde del carril.',
      'help.h.catch': '<strong>Atrapa</strong> colocándote bajo una bola que cae con las manos vacías. Una bola suena en tu oído izquierdo cuando está a tu izquierda, en el derecho cuando está a tu derecha, y justo en el centro cuando está encima de ti.',
      'help.h.throw': '<strong>Lanza</strong> la bola que sostienes hacia arriba con <kbd>Espacio</kbd>, <kbd>↑</kbd> o <kbd>Intro</kbd> (botón A del mando). Las bolas pesadas no suben tanto, así que el objetivo tiene que bajar más primero.',
      'help.h.merge': '<strong>Fusión</strong>: cuando la bola lanzada golpea otra bola, chocan y se convierten en una sola. Cuanto más alto ocurra, más puntos y más tiempo tendrás para ponerte bajo la nueva bola, más rápida. Golpéala justo en el centro y caerá recta; golpéala de lado y se desviará.',
      'help.h.bump': '<strong>Rebote</strong>: si una bola cae sobre la que sostienes, también se fusionan: un golpe grave, un pequeño salto y menos puntos. Es tu red de seguridad, no tu plan.',
      'help.h.size': '<strong>El tamaño es el tono.</strong> Las bolas pequeñas suenan agudas y ligeras, con un aleteo rápido; las grandes suenan graves y redondas, con un bamboleo lento y un rumor de viento. Las bolas grandes son más fáciles de golpear, pero caen más rápido.',
      'help.h.ticks': '<strong>La velocidad es el tictac.</strong> Cada bola que cae hace tictac, y el tictac se acelera al acercarse a tu cesta. El de una bola pesada se amontona mucho más rápido que el de una ligera: así de rápido va a aterrizar. Además, la bola suena más fuerte y brillante a medida que baja.',
      'help.h.lock': '<strong>Encuadre</strong>: cuando una bola está justo encima de ti, un armónico brillante se suma a su voz y un tic suave marca el momento. Mantente encuadrado para atraparla.',
      'help.h.range': '<strong>A tiro</strong>: mientras sostienes una bola, esta zumba en el centro. Cuando un lanzamiento ahora mismo acertaría, suena una campanilla y el zumbido se ilumina. Lanza pronto para ganar altura, pero solo cuando esté a tiro.',
      'help.h.drift': '<strong>Deriva</strong>: a partir de la segunda ronda las bolas se desplazan de lado y rebotan en las paredes con un boing gomoso. Escucha hacia dónde se mueve el sonido y anticípate.',
      'help.h.rounds': '<strong>Rondas</strong>: cada ronda pide más fusiones, bolas entrantes más grandes, más ritmo y más deriva. Desde la ronda cuatro la siguiente bola puede aparecer mientras aún esperas la anterior. Supera diez rondas para ganar; la puntuación cuenta igualmente.',
      'help.h.status': '<strong>Teclas de estado</strong>: <kbd>F1</kbd> puntos y ronda, <kbd>F2</kbd> qué sostienes y si está a tiro, <kbd>F3</kbd> las bolas en el aire, <kbd>F4</kbd> progreso de la ronda.',
      'help.h.pause': '<strong>Pausa</strong> con <kbd>Escape</kbd> (Start en el mando).',
      'help.h.arcade': '<strong>El modo arcade</strong> añade vidas y potenciadores. Empiezas con dos vidas extra: cuando una bola toca el suelo pierdes una, suena un chapoteo corto y la misma bola vuelve a caer del cielo un momento después. Si se te cae una sin vidas, la partida termina.',
      'help.h.powerups': '<strong>Los potenciadores</strong> cuelgan del techo, cada uno con su propia melodía repetida, situada en estéreo donde está: una tríada ascendente es una <strong>vida extra</strong>, un tintineo de moneda son <strong>puntos extra</strong>, un tictac es <strong>tiempo lento</strong>, un acorde amplio es una <strong>cesta ancha</strong>. Ponte debajo y <strong>lanza una bola hacia arriba</strong> para cogerlo. Baja poco a poco durante ocho segundos, su melodía se acelera al final, y luego sube de golpe con un zumbido. Las bolas ligeras llegan enseguida; las pesadas tienen que esperar a que baje.',
      'help.h.lives': '<strong>¿A tiro?</strong> Mientras sostienes una bola, un tresillo de campanillas y un aleteo rápido en el zumbido indican que un lanzamiento ahora mismo llegaría al potenciador. El tiempo lento y la cesta ancha duran unos segundos y terminan con una señal breve; <kbd>F1</kbd> lee tus vidas.',
      'help.audio': 'Juega con auriculares o con altavoces bien separados: izquierda y derecha son todo el juego. La pantalla Aprender los sonidos reproduce cada señal por separado.',
      'help.back': 'Atrás',

      // Learn
      'learn.aria': 'Aprender los sonidos',
      'learn.title': 'Aprender los sonidos',
      'learn.subtitle': 'Reproduce cada señal por separado.',
      'learn.small': 'Una bola pequeña cayendo',
      'learn.big': 'Una bola grande cayendo (más rápido)',
      'learn.left': 'Una bola a tu izquierda',
      'learn.right': 'Una bola a tu derecha',
      'learn.lock': 'Una bola justo encima de ti, y atrapada',
      'learn.held': 'Sosteniendo una bola',
      'learn.inrange': 'Sosteniendo una bola, el objetivo se pone a tiro',
      'learn.throw': 'Lanzar',
      'learn.merge': 'Dos bolas fusionándose en el aire',
      'learn.bump': 'Una bola fusionándose sobre tu cesta',
      'learn.wall': 'Una bola rebotando en las paredes',
      'learn.clear': 'Ronda superada',
      'learn.drop': 'Una bola tocando el suelo',
      'learn.puLife': 'Potenciador: vida extra (y cogido)',
      'learn.puBonus': 'Potenciador: puntos extra (y cogido)',
      'learn.puSlow': 'Potenciador: tiempo lento (y cogido)',
      'learn.puWide': 'Potenciador: cesta ancha (y cogido)',
      'learn.puGone': 'Un potenciador que sube de golpe',
      'learn.lifeLost': 'Perder una vida (arcade)',
      'learn.back': 'Atrás',

      // Test
      'test.aria': 'Prueba de audio estéreo',
      'test.title': 'Prueba de audio estéreo',
      'test.subtitle': 'Confirma izquierda, derecha y tono.',
      'test.left': 'Reproducir a la izquierda',
      'test.center': 'Reproducir en el centro',
      'test.right': 'Reproducir a la derecha',
      'test.small': 'Tono de bola pequeña',
      'test.big': 'Tono de bola grande',
      'test.sweep': 'Barrido de izquierda a derecha',
      'test.back': 'Atrás',

      // Announcements
      'ann.go': '¡Ya!',
      'ann.paused': 'En pausa.',
      'ann.resumed': 'Continuamos.',
      'ann.roundStart': 'Ronda {round}. Fusiona {merges} bolas.',
      'ann.seed': 'Bola {dir}. Atrápala.',
      'ann.spawn': 'Tamaño {size}, {dir}.',
      'ann.dirLeft': 'a la izquierda',
      'ann.dirRight': 'a la derecha',
      'ann.dirAbove': 'encima de ti',
      'ann.merge': 'Tamaño {size}. {done} de {needed}.',
      'ann.bump': 'Rebote a tamaño {size}. {done} de {needed}.',
      'ann.roundClear': '¡Ronda {round} superada! Bola de {size} guardada, más {points}.',
      'ann.roundClearPerfect': '¡Ronda {round} perfecta! Bola de {size} guardada, más {points}.',
      'ann.drop': 'La bola de tamaño {size} tocó el suelo.',
      'ann.over': 'Fin de la partida. {score} puntos, ronda {round}.',
      'ann.overHigh': 'Fin de la partida. {score} puntos, ronda {round}. ¡Nueva mejor puntuación!',
      'ann.win': '¡Has ganado! {score} puntos.',
      'ann.winHigh': '¡Has ganado! {score} puntos. ¡Nueva mejor puntuación!',
      'ann.status': '{score} puntos. Ronda {round}, {done} de {needed} fusiones.',
      'ann.progress': 'Ronda {round} de {total}. {done} de {needed} fusiones.',
      'ann.heldNone': 'Manos vacías.',
      'ann.held': 'Sostienes tamaño {size}. No está a tiro.',
      'ann.heldInRange': 'Sostienes tamaño {size}. A tiro.',
      'ann.noBalls': 'Nada en el aire.',
      'ann.ball': 'Tamaño {size}, {dir}, {alt}, {motion}.',
      'ann.altHigh': 'alta',
      'ann.altMid': 'a media altura',
      'ann.altLow': 'baja',
      'ann.rising': 'subiendo',
      'ann.landsIn': 'aterriza en {seconds} segundos',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.postPrompt': '¿Publicar esta puntuación en la tabla online? Elige Publicar online o No, gracias.',
      'ann.onlineRank': 'Publicada. Posición online {rank}.',
      'ann.onlineError': 'No se pudo conectar con la tabla online. Guardada en este dispositivo.',
      'ann.powerup': 'Potenciador: {name}, {dir}.',
      'ann.pu.life': 'vida extra',
      'ann.pu.bonus': 'puntos extra',
      'ann.pu.slow': 'tiempo lento',
      'ann.pu.wide': 'cesta ancha',
      'ann.powerupGone': 'Potenciador perdido.',
      'ann.powerupStatus': 'Potenciador {name}, {dir}, quedan {seconds} segundos.',
      'ann.collectLife': '¡Vida extra! Vidas {lives}.',
      'ann.collectBonus': '¡Bonus! Más {points}.',
      'ann.collectSlow': '¡Tiempo lento durante {seconds} segundos!',
      'ann.collectWide': '¡Cesta ancha durante {seconds} segundos!',
      'ann.effectEndSlow': 'El tiempo vuelve a la normalidad.',
      'ann.effectEndWide': 'La cesta vuelve a la normalidad.',
      'ann.lifeLost': '¡Se cayó! Vidas {lives}. La bola vuelve.',
      'ann.lifeLostLast': '¡Se cayó! Sin vidas. La bola vuelve.',
      'ann.returned': 'Vuelve la de tamaño {size}, {dir}.',
      'ann.statusArcade': '{score} puntos. Ronda {round}, {done} de {needed} fusiones. Vidas {lives}.',
      'ann.heldInRangePowerup': 'Sostienes tamaño {size}. Potenciador a tiro.',
      'ann.heldInRangeBoth': 'Sostienes tamaño {size}. Bola a tiro, potenciador a tiro.',
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
