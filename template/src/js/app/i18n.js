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
  const STORAGE_KEY = 'template.lang'

  const localeNames = {
    en: 'English',
    es: 'Español',
  }

  const dictionaries = {
    en: {
      // <head>
      'doc.title': 'syngen-template',

      // Menu
      'menu.aria': 'Main menu',
      'menu.title': 'syngen-template',
      'menu.start': 'Start',

      // Language picker
      'language.aria': 'Choose language',
      'language.title': 'Language',
      'language.subtitle': 'Choose the language used for menus and announcements.',
      'language.back': 'Back',
      'language.button': 'Language',

      // Generic UI
      'game.aria': 'Game',
    },

    es: {
      // <head>
      'doc.title': 'syngen-template',

      // Menu
      'menu.aria': 'Menú principal',
      'menu.title': 'syngen-template',
      'menu.start': 'Empezar',

      // Language picker
      'language.aria': 'Elegir idioma',
      'language.title': 'Idioma',
      'language.subtitle': 'Elige el idioma para los menús y los anuncios.',
      'language.back': 'Atrás',
      'language.button': 'Idioma',

      // Generic UI
      'game.aria': 'Juego',
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
