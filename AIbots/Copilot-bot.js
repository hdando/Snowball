// UltraSnowballChampion Bot:
// This bot uses game state data to pursue smaller opponents while evading larger ones,
// and otherwise heads toward the center of the map. It sends movement commands 20 times per second.

class UltraSnowballChampion {
  constructor(socket) {
    this.socket = socket;
    this.gameState = null;
    this.myId = null;
    this.target = { x: 0, y: 0 };
    this.init();
  }

  init() {
    // Expect an initialization message carrying the bot's id.
    this.socket.on("init", (data) => {
      this.myId = data.id;
    });

    // Listen for periodic game state updates.
    this.socket.on("state", (state) => {
      this.gameState = state;
      this.decideNextMove();
    });

    // Emit movement commands 20 times per second.
    setInterval(() => {
      this.socket.emit("move", this.target);
    }, 50);
  }

  decideNextMove() {
    if (!this.gameState || !this.myId) return;
    const players = this.gameState.players || [];
    const me = players.find((p) => p.id === this.myId);
    if (!me) return;

    // Use vectors to accumulate evasion and pursuit directions.
    let evadeVec = { x: 0, y: 0 };
    let pursueVec = { x: 0, y: 0 };
    let hasThreat = false,
      hasTarget = false;

    for (let opponent of players) {
      if (opponent.id === this.myId) continue;
      const dx = opponent.x - me.x;
      const dy = opponent.y - me.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) continue;

      // If an opponent is notably larger and within a danger radius, add an evasion component.
      if (opponent.radius > me.radius * 1.05 && dist < 300) {
        evadeVec.x -= dx / dist;
        evadeVec.y -= dy / dist;
        hasThreat = true;
      }
      // If an opponent is smaller, add a pursuit component.
      else if (opponent.radius < me.radius * 0.95) {
        pursueVec.x += dx / dist;
        pursueVec.y += dy / dist;
        hasTarget = true;
      }
    }

    let moveX = me.x;
    let moveY = me.y;

    if (hasThreat) {
      // Normalize the evasion vector and multiply by a factor to ensure a safe distance.
      const norm = Math.hypot(evadeVec.x, evadeVec.y);
      if (norm > 0) {
        moveX = me.x + (evadeVec.x / norm) * 200;
        moveY = me.y + (evadeVec.y / norm) * 200;
      }
    } else if (hasTarget) {
      // Normalize the pursuit vector and move towards the aggregate of smaller opponents.
      const norm = Math.hypot(pursueVec.x, pursueVec.y);
      if (norm > 0) {
        moveX = me.x + (pursueVec.x / norm) * 150;
        moveY = me.y + (pursueVec.y / norm) * 150;
      }
    } else if (this.gameState.map) {
      // If no immediate interactions, head toward the center of the map.
      moveX = this.gameState.map.width / 2;
      moveY = this.gameState.map.height / 2;
    } else {
      // Fallback in case no map data is available: wander slightly.
      moveX = me.x + Math.random() * 50 - 25;
      moveY = me.y + Math.random() * 50 - 25;
    }

    this.target = { x: moveX, y: moveY };
  }
}

module.exports = function (socket) {
  new UltraSnowballChampion(socket);
};
