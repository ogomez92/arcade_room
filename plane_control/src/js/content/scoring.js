// Point awards. A safe landing pays a base award plus an efficiency bonus
// scaled by the plane's remaining fuel (land them promptly, score more).
// Writes to career.score. References siblings lazily.
content.scoring = (() => {
  const C = () => content.constants
  const S = () => content.state

  function career() { return S().career() }

  // Returns the points awarded for landing `plane`.
  function landing(plane) {
    const car = career()
    if (!car) return 0
    const P = C().POINTS
    const fuelBonus = Math.max(0, Math.round((plane.fuel || 0) * P.FUEL_BONUS_PER_S))
    const pts = P.LAND + fuelBonus
    car.score += pts
    car.landed++
    return pts
  }

  function awardRaw(points) {
    const car = career()
    if (car) car.score += (points || 0)
    return points || 0
  }

  return {
    landing,
    awardRaw,
    total: () => (career() ? career().score : 0),
  }
})()
