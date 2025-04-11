class AdvancedBot {
  constructor(botId, gameState, sendInputs) {
    // Basic properties
    this.id = botId;
    this.gameState = gameState;
    this.sendInputs = sendInputs;
    
    // Bot state
    this.lastUpdateTime = Date.now();
    this.updateInterval = 50; // milliseconds (increased frequency)
    this.isAlive = true;
    this.lastPosition = null;
    this.stuckCounter = 0;
    this.stuckThreshold = 5;
    
    // Combat parameters
    this.shootCooldown = 1000; // 1 second between shots (more aggressive)
    this.lastShootTime = 0;
    this.targetPlayerId = null;
    this.targetPriority = null;
    this.lastTargetCheck = 0;
    this.targetCheckInterval = 500; // Check for new targets every 0.5 seconds
    
    // Movement parameters
    this.randomMoveTime = 0;
    this.randomMoveDirection = { left: false, right: false };
    this.avoidanceTime = 0;
    this.avoidanceDirection = { left: false, right: false };
    this.collisionCooldown = 0;
    this.exploreAngle = Math.random() * Math.PI * 2;
    this.exploreTimer = 0;
    this.exploreDuration = 10000; // Explore in one direction for 10 seconds
    
    // Resource focus and collection strategy
    this.collectibleMap = new Map(); // Keep track of processor locations
    this.priorityTypes = ["attackSpeed", "attack", "speed", "range", "hp", "resistance", "repairSpeed"];
    this.avoidingPlayerTime = 0;
    
    // Strategy parameters
    this.aggressive = false; // Start passive, focus on collecting
    this.minProcessorsForAggressive = 50; // Become aggressive after collecting this many
    this.escapeLowHealth = 0.3; // Run away when health below 30%
    this.safeDistance = 30; // Distance to maintain from powerful enemies
    
    // Stats tracking
    this.processorCount = 0;
    this.killCount = 0;
    this.deathCount = 0;
    
    console.log(`AdvancedBot initialized with ID: ${this.id}`);
  }
  
  update(gameState) {
    // Update our reference to the game state
    this.gameState = gameState;
    
    // Get the current state of our bot
    const me = this.getMyState();
    if (!me || !me.isAlive) {
      // If the bot is dead, send no input
      this.sendInputs({
        forward: false,
        backward: false,
        left: false,
        right: false,
        fire: false
      });
      return;
    }
    
    const currentTime = Date.now();
    
    // Check for being stuck
    this.checkIfStuck(me);
    
    // Update processor count for strategy adjustment
    if (me.stats && me.stats.processorCounts) {
      this.processorCount = Object.values(me.stats.processorCounts).reduce((a, b) => a + b, 0);
      
      // Adjust strategy based on processor count
      this.aggressive = this.processorCount >= this.minProcessorsForAggressive;
    }
    
    // Decide if we should fire (based on cooldown)
    const shouldFire = currentTime - this.lastShootTime > this.shootCooldown;
    if (shouldFire) {
      this.lastShootTime = currentTime;
    }
    
    // Avoid other players when low on health or when significantly weaker
    if (this.shouldAvoidPlayers(me)) {
      const nearestPlayer = this.findNearestPlayer(me.position);
      if (nearestPlayer) {
        this.avoidPlayer(me, nearestPlayer, shouldFire);
        return;
      }
    }
    
    // If we're in random move mode (after collision or being stuck)
    if (currentTime < this.randomMoveTime) {
      this.sendRandomMovement(shouldFire);
      return;
    }
    
    // If we're in avoidance mode (after detecting obstacle)
    if (currentTime < this.avoidanceTime) {
      this.sendAvoidanceMovement(shouldFire);
      return;
    }
    
    // Check if we need to update our target
    if (currentTime - this.lastTargetCheck > this.targetCheckInterval) {
      this.updateTarget(me);
      this.lastTargetCheck = currentTime;
    }
    
    // Target acquisition logic
    if (this.aggressive && this.targetPlayerId) {
      const targetPlayer = this.gameState.players[this.targetPlayerId];
      if (targetPlayer && targetPlayer.isAlive) {
        this.attackPlayer(me, targetPlayer, shouldFire);
        return;
      } else {
        // Clear invalid target
        this.targetPlayerId = null;
      }
    }
    
    // Look for the closest valuable processor based on our strategy
    const closestProcessor = this.findBestProcessor(me);
    
    if (closestProcessor) {
      // We found a processor, move towards it
      this.moveTowardsTarget(me, closestProcessor.position, shouldFire);
    } else {
      // No processor found, explore the map
      this.exploreMap(me, shouldFire);
    }
  }
  
  // Get the current state of the bot
  getMyState() {
    return this.gameState.players[this.id];
  }
  
  // Check if we're stuck and not moving
  checkIfStuck(me) {
    if (!this.lastPosition) {
      this.lastPosition = { ...me.position };
      return;
    }
    
    const distance = this.calculateDistance(this.lastPosition, me.position);
    
    // If we've barely moved
    if (distance < 0.05) {
      this.stuckCounter++;
      
      // If stuck for too long, trigger random movement
      if (this.stuckCounter > this.stuckThreshold) {
        this.randomMoveTime = Date.now() + 3000; // Random movement for 3 seconds
        this.stuckCounter = 0;
      }
    } else {
      // Reset stuck counter if moving
      this.stuckCounter = 0;
    }
    
    // Update last position
    this.lastPosition = { ...me.position };
  }
  
  // Update our current target
  updateTarget(me) {
    // If we're not aggressive yet, don't look for targets
    if (!this.aggressive) {
      this.targetPlayerId = null;
      return;
    }
    
    // Find potential targets
    const targets = [];
    
    for (const playerId in this.gameState.players) {
      // Don't target self
      if (playerId === this.id) continue;
      
      const player = this.gameState.players[playerId];
      if (!player.isAlive) continue;
      
      // Calculate distance
      const distance = this.calculateDistance(me.position, player.position);
      
      // Only consider players within reasonable attack range
      if (distance > me.stats.range * 1.5) continue;
      
      // Check how dangerous this player is compared to us
      const dangerRatio = this.calculateDangerRatio(me, player);
      
      // Add to potential targets
      targets.push({
        id: playerId,
        distance: distance,
        hp: player.hp,
        maxHp: player.maxHp,
        dangerRatio: dangerRatio
      });
    }
    
    // No targets in range
    if (targets.length === 0) {
      this.targetPlayerId = null;
      return;
    }
    
    // Sort by various criteria
    targets.sort((a, b) => {
      // Prefer weaker enemies (lower danger ratio)
      if (a.dangerRatio < 0.8 && b.dangerRatio >= 0.8) return -1;
      if (a.dangerRatio >= 0.8 && b.dangerRatio < 0.8) return 1;
      
      // Then prefer low health percentage enemies
      const aHealthPercent = a.hp / a.maxHp;
      const bHealthPercent = b.hp / b.maxHp;
      if (aHealthPercent < 0.3 && bHealthPercent >= 0.3) return -1;
      if (aHealthPercent >= 0.3 && bHealthPercent < 0.3) return 1;
      
      // Finally, prefer closer enemies
      return a.distance - b.distance;
    });
    
    // Set the best target
    this.targetPlayerId = targets[0].id;
    this.targetPriority = targets[0].dangerRatio < 0.8 ? "easy" : 
                          targets[0].hp / targets[0].maxHp < 0.3 ? "weakened" : "closest";
  }
  
  // Calculate how dangerous a player is compared to us
  calculateDangerRatio(me, player) {
    if (!me.stats || !player.stats) return 1.0;
    
    // Calculate combat effectiveness (simple approximation)
    const myEffectiveness = (me.stats.attack || 10) * (me.stats.attackSpeed || 0.5) * 
                           (me.stats.range || 10) * (me.stats.speed || 0.02);
    
    const theirEffectiveness = (player.stats.attack || 10) * (player.stats.attackSpeed || 0.5) * 
                              (player.stats.range || 10) * (player.stats.speed || 0.02);
    
    // Return ratio of their effectiveness to ours
    // Higher values mean they're more dangerous compared to us
    return theirEffectiveness / myEffectiveness;
  }
  
  // Decide if we should be avoiding other players
  shouldAvoidPlayers(me) {
    // Avoid players when health is low
    if (me.hp / me.maxHp < this.escapeLowHealth) {
      this.avoidingPlayerTime = Date.now() + 10000; // Avoid for 10 seconds
      return true;
    }
    
    // Continue avoiding if timer is still active
    if (Date.now() < this.avoidingPlayerTime) {
      return true;
    }
    
    // Avoid if we're weak (not many processors collected yet)
    if (this.processorCount < 20) {
      return true;
    }
    
    return false;
  }
  
  // Find the nearest player to a position
  findNearestPlayer(position) {
    let closest = null;
    let minDistance = Infinity;
    
    for (const playerId in this.gameState.players) {
      // Don't target self
      if (playerId === this.id) continue;
      
      const player = this.gameState.players[playerId];
      if (!player.isAlive) continue;
      
      const distance = this.calculateDistance(position, player.position);
      
      if (distance < minDistance) {
        minDistance = distance;
        closest = player;
      }
    }
    
    return closest;
  }
  
  // Move away from a player
  avoidPlayer(me, player, shouldFire) {
    // Calculate direction from player to us
    const awayVector = {
      x: me.position.x - player.position.x,
      z: me.position.z - player.position.z
    };
    
    // Normalize
    const length = Math.sqrt(awayVector.x * awayVector.x + awayVector.z * awayVector.z);
    awayVector.x /= length;
    awayVector.z /= length;
    
    // Calculate escape angle
    const escapeAngle = Math.atan2(awayVector.x, awayVector.z);
    
    // Set rotation to face away from the player
    this.rotateTowards(me, escapeAngle);
    
    // Move forward to escape
    this.sendInputs({
      forward: true,
      backward: false,
      left: Math.abs(this.normalizeAngle(me.rotation - escapeAngle)) > 0.1,
      right: Math.abs(this.normalizeAngle(escapeAngle - me.rotation)) > 0.1,
      fire: shouldFire // Fire while retreating for cover
    });
  }
  
  // Attack a player
  attackPlayer(me, target, shouldFire) {
    // Calculate angle to target
    const targetAngle = Math.atan2(
      target.position.x - me.position.x,
      target.position.z - me.position.z
    );
    
    // Calculate distance to target
    const distance = this.calculateDistance(me.position, target.position);
    
    // Determine if we should advance, maintain distance, or retreat
    let shouldAdvance = false;
    let shouldRetreat = false;
    
    if (distance > me.stats.range * 0.9) {
      // Too far away, advance
      shouldAdvance = true;
    } else if (distance < me.stats.range * 0.5) {
      // Too close, retreat a bit to maintain optimal firing range
      shouldRetreat = true;
    }
    
    // Check for obstacles
    if (distance > 5) { // Only check if not already very close
      const hasObstacle = this.checkForObstacle(me, target.position);
      if (hasObstacle) {
        // Try to navigate around obstacles
        this.avoidanceTime = Date.now() + 1000;
        this.avoidanceDirection.left = Math.random() > 0.5;
        this.avoidanceDirection.right = !this.avoidanceDirection.left;
        return;
      }
    }
    
    // Rotate to face target
    this.rotateTowards(me, targetAngle);
    
    // Send inputs for attacking the target
    this.sendInputs({
      forward: shouldAdvance && Math.abs(this.normalizeAngle(me.rotation - targetAngle)) < 0.5,
      backward: shouldRetreat && Math.abs(this.normalizeAngle(me.rotation - targetAngle)) < 0.5,
      left: this.normalizeAngle(targetAngle - me.rotation) < -0.05,
      right: this.normalizeAngle(targetAngle - me.rotation) > 0.05,
      fire: shouldFire
    });
  }
  
  // Find the best processor based on our current strategy
  findBestProcessor(me) {
    if (!this.gameState.processors) {
      return null;
    }
    
    const processors = Object.values(this.gameState.processors);
    
    if (processors.length === 0) {
      return null;
    }
    
    // Filter processors to include only those without obstacles in direct path
    const accessibleProcessors = processors.filter(processor => {
      return !this.checkForObstacle(me, processor.position);
    });
    
    // Use accessible processors if available, otherwise use all processors
    const candidateProcessors = accessibleProcessors.length > 0 ? accessibleProcessors : processors;
    
    // Calculate scores for each processor
    const scoredProcessors = candidateProcessors.map(processor => {
      const distance = this.calculateDistance(me.position, processor.position);
      
      // Base score is inverse of distance (closer is better)
      let score = 1000 / (distance + 1);
      
      // Adjust score based on processor type priority
      const typeIndex = this.priorityTypes.indexOf(processor.type);
      if (typeIndex !== -1) {
        // Scale from 1.0 to 2.0 based on priority (higher priority gets higher multiplier)
        const typePriorityMultiplier = 2.0 - (typeIndex / this.priorityTypes.length);
        score *= typePriorityMultiplier;
      }
      
      // De-prioritize processors that are close to other players
      for (const playerId in this.gameState.players) {
        if (playerId !== this.id) {
          const player = this.gameState.players[playerId];
          if (player.isAlive) {
            const playerToProcessorDist = this.calculateDistance(player.position, processor.position);
            // If another player is close to this processor, reduce its score
            if (playerToProcessorDist < distance) {
              score *= 0.5; // Significant reduction if another player is closer
            }
          }
        }
      }
      
      return {
        processor: processor,
        score: score
      };
    });
    
    // Sort by score (highest first)
    scoredProcessors.sort((a, b) => b.score - a.score);
    
    // Return the highest scoring processor
    return scoredProcessors.length > 0 ? scoredProcessors[0].processor : null;
  }
  
  // Explore the map when no better actions are available
  exploreMap(me, shouldFire) {
    const currentTime = Date.now();
    
    // Change direction periodically
    if (currentTime > this.exploreTimer) {
      this.exploreAngle = Math.random() * Math.PI * 2;
      this.exploreTimer = currentTime + this.exploreDuration;
    }
    
    // Check for obstacles in exploration direction
    const exploreTarget = {
      x: me.position.x + Math.sin(this.exploreAngle) * 10,
      z: me.position.z + Math.cos(this.exploreAngle) * 10
    };
    
    const hasObstacle = this.checkForObstacle(me, exploreTarget);
    
    if (hasObstacle) {
      // Change direction if obstacle detected
      this.exploreAngle = (this.exploreAngle + Math.PI/2 + Math.random() * Math.PI/2) % (Math.PI * 2);
      this.exploreTimer = currentTime + 3000; // Shorter duration after obstacle
    }
    
    // Move in exploration direction
    this.rotateTowards(me, this.exploreAngle);
    
    this.sendInputs({
      forward: true,
      backward: false,
      left: this.normalizeAngle(this.exploreAngle - me.rotation) < -0.05,
      right: this.normalizeAngle(this.exploreAngle - me.rotation) > 0.05,
      fire: shouldFire // Fire occasionally while exploring
    });
  }
  
  // Move towards a target position
  moveTowardsTarget(me, targetPosition, shouldFire) {
    // Calculate angle to target
    const targetAngle = Math.atan2(
      targetPosition.x - me.position.x,
      targetPosition.z - me.position.z
    );
    
    // Current angle of the bot
    const currentAngle = me.rotation;
    
    // Calculate the normalized angle difference
    const angleDiff = this.normalizeAngle(targetAngle - currentAngle);
    
    // Check for obstacles
    const hasObstacle = this.checkForObstacle(me, targetPosition);
    
    if (hasObstacle) {
      // If obstacle detected, activate avoidance mode
      this.avoidanceTime = Date.now() + 1000;
      
      // Choose a random direction to avoid
      this.avoidanceDirection.left = Math.random() > 0.5;
      this.avoidanceDirection.right = !this.avoidanceDirection.left;
      
      this.sendAvoidanceMovement(shouldFire);
      return;
    }
    
    // Send inputs based on angle difference
    this.sendInputs({
      forward: Math.abs(angleDiff) < 0.5, // Only move forward when roughly facing the target
      backward: false,
      left: angleDiff < -0.05,
      right: angleDiff > 0.05,
      fire: shouldFire
    });
  }
  
  // Rotate towards a specific angle
  rotateTowards(me, targetAngle) {
    const angleDiff = this.normalizeAngle(targetAngle - me.rotation);
    
    // Calculate rotation inputs
    const left = angleDiff < -0.05;
    const right = angleDiff > 0.05;
    
    return { left, right };
  }
  
  // Normalize angle to range [-PI, PI]
  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
  
  // Send inputs for random movement
  sendRandomMovement(shouldFire) {
    // If we don't have a set random direction or it's time to change
    if (!this.randomMoveDirection.set || Math.random() < 0.03) {
      this.randomMoveDirection = {
        forward: Math.random() > 0.2, // 80% chance to move forward
        backward: Math.random() < 0.1, // 10% chance to move backward
        left: Math.random() > 0.5,
        right: Math.random() < 0.5,
        set: true
      };
      
      // Avoid turning left and right simultaneously
      if (this.randomMoveDirection.left && this.randomMoveDirection.right) {
        this.randomMoveDirection.right = false;
      }
    }
    
    // Send the random inputs
    this.sendInputs({
      forward: this.randomMoveDirection.forward,
      backward: this.randomMoveDirection.backward,
      left: this.randomMoveDirection.left,
      right: this.randomMoveDirection.right,
      fire: shouldFire
    });
  }
  
  // Send inputs for obstacle avoidance
  sendAvoidanceMovement(shouldFire) {
    // Send the avoidance inputs
    this.sendInputs({
      forward: true,
      backward: false,
      left: this.avoidanceDirection.left,
      right: this.avoidanceDirection.right,
      fire: shouldFire
    });
  }
  
  // Check if there's an obstacle between the bot and a target
  checkForObstacle(me, targetPosition) {
    // Direction vector from bot to target
    const direction = {
      x: targetPosition.x - me.position.x,
      z: targetPosition.z - me.position.z
    };
    
    // Distance to target
    const distance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (distance === 0) return false;
    
    // Normalize direction
    direction.x /= distance;
    direction.z /= distance;
    
    // Check other players as obstacles
    for (const playerId in this.gameState.players) {
      if (playerId === this.id) continue; // Ignore self
      
      const player = this.gameState.players[playerId];
      if (!player.isAlive) continue; // Ignore dead players
      
      // Vector from bot to player
      const toPlayer = {
        x: player.position.x - me.position.x,
        z: player.position.z - me.position.z
      };
      
      // Distance to player
      const playerDist = Math.sqrt(toPlayer.x * toPlayer.x + toPlayer.z * toPlayer.z);
      if (playerDist > distance) continue; // Player is farther than target
      
      // Projection of player vector onto direction
      const dot = toPlayer.x * direction.x + toPlayer.z * direction.z;
      if (dot <= 0) continue; // Player is behind us
      
      // Distance from player to line of sight
      const projX = direction.x * dot;
      const projZ = direction.z * dot;
      const perpX = toPlayer.x - projX;
      const perpZ = toPlayer.z - projZ;
      const perpDist = Math.sqrt(perpX * perpX + perpZ * perpZ);
      
      // Adjust collision radius based on player scale
      let collisionRadius = 1.5;
      if (player.stats && player.stats.processorCounts) {
        const totalProcessors = Object.values(player.stats.processorCounts).reduce((sum, count) => sum + count, 0);
        collisionRadius *= (1 + (totalProcessors * 0.005));
      }
      
      if (perpDist < collisionRadius) return true; // Obstacle detected
    }
    
    // Check structures
    for (const structureId in this.gameState.structures) {
      const structure = this.gameState.structures[structureId];
      if (structure.destroyed) continue; // Ignore destroyed structures
      
      // Vector from bot to structure
      const toStructure = {
        x: structure.position.x - me.position.x,
        z: structure.position.z - me.position.z
      };
      
      // Distance to structure
      const structDist = Math.sqrt(toStructure.x * toStructure.x + toStructure.z * toStructure.z);
      if (structDist > distance) continue; // Structure is farther than target
      
      // Projection onto direction
      const dot = toStructure.x * direction.x + toStructure.z * direction.z;
      if (dot <= 0) continue; // Structure is behind us
      
      // Distance from structure to line of sight
      const projX = direction.x * dot;
      const projZ = direction.z * dot;
      const perpX = toStructure.x - projX;
      const perpZ = toStructure.z - projZ;
      const perpDist = Math.sqrt(perpX * perpX + perpZ * perpZ);
      
      // Different collision radius based on structure type
      const collisionRadius = structure.type === 'waterTower' ? 5 : 
                              structure.type === 'tree' ? 1.5 : 2;
      
      if (perpDist < collisionRadius) return true; // Obstacle detected
    }
    
    // Check map boundaries
    const mapRadius = 99; // Slightly less than actual 100 to be safe
    
    // Calculate if target is outside map bounds
    const targetDistFromCenter = Math.sqrt(
      targetPosition.x * targetPosition.x + 
      targetPosition.z * targetPosition.z
    );
    
    if (targetDistFromCenter > mapRadius) {
      // Target is outside map, check if path crosses boundary
      // Parametric line equation: me.position + t * direction = point on circle
      // Solve for t: |me.position + t * direction|² = mapRadius²
      
      const a = direction.x * direction.x + direction.z * direction.z; // Should be 1 if normalized
      const b = 2 * (me.position.x * direction.x + me.position.z * direction.z);
      const c = me.position.x * me.position.x + me.position.z * me.position.z - mapRadius * mapRadius;
      
      // Discriminant of quadratic equation
      const discriminant = b * b - 4 * a * c;
      
      if (discriminant >= 0) {
        // Line intersects circle (map boundary)
        return true;
      }
    }
    
    return false;
  }
  
  // Calculate distance between two points
  calculateDistance(a, b) {
    return Math.sqrt(
      Math.pow(b.x - a.x, 2) +
      Math.pow(b.z - a.z, 2)
    );
  }
  
  // Handle game events
  handleEvent(event, data) {
    // React when taking damage
    if (event === 'playerDamaged' && data.id === this.id) {
      // If taking damage, enter random movement mode for 1 second
      this.randomMoveTime = Date.now() + 1000;
      // Reset random direction
      this.randomMoveDirection.set = false;
    }
    
    // React when killed
    if (event === 'playerKilled' && data.id === this.id) {
      this.isAlive = false;
      this.deathCount++;
      // Reset targeting and strategy
      this.targetPlayerId = null;
      this.aggressive = false;
    }
    
    // If we killed someone
    if (event === 'playerKilled' && data.killerId === this.id) {
      this.killCount++;
      // Briefly enter random movement to avoid getting stuck on dropped processors
      this.randomMoveTime = Date.now() + 500;
    }
    
    // If a processor is collected by someone else, remove from our map
    if (event === 'processorCollected' && data.playerId !== this.id) {
      this.collectibleMap.delete(data.id);
    }
    
    // Update target when a player is killed
    if (event === 'playerKilled' && this.targetPlayerId === data.id) {
      this.targetPlayerId = null;
      this.lastTargetCheck = 0; // Force immediate retargeting
    }
    
    // When another player is damaged, potentially opportunistically switch targets
    if (event === 'playerDamaged' && data.id !== this.id && this.aggressive) {
      const player = this.gameState.players[data.id];
      if (player && player.isAlive && player.hp / player.maxHp < 0.3) {
        // Consider switching to this low-health target
        const me = this.getMyState();
        const distance = this.calculateDistance(me.position, player.position);
        
        // Only switch if in reasonable range and not currently executing an avoidance maneuver
        if (distance < me.stats.range * 1.5 && Date.now() > this.avoidanceTime) {
          this.targetPlayerId = data.id;
          this.targetPriority = "weakened";
        }
      }
    }
  }
}

module.exports = AdvancedBot;
