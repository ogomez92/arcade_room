content.teamManager = (() => {
  let team1 = []   // [{id, name, isLocal}]
  let team2 = []
  let active1 = 0  // index into team1 of current active player
  let active2 = 0
  let localTeam = null  // 1 | 2 | null
  let localId = null
  let multiplayerActive = false

  return {
    setup: (team1Players, team2Players, localPlayerId) => {
      team1 = team1Players.slice()
      team2 = team2Players.slice()
      active1 = 0
      active2 = 0
      localId = localPlayerId
      localTeam = team1.some(p => p.id === localPlayerId) ? 1
                : team2.some(p => p.id === localPlayerId) ? 2
                : null
      multiplayerActive = true
    },

    rotateTeam: (teamNum) => {
      if (teamNum === 1) {
        const outPlayer = team1[active1]
        active1 = (active1 + 1) % team1.length
        const inPlayer = team1[active1]
        return { outPlayer, inPlayer }
      } else {
        const outPlayer = team2[active2]
        active2 = (active2 + 1) % team2.length
        const inPlayer = team2[active2]
        return { outPlayer, inPlayer }
      }
    },

    getListenerX: () => {
      if (!multiplayerActive) return content.player.getX()
      const isActive1 = localTeam === 1 && team1[active1] && team1[active1].id === localId
      const isActive2 = localTeam === 2 && team2[active2] && team2[active2].id === localId
      if (isActive1) return content.player.getX()
      if (isActive2) return content.ai.getX()
      return content.table.WIDTH / 2
    },

    isTeam2: () => {
      if (!multiplayerActive) return false
      return localTeam === 2 && team2[active2] && team2[active2].id === localId
    },

    isBench: () => {
      if (!multiplayerActive) return false
      const isActive1 = localTeam === 1 && team1[active1] && team1[active1].id === localId
      const isActive2 = localTeam === 2 && team2[active2] && team2[active2].id === localId
      return !isActive1 && !isActive2
    },

    getLocalTeam: () => localTeam,

    isMultiplayer: () => multiplayerActive,

    getTeam1ActiveId: () => team1[active1] ? team1[active1].id : null,

    getTeam2ActiveId: () => team2[active2] ? team2[active2].id : null,

    getTeam: (n) => (n === 1 ? team1 : team2).slice(),

    reset: () => {
      team1 = []
      team2 = []
      active1 = 0
      active2 = 0
      localTeam = null
      localId = null
      multiplayerActive = false
    },
  }
})()
