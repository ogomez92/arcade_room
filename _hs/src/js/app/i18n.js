/**
 * i18n for horses — bilingual EN/ES with per-locale phrase pools.
 *
 * Two lookup paths:
 *   t(key, params)             — scalar string lookup with {placeholder} substitution.
 *   pick(category, params)     — random choice from an ARRAY pool, with anti-repeat
 *                                 memory so the same phrasing doesn't fire back-to-back.
 *
 * The commentator stores {categoryKey, params}, never rendered strings, so a
 * mid-race locale change yields the next line in the new locale's *own*
 * register (not a translation of the prior line).
 *
 * Each locale's phrase pool is hand-authored in its own voice. Spanish is a
 * Spanish-feria barker (repetition, exclamations, gentle ribbing). English is
 * a county-fair hype barker (alliteration, "folks", "ladies and gentlemen").
 * NEVER translate one to the other — write each pool fresh in its register.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'horses.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // --- <head> ----------------------------------------------------------
      'doc.title': 'Horses — Audio Race',

      // --- Splash ----------------------------------------------------------
      'splash.author': 'an audio-fair horse race',
      'splash.instruction': 'Press any key to begin',

      // --- Language picker -------------------------------------------------
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // --- Mode menu -------------------------------------------------------
      'mode.aria': 'Main menu',
      'mode.title': 'Horses',
      'mode.subtitle': 'Throw, hit, race. Last horse to the finish line buys the cider.',
      'mode.championship': 'Championship',
      'mode.singleRace': 'Quick race',
      'mode.multiplayer': 'Multiplayer',
      'mode.learn': 'Learn the sounds',
      'mode.audioTest': 'Audio test',
      'mode.help': 'How to play',
      'mode.language': 'Language',

      // --- Lobby -----------------------------------------------------------
      'lobby.aria': 'Multiplayer lobby',
      'lobby.title': 'Multiplayer',
      'lobby.subtitle': 'Host a room or join one with a code.',
      'lobby.nameLabel': 'Your name',
      'lobby.codeLabel': 'Or enter a code to join',
      'lobby.host': 'Host a room',
      'lobby.join': 'Join',
      'lobby.start': 'Start race',
      'lobby.leave': 'Leave',
      'lobby.back': 'Back',
      'lobby.codeIs': 'Room code',
      'lobby.noPeerJs': 'Multiplayer needs an internet connection. Try again online.',
      'lobby.errorGeneric': 'Connection failed. Try again.',
      'lobby.disconnected': 'Disconnected ({reason}).',

      // --- Championship menu ----------------------------------------------
      'championship.aria': 'Championship',
      'championship.title': 'Championship',
      'championship.subtitle': 'Five races. Best total wins.',
      'championship.continue': 'Continue (race {n} of {total})',
      'championship.new': 'New championship',
      'championship.standings': 'Standings',
      'championship.highscores': 'High scores',
      'championship.back': 'Back',
      'championship.confirmNew': 'Start a new championship? Current progress will be lost.',
      'championship.empty': 'No championship in progress.',

      // --- Game / HUD ------------------------------------------------------
      'game.aria': 'Race in progress',
      'game.help': 'Press space or J to throw. Time it so the cursor sits on the lane you want — narrower lanes score more. Press F1 through F7 for status. Press Escape to pause.',
      'game.paused': 'Paused. Press Escape to resume, Q to quit.',
      'game.countdown.3': 'Three',
      'game.countdown.2': 'Two',
      'game.countdown.1': 'One',
      'game.countdown.go': 'They are off!',

      // --- Race result -----------------------------------------------------
      'result.aria': 'Race result',
      'result.title': 'Result',
      'result.race': 'Race {n} of {total}',
      'result.youFinished': 'You finished {place} of {total}.',
      'result.points': '{name} — {points} pts (this race {race})',
      'result.next': 'Next race',
      'result.continue': 'Continue',
      'result.toMenu': 'Main menu',
      'result.championOver': 'Championship complete',
      'result.totals': 'Final standings',

      // --- High scores -----------------------------------------------------
      'highscores.aria': 'High scores',
      'highscores.title': 'High scores',
      'highscores.subtitle': 'Best championship totals.',
      'highscores.empty': 'No scores yet.',
      'highscores.row': '{rank}. {name} — {points} pts ({date})',
      'highscores.back': 'Back',
      'highscores.you': 'You',

      // --- Learn -----------------------------------------------------------
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Play each sound in isolation.',
      'learn.cursorTick': 'Cursor sweep — lane {n}',
      'learn.thunk': 'Throw',
      'learn.hitChime': 'Hit — lane {n}',
      'learn.miss': 'Miss',
      'learn.whinny': 'Whinny',
      'learn.gallop': 'Gallop',
      'learn.crowd': 'Crowd',
      'learn.organ': 'Fairground organ',
      'learn.photoFinish': 'Photo finish chime',
      'learn.back': 'Back',

      // --- Audio test ------------------------------------------------------
      'test.aria': 'Audio test',
      'test.title': 'Audio test',
      'test.subtitle': 'Ticks at front, right, behind, and left around a static listener. Verify by ear before assuming any other audio bug is real.',
      'test.front': 'Front tick',
      'test.right': 'Right tick',
      'test.behind': 'Behind tick',
      'test.left': 'Left tick',
      'test.back': 'Back',

      // --- Status hotkeys (assertive aria-live) ---------------------------
      'status.position': 'Position {n} of {total}',
      'status.stamina': 'Stamina {pct}%',
      'status.distance': '{travelled} of {total}',
      'status.gapLeader': 'Leader is {gap} ahead',
      'status.gapLeaderYou': 'You are leading by {gap}',
      'status.elapsed': 'Race time {seconds} seconds',
      'status.standings': 'Championship: {summary}',
      'status.raceIndex': 'Race {n} of {total}',

      // --- Horse names ------------------------------------------------------
      // 'horse.player' is what the host's own horse is called in commentary —
      // grammatically third-person so "Your horse takes the lead!" reads.
      // AI fillers draw a distinct index from `horse.pool` per race; MP peers
      // use the name they entered in the lobby (no translation).
      'horse.player': 'Your horse',
      'horse.pool': [
        'Thunder', 'Storm', 'Bandit', 'Shadow', 'Whiskey',
        'Sundance', 'Maverick', 'Apollo', 'Jasper', 'Atlas',
        'Onyx', 'Silver', 'Phoenix', 'Rebel', 'Domino',
        'Hazel', 'Saffron', 'Cinnamon', 'Chief', 'Comet',
      ],

      // --- Commentator pools (ARRAYS) -------------------------------------
      'commentary.preRace': [
        "Ladies and gentlemen, the horses are at the line!",
        "Folks, hush up, hush up, the riders are ready.",
        "All right, all right, hold onto your hats, here we go.",
      ],
      'commentary.countdown.3': ["Three!"],
      'commentary.countdown.2': ["Two!"],
      'commentary.countdown.1': ["One!"],
      'commentary.countdown.go': [
        "They're off!",
        "And they ride!",
        "Here we go folks, here we go!",
      ],
      'commentary.start': [
        "And they're off!",
        "Here we go folks, here we go!",
        "Hold onto your hats, the field is breaking!",
        "Riders riders riders, off they go!",
        "Out of the gate clean — clean as a whistle!",
        "And there they go, six horses pounding turf!",
      ],
      'commentary.midRace': [
        "Halfway through and the field is hot!",
        "We are right in the middle of it now.",
        "These horses are giving everything they've got, folks.",
        "Halfway, and the cider stand is full!",
        "Plenty of race left, plenty of race left.",
      ],
      'commentary.lastStretch': [
        "Down the stretch they come!",
        "Last quarter, last quarter, last quarter!",
        "It is the home stretch and they are FLYING!",
        "Folks, the finish line is in sight!",
      ],
      'commentary.takesLead': [
        "{name} takes the lead!",
        "Move over folks, {name} is in front!",
        "{name} surges to the front of the pack!",
        "Look at that — {name} is ahead!",
        "And just like that, {name} is leading the race!",
      ],
      'commentary.leadGrows': [
        "{name} is pulling away!",
        "{name} stretches the lead!",
        "More daylight for {name}!",
      ],
      'commentary.fightForLead': [
        "{name} and {other} side by side!",
        "Two heads for the front — {name}, {other}, who wants it?!",
        "What a battle up front between {name} and {other}!",
      ],
      'commentary.passes': [
        "{name} passes {other}!",
        "There goes {name} around {other}!",
        "{name} slips past {other}!",
      ],
      'commentary.fallsBack': [
        "{name} drops a place.",
        "{name} can't hold it, slips back.",
        "{name} loses ground.",
      ],
      'commentary.lastPlace': [
        "{name} is dead last, folks.",
        "Somebody bring {name} a sandwich.",
        "{name} is bringing up the rear.",
      ],
      'commentary.lapped': [
        "{name} is way off the pace now.",
        "{name} is falling further behind.",
      ],
      'commentary.bunched': [
        "Tight pack right now — anyone could win this!",
        "It is bunched up, folks, bunched up tight!",
      ],
      'commentary.runaway': [
        "{name} is running away with this!",
        "It's a runaway by {name}!",
        "Nobody can touch {name} right now!",
      ],
      'commentary.tired': [
        "{name} is starting to fade.",
        "{name} is breathing hard, folks.",
        "{name} is leaving it all on the track and starting to feel it.",
      ],
      'commentary.exhausted': [
        "{name} is gassed!",
        "{name} has nothing left in the tank!",
        "{name} is on fumes!",
      ],
      'commentary.recovering': [
        "{name} catching a second wind.",
        "{name} is back in this thing!",
      ],
      'commentary.gassed': [
        "{name} is done, folks, totally done.",
        "Stick a fork in {name}.",
      ],
      'commentary.bullseye': [
        "Bullseye for {name}!",
        "Right in the bucket! {name}!",
        "Oh that is a beauty by {name}!",
        "Dead center! {name} nails it!",
        "Mama mia, what a throw from {name}!",
      ],
      'commentary.streak': [
        "{name} is on a heater — {n} in a row!",
        "{n} straight for {name}!",
        "{name} can't miss! {n} in a row!",
      ],
      'commentary.streakBreak': [
        "And the streak ends for {name}.",
        "Oh, {name} bricks one.",
      ],
      'commentary.coldStreak': [
        "{name} is ice cold right now.",
        "{name} can't buy a hit.",
      ],
      'commentary.terribleMiss': [
        "Where did that one go, {name}?!",
        "Folks, that throw deserves an apology.",
      ],
      'commentary.comeback': [
        "{name} is making a charge!",
        "Look out, here comes {name}!",
        "{name} is climbing through the field!",
      ],
      'commentary.heroicComeback': [
        "Folks, {name} has come from the back to the FRONT!",
        "Hold the phone! {name} is in contention!",
        "What a comeback by {name}, what a comeback!",
      ],
      'commentary.collapse': [
        "And just like that, {name} drops out of the lead.",
        "{name} is coming undone, folks.",
      ],
      'commentary.unbelievable': [
        "Unbelievable!",
        "I cannot believe what I am seeing!",
        "Folks, you tell your kids about this one!",
      ],
      'commentary.aboutToWin': [
        "{name} is about to take it!",
        "{name} smells the finish!",
        "It's all over but the shouting — {name}!",
      ],
      'commentary.win': [
        "{name} takes it!",
        "{name} wins! {name} wins! {name} wins!",
        "Winner — {name}!",
        "Stick a ribbon on {name}, that's the race!",
      ],
      'commentary.photoFinish': [
        "PHOTO FINISH!",
        "Too close to call! Photo finish!",
        "Get the cameras up, get the cameras up!",
      ],
      'commentary.photoFinishCall': [
        "And after the photo... it's {name}!",
        "The photo says — {name}!",
        "By a whisker — {name}!",
      ],
      'commentary.runnerUp': [
        "{name} second.",
        "Bridesmaid finish for {name}.",
      ],
      'commentary.danceOnTheLine': [
        "{name} wins it by a hair!",
        "Just {gap} between {name} and runner-up!",
      ],
      'commentary.crowdReact': [
        "Listen to that crowd!",
        "The grandstand is on its feet!",
        "What a roar!",
      ],
      'commentary.suspense': [
        "...",
        "Quiet now, folks, quiet now.",
        "You could hear a pin drop.",
      ],
      'commentary.silly': [
        "I haven't seen anything like this since I lost my keys.",
        "If my mother could see me now.",
        "Folks, the sandwiches at concessions are ten cents.",
        "Look at that horse go — and look at THAT horse go too!",
      ],
      'commentary.weather': [
        "Beautiful day for it.",
        "Not a cloud in the sky.",
        "Smells like funnel cake out here.",
      ],
      'commentary.shoutout': [
        "Big hello to {name} — go {name} go!",
        "Show some love for {name}!",
      ],
    },

    es: {
      // --- <head> ----------------------------------------------------------
      'doc.title': 'Caballos — carrera de feria',

      // --- Splash ----------------------------------------------------------
      'splash.author': 'una carrera de caballos de feria',
      'splash.instruction': 'Pulsa cualquier tecla para empezar',

      // --- Language picker -------------------------------------------------
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // --- Mode menu -------------------------------------------------------
      'mode.aria': 'Menú principal',
      'mode.title': 'Caballos',
      'mode.subtitle': 'Pelotas, agujeros, caballos. El último al cántaro paga la sidra.',
      'mode.championship': 'Campeonato',
      'mode.singleRace': 'Carrera rápida',
      'mode.multiplayer': 'Multijugador',
      'mode.learn': 'Aprender los sonidos',
      'mode.audioTest': 'Prueba de audio',
      'mode.help': 'Cómo se juega',
      'mode.language': 'Idioma',

      // --- Lobby -----------------------------------------------------------
      'lobby.aria': 'Sala multijugador',
      'lobby.title': 'Multijugador',
      'lobby.subtitle': 'Crea una sala o únete con un código.',
      'lobby.nameLabel': 'Tu nombre',
      'lobby.codeLabel': 'O escribe un código para unirte',
      'lobby.host': 'Crear sala',
      'lobby.join': 'Unirse',
      'lobby.start': 'Empezar carrera',
      'lobby.leave': 'Salir',
      'lobby.back': 'Atrás',
      'lobby.codeIs': 'Código de sala',
      'lobby.noPeerJs': 'El multijugador necesita conexión a internet. Vuelve a intentarlo en línea.',
      'lobby.errorGeneric': 'No se pudo conectar. Inténtalo de nuevo.',
      'lobby.disconnected': 'Desconectado ({reason}).',

      // --- Championship menu ----------------------------------------------
      'championship.aria': 'Campeonato',
      'championship.title': 'Campeonato',
      'championship.subtitle': 'Cinco carreras. Gana el total más alto.',
      'championship.continue': 'Continuar (carrera {n} de {total})',
      'championship.new': 'Nuevo campeonato',
      'championship.standings': 'Clasificación',
      'championship.highscores': 'Récords',
      'championship.back': 'Atrás',
      'championship.confirmNew': '¿Empezar un campeonato nuevo? Se perderá el progreso actual.',
      'championship.empty': 'No hay campeonato en curso.',

      // --- Game / HUD ------------------------------------------------------
      'game.aria': 'Carrera en curso',
      'game.help': 'Pulsa espacio o J para lanzar. Apunta cuando el cursor esté en el carril que quieras — los más estrechos puntúan más. F1 a F7 para estado. Escape para pausar.',
      'game.paused': 'Pausa. Pulsa Escape para seguir, Q para salir.',
      'game.countdown.3': '¡Tres!',
      'game.countdown.2': '¡Dos!',
      'game.countdown.1': '¡Uno!',
      'game.countdown.go': '¡Y arrancan!',

      // --- Race result -----------------------------------------------------
      'result.aria': 'Resultado de la carrera',
      'result.title': 'Resultado',
      'result.race': 'Carrera {n} de {total}',
      'result.youFinished': 'Has acabado en la posición {place} de {total}.',
      'result.points': '{name} — {points} pts (carrera {race})',
      'result.next': 'Siguiente carrera',
      'result.continue': 'Seguir',
      'result.toMenu': 'Menú principal',
      'result.championOver': 'Campeonato terminado',
      'result.totals': 'Clasificación final',

      // --- High scores -----------------------------------------------------
      'highscores.aria': 'Récords',
      'highscores.title': 'Récords',
      'highscores.subtitle': 'Mejores totales de campeonato.',
      'highscores.empty': 'Aún no hay récords.',
      'highscores.row': '{rank}. {name} — {points} pts ({date})',
      'highscores.back': 'Atrás',
      'highscores.you': 'Tú',

      // --- Learn -----------------------------------------------------------
      'learn.aria': 'Aprender los sonidos',
      'learn.title': 'Aprender los sonidos',
      'learn.subtitle': 'Reproduce cada sonido por separado.',
      'learn.cursorTick': 'Cursor — carril {n}',
      'learn.thunk': 'Lanzamiento',
      'learn.hitChime': 'Acierto — carril {n}',
      'learn.miss': 'Fallo',
      'learn.whinny': 'Relincho',
      'learn.gallop': 'Galope',
      'learn.crowd': 'Público',
      'learn.organ': 'Organillo',
      'learn.photoFinish': 'Llegada en foto',
      'learn.back': 'Atrás',

      // --- Audio test ------------------------------------------------------
      'test.aria': 'Prueba de audio',
      'test.title': 'Prueba de audio',
      'test.subtitle': 'Ticks delante, derecha, detrás e izquierda alrededor del oyente. Comprueba con auriculares antes de buscar otros bugs de audio.',
      'test.front': 'Tick delante',
      'test.right': 'Tick derecha',
      'test.behind': 'Tick detrás',
      'test.left': 'Tick izquierda',
      'test.back': 'Atrás',

      // --- Status hotkeys --------------------------------------------------
      'status.position': 'Posición {n} de {total}',
      'status.stamina': 'Aliento {pct} por ciento',
      'status.distance': '{travelled} de {total}',
      'status.gapLeader': 'El líder va a {gap} por delante',
      'status.gapLeaderYou': 'Vas en cabeza por {gap}',
      'status.elapsed': 'Tiempo {seconds} segundos',
      'status.standings': 'Campeonato: {summary}',
      'status.raceIndex': 'Carrera {n} de {total}',

      // --- Horse names -----------------------------------------------------
      'horse.player': 'Tu caballo',
      'horse.pool': [
        'Lucero', 'Centella', 'Trueno', 'Bandido', 'Estrella',
        'Caramelo', 'Tornado', 'Azabache', 'Capitán', 'Sultán',
        'Príncipe', 'Camelia', 'Romero', 'Jazmín', 'Tabernero',
        'Zorro', 'Apache', 'Volcán', 'Reluciente', 'Relámpago',
      ],

      // --- Commentator pools (ARRAYS) -------------------------------------
      'commentary.preRace': [
        "¡Señoras y señores, los caballos en la línea!",
        "¡Atención atención, que va a empezar la cosa!",
        "¡Aaaagarraos los pantalones, que esto arranca!",
      ],
      'commentary.countdown.3': ["¡Tres!"],
      'commentary.countdown.2': ["¡Dos!"],
      'commentary.countdown.1': ["¡Uno!"],
      'commentary.countdown.go': [
        "¡Y arrancan, arrancan, arrancan!",
        "¡Carrerón carrerón carrerón!",
        "¡Vamos allá señoras y señores, vamos allá!",
        "¡Dale dale dale, que empieza la cosa!",
      ],
      'commentary.start': [
        "¡Salida limpia, salida limpísima!",
        "¡Y se lanzan los seis al galope!",
        "¡Hala, ahí van todos como almas que lleva el diablo!",
        "¡Empieza la carrera, empieza la carrera, EMPIEZA LA CARRERA!",
        "¡Ay madre mía, qué salida!",
        "¡Qué arrancada, qué arrancada, señoras y señores!",
      ],
      'commentary.midRace': [
        "¡Vamos por la mitad y esto arde!",
        "¡A mitad de carrera, a mitad de carrera!",
        "¡Estos caballos están dejando hasta la última gota!",
        "¡Mucho pulso, mucho pulso por ahí!",
        "¡Y todavía queda carrera para rato!",
      ],
      'commentary.lastStretch': [
        "¡Recta final, recta final, recta final!",
        "¡Última recta, último empujón!",
        "¡Ya se huele la meta!",
        "¡Vamos a la última, vamos a la última!",
      ],
      'commentary.takesLead': [
        "¡{name} se pone en cabeza!",
        "¡Aparta aparta, que llega {name}!",
        "¡{name} se planta el primero!",
        "¡Mira mira, ahora manda {name}!",
        "¡Y de repente, {name} al frente!",
      ],
      'commentary.leadGrows': [
        "¡{name} se escapa!",
        "¡{name} se va solo de paseo!",
        "¡Más distancia para {name}, más distancia!",
      ],
      'commentary.fightForLead': [
        "¡{name} y {other} cabeza con cabeza!",
        "¡Madre mía, {name} y {other} no se sueltan!",
        "¡Qué pelea ahí delante entre {name} y {other}!",
      ],
      'commentary.passes': [
        "¡{name} adelanta a {other}!",
        "¡{name} le come el polvo a {other}!",
        "¡Por dentro, {name}! ¡Adiós {other}!",
      ],
      'commentary.fallsBack': [
        "¡{name} pierde un puesto, qué pena!",
        "¡{name} se queda atrás!",
        "¡Se cae {name}, se cae {name}!",
      ],
      'commentary.lastPlace': [
        "¡Y {name} de farolillo rojo, oiga!",
        "Que alguien le traiga un bocadillo a {name}.",
        "¡{name} cierra el grupo, pobrecito!",
      ],
      'commentary.lapped': [
        "¡{name} se ha quedado descolgadísimo!",
        "¡A {name} ya no le ven ni los prismáticos!",
      ],
      'commentary.bunched': [
        "¡Esto está apretado, apretadísimo!",
        "¡Aquí cualquiera puede ganar, señoras y señores!",
      ],
      'commentary.runaway': [
        "¡{name} se escapa solito!",
        "¡Esto es de {name}, esto es de {name}!",
        "¡Nadie pilla a {name}!",
      ],
      'commentary.tired': [
        "¡{name} empieza a flojear!",
        "¡{name} resopla como una locomotora!",
        "¡Ay, {name} se está vaciando!",
      ],
      'commentary.exhausted': [
        "¡{name} no puede más!",
        "¡{name} está fundido, fundidísimo!",
        "¡A {name} se le ha acabado la gasolina!",
      ],
      'commentary.recovering': [
        "¡{name} coge aire, mucho cuidado!",
        "¡{name} ha resucitado!",
      ],
      'commentary.gassed': [
        "¡{name} ya está para el corral!",
        "Echadle una manta a {name} que se va a casa.",
      ],
      'commentary.bullseye': [
        "¡Toma castaña, {name}!",
        "¡Diana diana diana!",
        "¡Eso es un lanzamiento como Dios manda, {name}!",
        "¡Olé el caballo de {name}!",
        "¡Al centro, al centro, al centro!",
      ],
      'commentary.streak': [
        "¡{name} está enchufadísimo, {n} seguidos!",
        "¡{n} seguidos para {name}!",
        "¡Que no falla, que no falla {name}!",
      ],
      'commentary.streakBreak': [
        "¡Se acabó la racha de {name}!",
        "¡Vaya, {name} la pifia!",
      ],
      'commentary.coldStreak': [
        "¡{name} no la mete ni con un mapa!",
        "¡{name} está frío como una nevera!",
      ],
      'commentary.terribleMiss': [
        "¡Pero qué tiro es ese, {name}!",
        "¡Madre del amor hermoso, {name}!",
      ],
      'commentary.comeback': [
        "¡{name} sube como la espuma!",
        "¡Atención, que aprieta {name}!",
        "¡{name} se está metiendo en faena!",
      ],
      'commentary.heroicComeback': [
        "¡{name} viene desde atrás y se planta arriba!",
        "¡No me lo puedo creer, {name} en cabeza!",
        "¡Qué remontada de {name}, qué remontadaaaa!",
      ],
      'commentary.collapse': [
        "¡{name} se desinfla!",
        "¡Y {name} cae de la cabeza, qué desastre!",
      ],
      'commentary.unbelievable': [
        "¡Increíble!",
        "¡Esto no se puede ver, señoras y señores!",
        "¡Que se lo cuenten a sus nietos!",
      ],
      'commentary.aboutToWin': [
        "¡{name} ya casi la tiene!",
        "¡{name} la huele!",
        "¡Esto es de {name}, esto es de {name}!",
      ],
      'commentary.win': [
        "¡Y gana {name}!",
        "¡{name} gana, {name} gana, {name} gaaaaana!",
        "¡Vencedor — {name}!",
        "¡Lazo y banda para {name}, ahí queda eso!",
      ],
      'commentary.photoFinish': [
        "¡FOTO FINISH!",
        "¡Esto hay que verlo en foto, señoras!",
        "¡A la foto, a la foto, a la foto!",
      ],
      'commentary.photoFinishCall': [
        "¡Y según la foto... gana {name}!",
        "¡La foto canta — {name}!",
        "¡Por un pelo de la cola — {name}!",
      ],
      'commentary.runnerUp': [
        "Segundo, {name}.",
        "Y plata para {name}.",
      ],
      'commentary.danceOnTheLine': [
        "¡{name} la gana por los pelos!",
        "¡Qué poco, qué poco entre {name} y el segundo!",
      ],
      'commentary.crowdReact': [
        "¡Cómo viene la grada!",
        "¡Aquí no se oye ni la radio, qué gritos!",
        "¡Ole olé olé olé!",
      ],
      'commentary.suspense': [
        "...",
        "Silencio en las gradas...",
        "Que no se oye una mosca, oiga.",
      ],
      'commentary.silly': [
        "Yo esto no lo veía desde la boda de mi prima.",
        "Si me viera mi madre.",
        "Bocadillos a diez duros en la barra del fondo, señoras.",
        "¡Qué caballo, qué caballo, y qué caballo el otro!",
      ],
      'commentary.weather': [
        "Hace una tarde que da gusto.",
        "No hay ni una nube, oiga.",
        "Huele a churros desde aquí.",
      ],
      'commentary.shoutout': [
        "¡Un saludo a {name}, vamos {name}!",
        "¡Aplausos para {name}!",
      ],
    },
  }

  let current = FALLBACK
  const listeners = []

  // Anti-repeat memory: per-locale × per-category, last few indices used.
  const recentIndices = {}
  const RECENT_WINDOW = 2

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
    const v = lookup(key, current)
    if (Array.isArray(v)) {
      // Caller hit pick() territory by accident — return the first element so we
      // never render "[object Array]" into the DOM.
      return format(v[0] || key, params)
    }
    return format(v, params)
  }

  function pick(category, params) {
    let pool = lookup(category, current)
    if (!Array.isArray(pool)) {
      // No pool in current locale — fall back to scalar lookup so missing
      // categories still produce something.
      return format(pool, params)
    }
    if (pool.length === 0) return category

    const memKey = current + ':' + category
    const recent = recentIndices[memKey] || (recentIndices[memKey] = [])

    let pick
    if (pool.length === 1) {
      pick = 0
    } else {
      // Try a handful of times to pick an index not in the recent window.
      // Falls back to a fresh random if we can't avoid (shouldn't happen for
      // pools of length > RECENT_WINDOW).
      for (let attempts = 0; attempts < 8; attempts++) {
        const candidate = Math.floor(Math.random() * pool.length)
        if (!recent.includes(candidate)) {
          pick = candidate
          break
        }
      }
      if (pick == null) pick = Math.floor(Math.random() * pool.length)
    }

    recent.push(pick)
    while (recent.length > RECENT_WINDOW) recent.shift()

    return format(pool[pick], params)
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

  // Deterministic indexed lookup into an array dictionary entry. Unlike
  // pick() which is anti-repeat random, this returns the same entry for
  // the same idx — used for stable horse names that need to retranslate
  // on locale change without becoming a different horse.
  function poolAt(category, idx) {
    const pool = lookup(category, current)
    if (Array.isArray(pool) && idx >= 0 && idx < pool.length) return pool[idx]
    const fb = lookup(category, FALLBACK)
    if (Array.isArray(fb) && idx >= 0 && idx < fb.length) return fb[idx]
    return null
  }

  function poolSize(category) {
    const pool = lookup(category, current)
    if (Array.isArray(pool)) return pool.length
    const fb = lookup(category, FALLBACK)
    return Array.isArray(fb) ? fb.length : 0
  }

  current = detect()

  return {
    t,
    pick,
    poolAt,
    poolSize,
    applyDom,
    setLocale,
    locale: () => current,
    available: () => Object.keys(dictionaries).map((id) => ({id, name: localeNames[id] || id})),
    localeName: (id) => localeNames[id] || id,
    onChange,
    detect,
  }
})()
