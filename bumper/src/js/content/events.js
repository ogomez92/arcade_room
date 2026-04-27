/**
 * Game-wide event bus. Decouples physics/AI/sound/UI.
 * Events:
 *   carHit         {carId, otherId, damage, impact}
 *   carWallHit     {carId, damage, impact}
 *   carScrape      {carId, speed}
 *   carEliminated  {carId, byId|null}
 *   roundStart     {carCount}
 *   roundEnd       {winnerId|null, standings: [{id, label, score, eliminated}]}
 */
content.events = engine.tool.pubsub.create()
