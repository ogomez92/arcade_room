/**
 * Pizza! — i18n + per-locale phrase pools.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
 * 2-letter prefix → fallback ('en').
 *
 * Phrase pools (street names, ingredients, landmarks, edge features, GPS
 * phrasing) are AUTHORED per locale, not translated. Use
 * app.i18n.pickFromPool('streetNames') to draw a random entry in the
 * active locale, app.i18n.pool('landmarks') for the whole array.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'pizza.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

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
      // One landmark per city block (25 blocks; the pool is bigger so each
      // run feels different). Short, so they read fast in an address.
      landmarks: [
        'the library', 'the post office', 'the town hall', 'the police station',
        'the cathedral', 'the stadium', 'the hospital', 'the market hall',
        'the museum', 'the cinema', 'the swimming pool', 'the bus station',
        'the bank', 'the courthouse', 'the theatre', 'the university',
        'the primary school', 'the high school', 'the old mill', 'the water tower',
        'the brewery', 'the botanical garden', 'the zoo', 'the laundromat',
        'the bowling alley', 'the record shop', 'the skate park', 'the aquarium',
        'the observatory', 'the tattoo parlour', 'the pet shop', 'the bakery',
        'the fish market', 'the car wash', 'the arcade', 'the dentist',
        'the gym', 'the florist', 'the hardware store', 'the karaoke bar',
        'the noodle bar', 'the wedding chapel', 'the roller rink', 'the funeral home',
        'the DMV', "your ex's apartment", "your mom's house", "Oriol's house",
        'the taxidermist', 'the megachurch',
      ],
      // What lies beyond each map edge. `kind` picks the ambience:
      // water / traffic / industrial / nature.
      edgeFeatures: [
        {name: 'the river', kind: 'water'},
        {name: 'the harbour', kind: 'water'},
        {name: 'the beach', kind: 'water'},
        {name: 'the lake', kind: 'water'},
        {name: 'the highway', kind: 'traffic'},
        {name: 'the ring road', kind: 'traffic'},
        {name: 'the airport', kind: 'traffic'},
        {name: 'the railway yard', kind: 'industrial'},
        {name: 'the industrial estate', kind: 'industrial'},
        {name: 'the docks', kind: 'industrial'},
        {name: 'the city park', kind: 'nature'},
        {name: 'the forest', kind: 'nature'},
        {name: 'the hills', kind: 'nature'},
        {name: 'the golf course', kind: 'nature'},
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
      landmarks: [
        'la biblioteca', 'Correos', 'el ayuntamiento', 'la comisaría',
        'la catedral', 'el estadio', 'el hospital', 'el mercado',
        'el museo', 'el cine', 'la piscina municipal', 'la estación de autobuses',
        'el banco', 'los juzgados', 'el teatro', 'la universidad',
        'el colegio', 'el instituto', 'el molino viejo', 'el depósito de agua',
        'la fábrica de cerveza', 'el jardín botánico', 'el zoo', 'la lavandería',
        'la bolera', 'la tienda de discos', 'el skatepark', 'el acuario',
        'el observatorio', 'el estudio de tatuajes', 'la tienda de mascotas',
        'la panadería de toda la vida', 'la lonja', 'el túnel de lavado',
        'los recreativos', 'la clínica dental', 'el gimnasio', 'la floristería',
        'la ferretería', 'el karaoke', 'el bar de Pepe', 'la peluquería de Doña Carmen',
        'el bingo de los abuelos', 'la sede de Hacienda', 'el tanatorio',
        'la casa de tu ex', 'la casa de tu suegra', 'la oficina del paro',
        'el estanco', 'la churrería',
      ],
      edgeFeatures: [
        {name: 'el río', kind: 'water'},
        {name: 'el puerto', kind: 'water'},
        {name: 'la playa', kind: 'water'},
        {name: 'el pantano', kind: 'water'},
        {name: 'la autopista', kind: 'traffic'},
        {name: 'la ronda de circunvalación', kind: 'traffic'},
        {name: 'el aeropuerto', kind: 'traffic'},
        {name: 'las vías del tren', kind: 'industrial'},
        {name: 'el polígono industrial', kind: 'industrial'},
        {name: 'los astilleros', kind: 'industrial'},
        {name: 'el parque', kind: 'nature'},
        {name: 'el bosque', kind: 'nature'},
        {name: 'las colinas', kind: 'nature'},
        {name: 'los naranjales', kind: 'nature'},
      ],
    },
  }

  const dictionaries = {
    en: {
      'doc.title': 'Pizza!',
      'street.pizza': 'Pizza',
      'street.avocado': 'Avocado',

      'splash.author': 'an audio-first arcade by Oriol Gómez',
      'splash.instruction': 'Press any key to begin',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'menu.title': 'Pizza!',
      'menu.subtitle': 'Deliver pizzas across the city. Don\'t lose your tip.',
      'menu.aria': 'Main menu',
      'menu.start': 'Start a New Run',
      'menu.help': 'How to Play',
      'menu.learn': 'Learn Sounds',
      'menu.highscores': 'High Scores',
      'menu.settings': 'Settings',

      'settings.aria': 'Settings',
      'settings.title': 'Settings',
      'settings.subtitle': 'Toggle player-facing options.',
      'settings.back': 'Back',
      'settings.on': 'on',
      'settings.off': 'off',
      'settings.manualSteering': 'Manual steering',
      'settings.manualSteeringDesc': 'Off (default): the bike follows the road and Left / Right choose the turn at the next crossing. On: free steering with the arrow keys; curbs are solid and Enter recentres you on the road.',
      'settings.ttsFallback': 'Spoken announcements (built-in voice)',
      'settings.ttsFallbackDesc': 'Reads announcements aloud with the browser\'s own voice. Turn on if you play without a screen reader.',

      'briefing.aria': 'Pizza shop briefing',
      'briefing.title': 'At the pizza shop',
      'briefing.subtitleOne': 'Job {n}: 1 pizza to deliver',
      'briefing.subtitleMany': 'Job {n}: {count} pizzas to deliver',
      'briefing.intro': 'You are at the pizza shop, {address}, between {north} and {south}. You start facing north.',
      'briefing.pizzaLine': 'Pizza {n}: {ingredients}. Deliver to {address}.',
      'briefing.start': 'Start driving',
      'briefing.back': 'Back to menu',
      'briefing.map': 'Hear the city map',
      'briefing.numberHint': 'Press 1–9 to re-read a pizza, M to hear the city map. Space to start driving.',

      'game.aria': 'Driving the pizza bike',
      'game.hudJob': 'Job {n}',
      'game.hudTime': 'Time {sec}s',
      'game.hudTips': 'Tips: ${dollars}',
      'game.hudHeld': 'Holding {label}',
      'game.hudHeldEmpty': 'Out of pizzas',
      'game.hudHeldOne': 'pizza {n} of {count}',
      'game.hudGps': 'GPS: {instruction}',
      'game.hudGpsIdle': 'GPS: idle',

      'help.aria': 'How to play',
      'help.title': 'How to Play',
      'help.controls': 'Controls',
      'help.controlMove': '<kbd>Up</kbd> / <kbd>Down</kbd> — accelerate / brake. Brake hard before a corner: cornering fast scrubs your speed.',
      'help.controlTurn': '<kbd>Left</kbd> / <kbd>Right</kbd> — turn at the next crossing. Press any time after the GPS tells you; the bike turns when it gets there. Hold a direction while stopped to turn around.',
      'help.controlSelect': '<kbd>1</kbd>…<kbd>9</kbd> — pick a pizza from the bag (you hear its toppings, never its address).',
      'help.controlThrow': '<kbd>Space</kbd> — hand over the selected pizza at the customer\'s door.',
      'help.controlRecenter': '<kbd>Enter</kbd> — cancel a queued turn (with manual steering: recentre the bike on the road).',
      'help.controlPause': '<kbd>Esc</kbd> — pause and return to the menu.',
      'help.statusHotkeys': 'Status hotkeys',
      'help.statusF1': '<kbd>F1</kbd> — next GPS instruction.',
      'help.statusF2': '<kbd>F2</kbd> — the pizza in your hand.',
      'help.statusF3': '<kbd>F3</kbd> — distance and direction to the pizza shop.',
      'help.statusF4': '<kbd>F4</kbd> — time and tip total.',
      'help.statusF5': '<kbd>F5</kbd> — where you are: street, facing, and the landmarks on each side.',
      'help.statusF6': '<kbd>F6</kbd> — the city map: every street in order, and what lies beyond each edge.',
      'help.statusF7': '<kbd>F7</kbd> — the crossing ahead and its light.',
      'help.sounds': 'What you hear',
      'help.soundsBody': 'A bell rings at the crossing where your next turn is; close to it, the bell becomes a chirp on the side you must turn to. The crossing ahead has a light tone: quick high ticks are green, slow low ticks are red. Footsteps at a crossing mean people are on your road — it is red for you. A tremolo beacon marks the customer\'s door. Each map edge has its own sound (water, traffic, birds, machinery); roads end there.',
      'help.objective': 'Objective',
      'help.objectiveBody': 'Memorise which pizza goes where during the briefing, then deliver each one and ride back for the next job. The tip shrinks if you are slow, and fines for red lights, pedestrians and police chases come off it. A delivery that earns nothing, a pizza thrown at the wrong door, or getting caught by the police ends your shift.',
      'help.city': 'The city',
      'help.cityBody': 'Six streets run north–south and six run east–west, 100 metres apart. Pizza Street and Avocado Street are always there; the rest are new every run, and so are the landmarks on every block and what lies beyond each edge. House numbers run 1 to 100 along a street, twenty per block from the north or west end — even numbers on the east or south side. Number 45 is in the third block.',
      'help.back': 'Back',

      'learn.aria': 'Learn the sounds',
      'learn.title': 'Learn Sounds',
      'learn.subtitle': 'Tap each cue to hear it on its own.',
      'learn.bike': 'Pizza bike engine',
      'learn.lightGreen': 'Crossing ahead — green (quick high ticks)',
      'learn.lightYellow': 'Crossing ahead — yellow (medium pulses)',
      'learn.lightRed': 'Crossing ahead — red (slow low ticks)',
      'learn.lightChange': 'Light changes: green, yellow, red',
      'learn.pedestrian': 'Pedestrian footsteps',
      'learn.siren': 'Police siren',
      'learn.restaurant': 'Pizza shop beacon',
      'learn.delivery': 'Customer beacon',
      'learn.turnBeacon': 'Next-turn bell (ahead, slightly right)',
      'learn.turnChirpLeft': 'Turn now — left',
      'learn.turnChirpRight': 'Turn now — right',
      'learn.turnChirpUturn': 'Turn now — U-turn',
      'learn.turnQueued': 'Turn queued (left, then right)',
      'learn.gpsChime': 'GPS chime',
      'learn.turnConfirm': 'Turn confirmed',
      'learn.wrongTurn': 'Wrong turn — recalculating',
      'learn.deadEnd': 'Dead end ahead, then stopped at the edge',
      'learn.bump': 'Bumped a wall (manual steering)',
      'learn.squeal': 'Wide corner — tyre squeal',
      'learn.edgeWater': 'Map edge — water',
      'learn.edgeTraffic': 'Map edge — traffic',
      'learn.edgeNature': 'Map edge — park or countryside',
      'learn.edgeIndustrial': 'Map edge — railway or industry',
      'learn.inRange': 'At the customer\'s door',
      'learn.throw': 'Pizza handed over',
      'learn.success': 'Tip received',
      'learn.fail': 'Failed delivery',
      'learn.back': 'Back',

      'gameover.aria': 'Game over',
      'gameover.title': 'Shift\'s over.',
      'gameover.subtitle': '{reason}',
      'gameover.reasonZeroTip': 'A delivery earned nothing.',
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
      'gameover.nameRequired': 'Type a name to save your score.',
      'online.posting': 'Posting your score…',
      'online.rank': 'Online rank: #{rank}',
      'online.error': 'Couldn’t reach the leaderboard. Saved locally.',
      'online.viewBoard': 'View the world leaderboard',

      'highscores.aria': 'High scores',
      'highscores.title': 'High Scores',
      'highscores.empty': 'No scores yet. Start a run!',
      'highscores.entry': '{rank}. {name} — ${score} ({deliveries} deliveries)',
      'highscores.back': 'Back',

      // GPS
      'gps.nextTurn': 'At the next crossing, {turn} onto {street}.',
      'gps.inDist': 'In {distance} meters, {turn} onto {street}.',
      'gps.nextTurnNoStreet': 'At the next crossing, {turn}.',
      'gps.inDistNoStreet': 'In {distance} meters, {turn}.',
      'gps.continueOne': 'Straight through the next crossing, then {turn} onto {street2}.',
      'gps.continueFor': 'Continue on {street} for {n} crossings, then {turn} onto {street2}.',
      'gps.continueToDest': 'Continue on {street}. Your destination is {distance} meters ahead.',
      'gps.destAhead': 'Your destination is {distance} meters ahead, on your {side}.',
      'gps.destBehind': 'Your destination is behind you. Stop, then hold left or right to turn around.',
      'gps.inRange': 'You are at {address}. Hand over the pizza when ready.',
      'gps.now': '{turnCap} now.',
      'gps.uturnNow': 'Stop and turn around.',
      'gps.turnAroundNow': 'Turn around: stop, then hold left or right.',
      'gps.wrongTurn': 'Wrong turn. Recalculating.',
      'gps.toRestaurant': 'Heading back to the pizza shop.',
      'gps.lightAhead': '{street} crossing. Light is {state}.',
      'gps.lightRed': 'red',
      'gps.lightYellow': 'yellow',
      'gps.lightGreen': 'green',
      'gps.sideLeft': 'left',
      'gps.sideRight': 'right',
      'gps.statusIdle': 'No active route.',
      'gps.statusFinal': 'About {distance} meters to {address}, on your {side}.',

      // Announcer
      'ann.welcome': 'Welcome to Pizza! Press F1 for help.',
      'ann.firstDriveHint': 'Hold Up to ride. Left and Right turn at the next crossing. F1 repeats the GPS, F5 tells you where you are.',
      'ann.firstDriveHintManual': 'Hold Up to ride, steer with Left and Right. Enter recentres you on the road.',
      'ann.delivered': 'Delivered. ${tip} tip.',
      'ann.deliveredFast': 'Fast delivery bonus!',
      'ann.deliveredLate': 'You were {sec} seconds over.',
      'ann.deliveredFined': 'Fines were deducted.',
      'ann.lostPizza': 'Wrong pizza! Pizza {n} was for {address}. That customer gets nothing.',
      'ann.noCustomerHere': 'No customer here. Keep the pizza.',
      'ann.gameOver': 'Game over. Total tips: ${dollars}.',
      'ann.onlineRank': 'Online rank: number {rank}.',
      'ann.onlineError': 'Could not reach the online leaderboard. Score saved locally.',
      'ann.policeSpotted': 'Police on your tail! Take some corners.',
      'ann.policeShaken': 'You lost them.',
      'ann.policeGaveUp': 'The police gave up.',
      'ann.redLight': 'You ran a red light!',
      'ann.hitPed': 'You hit a pedestrian!',
      'ann.jobDone': 'Job complete. ${jobTips} so far. Head back to the shop.',
      'ann.nextJob': 'Back at the shop. Next job: {count} pizzas.',
      'ann.tooLate': 'Far too late. No tip.',
      'ann.finedOut': 'The fines ate the whole tip.',
      'ann.heldPizza': 'Holding pizza {n}: {ingredients}, for {address}.',
      'ann.restaurantDistance': 'Pizza shop is {distance} meters to the {compass}.',
      'ann.timeAndTips': 'Time {sec} seconds. Tips: ${dollars}.',
      'ann.heldEmpty': 'You have no pizzas left. Head back to the shop.',
      'ann.selectedPizza': 'Pizza {n} in hand: {ingredients}.',
      'ann.pizzaGone': 'Pizza {n} is already gone.',
      'ann.selectFirst': 'Press a pizza number from 1 to {count} to choose which one to hand over.',
      'ann.startSelected': 'Pizza {n} is in your hand. Make sure it matches the destination before you hand it over.',
      'ann.recentering': 'Recentering on the road.',
      'ann.queuedLeft': 'Left at the next crossing.',
      'ann.queuedRight': 'Right at the next crossing.',
      'ann.turnCancelled': 'Turn cancelled.',
      'ann.noRoadLeft': 'No road to the left at the next crossing.',
      'ann.noRoadRight': 'No road to the right at the next crossing.',
      'ann.wideTurn': 'Wide corner — too fast.',
      'ann.turnedAround': 'Turned around.',
      'ann.deadEndAhead': 'Dead end ahead: {feature}.',
      'ann.deadEnd': 'End of {street}. {feature} is ahead. Turn left or right, or hold a direction to turn around.',
      'ann.bumpLandmark': 'Bumped into {landmark}.',
      'ann.bumpEdge': 'Bumped into the barrier at {feature}.',
      'ann.bumpCurb': 'Bumped the curb.',
      // Where am I (F5)
      'ann.whereCorner': 'At the corner of {streetV} and {streetH}, facing {compass}.',
      'ann.whereBlock': 'On {street}, facing {compass}. {crossAhead} is {dist} meters ahead; {crossBehind} is behind you.',
      'ann.whereSides': 'On your left, {left}. On your right, {right}.',
      'ann.wherePlace': '{label}: {place}.',
      'ann.whereUnknown': 'No street nearby.',
      'place.aheadLeft': 'Ahead on the left',
      'place.aheadRight': 'Ahead on the right',
      'place.behindLeft': 'Behind on the left',
      'place.behindRight': 'Behind on the right',
      'compass.n': 'north', 'compass.ne': 'north-east', 'compass.e': 'east', 'compass.se': 'south-east',
      'compass.s': 'south', 'compass.sw': 'south-west', 'compass.w': 'west', 'compass.nw': 'north-west',
      // City map (F6 / briefing M)
      'ann.mapVertical': 'Streets running north to south, from west to east: {list}.',
      'ann.mapHorizontal': 'Streets running east to west, from north to south: {list}.',
      'ann.mapEdges': 'Beyond the north edge: {north}. South: {south}. East: {east}. West: {west}.',
      'ann.mapShop': 'The pizza shop is on {street}, just south of {cross}.',
      'ann.mapNumbers': 'House numbers run 1 to 100 along each street, twenty per block from the north or west end.',
      // Light ahead (F7)
      'ann.lightStatus': '{street} crossing in {dist} meters. Light is {state}, changes in {sec} seconds.',
      'ann.lightStatusNone': 'No crossing ahead.',

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
      'street.pizza': 'Pizza',
      'street.avocado': 'Aguacate',

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

      'settings.aria': 'Ajustes',
      'settings.title': 'Ajustes',
      'settings.subtitle': 'Activa o desactiva opciones para el jugador.',
      'settings.back': 'Volver',
      'settings.on': 'activado',
      'settings.off': 'desactivado',
      'settings.manualSteering': 'Dirección manual',
      'settings.manualSteeringDesc': 'Desactivado (por defecto): la moto sigue la calle y con izquierda / derecha eliges el giro en el próximo cruce. Activado: conduces libremente con las flechas; los bordillos son sólidos e Intro te recentra en la calzada.',
      'settings.ttsFallback': 'Anuncios hablados (voz del navegador)',
      'settings.ttsFallbackDesc': 'Lee los anuncios en voz alta con la voz del propio navegador. Actívalo si juegas sin lector de pantalla.',

      'briefing.aria': 'En la pizzería',
      'briefing.title': 'En la pizzería',
      'briefing.subtitleOne': 'Pedido {n}: 1 pizza para repartir',
      'briefing.subtitleMany': 'Pedido {n}: {count} pizzas para repartir',
      'briefing.intro': 'Estás en la pizzería, {address}, entre {north} y {south}. Empiezas mirando al norte.',
      'briefing.pizzaLine': 'Pizza {n}: {ingredients}. Para repartir en {address}.',
      'briefing.start': 'A repartir',
      'briefing.back': 'Volver al menú',
      'briefing.map': 'Oír el mapa de la ciudad',
      'briefing.numberHint': 'Pulsa 1–9 para volver a oír cada pizza, M para oír el mapa. Espacio para empezar.',

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
      'help.controlMove': '<kbd>Arriba</kbd> / <kbd>Abajo</kbd> — acelerar / frenar. Frena antes de las esquinas: si giras muy rápido, pierdes velocidad.',
      'help.controlTurn': '<kbd>Izquierda</kbd> / <kbd>Derecha</kbd> — girar en el próximo cruce. Puedes pulsar en cuanto el GPS te lo diga; la moto gira al llegar. Mantén una dirección estando parado para dar la vuelta.',
      'help.controlSelect': '<kbd>1</kbd>…<kbd>9</kbd> — coger una pizza de la bolsa (oyes sus ingredientes, nunca su dirección).',
      'help.controlThrow': '<kbd>Espacio</kbd> — entregar la pizza seleccionada en la puerta del cliente.',
      'help.controlRecenter': '<kbd>Intro</kbd> — cancelar un giro programado (con dirección manual: recentrar la moto en la calzada).',
      'help.controlPause': '<kbd>Esc</kbd> — pausa y vuelta al menú.',
      'help.statusHotkeys': 'Atajos de estado',
      'help.statusF1': '<kbd>F1</kbd> — próxima instrucción del GPS.',
      'help.statusF2': '<kbd>F2</kbd> — la pizza que llevas en la mano.',
      'help.statusF3': '<kbd>F3</kbd> — distancia y dirección hasta la pizzería.',
      'help.statusF4': '<kbd>F4</kbd> — tiempo y propinas.',
      'help.statusF5': '<kbd>F5</kbd> — dónde estás: calle, orientación y qué hay a cada lado.',
      'help.statusF6': '<kbd>F6</kbd> — el mapa de la ciudad: todas las calles en orden y qué hay más allá de cada borde.',
      'help.statusF7': '<kbd>F7</kbd> — el cruce que tienes delante y su semáforo.',
      'help.sounds': 'Lo que oyes',
      'help.soundsBody': 'Una campana suena en el cruce donde tienes el próximo giro; al acercarte, la campana se convierte en un pitido en el lado hacia el que tienes que girar. El cruce de delante tiene un tono de semáforo: tics rápidos y agudos es verde, tics lentos y graves es rojo. Pasos en un cruce significan que hay gente en tu calle: está en rojo para ti. Una baliza con trémolo marca la puerta del cliente. Cada borde del mapa tiene su propio sonido (agua, tráfico, pájaros, maquinaria); ahí se acaban las calles.',
      'help.objective': 'Objetivo',
      'help.objectiveBody': 'Memoriza qué pizza va a cada sitio durante el pedido, entrégalas y vuelve a por el siguiente. La propina baja si tardas, y las multas por semáforos, peatones y persecuciones se descuentan. Una entrega sin propina, una pizza entregada en la puerta equivocada o que te pille la policía acaban con tu jornada.',
      'help.city': 'La ciudad',
      'help.cityBody': 'Seis calles van de norte a sur y seis de este a oeste, a 100 metros unas de otras. La calle Pizza y la calle Aguacate están siempre; el resto cambia en cada partida, igual que los edificios de cada manzana y lo que hay más allá de cada borde. Los números van del 1 al 100 en cada calle, veinte por manzana desde el extremo norte u oeste; los pares en la acera este o sur. El 45 está en la tercera manzana.',
      'help.back': 'Atrás',

      'learn.aria': 'Aprender los sonidos',
      'learn.title': 'Aprender los sonidos',
      'learn.subtitle': 'Pulsa cada sonido para oírlo solo.',
      'learn.bike': 'Motor de la moto',
      'learn.lightGreen': 'Cruce delante — verde (tics rápidos y agudos)',
      'learn.lightYellow': 'Cruce delante — ámbar (pulsos medios)',
      'learn.lightRed': 'Cruce delante — rojo (tics lentos y graves)',
      'learn.lightChange': 'Cambios de semáforo: verde, ámbar, rojo',
      'learn.pedestrian': 'Pasos de peatón',
      'learn.siren': 'Sirena de policía',
      'learn.restaurant': 'Baliza de la pizzería',
      'learn.delivery': 'Baliza del cliente',
      'learn.turnBeacon': 'Campana del próximo giro (delante, algo a la derecha)',
      'learn.turnChirpLeft': 'Gira ahora — izquierda',
      'learn.turnChirpRight': 'Gira ahora — derecha',
      'learn.turnChirpUturn': 'Gira ahora — media vuelta',
      'learn.turnQueued': 'Giro programado (izquierda y luego derecha)',
      'learn.gpsChime': 'Tono del GPS',
      'learn.turnConfirm': 'Giro confirmado',
      'learn.wrongTurn': 'Giro equivocado — recalculando',
      'learn.deadEnd': 'Calle sin salida delante y parada en el borde',
      'learn.bump': 'Golpe contra una pared (dirección manual)',
      'learn.squeal': 'Curva demasiado rápida — chirrido',
      'learn.edgeWater': 'Borde del mapa — agua',
      'learn.edgeTraffic': 'Borde del mapa — tráfico',
      'learn.edgeNature': 'Borde del mapa — parque o campo',
      'learn.edgeIndustrial': 'Borde del mapa — vías o industria',
      'learn.inRange': 'En la puerta del cliente',
      'learn.throw': 'Pizza entregada',
      'learn.success': 'Propina recibida',
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
      'gameover.nameRequired': 'Escribe un nombre para guardar tu puntuación.',
      'online.posting': 'Enviando tu puntuación…',
      'online.rank': 'Puesto en línea: número {rank}',
      'online.error': 'No se pudo conectar con el ránking. Guardada localmente.',
      'online.viewBoard': 'Ver el ránking mundial',

      'highscores.aria': 'Mejores propinas',
      'highscores.title': 'Mejores propinas',
      'highscores.empty': 'Aún no hay puntuaciones. ¡Empieza una partida!',
      'highscores.entry': '{rank}. {name} — {score}€ ({deliveries} entregas)',
      'highscores.back': 'Atrás',

      'gps.nextTurn': 'En el próximo cruce, {turn} por {street}.',
      'gps.inDist': 'En {distance} metros, {turn} por {street}.',
      'gps.nextTurnNoStreet': 'En el próximo cruce, {turn}.',
      'gps.inDistNoStreet': 'En {distance} metros, {turn}.',
      'gps.continueOne': 'Pasa de largo el próximo cruce y luego {turn} por {street2}.',
      'gps.continueFor': 'Sigue por {street} durante {n} cruces y luego {turn} por {street2}.',
      'gps.continueToDest': 'Sigue por {street}. Tu destino está a {distance} metros.',
      'gps.destAhead': 'Tu destino está a {distance} metros, a tu {side}.',
      'gps.destBehind': 'Tu destino está detrás de ti. Para y mantén izquierda o derecha para dar la vuelta.',
      'gps.inRange': 'Estás en {address}. Entrega la pizza cuando quieras.',
      'gps.now': '{turnCap} ahora.',
      'gps.uturnNow': 'Para y da la vuelta.',
      'gps.turnAroundNow': 'Da la vuelta: para y mantén izquierda o derecha.',
      'gps.wrongTurn': 'Giro equivocado. Recalculando.',
      'gps.toRestaurant': 'De vuelta a la pizzería.',
      'gps.lightAhead': 'Cruce con {street}. Semáforo en {state}.',
      'gps.lightRed': 'rojo',
      'gps.lightYellow': 'ámbar',
      'gps.lightGreen': 'verde',
      'gps.sideLeft': 'izquierda',
      'gps.sideRight': 'derecha',
      'gps.statusIdle': 'Sin ruta activa.',
      'gps.statusFinal': 'Unos {distance} metros hasta {address}, a tu {side}.',

      'ann.welcome': 'Bienvenido a ¡Pizza! Pulsa F1 para la ayuda.',
      'ann.firstDriveHint': 'Mantén Arriba para conducir. Izquierda y Derecha giran en el próximo cruce. F1 repite el GPS, F5 te dice dónde estás.',
      'ann.firstDriveHintManual': 'Mantén Arriba para conducir y gira con Izquierda y Derecha. Intro te recentra en la calzada.',
      'ann.delivered': 'Entregada. Propina de {tip}€.',
      'ann.deliveredFast': '¡Bonus por entrega rápida!',
      'ann.deliveredLate': 'Has tardado {sec} segundos de más.',
      'ann.deliveredFined': 'Se han descontado las multas.',
      'ann.lostPizza': '¡Pizza equivocada! La pizza {n} era para {address}. Ese cliente se queda sin nada.',
      'ann.noCustomerHere': 'Aquí no hay ningún cliente. Guarda la pizza.',
      'ann.gameOver': 'Fin de la jornada. Propinas totales: {dollars}€.',
      'ann.onlineRank': 'Puesto en línea: número {rank}.',
      'ann.onlineError': 'No se pudo conectar con el ránking en línea. Puntuación guardada localmente.',
      'ann.policeSpotted': '¡La poli te persigue! Coge unas cuantas esquinas.',
      'ann.policeShaken': 'Los has despistado.',
      'ann.policeGaveUp': 'La policía se ha rendido.',
      'ann.redLight': '¡Te has saltado un semáforo en rojo!',
      'ann.hitPed': '¡Has atropellado a un peatón!',
      'ann.jobDone': 'Pedido completado. {jobTips}€ hasta ahora. Vuelve a la pizzería.',
      'ann.nextJob': 'De vuelta en la pizzería. Próximo pedido: {count} pizzas.',
      'ann.tooLate': 'Demasiado tarde. Sin propina.',
      'ann.finedOut': 'Las multas se han comido toda la propina.',
      'ann.heldPizza': 'Llevas la pizza {n}: {ingredients}, para {address}.',
      'ann.restaurantDistance': 'La pizzería está a {distance} metros hacia el {compass}.',
      'ann.timeAndTips': 'Tiempo {sec} segundos. Propinas: {dollars}€.',
      'ann.heldEmpty': 'No te quedan pizzas. Vuelve a la pizzería.',
      'ann.selectedPizza': 'Pizza {n} en la mano: {ingredients}.',
      'ann.pizzaGone': 'La pizza {n} ya no está.',
      'ann.selectFirst': 'Pulsa un número del 1 al {count} para elegir qué pizza entregar.',
      'ann.startSelected': 'Llevas la pizza {n} en la mano. Asegúrate de que es la del destino antes de entregarla.',
      'ann.recentering': 'Recentrando la moto en la calzada.',
      'ann.queuedLeft': 'Izquierda en el próximo cruce.',
      'ann.queuedRight': 'Derecha en el próximo cruce.',
      'ann.turnCancelled': 'Giro cancelado.',
      'ann.noRoadLeft': 'No hay calle a la izquierda en el próximo cruce.',
      'ann.noRoadRight': 'No hay calle a la derecha en el próximo cruce.',
      'ann.wideTurn': 'Curva demasiado rápida.',
      'ann.turnedAround': 'Media vuelta.',
      'ann.deadEndAhead': 'Calle sin salida: {feature}.',
      'ann.deadEnd': 'Fin de {street}. Delante tienes {feature}. Gira a la izquierda o a la derecha, o mantén una dirección para dar la vuelta.',
      'ann.bumpLandmark': 'Te has dado contra {landmark}.',
      'ann.bumpEdge': 'Te has dado contra la valla de {feature}.',
      'ann.bumpCurb': 'Te has dado contra el bordillo.',
      'ann.whereCorner': 'En la esquina de {streetV} con {streetH}, mirando al {compass}.',
      'ann.whereBlock': 'En {street}, mirando al {compass}. {crossAhead} está a {dist} metros; {crossBehind} queda detrás.',
      'ann.whereSides': 'A tu izquierda, {left}. A tu derecha, {right}.',
      'ann.wherePlace': '{label}: {place}.',
      'ann.whereUnknown': 'Ninguna calle a la vista.',
      'place.aheadLeft': 'Delante a la izquierda',
      'place.aheadRight': 'Delante a la derecha',
      'place.behindLeft': 'Detrás a la izquierda',
      'place.behindRight': 'Detrás a la derecha',
      'compass.n': 'norte', 'compass.ne': 'noreste', 'compass.e': 'este', 'compass.se': 'sureste',
      'compass.s': 'sur', 'compass.sw': 'suroeste', 'compass.w': 'oeste', 'compass.nw': 'noroeste',
      'ann.mapVertical': 'Calles de norte a sur, de oeste a este: {list}.',
      'ann.mapHorizontal': 'Calles de este a oeste, de norte a sur: {list}.',
      'ann.mapEdges': 'Más allá del borde norte: {north}. Sur: {south}. Este: {east}. Oeste: {west}.',
      'ann.mapShop': 'La pizzería está en {street}, justo al sur de {cross}.',
      'ann.mapNumbers': 'Los números van del 1 al 100 en cada calle, veinte por manzana desde el extremo norte u oeste.',
      'ann.lightStatus': 'Cruce con {street} a {dist} metros. Semáforo en {state}, cambia en {sec} segundos.',
      'ann.lightStatusNone': 'Ningún cruce delante.',

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
    try {
      const browser = (navigator.language || navigator.userLanguage || '').toLowerCase()
      if (browser) {
        const short = browser.slice(0, 2)
        if (dictionaries[short]) return short
      }
    } catch (e) { /* no navigator (headless) */ }
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
  // EN: names that already carry a type ("Pepperoni Plaza") get no
  //   suffix; bare names ("Pizza") get " Street".
  // ES: names with a Spanish type prefix ("Plaza X", "Calle del Y") become
  //   "el número N {de la|del} {Type X}"; bare names become "el número N
  //   de la calle X".
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

  function formatDeliveryAddress(building, n, street) {
    const addr = formatAddress(n, street)
    if (!building) return addr
    if (current === 'es') return building + ', ' + addr
    return building + ' at ' + addr
  }

  // Street reference for "turn onto X" / "por X" sentences. Templates must
  // NOT prepend "la calle" / "Street" themselves.
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

  // A landmark / edge feature as a phrase ("the library" / "el río").
  function formatPlace(place) {
    if (!place) return ''
    if (place.kind === 'block') return place.landmark
    if (place.kind === 'edge') return place.feature.name
    return ''
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
    formatPlace,
  }
})()
