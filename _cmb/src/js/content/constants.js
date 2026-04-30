content.constants = {
  arena: {
    size: 400,         // meters (square arena side length)
    wallHeight: 40,    // ceiling
    minSpawnSeparation: 200,   // meters between the two spawn points
  },
  audio: {
    maxAudibleDistance: 500,   // meters — used for opponent engine/SFX falloff
  },
  gravity: 24,         // m/s^2
  netTickHz: 20,
  radar: {
    maxDistance: 20,   // meters to react to wall
  },
  sonar: {
    maxAngle: Math.PI / 2,  // outside this, no sonar
  },
  ram: {
    minSpeedForDamage: 3,
    damagePerMps: 2.2,       // damage per m/s of closing speed
    fallAttackMultiplier: 2.0,
  },
  collision: {
    wallSpeedDamageFactor: 2.5,
  },
}
