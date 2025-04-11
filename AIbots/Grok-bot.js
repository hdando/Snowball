class MyBot {
  constructor(socket, botId, gameWidth, gameHeight, snowballSpeed, playerRadius) {
    this.socket = socket;
    this.botId = botId;
    this.gameWidth = gameWidth || 800;      // Default game width in pixels
    this.gameHeight = gameHeight || 600;    // Default game height in pixels
    this.snowballSpeed = snowballSpeed || 200; // Snowball speed in pixels per second
    this.playerRadius = playerRadius || 20; // Player hitbox radius in pixels
    this.botState = {
      players: {},     // Map of player IDs to their state (position, velocity, etc.)
      snowballs: [],   // Array of snowballs with position and velocity
    };
    this.lastThrowTime = 0;
    this.throwCooldown = 500; // Time between throws in milliseconds
    this.position = null;     // Bot's current position
  }

  /**
   * Handles game state updates received from the server.
   * Updates the bot's internal state and makes decisions for movement and attacking.
   * @param {Object} gameState - Current state of the game from the server
   */
  onGameState(gameState) {
    this.updateBotState(gameState);
    const currentTime = Date.now();

    // Retrieve bot's current position
    const botPlayer = gameState.players.find(p => p.id === this.botId);
    if (!botPlayer || botPlayer.eliminated) return; // Skip if bot not found or eliminated
    this.position = botPlayer.position;

    // Movement decision: Evade threats or move strategically
    const threats = this.getThreats();
    let moveDirection;
    if (threats.length > 0) {
      moveDirection = this.calculateEvasionDirection(threats);
    } else {
      moveDirection = this.calculateStrategicDirection();
    }
    if (moveDirection) {
      this.socket.emit('move', moveDirection);
    }

    // Attack decision: Throw snowball at target if cooldown allows
    if (currentTime - this.lastThrowTime > this.throwCooldown) {
      const target = this.getTarget();
      if (target) {
        const throwDirection = this.calculateThrowDirection(target);
        if (throwDirection) {
          this.socket.emit('throwSnowball', throwDirection);
          this.lastThrowTime = currentTime;
        }
      }
    }
  }

  /**
   * Updates the bot's internal state with the latest game state data.
   * Tracks player positions and velocities, and updates snowball positions.
   * @param {Object} gameState - Current state of the game
   */
  updateBotState(gameState) {
    const currentTime = Date.now();
    // Update player states
    for (let player of gameState.players) {
      if (!this.botState.players[player.id]) {
        this.botState.players[player.id] = {
          position: { x: player.position.x, y: player.position.y },
          lastUpdate: currentTime,
          velocity: { x: 0, y: 0 },
          eliminated: player.eliminated
        };
      } else {
        const prev = this.botState.players[player.id];
        const dx = player.position.x - prev.position.x;
        const dy = player.position.y - prev.position.y;
        const dt = (currentTime - prev.lastUpdate) / 1000; // Time delta in seconds
        prev.velocity = dt > 0 ? { x: dx / dt, y: dy / dt } : { x: 0, y: 0 };
        prev.position = { x: player.position.x, y: player.position.y };
        prev.lastUpdate = currentTime;
        prev.eliminated = player.eliminated;
      }
    }
    // Update snowballs
    this.botState.snowballs = gameState.snowballs.map(sb => ({
      position: { x: sb.position.x, y: sb.position.y },
      velocity: { x: sb.velocity.x, y: sb.velocity.y }
    }));
  }

  /**
   * Identifies snowballs that are threats to the bot.
   * @returns {Array} Array of threatening snowballs
   */
  getThreats() {
    return this.botState.snowballs.filter(sb => this.isThreat(sb));
  }

  /**
   * Determines if a snowball is on a collision course with the bot.
   * @param {Object} snowball - Snowball with position and velocity
   * @returns {boolean} True if the snowball is a threat
   */
  isThreat(snowball) {
    const P_s = snowball.position;
    const V_s = snowball.velocity;
    const P_bot = this.position;
    const denominator = V_s.x * V_s.x + V_s.y * V_s.y;
    if (denominator === 0) return false; // Snowball not moving
    const numerator = (P_bot.x - P_s.x) * V_s.x + (P_bot.y - P_s.y) * V_s.y;
    const t = -numerator / denominator;
    if (t <= 0) return false; // Snowball has passed or is moving away
    const P_closest = { x: P_s.x + t * V_s.x, y: P_s.y + t * V_s.y };
    const distance = Math.hypot(P_closest.x - P_bot.x, P_closest.y - P_bot.y);
    return distance < this.playerRadius; // Threat if within hitbox
  }

  /**
   * Calculates the direction to move to evade multiple threats.
   * Weights evasion by threat imminence (1/t).
   * @param {Array} threats - Array of threatening snowballs
   * @returns {Object|null} Normalized direction vector or null if no movement needed
   */
  calculateEvasionDirection(threats) {
    let totalEvasion = { x: 0, y: 0 };
    for (let threat of threats) {
      const P_s = threat.position;
      const V_s = threat.velocity;
      const denominator = V_s.x * V_s.x + V_s.y * V_s.y;
      const numerator = (this.position.x - P_s.x) * V_s.x + (this.position.y - P_s.y) * V_s.y;
      const t = -numerator / denominator;
      const P_closest = { x: P_s.x + t * V_s.x, y: P_s.y + t * V_s.y };
      const evasionDir = { x: this.position.x - P_closest.x, y: this.position.y - P_closest.y };
      const mag = Math.hypot(evasionDir.x, evasionDir.y);
      if (mag > 0) {
        evasionDir.x /= mag;
        evasionDir.y /= mag;
        const weight = 1 / t; // More imminent threats have higher weight
        totalEvasion.x += evasionDir.x * weight;
        totalEvasion.y += evasionDir.y * weight;
      }
    }
    const totalMag = Math.hypot(totalEvasion.x, totalEvasion.y);
    if (totalMag > 0) {
      return { x: totalEvasion.x / totalMag, y: totalEvasion.y / totalMag };
    }
    return null;
  }

  /**
   * Calculates a strategic movement direction when no threats are present.
   * Moves towards the center of the game area for better positioning.
   * @returns {Object|null} Normalized direction vector or null if no movement needed
   */
  calculateStrategicDirection() {
    const center = { x: this.gameWidth / 2, y: this.gameHeight / 2 };
    const toCenter = { x: center.x - this.position.x, y: center.y - this.position.y };
    const mag = Math.hypot(toCenter.x, toCenter.y);
    if (mag > 0) {
      return { x: toCenter.x / mag, y: toCenter.y / mag };
    }
    return null;
  }

  /**
   * Selects the closest non-eliminated opponent as the target.
   * @returns {Object|null} Target player object or null if no valid target
   */
  getTarget() {
    let minDistance = Infinity;
    let target = null;
    for (let player of Object.values(this.botState.players)) {
      if (player.id === this.botId || player.eliminated) continue;
      const distance = Math.hypot(player.position.x - this.position.x, player.position.y - this.position.y);
      if (distance < minDistance) {
        minDistance = distance;
        target = player;
      }
    }
    return target;
  }

  /**
   * Calculates the direction to throw a snowball to hit the target, predicting its future position.
   * @param {Object} target - Target player with position and velocity
   * @returns {Object|null} Normalized direction vector or null if invalid
   */
  calculateThrowDirection(target) {
    if (!target) return null;
    const P_T = target.position;
    const V_T = target.velocity || { x: 0, y: 0 };
    const P_bot = this.position;
    const distance = Math.hypot(P_T.x - P_bot.x, P_T.y - P_bot.y);
    const t = distance / this.snowballSpeed; // Time for snowball to reach target
    const predicted_P_T = { x: P_T.x + V_T.x * t, y: P_T.y + V_T.y * t };
    const direction = { x: predicted_P_T.x - P_bot.x, y: predicted_P_T.y - P_bot.y };
    const magnitude = Math.hypot(direction.x, direction.y);
    if (magnitude > 0) {
      return { x: direction.x / magnitude, y: direction.y / magnitude };
    }
    return null;
  }
}

module.exports = MyBot;
