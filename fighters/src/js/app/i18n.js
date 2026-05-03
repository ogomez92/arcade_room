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
  const STORAGE_KEY = 'brawl.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'BRAWL!',

      'splash.logo': 'BRAWL!',
      'splash.author': 'audio melee',
      'splash.instruction': 'Press any key to begin',

      'menu.aria': 'Main Menu',
      'menu.title': 'BRAWL!',
      'menu.subtitle': 'Audio melee. Top-down arena, fists and feet, gendered voices, no weapons.',
      'menu.fight': 'Begin Fight',
      'menu.howto': 'How to Play',
      'menu.language': 'Language',
      'menu.hint': 'Headphones strongly recommended.',

      'select.aria': 'Choose your fighter',
      'select.title': 'Choose your fighter',
      'select.subtitle': 'Each fighter has a distinct voice and a default style.',
      'select.fight': 'Fight!',
      'select.back': 'Back',
      'select.female': 'female',
      'select.male': 'male',
      'select.style.boxer': 'boxer',
      'select.style.kicker': 'kicker',
      'select.style.mixer': 'all-rounder',
      'select.desc': 'Voice: {gender}. Style: {style}.',

      'char.roxy':  'Roxy',
      'char.lola':  'Lola',
      'char.mira':  'Mira',
      'char.bruno': 'Bruno',
      'char.kenji': 'Kenji',
      'char.rocco': 'Rocco',

      'howto.aria': 'How to play',
      'howto.title': 'How to Play',
      'howto.movementTitle': 'Movement',
      'howto.move': 'W A S D — walk around the arena (top-down, you do not need to face anyone).',
      'howto.attackTitle': 'Attacks',
      'howto.highPunch': 'T — high punch. Fast jab to the face. Light damage.',
      'howto.lowPunch':  'G — low punch. Body shot. Slightly heavier.',
      'howto.highKick':  'U — high kick. Slow, big damage, can knock down.',
      'howto.lowKick':   'J — low sweep kick. Knocks the opponent down often.',
      'howto.knockdownTitle': 'Knockdowns',
      'howto.knockdownIntro': 'When the opponent is on the ground:',
      'howto.knockdown1': 'High attacks miss completely — you cannot punch the air.',
      'howto.knockdown2': 'Low attacks (G and J) deal a heavy stomp bonus.',
      'howto.knockdown3': 'They get up after about a second and a half, briefly invulnerable.',
      'howto.combosTitle': 'Combos',
      'howto.combosIntro': 'Land hits in sequence within roughly two seconds. Some openers:',
      'howto.combo1': 'T T G — One-Two-Body.',
      'howto.combo2': 'T G U — Combination.',
      'howto.combo3': 'Q Q L — Liver Crusher (knocks down).',
      'howto.combo4': 'P Q K L — Hurricane (4-hit finisher).',
      'howto.statusTitle': 'Status keys',
      'howto.f1': 'F1 — your health.',
      'howto.f2': 'F2 — opponent health.',
      'howto.f3': 'F3 — distance and direction to opponent.',
      'howto.f4': 'F4 — current combo chain.',
      'howto.f5': 'F5 — your posture and the opponent’s.',
      'howto.f0': '0 — debug heal (sets your HP to 10000).',
      'howto.defenseTitle': 'Defense and mobility',
      'howto.block': 'Period (.) — raise your guard. Hits land but deal little damage and never knock down. Short cooldown.',
      'howto.duck': 'L — duck. High punches and high kicks miss. Low attacks still hit.',
      'howto.jump': 'O — jump. Low attacks miss while you are airborne. Land next to a downed opponent to mount them.',
      'howto.mountTitle': 'Mounting and walking on a downed opponent',
      'howto.mount1': 'After a knockdown, jump (O) while next to the opponent to land on top of them.',
      'howto.mount2': 'Once mounted, your movement keys step on body parts: W head, S shins, A and D ribs, diagonals shoulders/hips. Standing still steps on the chest.',
      'howto.mount3': 'Press jump (O) again while mounted for a heavier slam onto the stomach.',
      'howto.mount4': 'You cannot punch or kick while mounted. The mount ends when the opponent gets up.',
      'howto.struggleTitle': 'When you are knocked down',
      'howto.struggle1': 'You will not get up automatically while someone is on top of you.',
      'howto.struggle2': 'Tap and hold movement keys to struggle and throw the opponent off — wiggling between directions builds energy faster.',
      'howto.back': 'Back',

      'game.aria': 'Fight',
      'hud.you': 'You',
      'hud.foe': 'Foe',
      'hud.round': 'Round',
      'hud.combo': 'Combo',

      'gameover.aria': 'Match result',
      'gameover.win': 'Victory',
      'gameover.lose': 'Knocked Out',
      'gameover.summary': 'You reached round {round}.',
      'gameover.rematch': 'Rematch',
      'gameover.menu': 'Main Menu',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Announcer
      'ann.you': 'You',
      'ann.foe': 'Opponent',
      'ann.roundStart': 'Round {round}. {name}. Fight!',
      'ann.health': '{name} health: {hp}.',
      'ann.distance': 'Opponent: {dist}, to the {dir}. Round {round}.',
      'ann.posture': 'You: {you}. Opponent: {foe}.',
      'ann.posture.stand': 'standing',
      'ann.posture.down':  'down',
      'ann.posture.getup': 'getting up',
      'ann.comboChain': 'Chain: {chain}.',
      'ann.comboNone': 'No combo yet.',
      'ann.youHit': '{atk} landed. {dmg} damage.',
      'ann.youHitCrit': 'Critical {atk}! {dmg} damage.',
      'ann.youStomp': 'Ground stomp with {atk}. {dmg} damage.',
      'ann.youBlocked': '{atk} blocked. Only {dmg} through.',
      'ann.foeHit': 'Hit by {atk}. {dmg} taken.',
      'ann.foeStomp': 'Stomped on the ground. {dmg} taken.',
      'ann.foeBlocked': 'You blocked {atk}. {dmg} through.',
      'ann.youDodge': 'You dodged.',
      'ann.youDodge.duck': 'You ducked under the strike.',
      'ann.youDodge.jump': 'You jumped over the sweep.',
      'ann.youDodge.down': 'You are flat on the ground.',
      'ann.foeDodge': 'They dodged.',
      'ann.foeDodge.duck': 'They ducked under it.',
      'ann.foeDodge.jump': 'They jumped over the sweep.',
      'ann.foeDodge.down': 'They are too low to hit.',
      'ann.foeWindup': 'Incoming {atk}.',
      'ann.combo': 'Combo! {name}!',
      'ann.youKnockdown': 'Opponent down!',
      'ann.foeKnockdown': 'You are down!',
      'ann.lowHp': 'Warning: low health.',
      'ann.foeLowHp': 'Opponent is staggering.',
      'ann.youMount': 'You landed on top of them. Walk to stomp body parts.',
      'ann.foeMount': 'They are on top of you! Mash movement keys to throw them off.',
      'ann.youWalkOn': 'You stomp the {part}. {dmg} damage.',
      'ann.foeWalkOn': 'They stomp your {part}. {dmg} damage.',
      'ann.youThrowOff': 'You buck them off!',
      'ann.foeThrowOff': 'They threw you off!',
      'ann.taunt': '{who}: {line}',
      'ann.debugHeal': 'Debug: health set to {hp}.',
      // Round-end strings now include a {taunt} slot.
      'ann.roundWin': 'You knocked out {name}. Round {round} cleared. {taunt}',
      'ann.roundLose': 'You are knocked out. Round {round} reached. {taunt}',
      // In-fight taunt phrase pool (English originals — do not translate
      // these; the Spanish dictionary has its own pool).
      'taunt.1': 'Get up.',
      'taunt.2': 'Is that all you have?',
      'taunt.3': 'Stay down.',
      'taunt.4': 'Come on.',
      'taunt.victory.1': 'Easy work.',
      'taunt.victory.2': 'Champion!',
      'taunt.victory.3': 'Next.',
      // Body parts (English).
      'bodypart.head':      'head',
      'bodypart.shoulderR': 'right shoulder',
      'bodypart.shoulderL': 'left shoulder',
      'bodypart.ribsR':     'right ribs',
      'bodypart.ribsL':     'left ribs',
      'bodypart.hipR':      'right hip',
      'bodypart.shinR':     'right shin',
      'bodypart.shinL':     'left shin',
      'bodypart.chest':     'chest',
      'bodypart.stomach':   'stomach',
      'bodypart.groin':     'groin',
      // Action labels for the posture readout.
      'ann.posture.block':  'guarding',
      'ann.posture.duck':   'ducking',
      'ann.posture.jump':   'airborne',
      'ann.posture.mounted': 'on top of opponent',
      'ann.posture.pinned': 'pinned on the ground',
      'ann.dist.close': 'close',
      'ann.dist.mid': 'medium range',
      'ann.dist.far': 'far',
      'ann.dir.east': 'east',
      'ann.dir.northeast': 'northeast',
      'ann.dir.north': 'north',
      'ann.dir.northwest': 'northwest',
      'ann.dir.west': 'west',
      'ann.dir.southwest': 'southwest',
      'ann.dir.south': 'south',
      'ann.dir.southeast': 'southeast',

      // Attack labels (locale-stable keys are stored in code).
      'atk.highPunch': 'high punch',
      'atk.lowPunch':  'low punch',
      'atk.highKick':  'high kick',
      'atk.lowKick':   'low sweep',

      // Combo names
      'combo.oneTwoBody':   'One-Two-Body',
      'combo.oneTwoKick':   'One-Two Kick',
      'combo.combination':  'Combination',
      'combo.liverCrusher': 'Liver Crusher',
      'combo.tornado':      'Tornado',
      'combo.bodyBuilder':  'Body Builder',
      'combo.sweeper':      'Sweeper',
      'combo.bodyCrusher':  'Body Crusher',
      'combo.legday':       'Leg Day',
      'combo.boxingMaster': 'Boxing Master',
      'combo.bruiser':      'Bruiser',
      'combo.hurricane':    'Hurricane',
    },

    es: {
      'doc.title': 'BRAWL!',

      'splash.logo': 'BRAWL!',
      'splash.author': 'pelea sonora',
      'splash.instruction': 'Pulsa cualquier tecla para empezar',

      'menu.aria': 'Menú principal',
      'menu.title': 'BRAWL!',
      'menu.subtitle': 'Pelea sonora. Arena cenital, puños y patadas, voces masculinas y femeninas, sin armas.',
      'menu.fight': 'Empezar combate',
      'menu.howto': 'Cómo jugar',
      'menu.language': 'Idioma',
      'menu.hint': 'Se recomiendan auriculares.',

      'select.aria': 'Elige luchador',
      'select.title': 'Elige luchador',
      'select.subtitle': 'Cada luchador tiene voz propia y un estilo de partida.',
      'select.fight': '¡A pelear!',
      'select.back': 'Atrás',
      'select.female': 'femenina',
      'select.male': 'masculina',
      'select.style.boxer': 'boxeador',
      'select.style.kicker': 'pateador',
      'select.style.mixer': 'mixto',
      'select.desc': 'Voz: {gender}. Estilo: {style}.',

      'char.roxy':  'Roxy',
      'char.lola':  'Lola',
      'char.mira':  'Mira',
      'char.bruno': 'Bruno',
      'char.kenji': 'Kenji',
      'char.rocco': 'Rocco',

      'howto.aria': 'Cómo jugar',
      'howto.title': 'Cómo jugar',
      'howto.movementTitle': 'Movimiento',
      'howto.move': 'W A S D: caminas por la arena. Vista cenital: no hace falta encarar al rival.',
      'howto.attackTitle': 'Ataques',
      'howto.highPunch': 'T: puñetazo alto. Jab rápido a la cara. Daño bajo.',
      'howto.lowPunch':  'G: puñetazo bajo. Al cuerpo. Algo más fuerte.',
      'howto.highKick':  'U: patada alta. Lenta, mucho daño, puede derribar.',
      'howto.lowKick':   'J: barrido bajo. Tira al suelo a menudo.',
      'howto.knockdownTitle': 'Derribos',
      'howto.knockdownIntro': 'Cuando el rival está en el suelo:',
      'howto.knockdown1': 'Los ataques altos fallan: no puedes pegar al aire.',
      'howto.knockdown2': 'Los ataques bajos (G y J) hacen pisotón con bonificación.',
      'howto.knockdown3': 'Se levanta tras un segundo y medio, brevemente invulnerable.',
      'howto.combosTitle': 'Combos',
      'howto.combosIntro': 'Conecta golpes en secuencia en menos de dos segundos. Para empezar:',
      'howto.combo1': 'T T G: uno-dos al cuerpo.',
      'howto.combo2': 'T G U: combinación.',
      'howto.combo3': 'G G J: triturador de hígado (derriba).',
      'howto.combo4': 'T G U J: huracán (finalizador de 4 golpes).',
      'howto.statusTitle': 'Teclas de estado',
      'howto.f1': 'F1: tu vida.',
      'howto.f2': 'F2: vida del rival.',
      'howto.f3': 'F3: distancia y dirección al rival.',
      'howto.f4': 'F4: cadena de combo actual.',
      'howto.f5': 'F5: tu postura y la del rival.',
      'howto.f0': '0: cura de prueba (te pone la vida a 10000).',
      'howto.defenseTitle': 'Defensa y movilidad',
      'howto.block': 'Punto (.): subes la guardia. Los golpes entran pero hacen poco daño y no derriban. Espera breve antes de volver a usarlo.',
      'howto.duck': 'L: te agachas. Los puñetazos altos y las patadas altas fallan. Los ataques bajos siguen entrando.',
      'howto.jump': 'O: saltas. Los ataques bajos fallan mientras estás en el aire. Si caes junto a un rival derribado, te subes encima.',
      'howto.mountTitle': 'Montar y caminar sobre un rival derribado',
      'howto.mount1': 'Tras un derribo, salta (O) junto al rival para caer encima.',
      'howto.mount2': 'Una vez encima, las teclas de movimiento pisan partes del cuerpo: W cabeza, S espinillas, A y D costillas, las diagonales hombros y caderas. Sin moverte, pisas el pecho.',
      'howto.mount3': 'Vuelve a pulsar saltar (O) estando encima para un pisotón fuerte sobre el estómago.',
      'howto.mount4': 'No puedes pegar mientras montas. La monta termina cuando el rival se levanta.',
      'howto.struggleTitle': 'Cuando te derriban a ti',
      'howto.struggle1': 'Si tienes a alguien encima, no te levantarás solo.',
      'howto.struggle2': 'Pulsa las teclas de movimiento para forcejear y tirarlo. Alternar direcciones acumula energía más rápido.',
      'howto.back': 'Atrás',

      'game.aria': 'Combate',
      'hud.you': 'Tú',
      'hud.foe': 'Rival',
      'hud.round': 'Asalto',
      'hud.combo': 'Combo',

      'gameover.aria': 'Resultado del combate',
      'gameover.win': 'Victoria',
      'gameover.lose': 'Derrota',
      'gameover.summary': 'Llegaste al asalto {round}.',
      'gameover.rematch': 'Revancha',
      'gameover.menu': 'Menú principal',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'ann.you': 'Tú',
      'ann.foe': 'Rival',
      'ann.roundStart': 'Asalto {round}. {name}. ¡A pelear!',
      'ann.roundWin': 'Has noqueado a {name}. Asalto {round} superado.',
      'ann.roundLose': 'Has sido noqueado. Asalto {round} alcanzado.',
      'ann.health': 'Vida {name}: {hp}.',
      'ann.distance': 'Rival: {dist}, al {dir}. Asalto {round}.',
      'ann.posture': 'Tú: {you}. Rival: {foe}.',
      'ann.posture.stand': 'de pie',
      'ann.posture.down':  'derribado',
      'ann.posture.getup': 'levantándose',
      'ann.comboChain': 'Cadena: {chain}.',
      'ann.comboNone': 'Sin combo todavía.',
      'ann.youHit': '{atk} conectado. {dmg} de daño.',
      'ann.youHitCrit': '¡{atk} crítico! {dmg} de daño.',
      'ann.youStomp': 'Pisotón con {atk}. {dmg} de daño.',
      'ann.youBlocked': '{atk} bloqueado. Solo {dmg} de daño.',
      'ann.foeHit': '{atk} recibido. {dmg} de daño.',
      'ann.foeStomp': 'Te pisotean en el suelo. {dmg} de daño.',
      'ann.foeBlocked': 'Bloqueas {atk}. {dmg} de daño.',
      'ann.youDodge': 'Esquivado.',
      'ann.youDodge.duck': 'Te agachas y pasa por encima.',
      'ann.youDodge.jump': 'Saltas por encima del barrido.',
      'ann.youDodge.down': 'Estás pegado al suelo.',
      'ann.foeDodge': 'Te esquivó.',
      'ann.foeDodge.duck': 'Se agachó.',
      'ann.foeDodge.jump': 'Saltó por encima del barrido.',
      'ann.foeDodge.down': 'Está demasiado bajo.',
      'ann.foeWindup': '{atk} entrante.',
      'ann.combo': '¡Combo! ¡{name}!',
      'ann.youKnockdown': '¡Rival en el suelo!',
      'ann.foeKnockdown': '¡Estás en el suelo!',
      'ann.lowHp': 'Aviso: vida baja.',
      'ann.foeLowHp': 'El rival se tambalea.',
      'ann.youMount': 'Caes encima del rival. Camina para pisar partes del cuerpo.',
      'ann.foeMount': 'El rival se te ha subido encima. Pulsa las teclas de movimiento para tirarlo.',
      'ann.youWalkOn': 'Pisas {part}. {dmg} de daño.',
      'ann.foeWalkOn': 'Te pisa {part}. {dmg} de daño.',
      'ann.youThrowOff': '¡Te lo quitas de encima!',
      'ann.foeThrowOff': '¡Te ha tirado!',
      'ann.taunt': '{who}: {line}',
      'ann.debugHeal': 'Modo prueba: vida puesta a {hp}.',
      'ann.roundWin': 'Has noqueado a {name}. Asalto {round} superado. {taunt}',
      'ann.roundLose': 'Has sido noqueado. Asalto {round} alcanzado. {taunt}',
      // Pool de bravatas en castellano (independiente del inglés).
      'taunt.1': '¡Levanta!',
      'taunt.2': '¿Eso es todo?',
      'taunt.3': 'No te levantes.',
      'taunt.4': '¡Vamos!',
      'taunt.victory.1': 'Tirado.',
      'taunt.victory.2': '¡Soy el campeón!',
      'taunt.victory.3': 'Siguiente.',
      'bodypart.head':      'la cabeza',
      'bodypart.shoulderR': 'el hombro derecho',
      'bodypart.shoulderL': 'el hombro izquierdo',
      'bodypart.ribsR':     'las costillas derechas',
      'bodypart.ribsL':     'las costillas izquierdas',
      'bodypart.hipR':      'la cadera derecha',
      'bodypart.shinR':     'la espinilla derecha',
      'bodypart.shinL':     'la espinilla izquierda',
      'bodypart.chest':     'el pecho',
      'bodypart.stomach':   'el estómago',
      'bodypart.groin':     'la entrepierna',
      'ann.posture.block':  'a la guardia',
      'ann.posture.duck':   'agachado',
      'ann.posture.jump':   'en el aire',
      'ann.posture.mounted': 'encima del rival',
      'ann.posture.pinned': 'inmovilizado en el suelo',
      'ann.dist.close': 'cerca',
      'ann.dist.mid': 'media distancia',
      'ann.dist.far': 'lejos',
      'ann.dir.east': 'este',
      'ann.dir.northeast': 'noreste',
      'ann.dir.north': 'norte',
      'ann.dir.northwest': 'noroeste',
      'ann.dir.west': 'oeste',
      'ann.dir.southwest': 'suroeste',
      'ann.dir.south': 'sur',
      'ann.dir.southeast': 'sureste',

      'atk.highPunch': 'puñetazo alto',
      'atk.lowPunch':  'puñetazo al cuerpo',
      'atk.highKick':  'patada alta',
      'atk.lowKick':   'barrido',

      'combo.oneTwoBody':   'Uno-dos al cuerpo',
      'combo.oneTwoKick':   'Uno-dos con patada',
      'combo.combination':  'Combinación',
      'combo.liverCrusher': 'Triturador de hígado',
      'combo.tornado':      'Tornado',
      'combo.bodyBuilder':  'Trabajo de cuerpo',
      'combo.sweeper':      'Barredor',
      'combo.bodyCrusher':  'Demoledor de cuerpo',
      'combo.legday':       'Día de pierna',
      'combo.boxingMaster': 'Maestro del boxeo',
      'combo.bruiser':      'Matón',
      'combo.hurricane':    'Huracán',
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
