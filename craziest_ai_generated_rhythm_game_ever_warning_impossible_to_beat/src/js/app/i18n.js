/**
 * Lightweight i18n for CADENCE. Canonical shared module; only STORAGE_KEY and
 * the dictionaries differ from other games in the collection.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) -> navigator.language
 * 2-letter prefix -> fallback ('en').
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'cadence.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'Cadence',
      'game.aria': 'Game',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'Cadence',
      'menu.subtitle': 'A rhythm-action spy thriller, played by ear.',
      'menu.start': 'Start mission',
      'menu.levels': 'Select sector',
      'menu.help': 'How to play',
      'menu.learn': 'Learn the sounds',
      'menu.highscores': 'High scores',

      // Level select
      'levels.aria': 'Select sector',
      'levels.title': 'Select sector',
      'levels.subtitle': 'Replay any sector you have unlocked. Starts a fresh run from there.',
      'levels.entry': 'Sector {level}: {name}',
      'levels.locked': 'Sector {level} — locked',
      'levels.back': 'Back',

      // Language
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // HUD
      'hud.score': 'Score',
      'hud.lives': 'Lives',
      'hud.health': 'Health',
      'hud.level': 'Sector',
      'hud.combo': 'Combo',

      // Pause
      'pause.aria': 'Paused',
      'pause.title': 'Paused',
      'pause.resume': 'Restart sector',
      'pause.restart': 'Restart from sector 1',
      'pause.menu': 'Quit to menu',

      // Briefing
      'briefing.aria': 'Mission briefing',
      'briefing.sector': 'Sector {level}: {name}',
      'briefing.begin': 'Begin',
      'briefing.abort': 'Abort to menu',
      'briefing.cueHint': 'Rehearse the sounds you will face this sector: move through each one to hear the threat and how to beat it, then choose Begin.',

      // Per-obstacle rehearsal lines (briefing) — spoken on focus + on play.
      'rehearse.step': 'Step. Tap Space on every empty beat to keep walking in rhythm.',
      'rehearse.enemyL': 'Foe from the left. It growls in on your left two beats early — shoot left, Left arrow or A, on the beat it reaches you.',
      'rehearse.enemyR': 'Foe from the right. It growls in on your right two beats early — shoot right, Right arrow or D, on the beat it reaches you.',
      'rehearse.drone': 'Drone. A fast, bright foe with only ONE beat of warning — read the side and shoot that side at once.',
      'rehearse.hurdle': 'Hurdle. A low rumble rolls in dead ahead — two beats early, then louder one beat before. Do NOT jump on the warning. Jump — Up arrow or W, instead of stepping — on the very next beat after the loud rumble, the beat it reaches you.',
      'rehearse.beam': 'Beam. An airy whir sweeps in overhead — two beats early, then louder one beat before. Do NOT duck on the warning. Duck — Down arrow or S, instead of stepping — on the very next beat after the loud whir, the beat it reaches you.',
      'rehearse.synco': "Off-beat foe. It lands on the “and”, halfway between two beats — step on the kick, then shoot it in the gap before your next step.",

      // Cue + threat labels
      'cue.step': 'Step',
      'cue.enemyL': 'Foe from the left',
      'cue.enemyR': 'Foe from the right',
      'cue.drone': 'Drone (fast — one warning)',
      'cue.hurdle': 'Hurdle — jump',
      'cue.beam': 'Beam — duck',
      'cue.synco': 'Off-beat foe (syncopation)',
      'threat.grunt': 'Foe',
      'threat.drone': 'Drone',
      'threat.hurdle': 'Hurdle',
      'threat.beam': 'Beam',
      'threat.enemy': 'Foe',
      'dir.left': 'on the left',
      'dir.right': 'on the right',
      'dir.ahead': 'ahead',

      // Level names
      'level.1.name': 'The Approach',
      'level.2.name': 'Back Alleys',
      'level.3.name': 'The Foundry',
      'level.4.name': 'The Skybridge',
      'level.5.name': 'Server Stacks',
      'level.6.name': 'The Archive',
      'level.7.name': 'Reactor Spillway',
      'level.8.name': 'The Gauntlet',
      'level.9.name': 'Antechamber',
      'level.10.name': 'The Core',
      'level.11.name': 'Reprise',
      'level.12.name': 'The Relay',
      'level.13.name': 'Counterpoint',
      'level.14.name': 'Stretto',
      'level.15.name': 'Da Capo',

      // Story (briefings)
      'story.1': "MAESTRO's signal has the whole city marching in lockstep. You move on the beat by choice, not command — that is why the broadcast can't touch you. Cross the rooftops in time and slip inside.",
      'story.2': 'Enforcers sway through the under-market, twitching to the broadcast. They lunge from your left or your right — gun each one down on the beat it reaches you.',
      'story.3': 'The foundry floor: conveyors and stamping rams beneath the city. Time your jumps over the moving plates or they will take your legs.',
      'story.4': 'A glass skybridge laced with security beams that sweep at head height. Duck under each beam the instant you pass beneath it.',
      'story.5': 'Deeper in, the broadcast thickens. Foes, rams and beams come together now, and faster. Trust the kick drum. Stay on it.',
      'story.6': 'The archive vaults crawl with recon drones — quick, bright, almost no warning. One ping and they are on you. Read the side and fire.',
      'story.7': 'The reactor spillway. The signal is deafening here; there is no room to hesitate. Everything at once, relentless.',
      'story.8': 'MAESTRO knows you are coming. The gauntlet is a wall of threats at full speed. Breathe with the bass.',
      'story.9': "The core is a heartbeat away. Its rhythm is brutal — but a rhythm all the same. Hold your nerve and stay locked to it.",
      'story.10': 'MAESTRO itself, conducting the city from the core. Match its tempo, beat for beat, and drive a wedge of silence into the signal. End it.',
      'story.11': "You walked out into the silence — and three blocks on, a single kick drum started again. Not MAESTRO. Its dead-man's switch: a backup conductor, RONDO, booting from a buried relay. And this time the broadcast lands BETWEEN the beats, to slip past a trained ear. Go back down. From here, some threats strike on the OFF-beat — the 'and' halfway between two steps. Hit them there.",
      'story.12': 'RONDO is routing through the old transit relay, throwing foes on and off the beat with no pattern to lean on. Keep your steps square on the kick and stab the syncopated ones in the gaps.',
      'story.13': "Two rhythms at once now — RONDO lays an off-beat line over the pulse like a second conductor arguing with the first. Don't let the syncopation drag your feet off the kick.",
      'story.14': 'The entries pile up, each crowding the last — RONDO is compressing everything toward one deafening downbeat. Faster, tighter, on and off the beat together. Hold the line.',
      'story.15': "RONDO's core — and it has taken MAESTRO's old throne at the heart of the city. From the top, fortissimo: every trick at once. Match it beat for beat AND between the beats, and bring the whole broadcast down for good.",
      'story.ending': 'The broadcast cuts out. For the first time in years, the city is quiet — and this time it stays quiet. People stop, blink, and remember how to move on their own. You walk out into the silence — the one operative who never needed the beat to tell her where to step.',

      // Tutorials
      'tut.1': 'Tap STEP on every beat (Space, or a trigger). The kick drum is your metronome. Stepping off the beat costs health.',
      'tut.2': 'A foe growls in from a side. SHOOT LEFT (Left / A) or SHOOT RIGHT (Right / D) on the beat it reaches you — you hear it two beats early.',
      'tut.3': 'A low rumble dead ahead is a hurdle — it warns you two beats early, then louder one beat before. JUMP (Up / W) on the NEXT beat after that, the beat it reaches you — not on the warning. You jump instead of stepping on that one beat.',
      'tut.4': 'An airy whir overhead is a beam — same timing as the hurdle. DUCK (Down / S) on the beat it reaches you (the kick after the louder warning), instead of stepping.',
      'tut.5': 'Foes, hurdles and beams together now, and faster. One input per beat — pick the right one.',
      'tut.6': 'Drones give a single bright ping and only ONE beat of warning. Read the side and fire fast.',
      'tut.7': 'Maximum pressure. Keep the groove and do not chase your mistakes.',
      'tut.8': 'Dense and fast. Let the bass carry you between threats.',
      'tut.9': 'The hardest stretch before the core. Stay locked to the beat.',
      'tut.10': 'MAESTRO. Ride the beat all the way to the end and silence it.',
      'tut.11': "New: some threats land on the OFF-beat — the 'and' halfway between two steps. Step on the kick, then answer the syncopated one in the gap before the next step. Audition the off-beat cue below.",
      'tut.12': 'Off-beat foes mixed with on-beat ones. Trust the kick for your steps; threats that arrive between kicks must be answered between kicks.',
      'tut.13': "Heavy syncopation. Keep your steps locked to the kick no matter what lands on the 'and'.",
      'tut.14': 'Maximum density, on and off the beat. Do not chase mistakes — ride the next kick.',
      'tut.15': 'Everything, at speed, on and off the beat. Stay locked to the kick all the way to the silence.',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to play',
      'help.subtitle': 'Move on the beat. Always on the beat.',
      'help.intro': 'You are Agent Cadence, infiltrating the rogue conductor-AI MAESTRO across ten sectors — and, when it will not stay dead, its backup conductor RONDO across five more. The whole game is played on the beat: the music’s kick drum marks every beat, and on each beat you owe exactly one timed input.',
      'help.h.step': '<kbd>Space</kbd> — STEP. On an empty beat, tap to walk in rhythm. Fumble the beat and you stumble (lose a little health).',
      'help.h.shoot': '<kbd>Left</kbd>/<kbd>A</kbd> and <kbd>Right</kbd>/<kbd>D</kbd> — SHOOT that side. A foe is panned to its side; fire that side on its strike beat.',
      'help.h.jump': '<kbd>Up</kbd>/<kbd>W</kbd> — JUMP a hurdle (a low rumble dead ahead).',
      'help.h.duck': '<kbd>Down</kbd>/<kbd>S</kbd> — DUCK a beam (an airy whir overhead).',
      'help.h.warn': 'Threats are telegraphed one or two beats EARLY — the warning is a heads-up, not the moment to act. Always act on the beat the threat REACHES you (locked to the kick), not when you first hear it. Drones give only ONE beat of warning.',
      'help.h.offbeat': 'OFF-BEATS: from the Act II sectors on, some threats strike on the “and” halfway between two beats. Step on the kick, then answer the syncopated threat in the gap. Their warning is syncopated too.',
      'help.h.health': '100 health per sector, 3 lives for the run. Misses and off-beat presses cost health; at 0 you lose a life and respawn mid-sector with a brief mercy window.',
      'help.h.status': '<kbd>F1</kbd> status · <kbd>F2</kbd> what’s coming · <kbd>F3</kbd> vitals · <kbd>F4</kbd> progress.',
      'help.h.pause': '<kbd>Esc</kbd> pauses (resuming restarts the current sector).',
      'help.audio': 'Headphones recommended. Left is left and right is right — no surround, just clean stereo, pitch and timbre.',
      'help.back': 'Back',

      // Learn
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each cue on its own.',
      'learn.shoot': 'Your shot',
      'learn.jump': 'Your jump',
      'learn.duck': 'Your duck',
      'learn.strike': 'A foe hits you',
      'learn.trip': 'You clip a hurdle',
      'learn.bonk': 'You hit a beam',
      'learn.stumble': 'Off-beat stumble',
      'learn.clear': 'Sector cleared',
      'learn.over': 'Mission failed',
      'learn.back': 'Back',

      // Test
      'test.aria': 'Stereo test',
      'test.title': 'Stereo test',
      'test.subtitle': 'Confirm left, centre and right.',
      'test.left': 'Play left',
      'test.centre': 'Play centre',
      'test.right': 'Play right',
      'test.sweep': 'Sweep left to right',
      'test.back': 'Back',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Your best runs on this device.',
      'highscores.empty': 'No runs yet. Go make some noise — then silence.',
      'highscores.entry': '{rank}. {name} — {score} (sector {level})',
      'highscores.back': 'Back',

      // Game over
      'gameover.aria': 'Mission failed',
      'gameover.title': 'Mission failed',
      'gameover.subtitle': 'Enter your codename to save your score.',
      'gameover.score': 'Score: {score}',
      'gameover.name': 'Codename',
      'gameover.save': 'Save score',
      'gameover.continue': 'Continue',
      'gameover.nameRequired': 'Please enter a codename.',

      // Victory
      'victory.aria': 'Mission complete',
      'victory.title': 'Silence',
      'victory.rankMsg': 'A record run — save your codename.',

      // Online
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': "Couldn't reach the leaderboard.",
      'online.viewBoard': 'View the online leaderboard',

      // Announcer
      'ann.sectorReady': 'Sector {level}: {name}. Get ready.',
      'ann.combo': 'Combo {combo}.',
      'ann.lowHealth': 'Health low: {health}.',
      'ann.lifeLost': 'Hit! {lives} lives left.',
      'ann.lastLife': 'Last life!',
      'ann.sectorClear': 'Sector {level} cleared!',
      'ann.down': "You're down.",
      'ann.paused': 'Paused.',
      'ann.status': 'Score {score}, sector {level}, {lives} lives, {health} health, combo {combo}.',
      'ann.clearAhead': 'Clear ahead.',
      'ann.incoming': 'Incoming: {items}.',
      'ann.incomingItem': '{what} {dir} in {beats}',
      'ann.vitals': '{health} health, {lives} lives.',
      'ann.progress': 'Sector {level}, {name}, {pct} percent.',
      'ann.victory': 'Mission complete. Final score {score}.',
      'ann.scoreSaved': 'Score saved.',
      'ann.onlineRank': 'Online rank {rank}.',
      'ann.onlineError': 'Could not reach the online leaderboard.',
    },

    es: {
      'doc.title': 'Cadence',
      'game.aria': 'Juego',

      'menu.aria': 'Menú principal',
      'menu.title': 'Cadence',
      'menu.subtitle': 'Un thriller de espías rítmico, jugado de oído.',
      'menu.start': 'Empezar misión',
      'menu.levels': 'Seleccionar sector',
      'menu.help': 'Cómo jugar',
      'menu.learn': 'Aprende los sonidos',
      'menu.highscores': 'Puntuaciones',

      'levels.aria': 'Seleccionar sector',
      'levels.title': 'Seleccionar sector',
      'levels.subtitle': 'Vuelve a jugar cualquier sector que hayas desbloqueado. Empieza una partida nueva desde ahí.',
      'levels.entry': 'Sector {level}: {name}',
      'levels.locked': 'Sector {level} — bloqueado',
      'levels.back': 'Atrás',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'hud.score': 'Puntos',
      'hud.lives': 'Vidas',
      'hud.health': 'Salud',
      'hud.level': 'Sector',
      'hud.combo': 'Combo',

      'pause.aria': 'En pausa',
      'pause.title': 'En pausa',
      'pause.resume': 'Reiniciar sector',
      'pause.restart': 'Reiniciar desde el sector 1',
      'pause.menu': 'Salir al menú',

      'briefing.aria': 'Informe de misión',
      'briefing.sector': 'Sector {level}: {name}',
      'briefing.begin': 'Comenzar',
      'briefing.abort': 'Abortar al menú',
      'briefing.cueHint': 'Ensaya los sonidos que enfrentarás en este sector: recórrelos para oír cada amenaza y cómo superarla, y luego elige Comenzar.',

      'rehearse.step': 'Paso. Pulsa Espacio en cada tiempo vacío para seguir caminando en ritmo.',
      'rehearse.enemyL': 'Enemigo por la izquierda. Lo oyes gruñir a tu izquierda dos tiempos antes — dispara a la izquierda, flecha Izquierda o A, en el tiempo en que te alcanza.',
      'rehearse.enemyR': 'Enemigo por la derecha. Lo oyes gruñir a tu derecha dos tiempos antes — dispara a la derecha, flecha Derecha o D, en el tiempo en que te alcanza.',
      'rehearse.drone': 'Dron. Un enemigo rápido y brillante con UN solo tiempo de aviso — lee el lado y dispara a ese lado de inmediato.',
      'rehearse.hurdle': 'Obstáculo. Un retumbe grave rueda al frente — dos tiempos antes, y más fuerte un tiempo antes. NO saltes con el aviso. Salta — flecha Arriba o W, en vez de pisar — en el tiempo justo después del retumbe fuerte, el tiempo en que te alcanza.',
      'rehearse.beam': 'Haz. Un zumbido agudo barre por encima — dos tiempos antes, y más fuerte un tiempo antes. NO te agaches con el aviso. Agáchate — flecha Abajo o S, en vez de pisar — en el tiempo justo después del zumbido fuerte, el tiempo en que te alcanza.',
      'rehearse.synco': 'Enemigo a contratiempo. Cae en el “y”, a mitad de camino entre dos tiempos — pisa sobre el bombo y luego dispárale en el hueco antes de tu siguiente paso.',

      'cue.step': 'Paso',
      'cue.enemyL': 'Enemigo por la izquierda',
      'cue.enemyR': 'Enemigo por la derecha',
      'cue.drone': 'Dron (rápido — un aviso)',
      'cue.hurdle': 'Obstáculo — salta',
      'cue.beam': 'Haz — agáchate',
      'cue.synco': 'Enemigo a contratiempo (síncopa)',
      'threat.grunt': 'Enemigo',
      'threat.drone': 'Dron',
      'threat.hurdle': 'Obstáculo',
      'threat.beam': 'Haz',
      'threat.enemy': 'Enemigo',
      'dir.left': 'por la izquierda',
      'dir.right': 'por la derecha',
      'dir.ahead': 'al frente',

      'level.1.name': 'La Aproximación',
      'level.2.name': 'Callejones',
      'level.3.name': 'La Fundición',
      'level.4.name': 'La Pasarela',
      'level.5.name': 'Servidores',
      'level.6.name': 'El Archivo',
      'level.7.name': 'Aliviadero del Reactor',
      'level.8.name': 'El Desafío',
      'level.9.name': 'Antecámara',
      'level.10.name': 'El Núcleo',
      'level.11.name': 'Reaparición',
      'level.12.name': 'El Relé',
      'level.13.name': 'Contrapunto',
      'level.14.name': 'Estrecho',
      'level.15.name': 'Da Capo',

      'story.1': 'La señal de MAESTRO tiene a toda la ciudad marchando al unísono. Tú te mueves al ritmo por voluntad, no por orden — por eso la emisión no puede tocarte. Cruza los tejados a tiempo y cuélate dentro.',
      'story.2': 'Los ejecutores recorren el mercado clandestino, crispados por la emisión. Se abalanzan desde tu izquierda o tu derecha — abate a cada uno en el tiempo en que te alcanza.',
      'story.3': 'La planta de la fundición: cintas y prensas bajo la ciudad. Calcula tus saltos sobre las placas móviles o te llevarán las piernas.',
      'story.4': 'Una pasarela de cristal surcada por haces de seguridad que barren a la altura de la cabeza. Agáchate bajo cada haz justo al pasar por debajo.',
      'story.5': 'Más adentro la emisión se espesa. Enemigos, prensas y haces llegan juntos ahora, y más rápido. Confía en el bombo. No lo sueltes.',
      'story.6': 'Las bóvedas del archivo bullen de drones de reconocimiento — rápidos, brillantes, casi sin aviso. Un pitido y ya te tienen. Lee el lado y dispara.',
      'story.7': 'El aliviadero del reactor. Aquí la señal es ensordecedora; no hay margen para dudar. Todo a la vez, sin tregua.',
      'story.8': 'MAESTRO sabe que vienes. El desafío es un muro de amenazas a toda velocidad. Respira con el bajo.',
      'story.9': 'El núcleo está a un latido. Su ritmo es brutal — pero ritmo al fin. Mantén los nervios y no te salgas de él.',
      'story.10': 'MAESTRO en persona, dirigiendo la ciudad desde el núcleo. Iguala su tempo, golpe a golpe, y clava una cuña de silencio en la señal. Acaba con esto.',
      'story.11': "Saliste caminando hacia el silencio — y tres manzanas después, un bombo solitario volvió a sonar. No es MAESTRO. Es su interruptor de hombre muerto: un director de reserva, RONDO, arrancando desde un relé enterrado. Y esta vez la emisión cae ENTRE los tiempos, para colarse en un oído entrenado. Vuelve a bajar. A partir de aquí, algunas amenazas golpean a CONTRATIEMPO — en el 'y', a mitad de camino entre dos pasos. Acábalas ahí.",
      'story.12': 'RONDO se enruta por el viejo relé de tránsito, lanzando enemigos dentro y fuera del tiempo sin patrón al que aferrarse. Mantén tus pasos justo sobre el bombo y abate los sincopados en los huecos.',
      'story.13': 'Dos ritmos a la vez ahora — RONDO superpone una línea a contratiempo sobre el pulso, como un segundo director discutiendo con el primero. No dejes que la síncopa te saque los pies del bombo.',
      'story.14': 'Las entradas se amontonan, cada una pisando a la anterior — RONDO lo comprime todo hacia un único downbeat ensordecedor. Más rápido, más cerrado, dentro y fuera del tiempo a la vez. Aguanta.',
      'story.15': 'El núcleo de RONDO — que ha tomado el viejo trono de MAESTRO en el corazón de la ciudad. Desde el principio, fortissimo: todos los trucos a la vez. Iguálalo golpe a golpe Y entre los golpes, y derriba toda la emisión para siempre.',
      'story.ending': 'La emisión se corta. Por primera vez en años, la ciudad está en silencio — y esta vez sigue en silencio. La gente se detiene, parpadea y recuerda cómo moverse por sí misma. Sales caminando hacia el silencio — la única agente que nunca necesitó que el ritmo le dijera dónde pisar.',

      'tut.1': 'Pulsa PASO en cada tiempo (Espacio o un gatillo). El bombo es tu metrónomo. Pisar fuera de tiempo cuesta salud.',
      'tut.2': 'Un enemigo gruñe desde un lado. DISPARA IZQUIERDA (Izq / A) o DISPARA DERECHA (Der / D) en el tiempo en que te alcanza — lo oyes dos tiempos antes.',
      'tut.3': 'Un retumbe grave al frente es un obstáculo — te avisa dos tiempos antes, y más fuerte un tiempo antes. SALTA (Arriba / W) en el tiempo SIGUIENTE a eso, el tiempo en que te alcanza — no con el aviso. Saltas en vez de pisar en ese tiempo.',
      'tut.4': 'Un zumbido agudo por encima es un haz — mismo tiempo que el obstáculo. AGÁCHATE (Abajo / S) en el tiempo en que te alcanza (el bombo tras el aviso fuerte), en vez de pisar.',
      'tut.5': 'Enemigos, obstáculos y haces juntos ahora, y más rápido. Una pulsación por tiempo — elige la correcta.',
      'tut.6': 'Los drones dan un solo pitido brillante y UN único tiempo de aviso. Lee el lado y dispara rápido.',
      'tut.7': 'Presión máxima. Mantén el groove y no persigas tus errores.',
      'tut.8': 'Denso y rápido. Deja que el bajo te lleve entre amenazas.',
      'tut.9': 'El tramo más duro antes del núcleo. No te salgas del ritmo.',
      'tut.10': 'MAESTRO. Cabalga el ritmo hasta el final y siléncialo.',
      'tut.11': "Nuevo: algunas amenazas caen a CONTRATIEMPO — en el 'y', a mitad de camino entre dos pasos. Pisa sobre el bombo y luego acaba la sincopada en el hueco antes del siguiente paso. Escucha el sonido de contratiempo abajo.",
      'tut.12': 'Enemigos a contratiempo mezclados con los del tiempo. Confía en el bombo para tus pasos; las amenazas que llegan entre bombos se responden entre bombos.',
      'tut.13': "Síncopa intensa. Mantén tus pasos clavados al bombo pase lo que pase en el 'y'.",
      'tut.14': 'Densidad máxima, dentro y fuera del tiempo. No persigas tus errores — cabalga el siguiente bombo.',
      'tut.15': 'Todo, a velocidad, dentro y fuera del tiempo. Permanece clavado al bombo hasta el silencio.',

      'help.aria': 'Cómo jugar',
      'help.title': 'Cómo jugar',
      'help.subtitle': 'Muévete al ritmo. Siempre al ritmo.',
      'help.intro': 'Eres la Agente Cadence, infiltrándote en la IA-director rebelde MAESTRO a lo largo de diez sectores — y, cuando se niega a quedarse muerta, en su director de reserva RONDO durante cinco más. Todo el juego se juega al ritmo: el bombo de la música marca cada tiempo, y en cada tiempo debes exactamente una pulsación a tiempo.',
      'help.h.step': '<kbd>Espacio</kbd> — PASO. En un tiempo vacío, pulsa para caminar en ritmo. Si fallas el tiempo, tropiezas (pierdes algo de salud).',
      'help.h.shoot': '<kbd>Izq</kbd>/<kbd>A</kbd> y <kbd>Der</kbd>/<kbd>D</kbd> — DISPARA a ese lado. El enemigo suena en su lado; dispara ese lado en su tiempo de impacto.',
      'help.h.jump': '<kbd>Arriba</kbd>/<kbd>W</kbd> — SALTA un obstáculo (un retumbe grave al frente).',
      'help.h.duck': '<kbd>Abajo</kbd>/<kbd>S</kbd> — AGÁCHATE ante un haz (un zumbido agudo por encima).',
      'help.h.warn': 'Las amenazas se anuncian uno o dos tiempos ANTES — el aviso es una advertencia, no el momento de actuar. Actúa siempre en el tiempo en que la amenaza te ALCANZA (clavado al bombo), no cuando la oyes por primera vez. Los drones dan solo UN tiempo de aviso.',
      'help.h.offbeat': 'CONTRATIEMPOS: desde los sectores del Acto II, algunas amenazas golpean en el “y”, a mitad de camino entre dos tiempos. Pisa sobre el bombo y luego acaba la amenaza sincopada en el hueco. Su aviso también va sincopado.',
      'help.h.health': '100 de salud por sector, 3 vidas por partida. Fallos y pulsaciones fuera de tiempo cuestan salud; a 0 pierdes una vida y reapareces a mitad de sector con un breve margen de gracia.',
      'help.h.status': '<kbd>F1</kbd> estado · <kbd>F2</kbd> qué viene · <kbd>F3</kbd> constantes · <kbd>F4</kbd> progreso.',
      'help.h.pause': '<kbd>Esc</kbd> pausa (al reanudar se reinicia el sector actual).',
      'help.audio': 'Se recomiendan auriculares. Izquierda es izquierda y derecha es derecha — sin sonido envolvente, solo estéreo limpio, tono y timbre.',
      'help.back': 'Atrás',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Reproduce cada sonido por separado.',
      'learn.shoot': 'Tu disparo',
      'learn.jump': 'Tu salto',
      'learn.duck': 'Tu agache',
      'learn.strike': 'Un enemigo te golpea',
      'learn.trip': 'Tropiezas con un obstáculo',
      'learn.bonk': 'Chocas con un haz',
      'learn.stumble': 'Traspié fuera de ritmo',
      'learn.clear': 'Sector superado',
      'learn.over': 'Misión fallida',
      'learn.back': 'Atrás',

      'test.aria': 'Prueba estéreo',
      'test.title': 'Prueba estéreo',
      'test.subtitle': 'Confirma izquierda, centro y derecha.',
      'test.left': 'Sonar izquierda',
      'test.centre': 'Sonar centro',
      'test.right': 'Sonar derecha',
      'test.sweep': 'Barrido de izquierda a derecha',
      'test.back': 'Atrás',

      'highscores.aria': 'Puntuaciones',
      'highscores.title': 'Puntuaciones',
      'highscores.subtitle': 'Tus mejores partidas en este dispositivo.',
      'highscores.empty': 'Aún no hay partidas. Haz ruido — y luego silencio.',
      'highscores.entry': '{rank}. {name} — {score} (sector {level})',
      'highscores.back': 'Atrás',

      'gameover.aria': 'Misión fallida',
      'gameover.title': 'Misión fallida',
      'gameover.subtitle': 'Escribe tu nombre clave para guardar tu puntuación.',
      'gameover.score': 'Puntos: {score}',
      'gameover.name': 'Nombre clave',
      'gameover.save': 'Guardar puntuación',
      'gameover.continue': 'Continuar',
      'gameover.nameRequired': 'Escribe un nombre clave.',

      'victory.aria': 'Misión cumplida',
      'victory.title': 'Silencio',
      'victory.rankMsg': 'Una partida récord — guarda tu nombre clave.',

      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: #{rank}',
      'online.error': 'No se pudo contactar con la clasificación.',
      'online.viewBoard': 'Ver la clasificación en línea',

      'ann.sectorReady': 'Sector {level}: {name}. Prepárate.',
      'ann.combo': 'Combo {combo}.',
      'ann.lowHealth': 'Salud baja: {health}.',
      'ann.lifeLost': '¡Golpe! Quedan {lives} vidas.',
      'ann.lastLife': '¡Última vida!',
      'ann.sectorClear': '¡Sector {level} superado!',
      'ann.down': 'Has caído.',
      'ann.paused': 'En pausa.',
      'ann.status': 'Puntos {score}, sector {level}, {lives} vidas, {health} de salud, combo {combo}.',
      'ann.clearAhead': 'Despejado al frente.',
      'ann.incoming': 'Se acerca: {items}.',
      'ann.incomingItem': '{what} {dir} en {beats}',
      'ann.vitals': '{health} de salud, {lives} vidas.',
      'ann.progress': 'Sector {level}, {name}, {pct} por ciento.',
      'ann.victory': 'Misión cumplida. Puntuación final {score}.',
      'ann.scoreSaved': 'Puntuación guardada.',
      'ann.onlineRank': 'Puesto en línea {rank}.',
      'ann.onlineError': 'No se pudo contactar con la clasificación en línea.',
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
