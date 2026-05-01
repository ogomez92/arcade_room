/**
 * Lightweight i18n for accessible audio games.
 *
 * Resolution order on boot: localStorage(STORAGE_KEY) → navigator.language
 * 2-letter prefix → fallback ('en').
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
  const STORAGE_KEY = 'fire.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      'doc.title': 'FIRE! — audio arcade',

      'splash.author': 'an audio-only arcade by Oriol Gómez',
      'splash.instruction': 'Press Enter to begin',

      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      'game.aria': 'FIRE! game in progress',
      'game.live': 'Game announcements',
      'game.urgent': 'Urgent announcements',

      'gameover.aria': 'Game over',
      'gameover.title': 'Game over',
      'gameover.scoreLine': 'Final score: {score} — Level {level}',
      'gameover.highScoreNew': 'New high score!',
      'gameover.highScoreLine': 'High score: {score}',
      'gameover.retry': 'Play again',
      'gameover.menu': 'Main menu',

      // Help / instructions appended to splash
      'splash.helpTitle': 'How to play',
      'splash.helpAim': '<kbd>←</kbd> / <kbd>→</kbd> aim the hose left and right.',
      'splash.helpSpray': '<kbd>Space</kbd> sprays water. Hold to keep spraying.',
      'splash.helpStatus': '<kbd>F1</kbd> score · <kbd>F2</kbd> nearest fire · <kbd>F3</kbd> threat level · <kbd>F4</kbd> level',
      'splash.helpAudio': 'All information is audio. Use headphones for accurate left/right cues.',

      // Announcements
      'ann.start': 'Level {level}. Begin!',
      'ann.levelClear': 'Level {level} clear. Bonus {bonus}.',
      'ann.score': 'Score {score}. Level {level}.',
      'ann.fireLeft': 'Fire to your left, distance {dist}.',
      'ann.fireRight': 'Fire to your right, distance {dist}.',
      'ann.fireFront': 'Fire ahead.',
      'ann.fireFar': 'Fire far {side}.',
      'ann.threatLow': 'Threat low.',
      'ann.threatMid': 'Threat rising.',
      'ann.threatHigh': 'Critical! Buildings collapsing.',
      'ann.extinguish': '+{points}',
      'ann.extinguishCombo': '+{points}, combo x{mult}',
      'ann.spread': 'Fire spreading!',
      'ann.lost': 'Building lost! {remaining} left.',
      'ann.gameOver': 'Game over. Final score {score}.',
      'ann.noFires': 'No active fires.',
      'ann.allClear': 'All clear.',
      'ann.aim': 'Aim {direction}.',
      'ann.aimCenter': 'Aim centered.',
      'ann.dirLeft': 'left',
      'ann.dirRight': 'right',
      'ann.dirCenter': 'center',
    },

    es: {
      'doc.title': '¡FUEGO! — arcade sonoro',

      'splash.author': 'arcade sonoro por Oriol Gómez',
      'splash.instruction': 'Pulsa Intro para empezar',

      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      'game.aria': 'Partida de ¡FUEGO! en curso',
      'game.live': 'Anuncios de la partida',
      'game.urgent': 'Anuncios urgentes',

      'gameover.aria': 'Fin de la partida',
      'gameover.title': 'Fin de la partida',
      'gameover.scoreLine': 'Puntuación final: {score} — Nivel {level}',
      'gameover.highScoreNew': '¡Nuevo récord!',
      'gameover.highScoreLine': 'Récord: {score}',
      'gameover.retry': 'Volver a jugar',
      'gameover.menu': 'Menú principal',

      'splash.helpTitle': 'Cómo se juega',
      'splash.helpAim': '<kbd>←</kbd> / <kbd>→</kbd> apuntan la manguera a izquierda y derecha.',
      'splash.helpSpray': '<kbd>Espacio</kbd> lanza agua. Mantén pulsado para seguir.',
      'splash.helpStatus': '<kbd>F1</kbd> puntuación · <kbd>F2</kbd> incendio más cercano · <kbd>F3</kbd> amenaza · <kbd>F4</kbd> nivel',
      'splash.helpAudio': 'Toda la información es sonora. Usa auriculares para localizar bien izquierda y derecha.',

      'ann.start': 'Nivel {level}. ¡Comienza!',
      'ann.levelClear': 'Nivel {level} superado. Bonus {bonus}.',
      'ann.score': 'Puntuación {score}. Nivel {level}.',
      'ann.fireLeft': 'Fuego a la izquierda, distancia {dist}.',
      'ann.fireRight': 'Fuego a la derecha, distancia {dist}.',
      'ann.fireFront': 'Fuego al frente.',
      'ann.fireFar': 'Fuego lejano a la {side}.',
      'ann.threatLow': 'Amenaza baja.',
      'ann.threatMid': 'Amenaza creciente.',
      'ann.threatHigh': '¡Crítico! Edificios derrumbándose.',
      'ann.extinguish': '+{points}',
      'ann.extinguishCombo': '+{points}, combo x{mult}',
      'ann.spread': '¡El fuego se propaga!',
      'ann.lost': '¡Edificio perdido! Quedan {remaining}.',
      'ann.gameOver': 'Fin de la partida. Puntuación final {score}.',
      'ann.noFires': 'No hay incendios activos.',
      'ann.allClear': 'Todo despejado.',
      'ann.aim': 'Apuntando a la {direction}.',
      'ann.aimCenter': 'Apuntando al frente.',
      'ann.dirLeft': 'izquierda',
      'ann.dirRight': 'derecha',
      'ann.dirCenter': 'centro',
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
