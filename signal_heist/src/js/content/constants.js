content.constants = (() => {
  const contracts = [
    {id: 'blackoutLobby', nameKey: 'contract.blackoutLobby', width: 30, height: 18, caches: 2, guards: 2, cameras: 1, trace: 130, jammers: 3, security: 0.75},
    {id: 'archiveSpine', nameKey: 'contract.archiveSpine', width: 34, height: 20, caches: 3, guards: 2, cameras: 2, trace: 150, jammers: 3, security: 0.85},
    {id: 'coldServer', nameKey: 'contract.coldServer', width: 38, height: 22, caches: 3, guards: 3, cameras: 2, trace: 160, jammers: 3, security: 0.95},
    {id: 'mirrorHall', nameKey: 'contract.mirrorHall', width: 40, height: 24, caches: 4, guards: 3, cameras: 3, trace: 175, jammers: 3, security: 1.05},
    {id: 'glassVault', nameKey: 'contract.glassVault', width: 42, height: 25, caches: 4, guards: 4, cameras: 3, trace: 185, jammers: 3, security: 1.12},
    {id: 'deadSwitch', nameKey: 'contract.deadSwitch', width: 44, height: 26, caches: 5, guards: 4, cameras: 4, trace: 195, jammers: 3, security: 1.20},
    {id: 'redElevator', nameKey: 'contract.redElevator', width: 46, height: 27, caches: 5, guards: 5, cameras: 4, trace: 205, jammers: 3, security: 1.28},
    {id: 'nightLedger', nameKey: 'contract.nightLedger', width: 48, height: 28, caches: 6, guards: 5, cameras: 5, trace: 215, jammers: 3, security: 1.36},
    {id: 'needleFloor', nameKey: 'contract.needleFloor', width: 50, height: 29, caches: 6, guards: 6, cameras: 5, trace: 225, jammers: 3, security: 1.44},
    {id: 'blackSite', nameKey: 'contract.blackSite', width: 52, height: 30, caches: 7, guards: 6, cameras: 6, trace: 235, jammers: 3, security: 1.52},
    {id: 'quietMoney', nameKey: 'contract.quietMoney', width: 54, height: 31, caches: 7, guards: 7, cameras: 6, trace: 245, jammers: 3, security: 1.60},
    {id: 'panicRoom', nameKey: 'contract.panicRoom', width: 56, height: 32, caches: 8, guards: 7, cameras: 7, trace: 255, jammers: 3, security: 1.68},
    {id: 'basementNine', nameKey: 'contract.basementNine', width: 58, height: 33, caches: 8, guards: 8, cameras: 7, trace: 265, jammers: 3, security: 1.76},
    {id: 'zeroWing', nameKey: 'contract.zeroWing', width: 60, height: 34, caches: 9, guards: 8, cameras: 8, trace: 275, jammers: 3, security: 1.84},
    {id: 'ashenCore', nameKey: 'contract.ashenCore', width: 62, height: 35, caches: 9, guards: 9, cameras: 8, trace: 285, jammers: 3, security: 1.92},
    {id: 'whiteNoise', nameKey: 'contract.whiteNoise', width: 64, height: 36, caches: 10, guards: 9, cameras: 9, trace: 295, jammers: 3, security: 2.00},
    {id: 'finalHandshake', nameKey: 'contract.finalHandshake', width: 66, height: 37, caches: 10, guards: 10, cameras: 9, trace: 305, jammers: 3, security: 2.08},
    {id: 'deepBlack', nameKey: 'contract.deepBlack', width: 68, height: 38, caches: 11, guards: 10, cameras: 10, trace: 315, jammers: 3, security: 2.18},
  ]

  function contractAt(index) {
    if (index < contracts.length) {
      return {...contracts[index], index}
    }

    const extra = index - contracts.length + 1

    return {
      id: 'deepBlack' + extra,
      nameKey: 'contract.deepBlackLoop',
      generatedNumber: extra,
      width: Math.min(78, 68 + extra * 2),
      height: Math.min(42, 38 + extra),
      caches: Math.min(14, 11 + Math.floor(extra / 2)),
      guards: Math.min(14, 10 + extra),
      cameras: Math.min(14, 10 + extra),
      trace: Math.max(260, 315 - extra * 4),
      jammers: 3,
      security: 2.18 + extra * 0.12,
      index,
    }
  }

  return {
    CACHE_RADIUS: 0.72,
    CAMERA_FOV: Math.PI / 4.8,
    CAMERA_RANGE: 9.5,
    CONTRACTS: contracts,
    EXIT_RADIUS: 1,
    GUARD_FOV: Math.PI / 2.35,
    GUARD_HEARING: 6.75,
    GUARD_RANGE: 7.6,
    JAM_COOLDOWN: 0.85,
    JAM_DURATION: 5.5,
    JAM_RADIUS: 7.25,
    PLAYER_RADIUS: 0.36,
    PLAYER_SPEED: 2.45,
    PLAYER_SPRINT_MULTIPLIER: 1.62,
    PLAYER_TURN_RATE: 2.75,
    PLAYER_STRAFE_MULTIPLIER: 0.78,
    contractAt,
  }
})()
