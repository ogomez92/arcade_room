const {contextBridge, ipcRenderer} = require('electron')

contextBridge.exposeInMainWorld('ElectronApi', {
  quit: () => ipcRenderer.send('quit'),
  exit: () => ipcRenderer.send('exit'),
  listGames: () => ipcRenderer.sendSync('games:list'),
  readHighScores: () => ipcRenderer.sendSync('highscores:read'),
  writeHighScores: (data) => ipcRenderer.send('highscores:write', data),
})
