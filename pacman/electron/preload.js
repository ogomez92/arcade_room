const {contextBridge, ipcRenderer} = require('electron')

contextBridge.exposeInMainWorld('ElectronApi', {
  quit: () => ipcRenderer.send('quit'),
  readHighScores: () => ipcRenderer.sendSync('highscores:read'),
  writeHighScores: (data) => ipcRenderer.send('highscores:write', data),
})
