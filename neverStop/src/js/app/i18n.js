/**
 * Lightweight i18n for accessible audio games. See bumper/template for the
 * canonical implementation; only the STORAGE_KEY and dictionaries differ.
 */
app.i18n = (() => {
  const FALLBACK = 'en'
  const STORAGE_KEY = 'neverStop.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'neverStop',

      // Splash
      'splash.tagline': 'An audio-first driving game',
      'splash.instruction': 'Press any key to begin',

      // Menu
      'menu.aria': 'Main menu',
      'menu.start': 'Start Game',
      'menu.help': 'Help',
      'menu.learn': 'Learn Sounds',
      'menu.language': 'Language',
      'menu.hint': 'Use arrow keys and Enter to navigate.',

      // Language
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',

      // Help
      'help.aria': 'Help',
      'help.title': 'How to play',
      'help.goal': '<strong>Goal:</strong> Never stop. If your car ever comes to a halt, the game ends.',
      'help.steer': '<strong>You only steer.</strong> Left/Right arrows or A/D. There are no accelerator or brake keys — speed and braking happen <em>to</em> you, not by you.',
      'help.cones': '<strong>Speed cones</strong> (soft sonar bleep) give you a few seconds of acceleration when you collect them. The first cones each lap give you the most boost; later ones give less and less. You\'ll hear them panned where they sit on the road.',
      'help.fuel': '<strong>Fuel cans</strong> (low metallic clank) refill your tank when you collect them. Without fuel you can\'t accelerate, even from cones.',
      'help.items': '<strong>Item boxes</strong> (twinkly arpeggio) give you a random inventory item — Boost, Shield, or Fuel pack. The choice is rolled at pickup time.',
      'help.hazards': '<strong>Hazards</strong> (two-tone alarm) are wide obstacles. Crash into one and you lose ~28% of your speed instantly plus brake for ~1 second. Crashing at very low speed can stall you.',
      'help.gears': 'Your car has gears. There is <strong>no speed limit</strong>. Higher speeds burn more fuel and make crashes more punishing — balance ambition against survival.',
      'help.offroad': 'Going off the road slows you down. As you drift toward the edge you\'ll hear <strong>warning beeps that get faster</strong> the closer you are to leaving the road.',
      'help.gearChange': 'Each gear change is <strong>announced</strong> on screen and to your screen reader.',
      'help.audio': 'Audio is top-down: the listener always faces up the road. Sounds to the left of the road are heard on your left, regardless of how you\'re steering. Try to keep your car centered in the audio field.',
      'help.statusHeader': 'Status hotkeys',
      'help.statusBlurb': 'While driving, press these keys to hear the current value announced. Each key replaces the browser\'s default action.',
      'help.keyF1': '<kbd>F1</kbd> Speed in kilometers per hour',
      'help.keyF2': '<kbd>F2</kbd> Fuel remaining',
      'help.keyF3': '<kbd>F3</kbd> Current gear',
      'help.keyF4': '<kbd>F4</kbd> Distance driven',
      'help.keyF5': '<kbd>F5</kbd> Time alive',
      'help.keyF6': '<kbd>F6</kbd> Pickups and crashes (speed cones, fuel cans, crashes)',
      'help.keyF7': '<kbd>F7</kbd> Everything at once',
      'help.keyG': '<kbd>G</kbd> Use Boost (3-second emergency acceleration). Says "no boosts" if you have none.',
      'help.keyI': '<kbd>I</kbd> Inventory readout — what you\'re holding right now.',
      'help.itemHeader': 'Inventory items',
      'help.itemBlurb': 'Item boxes randomly give you one of these. Some auto-fire, some are manual.',
      'help.itemBoost': '<strong>Boost</strong> — manual. Press <kbd>G</kbd> to add 3 seconds of acceleration.',
      'help.itemShield': '<strong>Shield</strong> — auto. Absorbs the next hazard hit instead of letting it slow you down.',
      'help.itemFuel': '<strong>Fuel pack</strong> — auto. When fuel drops below 20%, instantly refills to 100%.',
      'help.pause': '<strong>Pause / back to menu:</strong> Escape.',
      'help.back': 'Back to menu',

      // Learn
      'learn.aria': 'Learn sounds',
      'learn.title': 'Learn the sounds',
      'learn.subtitle': 'Focus or click each item to hear it. Press Escape or use the Back button to return to the menu.',
      'learn.back': 'Back to menu',
      'learn.s.engine.name': 'Engine',
      'learn.s.engine.desc': 'Low rumble. Pitch rises within each gear and resets when you shift up.',
      'learn.s.hiss.name': 'Wheels off-road',
      'learn.s.hiss.desc': 'Band-passed hiss panned with the car. Plays when you leave the road.',
      'learn.s.wind.name': 'Wind',
      'learn.s.wind.desc': 'Soft filtered noise. Builds with speed.',
      'learn.s.edge.name': 'Edge warning',
      'learn.s.edge.desc': 'Beeps that get faster the closer you are to leaving the road.',
      'learn.s.speedCone.name': 'Speed cone',
      'learn.s.speedCone.desc': 'Soft bell. Hit one for a few seconds of acceleration.',
      'learn.s.fuelCone.name': 'Fuel can',
      'learn.s.fuelCone.desc': 'Low repeating clunk-clunk. Hit one to refill the tank.',
      'learn.s.hazard.name': 'Hazard alarm',
      'learn.s.hazard.desc': 'Two-tone alarm. Crash into one and you slow down hard.',
      'learn.s.speedPickup.name': 'Speed cone collected',
      'learn.s.speedPickup.desc': 'Bright chord when you grab a speed cone.',
      'learn.s.fuelPickup.name': 'Fuel can collected',
      'learn.s.fuelPickup.desc': 'Two warm thumps and a chord — the tank glugs.',
      'learn.s.crash.name': 'Crash (direct hit)',
      'learn.s.crash.desc': 'Heavy thud + low noise burst when you hit a hazard head-on.',
      'learn.s.scrape.name': 'Scrape (clip)',
      'learn.s.scrape.desc': 'Lighter metal-on-metal scrape when you only clip a hazard edge.',
      'learn.s.itemBox.name': 'Item box (beacon)',
      'learn.s.itemBox.desc': 'Twinkly arpeggio looping ahead. Grab one for a random inventory item.',
      'learn.s.itemPickup.name': 'Item collected',
      'learn.s.itemPickup.desc': 'Bright chord + shimmer when you grab an item box.',
      'learn.s.boostUsed.name': 'Boost activated (G)',
      'learn.s.boostUsed.desc': 'Rising sine sweep + thud when you use a boost item.',
      'learn.s.shieldUsed.name': 'Shield activated',
      'learn.s.shieldUsed.desc': 'Descending swirl + chord when a shield absorbs a hazard.',
      'learn.s.fuelPackUsed.name': 'Fuel pack used',
      'learn.s.fuelPackUsed.desc': 'Auto-fires when fuel hits 20% and a fuel pack refills you.',
      'learn.s.noStock.name': 'No item to use',
      'learn.s.noStock.desc': 'Two-note "nope" when you press G with no boosts.',
      'learn.s.curveStartLeft.name': 'Curve start (left)',
      'learn.s.curveStartLeft.desc': 'Slides UP, panned LEFT — left curve coming, steer left.',
      'learn.s.curveStartRight.name': 'Curve start (right)',
      'learn.s.curveStartRight.desc': 'Slides UP, panned RIGHT — right curve coming, steer right.',
      'learn.s.curveEndLeft.name': 'Curve end (left)',
      'learn.s.curveEndLeft.desc': 'Slides DOWN, panned LEFT — left curve about to end.',
      'learn.s.curveEndRight.name': 'Curve end (right)',
      'learn.s.curveEndRight.desc': 'Slides DOWN, panned RIGHT — right curve about to end.',
      'learn.s.gearUp.name': 'Gear up',
      'learn.s.gearUp.desc': 'Two-note rise when you shift into a higher gear.',
      'learn.s.gearDown.name': 'Gear down',
      'learn.s.gearDown.desc': 'Two-note fall when your speed drops a gear.',
      'learn.s.fuelLow.name': 'Fuel critical alarm',
      'learn.s.fuelLow.desc': 'Continuous up-down siren that wails faster as the tank empties.',
      'learn.s.gameOver.name': 'Game over (general)',
      'learn.s.gameOver.desc': 'Descending lament when your car stops.',
      'learn.s.gameOverFuel.name': 'Game over (fuel)',
      'learn.s.gameOverFuel.desc': 'Engine sputters and dies — when you ran out of fuel.',

      // Soundtest
      'soundtest.aria': 'Sound test',
      'soundtest.title': 'Speed cone sound test',
      'soundtest.subtitle': 'Click a button to loop that variant. Click another to switch. Press Escape or use Back to return.',
      'soundtest.current': 'Current pick:',
      'soundtest.stop': 'Stop',
      'soundtest.back': 'Back to menu',

      // Game HUD
      'game.aria': 'Game',
      'game.speed': 'Speed',
      'game.gear': 'Gear',
      'game.fuel': 'Fuel',
      'game.distance': 'Distance',
      'game.unitKmh': 'km/h',
      'game.unitMeters': 'm',
      'game.keysLabel': 'Status hotkeys',
      'game.keys.f1': 'Speed',
      'game.keys.f2': 'Fuel',
      'game.keys.f3': 'Gear',
      'game.keys.f4': 'Distance',
      'game.keys.f5': 'Time',
      'game.keys.f6': 'Pickups & crashes',
      'game.keys.f7': 'All stats',
      'game.keys.g': 'Use boost',
      'game.keys.i': 'Inventory',

      // Game runtime / status
      'game.statusCrash': 'CRASH! Braking.',
      'game.statusOutOfFuel': 'Out of fuel — coasting.',
      'game.statusOffRoad': 'OFF THE ROAD',
      'game.statusEdge': 'Edge!',
      'game.statusFuelLow': 'Fuel low.',
      'game.statusBoost': 'Boost {seconds}s',
      'game.statusGetGoing': 'Get going.',
      'game.statusDriving': 'Driving. Stay on the road. Do not stop.',

      // Announcements
      'ann.gear': 'Gear {gear}',
      'ann.crash': 'Crash',
      'ann.scrape': 'Scrape',
      'ann.shieldUsed': 'Shield used',
      'ann.gotItem': 'Got {name}',
      'ann.itemUsed': '{name} used',
      'ann.noBoosts': 'No boosts',
      'ann.inventory': 'Inventory: {summary}',
      'ann.speed': 'Speed {value} kilometers per hour',
      'ann.fuel': 'Fuel {value} percent',
      'ann.gearOnly': 'Gear {gear}',
      'ann.distance': 'Distance {value} meters',
      'ann.time': 'Time {value}',
      'ann.timeFmt': '{m} minutes {r} seconds',
      'ann.pickups': '{cones} speed cones, {fuel} fuel cans, {crashes} crashes',
      'ann.allStats': 'Speed {speed}, gear {gear}, fuel {fuel} percent, distance {distance} meters, time {time}, {cones} speed cones, {fuelCans} fuel cans, {crashes} crashes',

      // Game over
      'gameover.aria': 'Game over',
      'gameover.title': 'You stopped.',
      'gameover.distance': 'Distance',
      'gameover.topSpeed': 'Top speed',
      'gameover.topGear': 'Top gear',
      'gameover.cones': 'Speed cones',
      'gameover.fuelCans': 'Fuel cans',
      'gameover.crashes': 'Crashes',
      'gameover.time': 'Time',
      'gameover.restart': 'Drive again',
      'gameover.menu': 'Main menu',

      // Stop reasons
      'stop.fuel': 'You ran out of fuel.',
      'stop.crash': 'A crash brought you to a halt.',
      'stop.offroad': 'You went off the road and stalled.',
      'stop.generic': 'You stopped.',

      // Inventory item names (generic fallbacks)
      'item.generic': 'Item',
      'item.boost.name': 'Boost',
      'item.boost.lower': 'boost',
      'item.boost.plural': 'boosts',
      'item.shield.name': 'Shield',
      'item.shield.lower': 'shield',
      'item.shield.plural': 'shields',
      'item.fuel.name': 'Fuel pack',
      'item.fuel.lower': 'fuel pack',
      'item.fuel.plural': 'fuel packs',
      'inv.empty': 'Empty',

      // Soundtest variants
      'soundtest.variant.sonar_up_soft': 'Sonar up-glide soft (default)',
      'soundtest.variant.sonar_up_softer': 'Sonar up-glide softer (Q2, slower attack)',
      'soundtest.variant.sonar_up_softest': 'Sonar up-glide softest (very gentle)',
      'soundtest.variant.sonar_up_high': 'Sonar up-glide high (A5)',
      'soundtest.variant.sonar_up_low': 'Sonar up-glide low (A3)',
      'soundtest.variant.sonar_up_wide': 'Sonar up-glide wide (+200¢)',
      'soundtest.variant.sonar_up_subtle': 'Sonar up-glide subtle (+60¢)',
      'soundtest.variant.sonar_up_long': 'Sonar up-glide longer notes (180ms)',
      'soundtest.variant.sonar_up_quick': 'Sonar up-glide quick (80ms)',
      'soundtest.variant.sonar_up_orig': 'Sonar up-glide ORIGINAL (Q7, harsh)',
      'soundtest.dash': '—',
      'soundtest.label': '{name} ({id})',
    },

    es: {
      'doc.title': 'neverStop',

      'splash.tagline': 'Un juego de conducción centrado en el audio',
      'splash.instruction': 'Pulsa una tecla para empezar',

      'menu.aria': 'Menú principal',
      'menu.start': 'Empezar partida',
      'menu.help': 'Ayuda',
      'menu.learn': 'Aprende los sonidos',
      'menu.language': 'Idioma',
      'menu.hint': 'Usa las flechas y Enter para navegar.',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',

      'help.aria': 'Ayuda',
      'help.title': 'Cómo se juega',
      'help.goal': '<strong>Objetivo:</strong> Nunca te detengas. Si tu coche se para, la partida termina.',
      'help.steer': '<strong>Solo giras.</strong> Flechas izquierda/derecha o A/D. No hay acelerador ni freno: la velocidad y el frenado te suceden <em>a ti</em>, no los controlas tú.',
      'help.cones': '<strong>Conos de velocidad</strong> (pitido suave de sonar) te dan unos segundos de aceleración al recogerlos. Los primeros conos de cada vuelta dan más impulso; los siguientes dan menos. Los oirás situados en la posición que ocupan en la calzada.',
      'help.fuel': '<strong>Bidones de combustible</strong> (golpe metálico grave) llenan el depósito al recogerlos. Sin combustible no puedes acelerar, ni siquiera con conos.',
      'help.items': '<strong>Cajas de objetos</strong> (arpegio brillante) te dan un objeto al azar: Turbo, Escudo o Bidón de gasolina. El objeto se elige al recoger la caja.',
      'help.hazards': '<strong>Obstáculos</strong> (alarma de dos tonos) son anchos. Si chocas pierdes ~28% de velocidad al instante y frenas durante ~1 segundo. Chocar a muy baja velocidad puede detenerte.',
      'help.gears': 'Tu coche tiene marchas. <strong>No hay límite de velocidad.</strong> A más velocidad, más consumo y choques más duros — equilibra ambición y supervivencia.',
      'help.offroad': 'Salirse de la calzada te frena. A medida que te acercas al borde oirás <strong>pitidos cada vez más rápidos</strong> según te aproximas al borde.',
      'help.gearChange': 'Cada cambio de marcha se <strong>anuncia</strong> en pantalla y al lector de pantalla.',
      'help.audio': 'El audio es cenital: el oyente siempre mira hacia el frente. Los sonidos a la izquierda de la calzada se oyen a tu izquierda, sin importar cómo gires. Intenta mantener el coche centrado en el campo sonoro.',
      'help.statusHeader': 'Atajos de estado',
      'help.statusBlurb': 'Mientras conduces, pulsa estas teclas para oír el valor actual. Cada tecla anula la acción por defecto del navegador.',
      'help.keyF1': '<kbd>F1</kbd> Velocidad en kilómetros por hora',
      'help.keyF2': '<kbd>F2</kbd> Combustible restante',
      'help.keyF3': '<kbd>F3</kbd> Marcha actual',
      'help.keyF4': '<kbd>F4</kbd> Distancia recorrida',
      'help.keyF5': '<kbd>F5</kbd> Tiempo en marcha',
      'help.keyF6': '<kbd>F6</kbd> Recogidas y choques (conos, bidones, choques)',
      'help.keyF7': '<kbd>F7</kbd> Todo a la vez',
      'help.keyG': '<kbd>G</kbd> Usar Turbo (3 segundos de aceleración de emergencia). Dice "sin turbos" si no tienes ninguno.',
      'help.keyI': '<kbd>I</kbd> Lectura de inventario — qué tienes ahora mismo.',
      'help.itemHeader': 'Objetos del inventario',
      'help.itemBlurb': 'Las cajas de objetos te dan uno de estos al azar. Algunos se activan solos, otros son manuales.',
      'help.itemBoost': '<strong>Turbo</strong> — manual. Pulsa <kbd>G</kbd> para añadir 3 segundos de aceleración.',
      'help.itemShield': '<strong>Escudo</strong> — automático. Absorbe el próximo choque en lugar de dejar que te frene.',
      'help.itemFuel': '<strong>Bidón</strong> — automático. Cuando el combustible baja del 20%, llena el depósito al 100%.',
      'help.pause': '<strong>Pausa / volver al menú:</strong> Escape.',
      'help.back': 'Volver al menú',

      'learn.aria': 'Aprende los sonidos',
      'learn.title': 'Aprende los sonidos',
      'learn.subtitle': 'Enfoca o haz clic en cada elemento para oírlo. Pulsa Escape o el botón Atrás para volver al menú.',
      'learn.back': 'Volver al menú',
      'learn.s.engine.name': 'Motor',
      'learn.s.engine.desc': 'Rumor grave. El tono sube dentro de cada marcha y se reinicia al subir de marcha.',
      'learn.s.hiss.name': 'Ruedas fuera de la calzada',
      'learn.s.hiss.desc': 'Siseo filtrado panoramizado con el coche. Suena al salirte de la calzada.',
      'learn.s.wind.name': 'Viento',
      'learn.s.wind.desc': 'Ruido suave filtrado. Aumenta con la velocidad.',
      'learn.s.edge.name': 'Aviso de borde',
      'learn.s.edge.desc': 'Pitidos cada vez más rápidos según te acercas al borde de la calzada.',
      'learn.s.speedCone.name': 'Cono de velocidad',
      'learn.s.speedCone.desc': 'Campana suave. Recógelo para unos segundos de aceleración.',
      'learn.s.fuelCone.name': 'Bidón de gasolina',
      'learn.s.fuelCone.desc': 'Golpe metálico repetido. Recógelo para llenar el depósito.',
      'learn.s.hazard.name': 'Alarma de obstáculo',
      'learn.s.hazard.desc': 'Alarma de dos tonos. Si chocas, te frenas mucho.',
      'learn.s.speedPickup.name': 'Cono de velocidad recogido',
      'learn.s.speedPickup.desc': 'Acorde brillante al recoger un cono.',
      'learn.s.fuelPickup.name': 'Bidón recogido',
      'learn.s.fuelPickup.desc': 'Dos golpes cálidos y un acorde — el depósito glugluteando.',
      'learn.s.crash.name': 'Choque (directo)',
      'learn.s.crash.desc': 'Golpe pesado y ráfaga grave al chocar de frente con un obstáculo.',
      'learn.s.scrape.name': 'Roce (rozadura)',
      'learn.s.scrape.desc': 'Roce metálico más suave al pasar rozando un obstáculo.',
      'learn.s.itemBox.name': 'Caja de objetos (baliza)',
      'learn.s.itemBox.desc': 'Arpegio brillante en bucle delante. Recógela para un objeto al azar.',
      'learn.s.itemPickup.name': 'Objeto recogido',
      'learn.s.itemPickup.desc': 'Acorde brillante con destello al recoger una caja.',
      'learn.s.boostUsed.name': 'Turbo activado (G)',
      'learn.s.boostUsed.desc': 'Barrido sinusoidal ascendente y golpe al usar un turbo.',
      'learn.s.shieldUsed.name': 'Escudo activado',
      'learn.s.shieldUsed.desc': 'Remolino descendente y acorde cuando el escudo absorbe un obstáculo.',
      'learn.s.fuelPackUsed.name': 'Bidón usado',
      'learn.s.fuelPackUsed.desc': 'Se activa solo al 20% de gasolina y rellena el depósito.',
      'learn.s.noStock.name': 'Sin objeto que usar',
      'learn.s.noStock.desc': 'Dos notas de "no" al pulsar G sin turbos.',
      'learn.s.curveStartLeft.name': 'Inicio de curva (izquierda)',
      'learn.s.curveStartLeft.desc': 'Sube, panoramizado a la IZQUIERDA — viene curva a la izquierda.',
      'learn.s.curveStartRight.name': 'Inicio de curva (derecha)',
      'learn.s.curveStartRight.desc': 'Sube, panoramizado a la DERECHA — viene curva a la derecha.',
      'learn.s.curveEndLeft.name': 'Fin de curva (izquierda)',
      'learn.s.curveEndLeft.desc': 'Baja, panoramizado a la IZQUIERDA — la curva izquierda termina.',
      'learn.s.curveEndRight.name': 'Fin de curva (derecha)',
      'learn.s.curveEndRight.desc': 'Baja, panoramizado a la DERECHA — la curva derecha termina.',
      'learn.s.gearUp.name': 'Cambio ascendente',
      'learn.s.gearUp.desc': 'Dos notas ascendentes al subir de marcha.',
      'learn.s.gearDown.name': 'Cambio descendente',
      'learn.s.gearDown.desc': 'Dos notas descendentes al bajar de marcha.',
      'learn.s.fuelLow.name': 'Alarma de gasolina crítica',
      'learn.s.fuelLow.desc': 'Sirena continua arriba/abajo que acelera según se vacía el depósito.',
      'learn.s.gameOver.name': 'Fin del juego (general)',
      'learn.s.gameOver.desc': 'Lamento descendente cuando el coche se para.',
      'learn.s.gameOverFuel.name': 'Fin del juego (gasolina)',
      'learn.s.gameOverFuel.desc': 'El motor se ahoga y se cala — al quedarte sin gasolina.',

      'soundtest.aria': 'Prueba de sonido',
      'soundtest.title': 'Prueba del sonido del cono',
      'soundtest.subtitle': 'Haz clic en un botón para repetir esa variante. Haz clic en otro para cambiar. Pulsa Escape o Atrás para volver.',
      'soundtest.current': 'Selección actual:',
      'soundtest.stop': 'Parar',
      'soundtest.back': 'Volver al menú',

      'game.aria': 'Juego',
      'game.speed': 'Velocidad',
      'game.gear': 'Marcha',
      'game.fuel': 'Gasolina',
      'game.distance': 'Distancia',
      'game.unitKmh': 'km/h',
      'game.unitMeters': 'm',
      'game.keysLabel': 'Atajos de estado',
      'game.keys.f1': 'Velocidad',
      'game.keys.f2': 'Combustible',
      'game.keys.f3': 'Marcha',
      'game.keys.f4': 'Distancia',
      'game.keys.f5': 'Tiempo',
      'game.keys.f6': 'Recogidas y choques',
      'game.keys.f7': 'Todas las estadísticas',
      'game.keys.g': 'Usar turbo',
      'game.keys.i': 'Inventario',

      'game.statusCrash': '¡CHOQUE! Frenando.',
      'game.statusOutOfFuel': 'Sin gasolina — rodando libre.',
      'game.statusOffRoad': 'FUERA DE LA CALZADA',
      'game.statusEdge': '¡Borde!',
      'game.statusFuelLow': 'Gasolina baja.',
      'game.statusBoost': 'Turbo {seconds}s',
      'game.statusGetGoing': 'En marcha.',
      'game.statusDriving': 'Conduciendo. No te salgas. No te detengas.',

      'ann.gear': 'Marcha {gear}',
      'ann.crash': 'Choque',
      'ann.scrape': 'Roce',
      'ann.shieldUsed': 'Escudo usado',
      'ann.gotItem': 'Has cogido {name}',
      'ann.itemUsed': '{name} usado',
      'ann.noBoosts': 'Sin turbos',
      'ann.inventory': 'Inventario: {summary}',
      'ann.speed': 'Velocidad {value} kilómetros por hora',
      'ann.fuel': 'Gasolina al {value} por ciento',
      'ann.gearOnly': 'Marcha {gear}',
      'ann.distance': 'Distancia {value} metros',
      'ann.time': 'Tiempo {value}',
      'ann.timeFmt': '{m} minutos {r} segundos',
      'ann.pickups': '{cones} conos, {fuel} bidones, {crashes} choques',
      'ann.allStats': 'Velocidad {speed}, marcha {gear}, gasolina al {fuel} por ciento, distancia {distance} metros, tiempo {time}, {cones} conos, {fuelCans} bidones, {crashes} choques',

      'gameover.aria': 'Fin del juego',
      'gameover.title': 'Te has parado.',
      'gameover.distance': 'Distancia',
      'gameover.topSpeed': 'Velocidad máx.',
      'gameover.topGear': 'Marcha máx.',
      'gameover.cones': 'Conos de velocidad',
      'gameover.fuelCans': 'Bidones',
      'gameover.crashes': 'Choques',
      'gameover.time': 'Tiempo',
      'gameover.restart': 'Conducir otra vez',
      'gameover.menu': 'Menú principal',

      'stop.fuel': 'Te has quedado sin gasolina.',
      'stop.crash': 'Un choque te ha detenido.',
      'stop.offroad': 'Te has salido de la calzada y se ha calado.',
      'stop.generic': 'Te has parado.',

      'item.generic': 'Objeto',
      'item.boost.name': 'Turbo',
      'item.boost.lower': 'turbo',
      'item.boost.plural': 'turbos',
      'item.shield.name': 'Escudo',
      'item.shield.lower': 'escudo',
      'item.shield.plural': 'escudos',
      'item.fuel.name': 'Bidón',
      'item.fuel.lower': 'bidón',
      'item.fuel.plural': 'bidones',
      'inv.empty': 'Vacío',

      'soundtest.variant.sonar_up_soft': 'Sónar ascendente suave (predeterminado)',
      'soundtest.variant.sonar_up_softer': 'Sónar ascendente más suave (Q2, ataque más lento)',
      'soundtest.variant.sonar_up_softest': 'Sónar ascendente muy suave',
      'soundtest.variant.sonar_up_high': 'Sónar ascendente agudo (la5)',
      'soundtest.variant.sonar_up_low': 'Sónar ascendente grave (la3)',
      'soundtest.variant.sonar_up_wide': 'Sónar ascendente ancho (+200¢)',
      'soundtest.variant.sonar_up_subtle': 'Sónar ascendente sutil (+60¢)',
      'soundtest.variant.sonar_up_long': 'Sónar ascendente notas largas (180 ms)',
      'soundtest.variant.sonar_up_quick': 'Sónar ascendente rápido (80 ms)',
      'soundtest.variant.sonar_up_orig': 'Sónar ascendente ORIGINAL (Q7, áspero)',
      'soundtest.dash': '—',
      'soundtest.label': '{name} ({id})',
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
