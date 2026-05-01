// Tiny string-table i18n for Wheels of Claudo.
// Loaded early; hud.js and main.js call I18n.t(...) for any user-facing string.
const I18n = (() => {
  const T = {
    en: {
      // splash
      'splash.title':       'WHEELS OF CLAUDO',
      'splash.subtitle':    'Anti-gravity racer',
      'splash.start':       'Start Game',
      'splash.host':        'Host Online Race',
      'splash.join':        'Join Online Race',
      'splash.learn':       'Learn Sounds',
      'splash.help':        'Help',
      'splash.lang':        'Language: English',
      'splash.hint':        'Use Up / Down arrows and Enter.',
      'splash.menuAria':    'Main menu',

      // help dialog
      'help.aria':          'Help',
      'help.body': `
        <h2>HELP</h2>
        <ul class="instructions">
          <li>Arrow Left / Right: steer</li>
          <li>Arrow Down: brake</li>
          <li>Shift: boost (drains health)</li>
          <li>A: shoot left &mdash; S: shoot forward &mdash; D: shoot right (needs ammo)</li>
          <li>Space: use held item (Nitro Burst, Ion Mine, or Decoy Beacon)</li>
          <li>F1: position &mdash; F2: lap &mdash; F3: speed &mdash; F4: health</li>
          <li>M: mute / unmute</li>
        </ul>
        <p class="sub">3 laps. Engine pans left/right with your lane position &mdash; steer TOWARD the quieter side to center.</p>
        <p class="sub">Ticking warns near the edge. Metal grinding = off track, drains health.</p>
        <p class="sub">Pickups float ahead. Sine chord = health. Metallic pulse = shooter ammo. Revving triangle = Nitro (short super-boost, no drain). Low ominous hum with crackle = Ion Mine (drop with Space; blows up whoever drives over it). Radio warble = Decoy Beacon (clears incoming missile locks).</p>
        <p class="sub">Bullets home onto any car you can hear. Direct hits slow more than clips.</p>
        <p class="sub">A dropped mine emits a low, slow 60Hz pulse so you can steer around it. Run over one and you hear a loud EMP thump &mdash; and lose half your speed.</p>
        <p class="sub">Online: host creates a room and shares the 6-character code. Others pick Join, enter the code, and race. Same controls, same items, real humans.</p>
        <p class="sub">Press Escape or Enter to return to menu.</p>
      `,

      // online: name entry
      'name.title':         'YOUR NAME',
      'name.prompt':        'Type a name, then press Enter.',
      'name.escape':        'Press Escape to return to the menu.',
      'name.modeHost':      'Hosting a new race.',
      'name.modeJoin':      'Joining an online race.',
      'name.creating':      'Creating room…',
      'name.cantCreate':    'Could not create room.',
      'name.tryAgain':      'Try again.',

      // online: join code
      'join.title':         'JOIN RACE',
      'join.prompt':        'Enter the 6-character room code, then press Enter.',
      'join.codeLength':    'Room code must be 6 characters.',
      'join.connecting':    'Connecting to host…',
      'join.cantJoin':      'Could not join.',
      'join.joined':        'Joined lobby. Waiting for host to start.',

      // lobby
      'lobby.title':        'LOBBY',
      'lobby.titleHost':    'LOBBY — YOU ARE HOST',
      'lobby.start':        'Start Race',
      'lobby.leave':        'Leave',
      'lobby.escape':       'Press Escape to leave.',
      'lobby.codeAria':     'Room code',
      'lobby.playersAria':  'Players in lobby',
      'lobby.actionsAria':  'Lobby actions',
      'lobby.code':         'Room code: {code}',
      'lobby.hintHost':     'Share the code. Empty slots ({free}) will be filled with CPU racers. Start when ready.',
      'lobby.hintFull':     'Full lobby. Press Start Race when ready.',
      'lobby.hintClient':   'Waiting for host to start the race.',
      'lobby.host':         'Host',
      'lobby.you':          'you',
      'lobby.hostTag':      '(host)',
      'lobby.youTag':       '(you)',
      'lobby.slot':         'Slot {n}',
      'lobby.created':      'Room created. Code {code}. Waiting for racers.',
      'lobby.joined':       '{name} joined.',
      'lobby.left':         'A racer left.',
      'lobby.disconnected': 'Disconnected from host.',
      'lobby.netError':     'Network error.',

      // learn sounds
      'learn.title':        'LEARN SOUNDS',
      'learn.aria':         'Learn sounds',
      'learn.prompt':       'Arrow Up / Down to browse. Enter to replay. Escape to return.',
      'learn.replay':       '{name}. Press Enter to play.',
      'learn.listAria':     'Game sounds',
      'sound.engine':            'Player engine',
      'sound.exhaust':           'Exhaust airflow',
      'sound.wind':              'Wind rushing by',
      'sound.center':            'Center-line cue',
      'sound.railLeft':          'Left rail proximity',
      'sound.railRight':         'Right rail proximity',
      'sound.offroad':           'Off-track metal grind',
      'sound.aiEngine':          'Opponent engine',
      'sound.pickupHealth':      'Health pickup beacon',
      'sound.pickupShooter':     'Shooter pickup beacon',
      'sound.pickupNitro':       'Nitro Burst beacon',
      'sound.pickupMine':        'Ion Mine pickup beacon',
      'sound.pickupDecoy':       'Decoy Beacon pickup',
      'sound.mineArmed':         'Armed mine on track (avoid)',
      'sound.travel':            'Bullet in flight',
      'sound.edgeTick':          'Edge-of-track tick',
      'sound.gearUp':            'Gear up-shift',
      'sound.gearDown':          'Gear down-shift',
      'sound.curveLeft':         'Left curve warning',
      'sound.curveRight':        'Right curve warning',
      'sound.straight':          'Long straight ahead',
      'sound.checkpoint':        'Checkpoint',
      'sound.lap':               'Lap complete',
      'sound.finish':            'Race finish fanfare',
      'sound.countdown3':        'Countdown beep',
      'sound.countdown0':        'Countdown GO',
      'sound.hit':               'Collision impact',
      'sound.alarm':             'Low-health alarm',
      'sound.fire':              'Shoot — bullet fire',
      'sound.explosion':         'Explosion on direct hit',
      'sound.miss':              'Bullet miss',
      'sound.pickupHealthFx':    'Health pickup collected',
      'sound.pickupShooterFx':   'Shooter pickup collected',
      'sound.pickupNitroFx':     'Nitro pickup collected',
      'sound.pickupMineFx':      'Ion Mine pickup collected',
      'sound.pickupDecoyFx':     'Decoy pickup collected',
      'sound.nitroActivate':     'Nitro Burst activation',
      'sound.nitroEnd':          'Nitro Burst ends',
      'sound.mineActivate':      'Ion Mine dropped (arming)',
      'sound.mineExplode':       'Ion Mine explosion / EMP',
      'sound.decoyActivate':     'Decoy Beacon released',
      'sound.decoyClear':        'Missile lock cleared',

      // hud labels
      'hud.pos':     'POS',
      'hud.lap':     'LAP',
      'hud.speed':   'SPEED',
      'hud.gear':    'GEAR',
      'hud.health':  'HEALTH',
      'hud.ammo':    'AMMO',
      'hud.item':    'ITEM',
      'hud.unitKmh': 'km/h',
      'hud.itemNitro': 'NITRO',
      'hud.itemMine':  'MINE',
      'hud.itemDecoy': 'DECOY',
      'hud.itemNone':  '—',
      'hud.itemNitroActive': 'NITRO {sec}s',

      // finish + game over
      'finish.title':    'Race complete',
      'finish.victory':  'VICTORY',
      'finish.complete': 'RACE COMPLETE',
      'finish.detail':   'Finished {ordinal} of {total} in {time}s',
      'finish.retry':    'Race Again',
      'finish.announce': 'Race complete. Finished {ordinal} of {total} in {time} seconds. Press Enter to restart.',

      'gameover.title':    'GAME OVER',
      'gameover.epitaph':  'Your ship is wrecked.',
      'gameover.retry':    'Try Again',
      'gameover.position': 'Position',
      'gameover.lap':      'Lap',
      'gameover.lapPct':   'Lap progress',
      'gameover.time':     'Race time',
      'gameover.topSpeed': 'Top speed',
      'gameover.ofTotal':  '{n} of {total}',
      'gameover.announce': 'Game over. Wrecked in {ordinal} place, lap {lap} of {totalLaps}, {pct} percent through. Press Enter to try again.',

      // ordinals (cardinal numbers used as ordinals; Spanish has gendered forms)
      'ord.1':  '1st',  'ord.2':  '2nd',  'ord.3':  '3rd',  'ord.4':  '4th',
      'ord.5':  '5th',  'ord.6':  '6th',  'ord.7':  '7th',  'ord.8':  '8th',

      // gameplay announcements
      'ann.healthPack':   'Health pack collected.',
      'ann.shooter':      'Shooter ammo, {n} rounds.',
      'ann.cantCarry':    'Can\'t carry {item} — already holding {held}.',
      'ann.acquired':     '{item} acquired. Press Space to use.',
      'ann.nitro':        'Nitro burst!',
      'ann.mineDrop':     'Mine dropped.',
      'ann.decoyRelease': 'Decoy released!',
      'ann.fired':        'Fired {dir}. {n} left.',
      'ann.three':        'Three',
      'ann.two':          'Two',
      'ann.one':          'One',
      'ann.go':           'Go!',
      'ann.directHit':    'Direct hit!',
      'ann.hit':          'Hit!',
      'ann.clipped':      'Clipped!',
      'ann.directHitTaken': 'Direct hit taken!',
      'ann.hitTaken':     'Hit!',
      'ann.clippedTaken': 'Clipped.',
      'ann.impact':       'Impact.',
      'ann.impactSide':   'Impact on {side}.',
      'ann.missedSide':   'Missed {side}.',
      'ann.mineTriggered':'Mine triggered!',
      'ann.newChallenger':'New challenger ahead — {n} racers now.',
      'ann.position':     'Position {n} of {total}.',
      'ann.lapStatus':    'Lap {n} of {total}.',
      'ann.lapDone':      'Lap {n} of {total}.',
      'ann.speedStatus':  'Speed {kmh} kilometers per hour, gear {gear}.',
      'ann.healthStatus': 'Health {pct} percent.',
      'ann.muted':        'Muted',
      'ann.unmuted':      'Unmuted',
      'ann.offTrack':     'Off track {side}! Steer to center.',
      'ann.backOnTrack':  'Back on track.',
      'ann.nitroSpent':   'Nitro spent.',

      'side.left':  'left',
      'side.right': 'right',
      'dir.left':    'left',
      'dir.forward': 'forward',
      'dir.right':   'right',

      'item.nitro': 'Nitro Burst',
      'item.mine':  'Ion Mine',
      'item.decoy': 'Decoy Beacon',
    },

    es: {
      // splash
      'splash.title':       'WHEELS OF CLAUDO',
      'splash.subtitle':    'Carrera antigravedad',
      'splash.start':       'Empezar partida',
      'splash.host':        'Crear sala en línea',
      'splash.join':        'Unirse a sala',
      'splash.learn':       'Aprender sonidos',
      'splash.help':        'Ayuda',
      'splash.lang':        'Idioma: Español',
      'splash.hint':        'Usa flechas Arriba / Abajo e Intro.',
      'splash.menuAria':    'Menú principal',

      'help.aria':          'Ayuda',
      'help.body': `
        <h2>AYUDA</h2>
        <ul class="instructions">
          <li>Flecha izquierda / derecha: girar</li>
          <li>Flecha abajo: frenar</li>
          <li>Mayús: turbo (gasta vida)</li>
          <li>A: disparar a la izquierda &mdash; S: disparar al frente &mdash; D: disparar a la derecha (necesita munición)</li>
          <li>Espacio: usar el objeto guardado (Nitro, Mina Iónica o Señuelo)</li>
          <li>F1: posición &mdash; F2: vuelta &mdash; F3: velocidad &mdash; F4: vida</li>
          <li>M: silenciar / activar sonido</li>
        </ul>
        <p class="sub">3 vueltas. El motor suena más a un lado u otro según tu carril &mdash; gira HACIA el lado más silencioso para centrarte.</p>
        <p class="sub">Un tictac te avisa cuando rozas el borde. Chirrido metálico = fuera de pista, te quita vida.</p>
        <p class="sub">Hay objetos flotando por delante. Acorde sinusoidal = vida. Pulso metálico = munición. Triángulo acelerando = Nitro (turbo corto, sin gastar vida). Zumbido grave con chasquidos = Mina Iónica (suéltala con Espacio; revienta a quien la pise). Crujido de radio = Señuelo (despeja los misiles que te persiguen).</p>
        <p class="sub">Las balas persiguen a cualquier coche que puedas oír. Un impacto directo frena más que un rozón.</p>
        <p class="sub">Una mina soltada emite un pulso lento y grave de 60Hz para que la esquives. Si la pisas, suena un golpazo de EMP &mdash; y pierdes la mitad de tu velocidad.</p>
        <p class="sub">En línea: el anfitrión crea una sala y comparte el código de 6 caracteres. Los demás eligen Unirse, escriben el código y a correr. Mismos controles, mismos objetos, humanos de verdad.</p>
        <p class="sub">Pulsa Escape o Intro para volver al menú.</p>
      `,

      'name.title':         'TU NOMBRE',
      'name.prompt':        'Escribe un nombre y pulsa Intro.',
      'name.escape':        'Pulsa Escape para volver al menú.',
      'name.modeHost':      'Vas a crear una sala nueva.',
      'name.modeJoin':      'Vas a unirte a una sala.',
      'name.creating':      'Creando sala…',
      'name.cantCreate':    'No se pudo crear la sala.',
      'name.tryAgain':      'Inténtalo de nuevo.',

      'join.title':         'UNIRSE A SALA',
      'join.prompt':        'Escribe el código de 6 caracteres y pulsa Intro.',
      'join.codeLength':    'El código debe tener 6 caracteres.',
      'join.connecting':    'Conectando con el anfitrión…',
      'join.cantJoin':      'No se pudo unir.',
      'join.joined':        'Te uniste a la sala. Esperando a que empiece.',

      'lobby.title':        'SALA',
      'lobby.titleHost':    'SALA — ERES EL ANFITRIÓN',
      'lobby.start':        'Empezar carrera',
      'lobby.leave':        'Salir',
      'lobby.escape':       'Pulsa Escape para salir.',
      'lobby.codeAria':     'Código de sala',
      'lobby.playersAria':  'Jugadores en la sala',
      'lobby.actionsAria':  'Acciones de la sala',
      'lobby.code':         'Código de sala: {code}',
      'lobby.hintHost':     'Comparte el código. Los puestos vacíos ({free}) se rellenan con bots. Empieza cuando estés.',
      'lobby.hintFull':     'Sala llena. Pulsa Empezar carrera cuando quieras.',
      'lobby.hintClient':   'Esperando a que el anfitrión empiece la carrera.',
      'lobby.host':         'Anfitrión',
      'lobby.you':          'tú',
      'lobby.hostTag':      '(anfitrión)',
      'lobby.youTag':       '(tú)',
      'lobby.slot':         'Puesto {n}',
      'lobby.created':      'Sala creada. Código {code}. Esperando corredores.',
      'lobby.joined':       '{name} se unió.',
      'lobby.left':         'Un corredor se fue.',
      'lobby.disconnected': 'Te has desconectado del anfitrión.',
      'lobby.netError':     'Error de red.',

      'learn.title':        'APRENDER SONIDOS',
      'learn.aria':         'Aprender sonidos',
      'learn.prompt':       'Flechas Arriba / Abajo para navegar. Intro para repetir. Escape para volver.',
      'learn.replay':       '{name}. Pulsa Intro para reproducir.',
      'learn.listAria':     'Sonidos del juego',
      'sound.engine':            'Motor del jugador',
      'sound.exhaust':           'Aire del escape',
      'sound.wind':              'Viento al pasar',
      'sound.center':            'Aviso de línea central',
      'sound.railLeft':          'Cercanía a la valla izquierda',
      'sound.railRight':         'Cercanía a la valla derecha',
      'sound.offroad':           'Chirrido fuera de pista',
      'sound.aiEngine':          'Motor de un rival',
      'sound.pickupHealth':      'Baliza del objeto de vida',
      'sound.pickupShooter':     'Baliza de munición',
      'sound.pickupNitro':       'Baliza de Nitro',
      'sound.pickupMine':        'Baliza de Mina Iónica',
      'sound.pickupDecoy':       'Baliza de Señuelo',
      'sound.mineArmed':         'Mina activa en pista (esquívala)',
      'sound.travel':            'Bala en vuelo',
      'sound.edgeTick':          'Tic del borde de la pista',
      'sound.gearUp':            'Subir marcha',
      'sound.gearDown':          'Bajar marcha',
      'sound.curveLeft':         'Aviso de curva a la izquierda',
      'sound.curveRight':        'Aviso de curva a la derecha',
      'sound.straight':          'Recta larga por delante',
      'sound.checkpoint':        'Punto de control',
      'sound.lap':               'Vuelta completada',
      'sound.finish':            'Fanfarria de meta',
      'sound.countdown3':        'Pitido de cuenta atrás',
      'sound.countdown0':        '¡YA! de cuenta atrás',
      'sound.hit':               'Choque',
      'sound.alarm':             'Alarma de poca vida',
      'sound.fire':              'Disparo de bala',
      'sound.explosion':         'Explosión por impacto directo',
      'sound.miss':              'Bala perdida',
      'sound.pickupHealthFx':    'Vida recogida',
      'sound.pickupShooterFx':   'Munición recogida',
      'sound.pickupNitroFx':     'Nitro recogido',
      'sound.pickupMineFx':      'Mina Iónica recogida',
      'sound.pickupDecoyFx':     'Señuelo recogido',
      'sound.nitroActivate':     'Nitro activado',
      'sound.nitroEnd':          'Nitro agotado',
      'sound.mineActivate':      'Mina soltada (armándose)',
      'sound.mineExplode':       'Explosión de Mina / EMP',
      'sound.decoyActivate':     'Señuelo lanzado',
      'sound.decoyClear':        'Misil despistado',

      'hud.pos':     'POS',
      'hud.lap':     'VUELTA',
      'hud.speed':   'VEL',
      'hud.gear':    'MARCHA',
      'hud.health':  'VIDA',
      'hud.ammo':    'MUNI',
      'hud.item':    'OBJETO',
      'hud.unitKmh': 'km/h',
      'hud.itemNitro': 'NITRO',
      'hud.itemMine':  'MINA',
      'hud.itemDecoy': 'SEÑUELO',
      'hud.itemNone':  '—',
      'hud.itemNitroActive': 'NITRO {sec}s',

      'finish.title':    'Carrera completada',
      'finish.victory':  'VICTORIA',
      'finish.complete': 'CARRERA COMPLETADA',
      'finish.detail':   'Has acabado {ordinal} de {total} en {time}s',
      'finish.retry':    'Correr otra vez',
      'finish.announce': 'Carrera completada. Has acabado {ordinal} de {total} en {time} segundos. Pulsa Intro para repetir.',

      'gameover.title':    'FIN DE LA PARTIDA',
      'gameover.epitaph':  'Tu nave está destrozada.',
      'gameover.retry':    'Reintentar',
      'gameover.position': 'Posición',
      'gameover.lap':      'Vuelta',
      'gameover.lapPct':   'Progreso de vuelta',
      'gameover.time':     'Tiempo',
      'gameover.topSpeed': 'Velocidad máx.',
      'gameover.ofTotal':  '{n} de {total}',
      'gameover.announce': 'Fin de la partida. Destrozado en {ordinal} puesto, vuelta {lap} de {totalLaps}, al {pct} por ciento. Pulsa Intro para reintentar.',

      'ord.1':  '1.º',  'ord.2':  '2.º',  'ord.3':  '3.º',  'ord.4':  '4.º',
      'ord.5':  '5.º',  'ord.6':  '6.º',  'ord.7':  '7.º',  'ord.8':  '8.º',

      'ann.healthPack':   'Vida recogida.',
      'ann.shooter':      'Munición: {n} balas.',
      'ann.cantCarry':    'No puedes llevar {item} — ya tienes {held}.',
      'ann.acquired':     '{item} recogido. Pulsa Espacio para usar.',
      'ann.nitro':        '¡Turbo!',
      'ann.mineDrop':     'Mina soltada.',
      'ann.decoyRelease': '¡Señuelo lanzado!',
      'ann.fired':        'Disparo {dir}. Quedan {n}.',
      'ann.three':        'Tres',
      'ann.two':          'Dos',
      'ann.one':          'Uno',
      'ann.go':           '¡Ya!',
      'ann.directHit':    '¡Impacto directo!',
      'ann.hit':          '¡Tocado!',
      'ann.clipped':      '¡Rozón!',
      'ann.directHitTaken': '¡Te dieron de lleno!',
      'ann.hitTaken':     '¡Te han tocado!',
      'ann.clippedTaken': 'Te rozaron.',
      'ann.impact':       'Choque.',
      'ann.impactSide':   'Choque por la {side}.',
      'ann.missedSide':   'Fallo por la {side}.',
      'ann.mineTriggered':'¡Mina activada!',
      'ann.newChallenger':'Nuevo rival — ya sois {n} en pista.',
      'ann.position':     'Posición {n} de {total}.',
      'ann.lapStatus':    'Vuelta {n} de {total}.',
      'ann.lapDone':      'Vuelta {n} de {total}.',
      'ann.speedStatus':  '{kmh} kilómetros por hora, marcha {gear}.',
      'ann.healthStatus': 'Vida al {pct} por ciento.',
      'ann.muted':        'Silenciado',
      'ann.unmuted':      'Sonido activado',
      'ann.offTrack':     '¡Fuera de pista por la {side}! Vuelve al centro.',
      'ann.backOnTrack':  'Vuelves a la pista.',
      'ann.nitroSpent':   'Turbo agotado.',

      'side.left':  'izquierda',
      'side.right': 'derecha',
      'dir.left':    'a la izquierda',
      'dir.forward': 'al frente',
      'dir.right':   'a la derecha',

      'item.nitro': 'Nitro',
      'item.mine':  'Mina Iónica',
      'item.decoy': 'Señuelo',
    },
  }

  let lang = 'en'
  try {
    const saved = localStorage.getItem('woc-lang')
    if (saved === 'en' || saved === 'es') lang = saved
  } catch (_) {}

  const subscribers = []

  function get() { return lang }

  function set(l) {
    if (l !== 'en' && l !== 'es') return
    if (l === lang) return
    lang = l
    try { localStorage.setItem('woc-lang', l) } catch (_) {}
    apply()
    for (const fn of subscribers) { try { fn(lang) } catch (_) {} }
  }

  function toggle() { set(lang === 'en' ? 'es' : 'en') }

  function t(key, params) {
    const table = T[lang] || T.en
    let s = table[key]
    if (s == null) s = T.en[key]
    if (s == null) s = key
    if (params) {
      for (const k in params) {
        s = s.split('{' + k + '}').join(params[k])
      }
    }
    return s
  }

  function apply() {
    document.documentElement.lang = lang
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n)
    })
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria))
    })
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml)
    })
  }

  function onChange(fn) { subscribers.push(fn) }

  // Apply once DOM is ready (script is in <body>; markup may already be parsed).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply)
  } else {
    apply()
  }

  return { get, set, toggle, t, apply, onChange }
})()
