class ClaudeBot {
  constructor(botId, io, gameState, emitAction) {
    // Basic properties
    this.id = botId;
    this.io = io;
    this.gameState = gameState;
    this.emitAction = emitAction;
    
    // Bot state
    this.target = null;
    this.strategy = 'collect'; // 'collect', 'attack', 'flee'
    this.threatMemory = {}; // Track dangerous players
    this.lastUpdateTime = Date.now();
    this.lastShootTime = 0;
    this.updateInterval = 100; // milliseconds
    this.isAlive = true;
    this.gameStartTime = Date.now();
    
    // Obstacle avoidance
    this.obstacles = [];
    this.mapRadius = 100; // Based on MAP_BOUNDS radius
    this.avoidanceRadius = 3; // Keep this distance from obstacles
    
    // Movement tracking
    this.lastPosition = null;
    this.stuckCounter = 0;
    this.consecutivePathFailures = 0;
    
    // Combat stats monitoring
    this.killCount = 0;
    this.damageDealt = 0;
    this.lastHealthCheck = 100;
    
    // Strategic behavior settings
    this.aggressiveness = 0.5; // 0-1, how likely to engage in combat
    this.resourcePriorities = this.getDefaultPriorities();
    
    console.log(`ClaudeBot initialized with ID: ${this.id}`);
  }
  
  update(gameState) {
    // Update our reference to the game state
    this.gameState = gameState;
    
    // Calculate time delta
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Only make decisions at specific intervals to avoid spamming
    if (deltaTime < this.updateInterval) return;
    
    // Get our bot's current state
    const me = this.getMyState();
    if (!me) return;
    
    // Check if we died or respawned
    if (me.isAlive !== this.isAlive) {
      this.handleRespawnOrDeath(me);
    }
    
    // Update obstacles list
    this.updateObstacles();
    
    // Only proceed if alive
    if (!me.isAlive) return;
    
    // Check if we're stuck
    this.checkIfStuck(me);
    
    // Update health check
    if (me.hp < this.lastHealthCheck) {
      // We took damage, update threat assessment
      this.updateThreatAssessment(me);
    }
    this.lastHealthCheck = me.hp;
    
    // Main decision making
    this.makeDecision(me);
    
    // Remember our last position
    this.lastPosition = { ...me.position };
  }
  
  // Get our bot's current state from the game state
  getMyState() {
    return this.gameState.players[this.id];
  }
  
  // Main decision-making function
  makeDecision(me) {
    // Reset target if we reached it or it no longer exists
    if (this.shouldResetTarget(me)) {
      this.target = null;
    }
    
    // Determine current strategy based on health and threats
    this.updateStrategy(me);
    
    // Execute the current strategy
    switch (this.strategy) {
      case 'collect':
        this.collectResources(me);
        break;
      case 'attack':
        this.attackEnemies(me);
        break;
      case 'flee':
        this.fleeFromDanger(me);
        break;
      default:
        this.randomMovement();
    }
  }
  
  // Handle respawn or death
  handleRespawnOrDeath(me) {
    this.isAlive = me.isAlive;
    
    if (me.isAlive) {
      // We respawned
      console.log(`Bot ${this.id} respawned`);
      this.target = null;
      this.strategy = 'collect';
      this.stuckCounter = 0;
      this.consecutivePathFailures = 0;
      this.resourcePriorities = this.getDefaultPriorities();
      
      // Reset combat stats
      this.damageDealt = 0;
    } else {
      // We died
      console.log(`Bot ${this.id} died`);
      this.target = null;
    }
  }
  
  // Update obstacles list
  updateObstacles() {
    this.obstacles = [];
    
    // Add static structures as obstacles
    if (this.gameState.structures) {
      Object.values(this.gameState.structures).forEach(structure => {
        if (structure.type === 'waterTower' || structure.type === 'tree') {
          if (!structure.destroyed) {
            this.obstacles.push({
              position: structure.position,
              radius: structure.type === 'waterTower' ? 6 : 2 // Larger radius for water tower
            });
          }
        }
      });
    }
  }
  
  // Check if we should reset our current target
  shouldResetTarget(me) {
    if (!this.target) return false;
    
    if (this.target.type === 'processor') {
      return !this.gameState.processors[this.target.id];
    } else if (this.target.type === 'cannon') {
      return !this.gameState.cannons[this.target.id];
    } else if (this.target.type === 'player') {
      const player = this.gameState.players[this.target.id];
      return !player || !player.isAlive;
    }
    
    return true;
  }
  
  // Check if we're stuck
  checkIfStuck(me) {
    if (!this.lastPosition) return;
    
    const distance = this.calculateDistance(me.position, this.lastPosition);
    
    // If we barely moved for several updates, we might be stuck
    if (distance < 0.01) {
      this.stuckCounter++;
      
      if (this.stuckCounter > 20) { // Stuck for too long
        console.log(`Bot ${this.id} is stuck, changing strategy`);
        this.stuckCounter = 0;
        this.target = null;
        this.consecutivePathFailures++;
        
        // If we've been consistently getting stuck, try more random movement
        if (this.consecutivePathFailures > 3) {
          this.randomMovement();
          // Reset after taking evasive action
          setTimeout(() => {
            this.consecutivePathFailures = 0;
          }, 2000);
        } else {
          // Try to move away from current position
          this.findEscapePath(me);
        }
      }
    } else {
      this.stuckCounter = 0; // Reset counter if we're moving
    }
  }
  
  // Find a path to escape from being stuck
  findEscapePath(me) {
    // Try to move away from nearby obstacles
    const nearbyObstacles = this.obstacles.filter(obstacle => {
      return this.calculateDistance(me.position, obstacle.position) < obstacle.radius + 5;
    });
    
    if (nearbyObstacles.length > 0) {
      // Move away from obstacles
      const avoidanceDirection = this.calculateObstacleAvoidanceDirection(me.position, nearbyObstacles);
      this.moveInDirection(me, avoidanceDirection);
    } else {
      // Move toward center if we're near the edge
      const distanceToCenter = this.calculateDistance(me.position, { x: 0, y: 0, z: 0 });
      if (distanceToCenter > this.mapRadius * 0.85) {
        const centerDirection = this.getDirectionToTarget(me.position, { x: 0, y: 0, z: 0 });
        this.moveInDirection(me, centerDirection);
      } else {
        // Otherwise move randomly
        this.randomMovement();
      }
    }
  }
  
  // Update our strategy based on current situation
  updateStrategy(me) {
    // Flee if health is low
    if (me.hp < me.maxHp * 0.3) {
      this.strategy = 'flee';
      return;
    }
    
    // Check for nearby threats
    const threats = this.findNearbyThreats(me);
    if (threats.length > 0) {
      // If we're significantly stronger than the threats, attack them
      if (this.isStrongerThan(threats[0], me)) {
        this.strategy = 'attack';
        this.target = { type: 'player', id: threats[0].id };
      } else {
        // Otherwise, flee
        this.strategy = 'flee';
      }
      return;
    }
    
    // Check if there are any worthy combat targets
    if (this.aggressiveness > Math.random() && me.hp > me.maxHp * 0.7) {
      const potentialTargets = this.findPotentialTargets(me);
      if (potentialTargets.length > 0 && this.isStrongerThan(potentialTargets[0], me)) {
        this.strategy = 'attack';
        this.target = { type: 'player', id: potentialTargets[0].id };
        return;
      }
    }
    
    // Default to collection if no threats or worthy targets
    this.strategy = 'collect';
  }
  
  // Update threat assessment when we take damage
  updateThreatAssessment(me) {
    // Look at nearby players and update our threat memory
    const players = Object.values(this.gameState.players);
    const nearbyPlayers = players.filter(player => {
      if (player.id === this.id || !player.isAlive) return false;
      
      const distance = this.calculateDistance(me.position, player.position);
      return distance < me.stats.range * 2; // Consider nearby players as potential damage sources
    });
    
    // Record threats in memory with timestamp
    nearbyPlayers.forEach(player => {
      this.threatMemory[player.id] = {
        lastSeen: Date.now(),
        position: player.position,
        strength: this.calculatePlayerStrength(player),
        username: player.username
      };
    });
  }
  
  // Calculate a player's combat strength
  calculatePlayerStrength(player) {
    if (!player || !player.stats) return 0;
    
    // Weight different stats according to their combat importance
    const attackPower = player.stats.attack * player.stats.attackSpeed;
    const defensePower = player.hp * (1 + player.stats.resistance / 100);
    const mobilityPower = player.stats.speed * player.stats.range;
    
    return (attackPower * 2) + defensePower + (mobilityPower * 0.5);
  }
  
  // Find nearby threats (enemy players)
  findNearbyThreats(me) {
    const players = Object.values(this.gameState.players);
    const threats = players.filter(player => {
      if (player.id === this.id || !player.isAlive) return false;
      
      const distance = this.calculateDistance(me.position, player.position);
      return distance < me.stats.range * 1.5; // Consider enemies within 1.5x our range as threats
    });
    
    // Sort by distance
    threats.sort((a, b) => {
      const distA = this.calculateDistance(me.position, a.position);
      const distB = this.calculateDistance(me.position, b.position);
      return distA - distB;
    });
    
    return threats;
  }
  
  // Check if we're stronger than an enemy
  isStrongerThan(enemy, me) {
    // More sophisticated strength evaluation
    // Consider our stats vs. enemy stats
    
    // Attack power
    const myAttackPower = me.stats.attack * me.stats.attackSpeed;
    const enemyAttackPower = enemy.stats.attack * enemy.stats.attackSpeed;
    
    // Effective HP (considering resistance)
    const myEffectiveHP = me.hp * (1 + me.stats.resistance / 100);
    const enemyEffectiveHP = enemy.hp * (1 + enemy.stats.resistance / 100);
    
    // Time to kill
    const myTimeToKillEnemy = enemyEffectiveHP / myAttackPower;
    const enemyTimeToKillMe = myEffectiveHP / enemyAttackPower;
    
    // We're stronger if we can kill them faster than they can kill us
    // Add a 20% margin to be safe
    return myTimeToKillEnemy < enemyTimeToKillMe * 0.8;
  }
  
  // Resource collection strategy
  collectResources(me) {
    // Determine what type of resource we need most
    const targetResource = this.determineTargetResource(me);
    
    if (targetResource.type === 'processor') {
      // Find closest processor of target type
      this.findAndTargetClosestProcessor(me, targetResource.processorType);
    } else if (targetResource.type === 'cannon') {
      // Find closest cannon
      this.findAndTargetClosestCannon(me);
    }
    
    // Move toward the target
    if (this.target) {
      this.moveToTarget(me);
    } else {
      // No target found, move randomly
      this.randomMovement();
    }
  }
  
  // Default resource priorities
  getDefaultPriorities() {
    return {
      hp: 1.0,
      resistance: 1.0,
      attack: 1.0,
      attackSpeed: 1.0,
      range: 1.0,
      speed: 1.0,
      repairSpeed: 1.0
    };
  }
  
  // Determine what type of resource we should target
  determineTargetResource(me) {
    // Prioritize cannons if we don't have many
    const cannonCount = Object.keys(this.gameState.cannons).length;
    if (cannonCount > 0 && Math.random() < 0.3) { // 30% chance to target cannons
      return { type: 'cannon' };
    }
    
    // Otherwise, target processors based on our needs
    const stats = me.stats;
    const processorCounts = stats.processorCounts;
    
    // Calculate game phase (0 to 1)
    const gamePhase = Math.min(1, (Date.now() - this.gameStartTime) / (10 * 60 * 1000)); // 10 minutes game
    
    // Adjust resource priorities based on game phase
    this.updateResourcePriorities(gamePhase, processorCounts);
    
    // Calculate priority for each type of processor
    const priorities = {
      hp: this.calculateProcessorPriority('hp', processorCounts.hp, this.resourcePriorities.hp),
      resistance: this.calculateProcessorPriority('resistance', processorCounts.resistance, this.resourcePriorities.resistance),
      attack: this.calculateProcessorPriority('attack', processorCounts.attack, this.resourcePriorities.attack),
      attackSpeed: this.calculateProcessorPriority('attackSpeed', processorCounts.attackSpeed, this.resourcePriorities.attackSpeed),
      range: this.calculateProcessorPriority('range', processorCounts.range, this.resourcePriorities.range),
      speed: this.calculateProcessorPriority('speed', processorCounts.speed, this.resourcePriorities.speed),
      repairSpeed: this.calculateProcessorPriority('repairSpeed', processorCounts.repairSpeed, this.resourcePriorities.repairSpeed)
    };
    
    // Add some randomness to priorities
    for (const key in priorities) {
      priorities[key] *= 0.8 + Math.random() * 0.4; // Randomize by ±20%
    }
    
    // Find the type with highest priority
    let maxPriority = 0;
    let targetType = 'hp';
    
    for (const [type, priority] of Object.entries(priorities)) {
      if (priority > maxPriority) {
        maxPriority = priority;
        targetType = type;
      }
    }
    
    return { type: 'processor', processorType: targetType };
  }
  
  // Update resource priorities based on game phase
  updateResourcePriorities(gamePhase, processorCounts) {
    if (gamePhase < 0.3) {
      // Early game priorities - focus on mobility and collection
      this.resourcePriorities = {
        speed: 2.0,     // Mobility is crucial early
        range: 1.8,     // Range helps collect safely
        attackSpeed: 1.5, // Quick attacks are useful early
        attack: 1.2,    // Some attack power
        hp: 1.0,        // Basic HP
        resistance: 0.8, // Less important early
        repairSpeed: 0.7 // Less important early
      };
    } else if (gamePhase < 0.7) {
      // Mid game priorities - balance offense and defense
      this.resourcePriorities = {
        attack: 1.8,      // Build attack power
        resistance: 1.7,  // Build defense
        range: 1.5,       // Range remains important
        attackSpeed: 1.4, // Attack speed is valuable
        hp: 1.3,          // More HP for sustain
        speed: 1.2,       // Still need mobility but less priority
        repairSpeed: 1.0  // Start building repair
      };
    } else {
      // Late game priorities - maximize survival and damage
      this.resourcePriorities = {
        hp: 1.8,           // Survive longer
        attack: 1.7,       // Maximize damage
        repairSpeed: 1.6,  // Stay alive in fights
        resistance: 1.5,   // Withstand attacks
        attackSpeed: 1.3,  // Quick attacks
        range: 1.2,        // Good range
        speed: 1.0         // Still need mobility but less priority
      };
    }
    
    // Adaptive adjustment - lower priority for stats we already have a lot of
    for (const stat in this.resourcePriorities) {
      if (processorCounts[stat] > 30) {
        this.resourcePriorities[stat] *= 0.7; // Reduce priority if we have many
      } else if (processorCounts[stat] < 5) {
        this.resourcePriorities[stat] *= 1.3; // Increase priority if we have few
      }
    }
  }
  
  // Calculate priority for a processor type
  calculateProcessorPriority(type, count, basePriority) {
    // Base priority decreases as we collect more
    return (10 / (count + 1)) * basePriority;
  }
  
  // Find and target the closest processor of a specific type
  findAndTargetClosestProcessor(me, processorType) {
    const processors = Object.values(this.gameState.processors);
    
    // First, try to find processors of the target type
    let candidates = processors.filter(p => p.type === processorType);
    
    // If none found or very few, consider any processor
    if (candidates.length < 3) {
      candidates = processors;
    }
    
    // Calculate scores for each processor
    const scoredProcessors = candidates.map(processor => {
      const distance = this.calculateDistance(me.position, processor.position);
      
      // Check for obstacles between us and the processor
      const hasObstacle = this.checkForObstacles(me.position, processor.position);
      
      // Check for nearby threats
      const nearbyThreats = this.checkForNearbyThreats(processor.position);
      
      // Score is based on:
      // - Distance (closer is better)
      // - Obstacles (prefer processors without obstacles in the way)
      // - Type match (prefer matching our target type)
      // - Safety (prefer processors away from threats)
      
      let score = 1000 - distance; // Base score inversely proportional to distance
      
      if (hasObstacle) {
        score *= 0.7; // Reduce score if there's an obstacle
      }
      
      if (processor.type === processorType) {
        score *= 1.3; // Boost score for matching type
      }
      
      if (nearbyThreats) {
        score *= 0.6; // Significantly reduce score if near threats
      }
      
      return { ...processor, score };
    });
    
    // Sort by score
    scoredProcessors.sort((a, b) => b.score - a.score);
    
    if (scoredProcessors.length > 0) {
      this.target = {
        type: 'processor',
        id: scoredProcessors[0].id,
        position: scoredProcessors[0].position
      };
    }
  }
  
  // Check if there are threats near a position
  checkForNearbyThreats(position) {
    const players = Object.values(this.gameState.players);
    
    for (const player of players) {
      if (player.id === this.id || !player.isAlive) continue;
      
      const distance = this.calculateDistance(position, player.position);
      if (distance < 8) {
        return true; // Found a threat nearby
      }
    }
    
    return false;
  }
  
  // Find and target the closest cannon
  findAndTargetClosestCannon(me) {
    const cannons = Object.values(this.gameState.cannons);
    
    // Calculate scores for each cannon
    const scoredCannons = cannons.map(cannon => {
      const distance = this.calculateDistance(me.position, cannon.position);
      
      // Check for obstacles between us and the cannon
      const hasObstacle = this.checkForObstacles(me.position, cannon.position);
      
      // Check for nearby threats
      const nearbyThreats = this.checkForNearbyThreats(cannon.position);
      
      // Score is based on:
      // - Distance (closer is better)
      // - Obstacles (prefer cannons without obstacles in the way)
      // - Safety (prefer cannons away from threats)
      
      let score = 1000 - distance; // Base score inversely proportional to distance
      
      if (hasObstacle) {
        score *= 0.7; // Reduce score if there's an obstacle
      }
      
      if (nearbyThreats) {
        score *= 0.6; // Significantly reduce score if near threats
      }
      
      return { ...cannon, score };
    });
    
    // Sort by score
    scoredCannons.sort((a, b) => b.score - a.score);
    
    if (scoredCannons.length > 0) {
      this.target = {
        type: 'cannon',
        id: scoredCannons[0].id,
        position: scoredCannons[0].position
      };
    }
  }
  
  // Attack enemies strategy
  attackEnemies(me) {
    // If we already have a target, check if it's still valid
    if (this.target && this.target.type === 'player') {
      const target = this.gameState.players[this.target.id];
      if (target && target.isAlive) {
        // Move toward target and shoot
        this.moveAndShoot(me, target);
        return;
      }
    }
    
    // Find new target
    const enemies = this.findPotentialTargets(me);
    if (enemies.length > 0) {
      this.target = { 
        type: 'player', 
        id: enemies[0].id 
      };
      this.moveAndShoot(me, enemies[0]);
    } else {
      // No enemies found, switch back to collection
      this.strategy = 'collect';
      this.collectResources(me);
    }
  }
  
  // Find potential targets to attack
  findPotentialTargets(me) {
    const players = Object.values(this.gameState.players);
    const enemies = players.filter(player => {
      if (player.id === this.id || !player.isAlive) return false;
      
      const distance = this.calculateDistance(me.position, player.position);
      return distance < me.stats.range * 2; // Target enemies within twice our range
    });
    
    // Score each enemy
    const scoredEnemies = enemies.map(enemy => {
      // Score based on:
      // - Health ratio (lower HP enemies are easier to kill)
      // - Processor count (higher counts are more rewarding)
      // - Distance (closer is better)
      // - Obstacles (prefer targets without obstacles in the way)
      // - Past threat (prefer enemies that have damaged us before)
      
      const healthRatio = enemy.hp / enemy.maxHp;
      const healthFactor = 1 - healthRatio; // 0 to 1, higher for lower health
      
      // Calculate total processors
      let totalProcessors = 0;
      if (enemy.stats && enemy.stats.processorCounts) {
        totalProcessors = Object.values(enemy.stats.processorCounts).reduce((sum, count) => sum + count, 0);
      }
      
      const distance = this.calculateDistance(me.position, enemy.position);
      const distanceFactor = 1 - (distance / (me.stats.range * 2)); // 0 to 1, higher for closer
      
      // Check for obstacles
      const hasObstacle = this.checkForObstacles(me.position, enemy.position);
      const obstacleFactor = hasObstacle ? 0.5 : 1.0;
      
      // Check if this enemy has threatened us before
      const isThreat = this.threatMemory[enemy.id] ? 1.5 : 1.0;
      
      // Calculate final score
      const score = (
        (healthFactor * 2) + 
        (totalProcessors * 0.05) + 
        distanceFactor
      ) * obstacleFactor * isThreat;
      
      return {
        ...enemy,
        score
      };
    });
    
    // Sort by score
    scoredEnemies.sort((a, b) => b.score - a.score);
    
    return scoredEnemies;
  }
  
  // Move toward target and shoot
  moveAndShoot(me, target) {
    // Update target position (in case they moved)
    if (this.target) {
      this.target.position = target.position;
    }
    
    // Calculate direction to target
    const direction = this.getDirectionToTarget(me.position, target.position);
    
    // Calculate optimal combat distance (70-90% of our range)
    const optimalDistance = me.stats.range * 0.8;
    const currentDistance = this.calculateDistance(me.position, target.position);
    
    // Determine if we should move forward, back, or maintain position
    let moveDirection = { ...direction };
    if (currentDistance > optimalDistance * 1.1) {
      // Too far, move closer
      this.moveInDirection(me, direction);
    } else if (currentDistance < optimalDistance * 0.7) {
      // Too close, back up
      moveDirection.x *= -1;
      moveDirection.z *= -1;
      this.moveInDirection(me, moveDirection);
    } else {
      // At good distance, maintain position but add some strafing
      // Perpendicular to the direction to target
      const strafeDirection = {
        x: -direction.z,
        z: direction.x
      };
      
      // Randomize strafe direction
      if (Math.random() > 0.5) {
        strafeDirection.x *= -1;
        strafeDirection.z *= -1;
      }
      
      this.moveInDirection(me, strafeDirection);
    }
    
    // Check if we're in range to shoot
    if (currentDistance <= me.stats.range) {
      // Check for obstacles before shooting
      const hasObstacle = this.checkForObstacles(me.position, target.position);
      if (!hasObstacle) {
        this.shoot(me, target.position, direction);
      }
    }
  }
  
  // Shoot at a target
  shoot(me, targetPosition, direction) {
    // Check cooldown
    const currentTime = Date.now();
    const cooldown = 1000 / me.stats.attackSpeed; // Convert attackSpeed to milliseconds
    
    if (currentTime - this.lastShootTime < cooldown) {
      return; // Still on cooldown
    }
    
    this.lastShootTime = currentTime;
    
    // Calculate a slight offset for the position (barrel of the gun)
    const position = {
      x: me.position.x + direction.x * 0.5,
      y: me.position.y + 0.2, // Slightly above the ground
      z: me.position.z + direction.z * 0.5
    };
    
    // Add some aim variance based on target distance
    const distance = this.calculateDistance(me.position, targetPosition);
    const variance = Math.min(0.05, distance * 0.005); // More variance at longer ranges
    
    const adjustedDirection = {
      x: direction.x + (Math.random() * variance * 2 - variance),
      y: direction.y + (Math.random() * variance * 2 - variance),
      z: direction.z + (Math.random() * variance * 2 - variance)
    };
    
    // Normalize the direction
    const magnitude = Math.sqrt(
      adjustedDirection.x * adjustedDirection.x + 
      adjustedDirection.y * adjustedDirection.y + 
      adjustedDirection.z * adjustedDirection.z
    );
    
    adjustedDirection.x /= magnitude;
    adjustedDirection.y /= magnitude;
    adjustedDirection.z /= magnitude;
    
    // Emit the shoot action
    this.emitAction(this.id, 'playerShoot', {
      position,
      direction: adjustedDirection
    });
  }
  
  // Flee from danger strategy
  fleeFromDanger(me) {
    // Find all threats
    const threats = this.findNearbyThreats(me);
    
    if (threats.length === 0) {
      // No more threats, switch to collection
      this.strategy = 'collect';
      return;
    }
    
    // Calculate average threat position, weighted by threat level and distance
    const avgPosition = {
      x: 0,
      y: 0,
      z: 0
    };
    
    let totalWeight = 0;
    
    threats.forEach(threat => {
      const distance = this.calculateDistance(me.position, threat.position);
      const threatLevel = this.calculatePlayerStrength(threat);
      const weight = threatLevel / (distance + 1); // Higher weight for closer, stronger threats
      
      avgPosition.x += threat.position.x * weight;
      avgPosition.y += threat.position.y * weight;
      avgPosition.z += threat.position.z * weight;
      totalWeight += weight;
    });
    
    if (totalWeight > 0) {
      avgPosition.x /= totalWeight;
      avgPosition.y /= totalWeight;
      avgPosition.z /= totalWeight;
    }
    
    // Move away from average threat position
    const direction = this.getDirectionToTarget(me.position, avgPosition);
    
    // Reverse the direction
    direction.x *= -1;
    direction.z *= -1;
    
    // Check for obstacles in our escape path
    // We might need to modify the escape direction
    const escapeDistance = 15; // How far ahead to check for obstacles
    
    // Calculate the escape target position
    const escapeTarget = {
      x: me.position.x + direction.x * escapeDistance,
      y: me.position.y,
      z: me.position.z + direction.z * escapeDistance
    };
    
    // Check for obstacles in the escape path
    const hasObstacle = this.checkForObstacles(me.position, escapeTarget);
    
    if (hasObstacle) {
      // Modify the escape direction
      // Try different angles until we find a clear path
      for (let angle = 30; angle <= 180; angle += 30) {
        const radians = angle * Math.PI / 180;
        const rotatedDirection = {
          x: Math.cos(radians) * direction.x - Math.sin(radians) * direction.z,
          z: Math.sin(radians) * direction.x + Math.cos(radians) * direction.z
        };
        
        const alternateTarget = {
          x: me.position.x + rotatedDirection.x * escapeDistance,
          y: me.position.y,
          z: me.position.z + rotatedDirection.z * escapeDistance
        };
        
        if (!this.checkForObstacles(me.position, alternateTarget)) {
          // Found a clear path
          this.moveInDirection(me, rotatedDirection);
          return;
        }
        
        // Try the other direction
        const counterRadians = -angle * Math.PI / 180;
        const counterRotatedDirection = {
          x: Math.cos(counterRadians) * direction.x - Math.sin(counterRadians) * direction.z,
          z: Math.sin(counterRadians) * direction.x + Math.cos(counterRadians) * direction.z
        };
        
        const counterAlternateTarget = {
          x: me.position.x + counterRotatedDirection.x * escapeDistance,
          y: me.position.y,
          z: me.position.z + counterRotatedDirection.z * escapeDistance
        };
        
        if (!this.checkForObstacles(me.position, counterAlternateTarget)) {
          // Found a clear path
          this.moveInDirection(me, counterRotatedDirection);
          return;
        }
      }
      
      // If all else fails, move randomly
      this.randomMovement();
    } else {
      // No obstacles, move in the escape direction
      this.moveInDirection(me, direction);
    }
  }
  
  // Move to a target position, avoiding obstacles
  moveToTarget(me) {
    if (!this.target || !this.target.position) {
      return;
    }
    
    // Calculate the direct direction to the target
    const direction = this.getDirectionToTarget(me.position, this.target.position);
    
    // Check for obstacles in the path
    const hasObstacle = this.checkForObstacles(me.position, this.target.position);
    
    if (hasObstacle) {
      // Try to find a path around the obstacle
      this.navigateAroundObstacle(me, this.target.position);
    } else {
      // No obstacles, move directly toward the target
      this.moveInDirection(me, direction);
    }
  }
  
  // Navigate around obstacles to reach a target
  navigateAroundObstacle(me, targetPosition) {
    // Find the closest obstacle in our path
    const obstacleInPath = this.findObstacleInPath(me.position, targetPosition);
    
    if (!obstacleInPath) {
      // No obstacle found, move directly
      const direction = this.getDirectionToTarget(me.position, targetPosition);
      this.moveInDirection(me, direction);
      return;
    }
    
    // Calculate a detour direction
    const originalDirection = this.getDirectionToTarget(me.position, targetPosition);
    
    // Determine which way to go around the obstacle (left or right)
    // Calculate perpendicular direction
    const perpendicularLeft = {
      x: -originalDirection.z,
      z: originalDirection.x
    };
    
    const perpendicularRight = {
      x: originalDirection.z,
      z: -originalDirection.x
    };
    
    // Check distances from the obstacle's center to the target position using both perpendicular directions
    const obstaclePos = obstacleInPath.position;
    const leftPoint = {
      x: obstaclePos.x + perpendicularLeft.x * (obstacleInPath.radius + this.avoidanceRadius),
      y: obstaclePos.y,
      z: obstaclePos.z + perpendicularLeft.z * (obstacleInPath.radius + this.avoidanceRadius)
    };
    
    const rightPoint = {
      x: obstaclePos.x + perpendicularRight.x * (obstacleInPath.radius + this.avoidanceRadius),
      y: obstaclePos.y,
      z: obstaclePos.z + perpendicularRight.z * (obstacleInPath.radius + this.avoidanceRadius)
    };
    
    // Calculate which path is shorter
    const leftDistance = this.calculateDistance(leftPoint, targetPosition);
    const rightDistance = this.calculateDistance(rightPoint, targetPosition);
    
    // Choose the shorter path
    const detourDirection = leftDistance < rightDistance ? perpendicularLeft : perpendicularRight;
    
    // Move in the detour direction
    this.moveInDirection(me, detourDirection);
  }
  
  // Find obstacles in the path between two points
  findObstacleInPath(start, end) {
    const direction = this.getDirectionToTarget(start, end);
    const distance = this.calculateDistance(start, end);
    
    // Check each obstacle
    for (const obstacle of this.obstacles) {
      // Calculate the vector from start to obstacle
      const obstacleVector = {
        x: obstacle.position.x - start.x,
        z: obstacle.position.z - start.z
      };
      
      // Calculate the dot product of the direction and the obstacle vector
      const dotProduct = direction.x * obstacleVector.x + direction.z * obstacleVector.z;
      
      // Only consider obstacles that are in front of us
      if (dotProduct <= 0) continue;
      
      // Calculate the closest point on the line segment to the obstacle
      const projectionLength = Math.min(dotProduct, distance); // Clamp to the end of the segment
      
      const closestPoint = {
        x: start.x + direction.x * projectionLength,
        z: start.z + direction.z * projectionLength
      };
      
      // Calculate the distance from the closest point to the obstacle
      const obstacleDistance = Math.sqrt(
        Math.pow(closestPoint.x - obstacle.position.x, 2) +
        Math.pow(closestPoint.z - obstacle.position.z, 2)
      );
      
      // If the distance is less than the obstacle radius plus our avoidance radius, then the obstacle is in our path
      if (obstacleDistance < obstacle.radius + this.avoidanceRadius) {
        return obstacle;
      }
    }
    
    // No obstacles found in the path
    return null;
  }
  
  // Check for obstacles between two points
  checkForObstacles(start, end) {
    // This is a simple implementation that just checks if any obstacle is too close to the path
    // More sophisticated algorithms would use raycasting or similar techniques
    
    // Calculate the direction and distance
    const direction = this.getDirectionToTarget(start, end);
    const distance = this.calculateDistance(start, end);
    
    // Check each obstacle
    for (const obstacle of this.obstacles) {
      // Calculate the vector from start to obstacle
      const obstacleVector = {
        x: obstacle.position.x - start.x,
        z: obstacle.position.z - start.z
      };
      
      // Calculate the dot product of the direction and the obstacle vector
      const dotProduct = direction.x * obstacleVector.x + direction.z * obstacleVector.z;
      
      // Only consider obstacles that are in front of us
      if (dotProduct <= 0) continue;
      
      // Calculate the closest point on the line to the obstacle
      const projectionLength = Math.min(dotProduct, distance); // Clamp to the end of the segment
      
      const closestPoint = {
        x: start.x + direction.x * projectionLength,
        z: start.z + direction.z * projectionLength
      };
      
      // Calculate the distance from the closest point to the obstacle
      const obstacleDistance = Math.sqrt(
        Math.pow(closestPoint.x - obstacle.position.x, 2) +
        Math.pow(closestPoint.z - obstacle.position.z, 2)
      );
      
      // If the distance is less than the obstacle radius, then the line intersects the obstacle
      if (obstacleDistance < obstacle.radius + 0.5) {
        return true;
      }
    }
    
    // No obstacles found
    return false;
  }
  
  // Calculate obstacle avoidance direction
  calculateObstacleAvoidanceDirection(position, obstacles) {
    // Calculate repulsive force from each obstacle
    let forceX = 0;
    let forceZ = 0;
    
    obstacles.forEach(obstacle => {
      // Vector from obstacle to bot
      const vecX = position.x - obstacle.position.x;
      const vecZ = position.z - obstacle.position.z;
      
      // Distance from obstacle
      const distance = Math.sqrt(vecX * vecX + vecZ * vecZ);
      
      // Calculate force (inversely proportional to square of distance)
      const forceMagnitude = 1 / Math.max(0.1, distance * distance);
      
      // Normalize the vector
      const normalizedX = vecX / distance;
      const normalizedZ = vecZ / distance;
      
      // Add to total force
      forceX += normalizedX * forceMagnitude;
      forceZ += normalizedZ * forceMagnitude;
    });
    
    // Normalize the total force
    const forceMagnitude = Math.sqrt(forceX * forceX + forceZ * forceZ);
    
    if (forceMagnitude > 0) {
      forceX /= forceMagnitude;
      forceZ /= forceMagnitude;
    }
    
    return { x: forceX, z: forceZ };
  }
  
  // Get the direction vector from start to target
  getDirectionToTarget(start, target) {
    // Calculate the vector from start to target
    const vecX = target.x - start.x;
    const vecZ = target.z - start.z;
    
    // Calculate the magnitude
    const magnitude = Math.sqrt(vecX * vecX + vecZ * vecZ);
    
    // Normalize the vector
    if (magnitude > 0) {
      return {
        x: vecX / magnitude,
        z: vecZ / magnitude
      };
    } else {
      // Default direction if start and target are the same
      return { x: 1, z: 0 };
    }
  }
  
  // Move in a given direction
  moveInDirection(me, direction) {
    // Normalize direction if it's not already
    const magnitude = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    
    const normalizedDirection = {
      x: direction.x / magnitude,
      z: direction.z / magnitude
    };
    
    // Calculate the rotation angle
    const angle = Math.atan2(normalizedDirection.x, normalizedDirection.z);
    
    // Emit the movement
    this.emitAction(this.id, 'playerUpdate', {
      direction: {
        x: normalizedDirection.x,
        y: 0,
        z: normalizedDirection.z
      },
      rotation: angle
    });
  }
  
  // Random movement
  randomMovement() {
    // Generate a random direction
    const angle = Math.random() * Math.PI * 2;
    
    const direction = {
      x: Math.sin(angle),
      z: Math.cos(angle)
    };
    
    // Move in that direction
    this.moveInDirection(null, direction);
  }
  
  // Calculate distance between two points
  calculateDistance(a, b) {
    return Math.sqrt(
      Math.pow(b.x - a.x, 2) +
      Math.pow(b.z - a.z, 2)
    );
  }
  
  // Handle actions received from the server
  handleAction(action, data) {
    switch (action) {
      case 'playerDamaged':
        // Check if it's us who took damage
        if (data.id === this.id) {
          this.onDamageTaken(data);
        }
        break;
      
      case 'playerKilled':
        // Check if it's us or our target who died
        if (data.id === this.id) {
          this.onDeath(data);
        } else if (this.target && this.target.type === 'player' && data.id === this.target.id) {
          // Our target died, find a new one
          this.target = null;
          
          // Record the kill if we were the killer
          if (data.killerId === this.id) {
            this.killCount++;
          }
        }
        break;
        
      case 'projectileHit':
        if (data.ownerId === this.id) {
          this.damageDealt += data.damage || 0;
        }
        break;
    }
  }
  
  // Handle taking damage
  onDamageTaken(data) {
    // Update our memory of who attacked us
    if (data.attackerId && this.gameState.players[data.attackerId]) {
      const attacker = this.gameState.players[data.attackerId];
      
      this.threatMemory[data.attackerId] = {
        lastSeen: Date.now(),
        position: attacker.position,
        strength: this.calculatePlayerStrength(attacker),
        username: attacker.username
      };
      
      // Possibly change strategy based on damage taken
      const me = this.getMyState();
      if (me && me.hp < me.maxHp * 0.3) {
        this.strategy = 'flee';
      }
    }
  }
  
  // Handle death
  onDeath(data) {
    this.isAlive = false;
    this.target = null;
    
    console.log(`Bot ${this.id} died`);
  }
}

module.exports = ClaudeBot;
