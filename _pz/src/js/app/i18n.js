/**
 * Pizza! — i18n + per-locale phrase pools.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
 * 2-letter prefix → fallback ('en').
 *
 * Phrase pools (street names, ingredients, GPS phrasing) are AUTHORED per
 * locale, not translated — the silly Spanish pool is independent of the
 * silly English pool. Use app.i18n.pickFromPool('streetNames') to draw a
 * random entry in the active locale.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'pizza.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  // Per-locale phrase pools. Keys collected under `pools.<name>`. These are
  // arrays, not strings, so `lookup` returns them directly.
  const pools = {
    en: {
      streetNames: [
        'Pizza', 'Avocado', 'Pepperoni Plaza', 'Mushroom Mews', 'Anchovy Avenue',
        'Olive Lane', 'Basil Boulevard', 'Crust Court', 'Tomato Terrace',
        'Cheddar Hollow', 'Garlic Gardens', 'Sausage Strip', 'Capsicum Crescent',
        'Mozzarella Mile', 'Oregano Drive', 'Salami Square', 'Parmesan Park',
        'Pineapple Path', 'Mighty Meatball', 'Saucy Way', 'Dough Drive',
        'Calzone Close', 'Buffalo Bend', 'Ricotta Row',
      ],
      ingredients: [
        'cheese', 'pepperoni', 'mushroom', 'ham', 'chicken', 'olives',
        'pineapple', 'peppers', 'onions', 'sausage', 'bacon', 'spinach',
        'anchovies', 'jalapeños', 'tomato', 'basil', 'salami',
      ],
      funnyIngredients: [
        'gummy bears', 'cold spaghetti', 'a single AAA battery', 'regrets',
        'bubblegum', 'marshmallow chunks', 'pickle slices', 'broccoli florets',
        'leftover taco filling', 'wasabi paste', 'glitter', 'cereal',
        'mystery sauce', 'a tiny umbrella', 'breakfast cereal',
      ],
      gpsTurnLeft: ['turn left', 'take a left', 'go left'],
      gpsTurnRight: ['turn right', 'take a right', 'go right'],
      gpsStraight: ['continue straight', 'keep going straight', 'stay on this road'],
      gpsTurnAround: ['make a U-turn', 'turn around', 'do a U-turn'],
      // Buildings the player delivers to OR crashes into. Pool shared
      // between both events for maximum chaos: delivering pizza to a
      // funeral home and crashing into the Hooters parking lot are both
      // funny. US-flavored — strip-mall and suburb anchors heavily.
      buildings: [
        // Family / acquaintance
        "your mom's house", "your grandma's place", "your ex's apartment",
        "your boss's McMansion", "your therapist's office", "your dentist's",
        "a Tinder date's apartment", "your in-laws' split-level",
        "your cousin's basement", "your roommate's situationship's place",
        // Strip-mall America
        'a Walgreens', 'a CVS', 'a Subway franchise', 'a Chick-fil-A',
        'a Cracker Barrel', 'a Hooters', 'a Dollar Tree', 'a Walmart',
        'a Costco loading dock', 'a Trader Joe’s', 'a Home Depot',
        'a Buffalo Wild Wings', 'a P.F. Chang’s', 'an IHOP',
        'a defunct Sears', 'a Convention Center',
        // Suburb anchors
        'a strip-mall nail salon', 'a check-cashing place',
        'a vape shop', 'a U-Haul depot', 'a self-storage unit',
        'a coin laundromat', 'a Jiffy Lube',
        // Civic / institutional
        'the public library', 'the post office', 'the DMV',
        'a polling station', 'city hall', 'a county courthouse',
        'the local elementary school', 'the funeral home',
        'a Methodist church', 'a megachurch with stadium seating',
        'a VFW hall',
        // Comedy / cultural
        'a CrossFit box', 'an escape room', 'a haunted-house attraction',
        'a karaoke bar', 'a board-game café', 'a cat café',
        "the local Republican HQ", "the local Democrat HQ",
        "an Airbnb the host clearly lives in",
        "a podcast studio in someone's garage",
        "an already slain spire", "a yoga studio above a Chase Bank",
        "a community theater", "Oriol's house",
      ],
    },
    es: {
      streetNames: [
        'Pizza', 'Aguacate', 'Plaza del Chorizo', 'Calle del Pimentón',
        'Avenida Tortilla', 'Manchego', 'Aceituna', 'Calle del Jamón',
        'Plaza Albóndiga', 'Avenida del Tomate', 'Calle Picante', 'Salsa Brava',
        'Plaza del Bocadillo', 'Calle Aceite', 'Pasaje del Queso',
        'Avenida Croqueta', 'Calle del Sofrito', 'Plaza Caracoles',
        'Calle Empanada', 'Pasaje del Mojo', 'Calle del Pulpo',
        'Avenida Gazpacho', 'Plaza del Membrillo', 'Calle Patatera',
      ],
      ingredients: [
        'queso', 'chorizo', 'champiñones', 'jamón', 'pollo', 'aceitunas',
        'piña', 'pimientos', 'cebolla', 'salchichón', 'panceta', 'espinacas',
        'anchoas', 'jalapeños', 'tomate', 'albahaca', 'sobrasada',
      ],
      funnyIngredients: [
        'gusanitos', 'cabello de ángel', 'una pila', 'sentimientos encontrados',
        'chuches', 'nubes de azúcar', 'pepinillos en vinagre', 'brócoli',
        'mojo picón sobrante', 'wasabi', 'purpurina comestible', 'cereales',
        'salsa misteriosa', 'una sombrillita de cóctel', 'palomitas',
      ],
      gpsTurnLeft: ['gira a la izquierda', 'toma la izquierda', 'tira a la izquierda'],
      gpsTurnRight: ['gira a la derecha', 'toma la derecha', 'tira a la derecha'],
      gpsStraight: ['continúa recto', 'sigue recto', 'mantente en esta calle'],
      gpsTurnAround: ['da media vuelta', 'haz un cambio de sentido', 'date la vuelta'],
      // Pool de edificios — destinos de reparto Y sitios contra los que
      // te estampas. Se mezcla todo a propósito: repartir pizza en una
      // sede del PSOE o estamparte contra la peluquería de Doña Carmen
      // dan igual de risa. Se prioriza color local sobre exactitud.
      buildings: [
        // Familia y allegados
        "la casa de tu tía", "la casa de tu abuela", "la casa de tu suegra",
        "el piso de tu primo", "la casa de tu cuñado", "el piso de tu ex",
        "el chalé de tu jefe", "la casa rural de un primo segundo",
        "la casa de tu mejor amigo del cole",
        // Política y prensa — el chiste fácil pero efectivo
        "la sede de Vox", "la sede del PSOE", "la sede del PP",
        "la sede de Podemos", "la redacción de El País",
        "los estudios de Mediaset", "la cadena SER",
        // Vida de barrio — el corazón del juego
        "la peluquería de Doña Carmen", "la panadería de toda la vida",
        "el quiosco de la esquina", "el bar de Pepe", "el bar de los indepes",
        "una administración de lotería", "el locutorio del chino",
        "el partyfiesta", "el todo a cien",
        "el estanco", "una churrería", "el paki",
        "el quiosco de la once",
        // Institucional y burocrático
        "el ayuntamiento", "la oficina del catastro", "Correos",
        "la sede de Hacienda", "el centro de salud", "el ambulatorio",
        "la biblioteca municipal", "la oficina del paro",
        "una clínica dental", "la asesoría fiscal", "el taller de Manolo",
        "una academia de inglés", "una academia de baile",
        "el local de la asociación de vecinos", "la administración de fincas",
        // Famosillos y cultura pop
        "la casa de Belén Esteban", "la academia de Operación Triunfo",
        "una iglesia evangélica", "el bingo de los abuelos",
        "la peña madridista", "la peña del Barça",
        "un videoclub que aún sobrevive", "un casting de Gran Hermano",
      ],
    },
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'Pizza!',

      // Splash
      'splash.author': 'an audio-first arcade by Oriol Gómez',
      'splash.instruction': 'Press any key to begin',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Main menu
      'menu.title': 'Pizza!',
      'menu.subtitle': 'Deliver pizzas across the city. Don\'t lose your tip.',
      'menu.aria': 'Main menu',
      'menu.start': 'Start a New Run',
      'menu.help': 'How to Play',
      'menu.learn': 'Learn Sounds',
      'menu.highscores': 'High Scores',
      'menu.settings': 'Settings',

      // Settings
      'settings.aria': 'Settings',
      'settings.title': 'Settings',
      'settings.subtitle': 'Toggle player-facing options.',
      'settings.back': 'Back',
      'settings.on': 'on',
      'settings.off': 'off',
      'settings.offroadProtection': 'Off-road protection',
      'settings.offroadProtectionDesc': 'When on, the bike slides along curbs instead of crashing off the road. Easier to learn the city; ends the "out of bike" deaths from a crash.',

      // Briefing
      'briefing.aria': 'Pizza shop briefing',
      'briefing.title': 'At the pizza shop',
      'briefing.subtitleOne': 'Job {n}: 1 pizza to deliver',
      'briefing.subtitleMany': 'Job {n}: {count} pizzas to deliver',
      'briefing.intro': 'You are at 36 Pizza Street, mid-block, just south of Avocado Street.',
      'briefing.pizzaLine': 'Pizza {n}: {ingredients}. Deliver to {address}.',
      'briefing.start': 'Start driving',
      'briefing.back': 'Back to menu',
      'briefing.numberHint': 'Press 1–9 to re-read a pizza. Space to start driving.',

      // Game (driving)
      'game.aria': 'Driving the pizza bike',
      'game.hudJob': 'Job {n}',
      'game.hudTime': 'Time {sec}s',
      'game.hudTips': 'Tips: ${dollars}',
      'game.hudHeld': 'Holding {label}',
      'game.hudHeldEmpty': 'Out of pizzas',
      'game.hudHeldOne': 'pizza {n} of {count}',
      'game.hudGps': 'GPS: {instruction}',
      'game.hudGpsIdle': 'GPS: idle',

      // Help
      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.controls': 'Controls',
      'help.controlMove': '<kbd>Up</kbd> / <kbd>Down</kbd> — accelerate / brake.',
      'help.controlTurn': '<kbd>Left</kbd> / <kbd>Right</kbd> — steer the bike.',
      'help.controlSelect': '<kbd>1</kbd>…<kbd>9</kbd> — select a held pizza.',
      'help.controlThrow': '<kbd>Space</kbd> — flick the selected pizza at the building in front of you.',
      'help.controlRecenter': '<kbd>Enter</kbd> — auto-recenter the bike on the road (takes about a second and a half; steering cancels it).',
      'help.controlPause': '<kbd>Esc</kbd> — pause and return to the menu.',
      'help.statusHotkeys': 'Status hotkeys',
      'help.statusF1': '<kbd>F1</kbd> — repeat last GPS instruction.',
      'help.statusF2': '<kbd>F2</kbd> — held pizza details.',
      'help.statusF3': '<kbd>F3</kbd> — distance to the restaurant.',
      'help.statusF4': '<kbd>F4</kbd> — time and tip total.',
      'help.statusF5': '<kbd>F5</kbd> — your current street address.',
      'help.objective': 'Objective',
      'help.objectiveBody': 'Pick up pizzas at the shop, deliver each one to its address, and head back for the next job. The longer you take, the smaller the tip — and a $0 delivery ends the run. Mind traffic lights and pedestrians; running reds or hitting people will draw the police.',
      'help.back': 'Back',

      // Learn sounds
      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn Sounds',
      'learn.subtitle': 'Tap each cue to hear it on its own.',
      'learn.bike': 'Pizza bike engine',
      'learn.lightGreen': 'Traffic light — green',
      'learn.lightYellow': 'Traffic light — yellow',
      'learn.lightRed': 'Traffic light — red',
      'learn.pedestrian': 'Pedestrian (chatter and footsteps)',
      'learn.siren': 'Police siren',
      'learn.restaurant': 'Restaurant beacon',
      'learn.delivery': 'Delivery beacon',
      'learn.turnBeacon': 'Next-turn beacon (blinking pulse)',
      'learn.gpsChime': 'GPS chime',
      'learn.turnConfirm': 'Turn confirmed',
      'learn.wrongTurn': 'Wrong turn — recalculating',
      'learn.roadSeek': 'Road-seek pings (after a crash)',
      'learn.edgeBeep': 'Lane-edge beeps (parking sensor)',
      'learn.throw': 'Pizza throw',
      'learn.success': 'Successful delivery',
      'learn.fail': 'Failed delivery',
      'learn.back': 'Back',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'Shift\'s over.',
      'gameover.subtitle': '{reason}',
      'gameover.reasonZeroTip': 'A delivery yielded no tip.',
      'gameover.reasonCrash': 'Crashed and lost the bike.',
      'gameover.reasonCaught': 'The police caught you.',
      'ann.caught': 'Pulled over! The police got you.',
      'gameover.totalTips': 'Total tips: ${dollars}',
      'gameover.deliveries': 'Deliveries completed: {count}',
      'gameover.jobs': 'Jobs completed: {count}',
      'gameover.namePrompt': 'Enter a name for the high-score table:',
      'gameover.save': 'Save',
      'gameover.restart': 'Try again',
      'gameover.menu': 'Main menu',

      // High scores
      'highscores.aria': 'High scores',
      'highscores.title': 'High Scores',
      'highscores.empty': 'No scores yet. Start a run!',
      'highscores.entry': '{rank}. {name} — ${score} ({deliveries} deliveries)',
      'highscores.back': 'Back',

      // GPS phrases
      'gps.in200': 'In 200 meters, {turn} onto {street}.',
      'gps.in100': 'In 100 meters, {turn} onto {street}.',
      'gps.in50': 'Almost there. {turnCap} onto {street}.',
      'gps.now': '{turnCap} now.',
      'gps.continue': 'Continue on {street}.',
      'gps.arriveSoon': 'Your destination is just ahead.',
      'gps.arrived': 'You have arrived at {address}.',
      'gps.recalculating': 'Recalculating route…',
      'gps.toRestaurant': 'Heading back to the pizza shop.',
      'gps.firstTurn': 'Head out from the shop. {turnCap} onto {street}.',
      'gps.crossingAhead': 'Crossing ahead. Light is {state}.',
      'gps.lightRed': 'red',
      'gps.lightYellow': 'yellow',
      'gps.lightGreen': 'green',
      // Status read-out (F1) — actively reported from current plan, not the last spoken line.
      'gps.statusIdle': 'No active route.',
      'gps.statusTurn': 'In about {distance} meters, {turn} onto {street}.',
      'gps.statusStraight': 'About {distance} meters along {street}.',
      'gps.statusFinal': 'About {distance} meters to {address}.',
      'gps.statusFinalNoAddress': 'About {distance} meters to your destination.',
      'gps.statusArrived': 'You are at the destination.',

      // Announcer flavor
      'ann.welcome': 'Welcome to Pizza! Press F1 for help.',
      'ann.briefingHello': 'Briefing: {count} pizzas this job.',
      'ann.delivered': 'Delivered to {address}. ${tip} tip.',
      'ann.lostPizza': 'Wrong address. Pizza is gone.',
      'ann.gameOver': 'Game over. Total tips: ${dollars}.',
      'ann.policeSpotted': 'Police on your tail!',
      'ann.policeShaken': 'You lost them.',
      'ann.redLight': 'You ran a red light!',
      'ann.hitPed': 'You hit a pedestrian!',
      'ann.crash': 'Crashed into {building}.',
      'ann.crashAt': 'Crashed into {building} on {street}.',
      'ann.edgeWarn': 'Off the road — pull back to the centre.',
      'ann.jobDone': 'Job complete. ${jobTips} this job.',
      'ann.nextJob': 'Next job: {count} pizzas. Head back to the shop.',
      'ann.reachedShop': 'You\'re at the pizza shop. Press space to start the next job.',
      'ann.tooLate': 'Too late. No tip.',
      'ann.heldPizza': 'Holding pizza {n}: {ingredients}, for {address}.',
      'ann.restaurantDistance': 'Pizza shop is {distance} meters away.',
      'ann.timeAndTips': 'Time {sec} seconds. Tips: ${dollars}.',
      'ann.whereAmI': 'You are near {address}.',
      'ann.whereAmIUnknown': 'No street address nearby.',
      'ann.heldEmpty': 'You have no pizzas left. Head back to the shop.',
      'ann.selectedPizza': 'Pizza {n} in hand: {ingredients}.',
      'ann.selectFirst': 'Press a pizza number from 1 to {count} to choose which one to throw.',
      'ann.startSelected': 'Pizza {n} is in your hand. Make sure it matches the destination before you throw.',
      'ann.outOfRange': 'Not close enough to a building.',
      'ann.atDestination': 'You\'re at {address}.',
      'ann.recentering': 'Recentering on the road.',

      // Test
      'test.aria': 'Audio orientation test',
      'test.title': 'Audio Test',
      'test.subtitle': 'A tick plays from the front, then left, then behind, then right.',
      'test.run': 'Run sequence',
      'test.back': 'Back',
      'test.front': 'Front',
      'test.left': 'Left',
      'test.behind': 'Behind',
      'test.right': 'Right',
      'test.yawIntro': 'Now rotating the listener. Same source, different facings.',
      'test.yawForward': 'Facing forward — source ahead.',
      'test.yawLeft90': 'Turned 90 left — source on the right.',
      'test.yawAbout': 'Turned around — source behind.',
      'test.yawRight90': 'Turned 90 right — source on the left.',
    },

    es: {
      'doc.title': '¡Pizza!',

      'splash.author': 'una arcade audio-first de Oriol Gómez',
      'splash.instruction': 'Pulsa una tecla para empezar',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'menu.title': '¡Pizza!',
      'menu.subtitle': 'Reparte pizzas por la ciudad. Que no se te escape la propina.',
      'menu.aria': 'Menú principal',
      'menu.start': 'Empezar partida',
      'menu.help': 'Cómo se juega',
      'menu.learn': 'Aprender los sonidos',
      'menu.highscores': 'Mejores propinas',
      'menu.settings': 'Ajustes',

      // Ajustes
      'settings.aria': 'Ajustes',
      'settings.title': 'Ajustes',
      'settings.subtitle': 'Activa o desactiva opciones para el jugador.',
      'settings.back': 'Volver',
      'settings.on': 'activado',
      'settings.off': 'desactivado',
      'settings.offroadProtection': 'Protección fuera de carretera',
      'settings.offroadProtectionDesc': 'Si está activado, la moto se desliza por los bordillos en vez de chocar. Más fácil para aprender la ciudad y evita las salidas en seco por choque.',

      'briefing.aria': 'En la pizzería',
      'briefing.title': 'En la pizzería',
      'briefing.subtitleOne': 'Pedido {n}: 1 pizza para repartir',
      'briefing.subtitleMany': 'Pedido {n}: {count} pizzas para repartir',
      'briefing.intro': 'Estás en el 36 de la calle Pizza, a mitad de manzana, justo al sur de la calle Aguacate.',
      'briefing.pizzaLine': 'Pizza {n}: {ingredients}. Para repartir en {address}.',
      'briefing.start': 'A repartir',
      'briefing.back': 'Volver al menú',
      'briefing.numberHint': 'Pulsa 1–9 para volver a oír cada pizza. Espacio para empezar.',

      'game.aria': 'Conduciendo la moto pizzera',
      'game.hudJob': 'Pedido {n}',
      'game.hudTime': 'Tiempo {sec}s',
      'game.hudTips': 'Propinas: {dollars}€',
      'game.hudHeld': 'Llevas {label}',
      'game.hudHeldEmpty': 'Sin pizzas',
      'game.hudHeldOne': 'pizza {n} de {count}',
      'game.hudGps': 'GPS: {instruction}',
      'game.hudGpsIdle': 'GPS: en espera',

      'help.aria': 'Cómo se juega',
      'help.title': 'Cómo se juega',
      'help.controls': 'Controles',
      'help.controlMove': '<kbd>Arriba</kbd> / <kbd>Abajo</kbd> — acelerar / frenar.',
      'help.controlTurn': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> — girar la moto.',
      'help.controlSelect': '<kbd>1</kbd>…<kbd>9</kbd> — seleccionar una pizza.',
      'help.controlThrow': '<kbd>Espacio</kbd> — lanzar la pizza al edificio que tienes delante.',
      'help.controlRecenter': '<kbd>Intro</kbd> — recentrar la moto en la calzada (tarda alrededor de un segundo y medio; girar lo cancela).',
      'help.controlPause': '<kbd>Esc</kbd> — pausa y vuelta al menú.',
      'help.statusHotkeys': 'Atajos de estado',
      'help.statusF1': '<kbd>F1</kbd> — repetir la última instrucción del GPS.',
      'help.statusF2': '<kbd>F2</kbd> — datos de la pizza que llevas.',
      'help.statusF3': '<kbd>F3</kbd> — distancia hasta la pizzería.',
      'help.statusF4': '<kbd>F4</kbd> — tiempo y propinas.',
      'help.statusF5': '<kbd>F5</kbd> — la calle donde estás.',
      'help.objective': 'Objetivo',
      'help.objectiveBody': 'Recoge las pizzas en la pizzería, repártelas en cada dirección y vuelve a por el siguiente pedido. Cuanto más tardes, menos propina te dejan; si te llevas 0€ por una entrega, se acaba la partida. Cuidado con los semáforos y los peatones: te pillará la policía.',
      'help.back': 'Atrás',

      'learn.aria': 'Aprender los sonidos',
      'learn.title': 'Aprender los sonidos',
      'learn.subtitle': 'Pulsa cada cue para oírlo solo.',
      'learn.bike': 'Motor de la moto',
      'learn.lightGreen': 'Semáforo en verde',
      'learn.lightYellow': 'Semáforo en ámbar',
      'learn.lightRed': 'Semáforo en rojo',
      'learn.pedestrian': 'Peatón (charla y pasos)',
      'learn.siren': 'Sirena de policía',
      'learn.restaurant': 'Baliza de la pizzería',
      'learn.delivery': 'Baliza del cliente',
      'learn.turnBeacon': 'Baliza del próximo giro (pulso parpadeante)',
      'learn.gpsChime': 'Tono del GPS',
      'learn.turnConfirm': 'Giro confirmado',
      'learn.wrongTurn': 'Giro equivocado — recalculando',
      'learn.roadSeek': 'Pings de vuelta a la calzada (tras un golpe)',
      'learn.edgeBeep': 'Pitidos de borde de carril (sensor de aparcamiento)',
      'learn.throw': 'Lanzar pizza',
      'learn.success': 'Entrega correcta',
      'learn.fail': 'Entrega fallida',
      'learn.back': 'Atrás',

      'gameover.aria': 'Fin de la jornada',
      'gameover.title': 'Fin de la jornada.',
      'gameover.subtitle': '{reason}',
      'gameover.reasonZeroTip': 'Una entrega no dejó propina.',
      'gameover.reasonCrash': 'Has destrozado la moto.',
      'gameover.reasonCaught': 'Te ha pillado la policía.',
      'ann.caught': '¡Te han pillado! La policía te ha parado.',
      'gameover.totalTips': 'Propinas totales: {dollars}€',
      'gameover.deliveries': 'Entregas hechas: {count}',
      'gameover.jobs': 'Pedidos completados: {count}',
      'gameover.namePrompt': 'Escribe tu nombre para la tabla de propinas:',
      'gameover.save': 'Guardar',
      'gameover.restart': 'Otra vez',
      'gameover.menu': 'Menú principal',

      'highscores.aria': 'Mejores propinas',
      'highscores.title': 'Mejores propinas',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Empieza una partida!',
      'highscores.entry': '{rank}. {name} — {score}€ ({deliveries} entregas)',
      'highscores.back': 'Atrás',

      'gps.in200': 'En 200 metros, {turn} por {street}.',
      'gps.in100': 'En 100 metros, {turn} por {street}.',
      'gps.in50': 'Casi llegas. {turnCap} por {street}.',
      'gps.now': '{turnCap} ahora.',
      'gps.continue': 'Sigue por {street}.',
      'gps.arriveSoon': 'Tu destino está justo delante.',
      'gps.arrived': 'Has llegado al {address}.',
      'gps.recalculating': 'Recalculando ruta…',
      'gps.toRestaurant': 'De vuelta a la pizzería.',
      'gps.firstTurn': 'Sal de la pizzería. {turnCap} por {street}.',
      'gps.crossingAhead': 'Cruce delante. Semáforo en {state}.',
      'gps.lightRed': 'rojo',
      'gps.lightYellow': 'ámbar',
      'gps.lightGreen': 'verde',
      // Status (F1)
      'gps.statusIdle': 'Sin ruta activa.',
      'gps.statusTurn': 'En unos {distance} metros, {turn} por {street}.',
      'gps.statusStraight': 'Unos {distance} metros por {street}.',
      'gps.statusFinal': 'A unos {distance} metros de {address}.',
      'gps.statusFinalNoAddress': 'A unos {distance} metros del destino.',
      'gps.statusArrived': 'Has llegado al destino.',

      'ann.welcome': 'Bienvenido a ¡Pizza! Pulsa F1 para la ayuda.',
      'ann.briefingHello': 'Pedido: {count} pizzas.',
      'ann.delivered': 'Entregada en {address}. Propina de {tip}€.',
      'ann.lostPizza': 'Dirección equivocada. Pizza perdida.',
      'ann.gameOver': 'Fin de la jornada. Propinas totales: {dollars}€.',
      'ann.policeSpotted': '¡La poli te persigue!',
      'ann.policeShaken': 'Los has despistado.',
      'ann.redLight': '¡Te has saltado un semáforo en rojo!',
      'ann.hitPed': '¡Has atropellado a un peatón!',
      'ann.crash': 'Te has estampado contra {building}.',
      'ann.crashAt': 'Te has estampado contra {building} en la calle {street}.',
      'ann.edgeWarn': 'Fuera de la carretera — vuelve al centro.',
      'ann.jobDone': 'Pedido completado. {jobTips}€ en este pedido.',
      'ann.nextJob': 'Próximo pedido: {count} pizzas. Vuelve a la pizzería.',
      'ann.reachedShop': 'Estás en la pizzería. Pulsa espacio para el siguiente pedido.',
      'ann.tooLate': 'Demasiado tarde. Sin propina.',
      'ann.heldPizza': 'Llevas la pizza {n}: {ingredients}, para {address}.',
      'ann.restaurantDistance': 'La pizzería está a {distance} metros.',
      'ann.timeAndTips': 'Tiempo {sec} segundos. Propinas: {dollars}€.',
      'ann.whereAmI': 'Estás cerca de {address}.',
      'ann.whereAmIUnknown': 'Ninguna calle a la vista.',
      'ann.heldEmpty': 'No te quedan pizzas. Vuelve a la pizzería.',
      'ann.selectedPizza': 'Pizza {n} en la mano: {ingredients}.',
      'ann.selectFirst': 'Pulsa un número del 1 al {count} para elegir qué pizza lanzar.',
      'ann.startSelected': 'Llevas la pizza {n} en la mano. Asegúrate de que es la del destino antes de lanzarla.',
      'ann.outOfRange': 'No estás bastante cerca de un edificio.',
      'ann.atDestination': 'Estás en {address}.',
      'ann.recentering': 'Recentrando la moto en la calzada.',

      'test.aria': 'Prueba de orientación de audio',
      'test.title': 'Prueba de audio',
      'test.subtitle': 'Sonará un tic delante, a la izquierda, detrás y a la derecha.',
      'test.run': 'Reproducir',
      'test.back': 'Atrás',
      'test.front': 'Delante',
      'test.left': 'Izquierda',
      'test.behind': 'Detrás',
      'test.right': 'Derecha',
      'test.yawIntro': 'Ahora gira el oyente. Misma fuente, distintas orientaciones.',
      'test.yawForward': 'Mirando al frente — fuente delante.',
      'test.yawLeft90': '90 a la izquierda — fuente a la derecha.',
      'test.yawAbout': 'Media vuelta — fuente detrás.',
      'test.yawRight90': '90 a la derecha — fuente a la izquierda.',
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

  function pool(name) {
    const p = pools[current] && pools[current][name]
    if (Array.isArray(p)) return p
    return (pools[FALLBACK] && pools[FALLBACK][name]) || []
  }

  function pickFromPool(name, rng) {
    const arr = pool(name)
    if (!arr.length) return ''
    const r = typeof rng === 'function' ? rng : Math.random
    return arr[Math.floor(r() * arr.length)]
  }

  // Locale-aware address rendering.
  //
  // EN: street names in the pool may already include their type suffix
  //   ("Pepperoni Plaza", "Anchovy Avenue", "Mushroom Mews") — in that
  //   case we don't append " Street". For bare names ("Pizza", "Avocado")
  //   we do append " Street".
  //
  // ES: street names that start with a Spanish street type ("Plaza X",
  //   "Calle del Y", "Avenida Z", "Pasaje del W") become "el número N
  //   {de la|del} {Type X}" depending on grammatical gender. Bare names
  //   ("Pizza", "Aguacate", "Manchego") become "el número N de la calle
  //   X". This is what a Spanish speaker would actually say.
  const EN_TYPE_SUFFIX = /\b(Plaza|Mews|Avenue|Lane|Boulevard|Court|Terrace|Hollow|Hill|Square|Strip|Crescent|Mile|Drive|Path|Way|Bend|Row|Park|Gardens|Close)$/i
  const ES_TYPE_PREFIX = /^(Plaza|Calle|Avenida|Pasaje|Camino|Paseo|Ronda|Glorieta)\b/i
  const ES_MASCULINE_TYPES = new Set(['pasaje', 'camino', 'paseo'])

  function formatAddress(n, street) {
    if (street == null || street === '') return String(n)
    if (current === 'es') {
      const m = street.match(ES_TYPE_PREFIX)
      if (m) {
        const article = ES_MASCULINE_TYPES.has(m[1].toLowerCase()) ? 'del' : 'de la'
        return 'el número ' + n + ' ' + article + ' ' + street
      }
      return 'el número ' + n + ' de la calle ' + street
    }
    if (EN_TYPE_SUFFIX.test(street)) return n + ' ' + street
    return n + ' ' + street + ' Street'
  }

  // Render a delivery destination — building name + address, in the
  // grammar of the active locale. Falls back to plain formatAddress if
  // no building is provided (so restaurants and F5 read-outs still work).
  function formatDeliveryAddress(building, n, street) {
    const addr = formatAddress(n, street)
    if (!building) return addr
    if (current === 'es') return building + ', ' + addr
    return building + ' at ' + addr
  }

  // Locale-aware street reference (for "turn onto X" / "por X" sentences).
  // Returns the street with its leading article for ES, or the rendered
  // street name for EN. Templates that consume this should NOT prepend
  // "la calle" / "Street" themselves — formatStreet covers it.
  function formatStreet(street) {
    if (!street) return ''
    if (current === 'es') {
      const m = street.match(ES_TYPE_PREFIX)
      if (m) {
        const article = ES_MASCULINE_TYPES.has(m[1].toLowerCase()) ? 'el' : 'la'
        return article + ' ' + street
      }
      return 'la calle ' + street
    }
    if (EN_TYPE_SUFFIX.test(street)) return street
    return street + ' Street'
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
    pool,
    pickFromPool,
    formatAddress,
    formatDeliveryAddress,
    formatStreet,
  }
})()
