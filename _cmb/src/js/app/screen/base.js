app.screen.base = {
  // Attributes
  id: undefined,
  parentSelector: undefined,
  rootSelector: undefined,
  transitions: {},
  // State
  state: {},
  // Hooks
  onReady: function () {},
  onEnter: function () {},
  onExit: function () {},
  onFrame: function () {},
  onImport: function () {},
  onReset: function () {},
  // Lifecycle methods
  enter: function (...args) {
    // Cancel any pending exit from a previous cycle
    if (this._exitTimeout) {
      clearTimeout(this._exitTimeout)
      this._exitTimeout = null
    }
    if (this._exitFinish) {
      this.parentElement.removeEventListener('transitionend', this._exitFinish)
      this._exitFinish = null
    }

    this.parentElement.removeAttribute('aria-hidden')
    this.parentElement.removeAttribute('hidden')

    window.requestAnimationFrame(() => {
      this.parentElement.onanimationend = undefined
      this.parentElement.classList.add('a-app--screen-active')
      this.parentElement.classList.remove('a-app--screen-inactive')
    })

    this.onEnter(...args)
    this.focusWithin()

    return this
  },
  exit: function (...args) {
    this.parentElement.setAttribute('aria-hidden', 'true')

    const finish = () => {
      this.parentElement.classList.remove('a-app--screen-inactive')
      this.parentElement.hidden = true
      this.parentElement.removeEventListener('transitionend', finish)
      if (this._exitTimeout) clearTimeout(this._exitTimeout)
      this._exitTimeout = null
      this._exitFinish = null
    }
    this._exitFinish = finish

    window.requestAnimationFrame(() => {
      this.parentElement.classList.remove('a-app--screen-active')
      this.parentElement.classList.add('a-app--screen-inactive')
      this.parentElement.addEventListener('transitionend', finish, { once: true })
      // Fallback in case transitionend doesn't fire
      this._exitTimeout = setTimeout(finish, 700)
    })

    this.onExit(...args)

    return this
  },
  import: function (...args) {
    this.onImport(...args)

    return this
  },
  ready: function (...args) {
    this.parentElement = document.querySelector(this.parentSelector)
    this.parentElement.setAttribute('aria-hidden', 'true')
    this.parentElement.hidden = true

    this.rootElement = document.querySelector(this.rootSelector)
    app.utility.focus.trap(this.rootElement)

    this.onReady(...args)

    return this
  },
  reset: function () {
    this.onReset()

    return this
  },
  // Custom methods
  focusWithin: function () {
    if (this.rootElement.getAttribute('tabindex') == -1) {
      app.utility.focus.set(this.rootElement)
    } else {
      app.utility.focus.setWithin(this.rootElement)
    }

    return this
  },
}
