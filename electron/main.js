const {app, BrowserWindow, ipcMain} = require('electron')

const fs = require('fs'),
  os = require('os'),
  path = require('path'),
  pkg = require('../package.json')

const LAUNCHER_FILE = path.join(__dirname, 'launcher.html')

let mainWindow

// Improve support for WebGL and Steam overlays
if (os.platform() == 'win32') {
  app.commandLine.appendSwitch('disable-direct-composition')
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('disable-software-rasterizer')
  app.commandLine.appendSwitch('in-process-gpu')
} else {
  app.commandLine.appendSwitch('ignore-gpu-blacklist')
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder')
}

app.on('ready', () => {
  app.accessibilitySupportEnabled = true
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
})

function createWindow() {
  const iconPng = path.join(__dirname, 'icon', 'icon.png')

  mainWindow = new BrowserWindow({
    frame: false,
    fullscreen: true,
    icon: fs.existsSync(iconPng) ? iconPng : undefined,
    title: pkg.productName || pkg.name,
    webPreferences: {
      contextIsolation: true,
      devTools: false,
      preload: path.join(__dirname, 'preload.js'),
    }
  })

  mainWindow.removeMenu()

  mainWindow.webContents.session.setPermissionRequestHandler((_w, permission, callback) => {
    switch (permission) {
      case 'midi':
      case 'pointerLock':
        return callback(true)
    }
    callback(false)
  })

  mainWindow.on('closed', () => { mainWindow = null })

  mainWindow.loadFile(LAUNCHER_FILE)
}

function onLauncher() {
  if (!mainWindow) return false
  const url = mainWindow.webContents.getURL()
  return url.endsWith('/launcher.html') || url.endsWith('\\launcher.html')
}

ipcMain.on('quit', () => {
  // From the launcher: actually exit. From a game: return to the launcher.
  if (!mainWindow) return app.quit()
  if (onLauncher()) {
    app.quit()
  } else {
    mainWindow.loadFile(LAUNCHER_FILE)
  }
})

ipcMain.on('exit', () => app.quit())

// Per-game high-scores file. The calling game is inferred from the
// renderer URL, so each game keeps a separate file even though the
// app is bundled.
function gameSlugFromSender(e) {
  try {
    const u = new URL(e.sender.getURL())
    if (u.protocol !== 'file:') return 'default'
    const parts = u.pathname.split('/').filter(Boolean)
    const i = parts.lastIndexOf('public')
    if (i > 0) return parts[i - 1]
  } catch (_err) { /* fall through */ }
  return 'default'
}

function highscoresPath(slug) {
  return path.join(app.getPath('userData'), `highscores-${slug}.json`)
}

ipcMain.on('highscores:read', (e) => {
  try {
    const raw = fs.readFileSync(highscoresPath(gameSlugFromSender(e)), 'utf8')
    e.returnValue = JSON.parse(raw)
  } catch (_err) {
    e.returnValue = []
  }
})

ipcMain.on('games:list', (e) => {
  try {
    const root = path.join(__dirname, '..')
    const skip = new Set(['electron', 'template', 'node_modules'])
    const items = fs.readdirSync(root, {withFileTypes: true})
      .filter(d => d.isDirectory() && !skip.has(d.name) && !d.name.startsWith('.'))
      .filter(d => fs.existsSync(path.join(root, d.name, 'public', 'index.html')))
      .map(d => d.name)
      .sort()
    e.returnValue = items
  } catch (_err) {
    e.returnValue = []
  }
})

ipcMain.on('highscores:write', (e, data) => {
  try {
    fs.writeFileSync(highscoresPath(gameSlugFromSender(e)), JSON.stringify(data, null, 2), 'utf8')
  } catch (_err) {
    // ignore
  }
})
