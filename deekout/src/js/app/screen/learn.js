// Learn game sounds. Lists every cue as a focusable button; activating one
// plays it a few cells north of the listener (fixed, facing north) so the
// player can build the cue vocabulary before playing.
app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0, listEl: null},
  onReady: function () {
    const root = this.rootElement
    this.state.listEl = root.querySelector('.a-learn--list')
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-sound]')
      if (btn) { playLearnSound(btn.dataset.sound); return }
      const act = e.target.closest('button[data-action]')
      if (act) app.screenManager.dispatch(act.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.setStaticListener()
    this.renderList()
    app.utility.focus.setWithin(this.rootElement)
  },
  renderList: function () {
    const ul = this.state.listEl
    if (!ul) return
    ul.innerHTML = ''
    for (const item of LEARN_SOUNDS) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.sound = item.id
      btn.textContent = app.i18n.t(item.key)
      li.appendChild(btn)
      ul.appendChild(li)
    }
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
    // keep the listener pinned in case we returned from a screen that moved it
    content.audio.setStaticListener()
    const ui = app.controls.ui()
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
    if (ui.back) app.screenManager.dispatch('back')
  },
})

const LEARN_SOUNDS = [
  {id: 'coin', key: 'learn.coin'},
  {id: 'coinSpecial', key: 'learn.coinSpecial'},
  {id: 'botRobot', key: 'learn.botRobot'},
  {id: 'botRocket', key: 'learn.botRocket'},
  {id: 'good', key: 'learn.good'},
  {id: 'dispatch', key: 'learn.dispatch'},
  {id: 'nasty', key: 'learn.nasty'},
  {id: 'wall', key: 'learn.wall'},
  {id: 'wallHit', key: 'learn.wallHit'},
  {id: 'warp', key: 'learn.warp'},
  {id: 'bombTick', key: 'learn.bombTick'},
  {id: 'bombExplode', key: 'learn.bombExplode'},
  {id: 'hazard', key: 'learn.hazard'},
  {id: 'oil', key: 'learn.oil'},
  {id: 'experiment', key: 'learn.experiment'},
  {id: 'robot', key: 'learn.death.robot'},
  {id: 'rocket', key: 'learn.death.rocket'},
  {id: 'bullet', key: 'learn.death.bullet'},
  {id: 'laugh', key: 'learn.laugh'},
]

function playLearnSound(id) {
  const g = content.constants.GRID
  const front = {col: (g.cols - 1) / 2, row: (g.rows - 1) / 2 - 5}
  switch (id) {
    case 'coin': content.audio.coinDing(front, 820); break
    case 'coinSpecial': content.audio.coinSpecial(front); break
    case 'botRobot': content.enemies.preview(content.constants.ENEMY.ROBOT, front); break
    case 'botRocket': content.enemies.preview(content.constants.ENEMY.ROCKET, front); break
    case 'good': content.audio.pickupGood(front); break
    case 'dispatch': content.audio.itemDispatch(); break
    case 'nasty': content.items.previewNasty(front); break
    case 'wall': content.audio.wallTone(2); break
    case 'wallHit': content.audio.wallHit(true); break
    case 'warp': content.audio.warp(); break
    case 'bombTick': content.audio.bombTick(front); break
    case 'bombExplode': content.audio.bombExplode(front); break
    case 'hazard': content.audio.hazardHiss(front); break
    case 'oil': content.audio.oilDrop(front); break
    case 'experiment': content.audio.experimentTone(1, front); break
    case 'robot': content.audio.deathSound('robot', front); break
    case 'rocket': content.audio.deathSound('rocket', front); break
    case 'bullet': content.audio.deathSound('bullet', front); break
    case 'laugh': content.audio.robotLaugh(); break
  }
}
