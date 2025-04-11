const THREE = require('three');

class DominanceBot {
  constructor(botId, gameState, sendInputs) {
    this.botId = botId;
    this.gameState = gameState;
    this.sendInputs = sendInputs;
    
    // Bot state
    this.target = null;
    this.targetType = null; // 'processor', 'cannon', 'player', 'position'
    this.state = 'collecting'; // 'collecting', 'attacking', 'retreating', 'flanking'
    this.lastHealth = 100;
    this.attackingPlayer = null;
    this.dangerLevel = 0;
    this.lastPosition = null;
    this.stuckCounter = 0;
    this.lastTargetUpdateTime = 0;
    this.lastFireTime = 0;
    
    // Strategy parameters
    this.aggressionThreshold = 30; // Processors before becoming aggressive
    this.healthRetreatThreshold = 40; // % health to retreat
    this.healthReturnThreshold = 80; // % health to return to normal
    this.targetUpdateInterval = 500; // ms between target recalculations
    this.stuckThreshold = 10; // Frames before considering stuck
    this.nearbyThreshold = 20; // Units to consider "nearby" for players
    this.processorPriorities = {
      'attack': 1.3,
      'hp': 1.2,
      'resistance': 1.1,
      'range': 1.0,
      'attackSpeed': 0.9,
      'speed': 0.8,
      'repairSpeed': 0.7
    };
  }
  
  update(gameState) {
    // Update our reference to the game state
    this.gameState = gameState;
    
    // Get our bot from the game state
    const bot = gameState.players[this.botId];
    if (!bot || !bot.isAlive) return;
    
    // Check if we're stuck
    this.detectIfStuck(bot);
    
    // Calculate our total processors
    const totalProcessors = this.calculateTotalProcessors(bot);
    
    // Check if we're being attacked
    this.checkIfUnderAttack(bot);
    
    // Only update target periodically for performance
    const currentTime = Date.now();
    if (currentTime - this.lastTargetUpdateTime > this.targetUpdateInterval || !this.target) {
      // Determine our state based on health and situation
      this.updateState(bot, totalProcessors);
      
      // Choose a target based on our state
      this.chooseTarget(bot, totalProcessors);
      
      this.lastTargetUpdateTime = currentTime;
    }
    
    // Generate inputs based on target and state
    const inputs = this.generateInputs(bot);
    
    // Send the inputs
    this.sendInputs(inputs);
    
    // Update lastPosition for stuck detection
    this.lastPosition = {...bot.position};
  }

  detectIfStuck(bot) {
    if (this.lastPosition) {
      const distance = this.calculateDistance(this.lastPosition, bot.position);
      if (distance < 0.01) {
        this.stuckCounter++;
        
        // If stuck for too long, pick a new random direction
        if (this.stuckCounter > this.stuckThreshold) {
          this.chooseRandomDirection(bot);
          this.stuckCounter = 0;
        }
      } else {
        this.stuckCounter = 0;
      }
    }
  }

  chooseRandomDirection(bot) {
    // Create a random direction to move in
    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + Math.random() * 20; // 20-40 units away
    
    const targetPosition = {
      x: bot.position.x + Math.sin(angle) * distance,
      y: bot.position.y,
      z: bot.position.z + Math.cos(angle) * distance
    };
    
    this.target = targetPosition;
    this.targetType = 'position';
    this.state = 'collecting'; // Reset state
  }
  
  calculateTotalProcessors(bot) {
    if (!bot.stats || !bot.stats.processorCounts) return 0;
    return Object.values(bot.stats.processorCounts).reduce((sum, count) => sum + count, 0);
  }
  
  checkIfUnderAttack(bot) {
    // Check if health decreased since last update
    if (bot.hp < this.lastHealth) {
      this.dangerLevel += (this.lastHealth - bot.hp) * 2;
      
      // Danger level decays over time
      setTimeout(() => {
        this.dangerLevel = Math.max(0, this.dangerLevel - 10);
      }, 3000);
    }
    this.lastHealth = bot.hp;
    
    // Also check for nearby players as potential threats
    this.detectNearbyPlayers(bot);
  }
  
  detectNearbyPlayers(bot) {
    let nearestEnemyDistance = Infinity;
    let nearestEnemyId = null;
    
    Object.entries(this.gameState.players).forEach(([playerId, player]) => {
      // Skip ourselves and dead players
      if (playerId === this.botId || !player.isAlive) return;
      
      const distance = this.calculateDistance(bot.position, player.position);
      if (distance < this.nearbyThreshold && distance < nearestEnemyDistance) {
        nearestEnemyDistance = distance;
        nearestEnemyId = playerId;
      }
    });
    
    // If there's a nearby enemy, increase danger level based on proximity
    if (nearestEnemyId) {
      const dangerIncrease = (this.nearbyThreshold - nearestEnemyDistance) / 2;
      this.dangerLevel += dangerIncrease;
      
      // Also remember this player as a potential attacker
      this.attackingPlayer = nearestEnemyId;
    }
  }
  
  updateState(bot, totalProcessors) {
    const healthPercent = (bot.hp / bot.maxHp) * 100;
    
    // Retreat if health is low or danger level is high
    if (healthPercent < this.healthRetreatThreshold || this.dangerLevel > 30) {
      this.state = 'retreating';
    }
    // Return to normal state if health recovered
    else if (this.state === 'retreating' && healthPercent > this.healthReturnThreshold) {
      this.state = 'collecting';
    }
    // Become aggressive if we have enough processors
    else if (totalProcessors > this.aggressionThreshold && 
            (this.state === 'collecting' || this.state === 'flanking')) {
      // Check if there are suitable targets before committing to attack
      const targets = this.findPotentialPlayerTargets(bot, totalProcessors);
      if (targets.length > 0) {
        this.state = 'attacking';
      } else {
        this.state = 'collecting';
      }
    }
    // If attacking but no suitable targets, revert to collecting
    else if (this.state === 'attacking' && !this.isValidPlayerTarget(this.target)) {
      this.state = 'collecting';
    }
    
    // Add flanking behavior when enemy is far but we want to attack
    if (this.state === 'attacking' && this.targetType === 'player') {
      const targetPlayer = this.gameState.players[this.target];
      if (targetPlayer && this.calculateDistance(bot.position, targetPlayer.position) > 30) {
        this.state = 'flanking';
      }
    }
  }
  
  isValidPlayerTarget(targetId) {
    if (!targetId || this.targetType !== 'player') return false;
    
    const player = this.gameState.players[targetId];
    return player && player.isAlive;
  }
  
  chooseTarget(bot, totalProcessors) {
    // Reset target if needed
    if (this.targetType === 'processor' && !this.gameState.processors[this.target]) {
      this.target = null;
      this.targetType = null;
    } else if (this.targetType === 'cannon' && !this.gameState.cannons[this.target]) {
      this.target = null;
      this.targetType = null;
    } else if (this.targetType === 'player' && 
              (!this.gameState.players[this.target] || !this.gameState.players[this.target].isAlive)) {
      this.target = null;
      this.targetType = null;
    }
    
    switch (this.state) {
      case 'collecting':
        // Find nearest processor or cannon
        this.findCollectibleTarget(bot, totalProcessors);
        break;
      case 'attacking':
        // Find a suitable player to attack
        this.findPlayerTarget(bot, totalProcessors);
        break;
      case 'retreating':
        // Move away from danger
        this.findRetreatDirection(bot);
        break;
      case 'flanking':
        // Find a flanking position around the target player
        this.findFlankingPosition(bot);
        break;
    }
  }
  
  findCollectibleTarget(bot, totalProcessors) {
    // Choose what to prioritize based on current stats
    const processorPriorities = this.calculateProcessorPriorities(bot, totalProcessors);
    
    let bestTarget = null;
    let bestType = null;
    let bestScore = Infinity;
    
    // Check processors
    Object.entries(this.gameState.processors).forEach(([id, processor]) => {
      const distance = this.calculateDistance(bot.position, processor.position);
      
      // Calculate obstacle avoidance penalty
      const obstaclePenalty = this.calculateObstaclePenalty(bot.position, processor.position);
      
      // Priority based on type
      const typePriority = processorPriorities[processor.type] || 1.0;
      
      // Lower score is better (distance / priority)
      const score = (distance + obstaclePenalty) / typePriority;
      
      if (score < bestScore) {
        bestScore = score;
        bestTarget = id;
        bestType = 'processor';
      }
    });
    
    // Check cannons - always high priority if we don't have many
    const botSideCannons = this.estimateBotSideCannonCount(bot);
    const cannonPriority = botSideCannons < 4 ? 1.5 : 0.5; // High priority if we need more
    
    Object.entries(this.gameState.cannons).forEach(([id, cannon]) => {
      const distance = this.calculateDistance(bot.position, cannon.position);
      
      // Calculate obstacle avoidance penalty
      const obstaclePenalty = this.calculateObstaclePenalty(bot.position, cannon.position);
      
      // Lower score is better
      const score = (distance + obstaclePenalty) / cannonPriority;
      
      if (score < bestScore) {
        bestScore = score;
        bestTarget = id;
        bestType = 'cannon';
      }
    });
    
    // If we found a target, set it
    if (bestTarget) {
      this.target = bestTarget;
      this.targetType = bestType;
    } else {
      // If no good targets, pick a random direction
      this.chooseRandomDirection(bot);
    }
  }
  
  calculateProcessorPriorities(bot, totalProcessors) {
    // Start with base priorities
    const priorities = {...this.processorPriorities};
    
    // Adjust based on bot's needs
    if (bot.hp < bot.maxHp * 0.7) {
      // Prioritize HP when low health
      priorities.hp *= 1.5;
      priorities.repairSpeed *= 1.3;
    }
    
    if (this.dangerLevel > 20) {
      // Prioritize defensive stats when in danger
      priorities.resistance *= 1.4;
      priorities.hp *= 1.3;
    }
    
    if (totalProcessors > this.aggressionThreshold) {
      // Prioritize offensive stats when we're getting stronger
      priorities.attack *= 1.3;
      priorities.attackSpeed *= 1.2;
      priorities.range *= 1.2;
    }
    
    return priorities;
  }
  
  calculateObstaclePenalty(startPos, endPos) {
    let penalty = 0;
    
    // Check for obstacles between positions
    Object.values(this.gameState.structures).forEach(structure => {
      if (structure.destroyed) return;
      
      const structurePos = structure.position;
      
      // Calculate distance from structure to the line between start and end
      const lineLength = this.calculateDistance(startPos, endPos);
      if (lineLength === 0) return 0;
      
      // Vector from start to end
      const dirX = (endPos.x - startPos.x) / lineLength;
      const dirZ = (endPos.z - startPos.z) / lineLength;
      
      // Vector from start to structure
      const structDirX = structurePos.x - startPos.x;
      const structDirZ = structurePos.z - startPos.z;
      
      // Calculate dot product
      const dot = dirX * structDirX + dirZ * structDirZ;
      
      // Find closest point on line
      const closestX = startPos.x + dirX * Math.max(0, Math.min(dot, lineLength));
      const closestZ = startPos.z + dirZ * Math.max(0, Math.min(dot, lineLength));
      
      // Distance from structure to line
      const distToLine = Math.sqrt(
        (structurePos.x - closestX) ** 2 + 
        (structurePos.z - closestZ) ** 2
      );
      
      // Add penalty based on how close the path goes to obstacles
      const obstacleRadius = structure.type === 'waterTower' ? 5 : 2;
      if (distToLine < obstacleRadius + 3) { // Add some margin
        penalty += 20 * (1 - distToLine / (obstacleRadius + 3));
      }
    });
    
    return penalty;
  }
  
  findPotentialPlayerTargets(bot, totalProcessors) {
    const potentialTargets = [];
    
    Object.entries(this.gameState.players).forEach(([playerId, player]) => {
      // Skip ourselves, dead players, and other bots
      if (playerId === this.botId || !player.isAlive || playerId.startsWith('bot-')) return;
      
      // Calculate their total processors
      const playerProcessors = player.stats && player.stats.processorCounts ?
        Object.values(player.stats.processorCounts).reduce((sum, count) => sum + count, 0) : 0;
      
      // Don't attack players much stronger than us
      if (playerProcessors > totalProcessors * 1.3) return;
      
      // Consider distance
      const distance = this.calculateDistance(bot.position, player.position);
      
      // Calculate a score (higher is better)
      const strengthDifference = totalProcessors - playerProcessors;
      const healthPercentage = (player.hp / player.maxHp) * 100;
      
      // Prefer weaker, more damaged players that are closer
      const targetScore = strengthDifference + (100 - healthPercentage) - (distance * 0.1);
      
      potentialTargets.push({
        id: playerId,
        score: targetScore,
        distance: distance
      });
    });
    
    // Sort by score, highest first
    return potentialTargets.sort((a, b) => b.score - a.score);
  }
  
  findPlayerTarget(bot, totalProcessors) {
    const potentialTargets = this.findPotentialPlayerTargets(bot, totalProcessors);
    
    // Choose the best target
    if (potentialTargets.length > 0) {
      this.target = potentialTargets[0].id;
      this.targetType = 'player';
    } else {
      // If no good targets, go back to collecting
      this.state = 'collecting';
      this.findCollectibleTarget(bot, totalProcessors);
    }
  }
  
  findRetreatDirection(bot) {
    // If we know who's attacking us, move away from them
    if (this.attackingPlayer && this.gameState.players[this.attackingPlayer]) {
      const attacker = this.gameState.players[this.attackingPlayer];
      
      // Vector from attacker to us
      const vectorFromAttacker = {
        x: bot.position.x - attacker.position.x,
        y: 0,
        z: bot.position.z - attacker.position.z
      };
      
      // Normalize and extend
      const magnitude = Math.sqrt(vectorFromAttacker.x ** 2 + vectorFromAttacker.z ** 2);
      if (magnitude > 0) {
        const normalizedVector = {
          x: vectorFromAttacker.x / magnitude,
          y: 0,
          z: vectorFromAttacker.z / magnitude
        };
        
        // Create a retreat position away from attacker
        const retreatPosition = {
          x: bot.position.x + normalizedVector.x * 30,
          y: bot.position.y,
          z: bot.position.z + normalizedVector.z * 30
        };
        
        // Ensure we don't retreat out of the map
        const distanceFromCenter = Math.sqrt(retreatPosition.x ** 2 + retreatPosition.z ** 2);
        if (distanceFromCenter > 90) { // 90% of map radius
          // Scale back to a safe distance
          const scale = 80 / distanceFromCenter;
          retreatPosition.x *= scale;
          retreatPosition.z *= scale;
        }
        
        this.target = retreatPosition;
        this.targetType = 'position';
        return;
      }
    }
    
    // If no attacker, move towards the edge of the map
    const vectorFromCenter = {
      x: bot.position.x,
      y: 0,
      z: bot.position.z
    };
    
    // Normalize and extend
    const magnitude = Math.sqrt(vectorFromCenter.x ** 2 + vectorFromCenter.z ** 2);
    if (magnitude > 0) {
      const normalizedVector = {
        x: vectorFromCenter.x / magnitude,
        y: 0,
        z: vectorFromCenter.z / magnitude
      };
      
      // Create a retreat position towards the edge
      const retreatPosition = {
        x: normalizedVector.x * 80, // 80% of map radius
        y: bot.position.y,
        z: normalizedVector.z * 80
      };
      
      this.target = retreatPosition;
      this.targetType = 'position';
    } else {
      // If at center, pick a random direction
      this.chooseRandomDirection(bot);
    }
  }
  
  findFlankingPosition(bot) {
    if (this.targetType !== 'player' || !this.gameState.players[this.target]) {
      // If no valid player target, revert to attacking or collecting
      this.state = 'collecting';
      this.findCollectibleTarget(bot, totalProcessors);
      return;
    }
    
    const targetPlayer = this.gameState.players[this.target];
    
    // Get position and direction of target
    const targetPos = targetPlayer.position;
    const targetDir = targetPlayer.direction;
    
    // Calculate perpendicular vector for flanking
    // Randomly choose left or right flank
    const flankSide = Math.random() > 0.5 ? 1 : -1;
    const perpVector = {
      x: -targetDir.z * flankSide,
      y: 0,
      z: targetDir.x * flankSide
    };
    
    // Normalize perpendicular vector
    const magnitude = Math.sqrt(perpVector.x ** 2 + perpVector.z ** 2);
    if (magnitude > 0) {
      perpVector.x /= magnitude;
      perpVector.z /= magnitude;
    }
    
    // Calculate flanking position: behind and to the side of target
    const flankPosition = {
      x: targetPos.x + (targetDir.x * -5) + (perpVector.x * 10), // 5 units behind, 10 to the side
      y: targetPos.y,
      z: targetPos.z + (targetDir.z * -5) + (perpVector.z * 10)
    };
    
    this.target = flankPosition;
    this.targetType = 'position';
  }
  
  generateInputs(bot) {
    const inputs = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      fire: false
    };
    
    if (!this.target) return inputs;
    
    let targetPosition;
    
    if (this.targetType === 'processor') {
      targetPosition = this.gameState.processors[this.target]?.position;
      if (!targetPosition) return inputs; // Processor no longer exists
    } else if (this.targetType === 'cannon') {
      targetPosition = this.gameState.cannons[this.target]?.position;
      if (!targetPosition) return inputs; // Cannon no longer exists
    } else if (this.targetType === 'player') {
      const targetPlayer = this.gameState.players[this.target];
      if (!targetPlayer || !targetPlayer.isAlive) return inputs;
      targetPosition = targetPlayer.position;
    } else if (this.targetType === 'position') {
      targetPosition = this.target; // Target is already a position
    }
    
    if (!targetPosition) return inputs;
    
    // Calculate angle to target
    const angleToTarget = Math.atan2(
      targetPosition.x - bot.position.x,
      targetPosition.z - bot.position.z
    );
    
    // Calculate current bot angle
    const botAngle = bot.rotation;
    
    // Normalize angles
    let angleDiff = angleToTarget - botAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    // Determine rotation
    const rotationThreshold = 0.1; // Radians
    if (angleDiff > rotationThreshold) {
      inputs.left = true;
    } else if (angleDiff < -rotationThreshold) {
      inputs.right = true;
    } else {
      // We're facing the right direction, move forward
      inputs.forward = true;
    }
    
    // Special handling for player targets - strafing and smart firing
    if (this.targetType === 'player') {
      const targetPlayer = this.gameState.players[this.target];
      const distanceToTarget = this.calculateDistance(bot.position, targetPosition);
      
      // Calculate bot range
      const botRange = bot.stats?.range || 10;
      
      // If we're in attack range but not too close, stop moving forward and just fire
      if (distanceToTarget <= botRange * 0.9 && distanceToTarget > 5) {
        inputs.forward = false;
        // Small rotation for strafing
        if (this.dangerLevel > 10) {
          inputs.left = Math.random() > 0.5;
          inputs.right = !inputs.left;
        }
      }
      
      // If we're too close, back up a bit
      if (distanceToTarget < 5) {
        inputs.forward = false;
        inputs.backward = true;
      }
      
      // Fire if facing the target and in range
      if (Math.abs(angleDiff) < 0.3 && distanceToTarget <= botRange) {
        const currentTime = Date.now();
        // Only fire if cooldown has elapsed
        if (currentTime - this.lastFireTime > 1000 / (bot.stats?.attackSpeed || 0.5)) {
          inputs.fire = true;
          this.lastFireTime = currentTime;
        }
      }
    }
    // For non-player targets, consider firing at nearby players opportunistically
    else if (this.state !== 'retreating') {
      this.checkForFireOpportunities(bot, inputs);
    }
    
    // Obstacle avoidance for all cases
    this.avoidObstacles(bot, inputs, targetPosition);
    
    return inputs;
  }
  
  checkForFireOpportunities(bot, inputs) {
    // Get bot range
    const botRange = bot.stats?.range || 10;
    
    Object.entries(this.gameState.players).forEach(([playerId, player]) => {
      // Skip ourselves, dead players, and other bots
      if (playerId === this.botId || !player.isAlive || playerId.startsWith('bot-')) return;
      
      const distance = this.calculateDistance(bot.position, player.position);
      
      // If player is in range, check if we're facing them
      if (distance <= botRange) {
        const angleToPlayer = Math.atan2(
          player.position.x - bot.position.x,
          player.position.z - bot.position.z
        );
        
        let angleDiff = angleToPlayer - bot.rotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // If we're facing the player, fire!
        if (Math.abs(angleDiff) < 0.3) {
          const currentTime = Date.now();
          // Only fire if cooldown has elapsed
          if (currentTime - this.lastFireTime > 1000 / (bot.stats?.attackSpeed || 0.5)) {
            inputs.fire = true;
            this.lastFireTime = currentTime;
          }
          return; // Only fire at one player at a time
        }
      }
    });
  }
  
  avoidObstacles(bot, inputs, targetPosition) {
    // Ray casting for obstacle detection
    const rayLength = 5; // Look 5 units ahead
    const botDirection = new THREE.Vector3(
      Math.sin(bot.rotation),
      0,
      Math.cos(bot.rotation)
    );
    
    // Check for obstacles directly ahead
    let obstacleAhead = false;
    Object.values(this.gameState.structures).forEach(structure => {
      if (structure.destroyed) return;
      
      const structurePos = structure.position;
      
      // Vector from bot to structure
      const toStructure = {
        x: structurePos.x - bot.position.x,
        y: 0,
        z: structurePos.z - bot.position.z
      };
      
      // Distance to structure
      const distanceToStructure = Math.sqrt(toStructure.x ** 2 + toStructure.z ** 2);
      
      // Collision radius
      const collisionRadius = structure.type === 'waterTower' ? 5 : 2;
      
      // Dot product to see if we're heading towards the structure
      const dot = botDirection.x * toStructure.x + botDirection.z * toStructure.z;
      
      // If obstacle is close, in front of us, and we'd hit it soon
      if (distanceToStructure < collisionRadius + 3 && dot > 0 && dot < rayLength) {
        obstacleAhead = true;
        
        // Find avoidance direction
        const rightVector = new THREE.Vector3(-botDirection.z, 0, botDirection.x);
        
        // Calculate which side has more room
        const rightDot = rightVector.x * toStructure.x + rightVector.z * toStructure.z;
        
        // Turn away from obstacle
        if (rightDot > 0) {
          // Structure is to the right, turn left
          inputs.left = true;
          inputs.right = false;
        } else {
          // Structure is to the left, turn right
          inputs.right = true;
          inputs.left = false;
        }
        
        // Slow down near obstacles
        if (distanceToStructure < collisionRadius + 1) {
          inputs.forward = false;
        }
      }
    });
    
    // Also check for other players to avoid bumping into them
    if (!obstacleAhead) {
      Object.entries(this.gameState.players).forEach(([playerId, player]) => {
        // Skip ourselves, dead players, and target (if we're attacking)
        if (playerId === this.botId || !player.isAlive || 
           (this.targetType === 'player' && playerId === this.target)) return;
        
        // Vector from bot to player
        const toPlayer = {
          x: player.position.x - bot.position.x,
          y: 0,
          z: player.position.z - bot.position.z
        };
        
        // Distance to player
        const distanceToPlayer = Math.sqrt(toPlayer.x ** 2 + toPlayer.z ** 2);
        
        // Dot product to see if we're heading towards the player
        const dot = botDirection.x * toPlayer.x + botDirection.z * toPlayer.z;
        
        // Collision radius (player scale affects this)
        let playerScale = 1.0;
        if (player.stats && player.stats.processorCounts) {
          const totalProcessors = Object.values(player.stats.processorCounts)
            .reduce((sum, count) => sum + count, 0);
          playerScale = 1.0 + (totalProcessors * 0.005);
        }
        
        const collisionRadius = 0.75 * playerScale;
        
        // If player is close, in front of us, and we'd hit them soon
        if (distanceToPlayer < collisionRadius + 2 && dot > 0 && dot < rayLength) {
          // Find avoidance direction
          const rightVector = new THREE.Vector3(-botDirection.z, 0, botDirection.x);
          
          // Calculate which side has more room
          const rightDot = rightVector.x * toPlayer.x + rightVector.z * toPlayer.z;
          
          // Turn away from player
          if (rightDot > 0) {
            // Player is to the right, turn left
            inputs.left = true;
            inputs.right = false;
          } else {
            // Player is to the left, turn right
            inputs.right = true;
            inputs.left = false;
          }
          
          // Slow down very close to players
          if (distanceToPlayer < collisionRadius + 0.5) {
            inputs.forward = false;
          }
        }
      });
    }
  }
  
  estimateBotSideCannonCount(bot) {
    // This is an approximation as we don't have access to the actual botSideCannons
    // Try to estimate based on total processors - more processors likely means more side cannons
    const totalProcessors = this.calculateTotalProcessors(bot);
    
    // Guessing cannons based on processors (adjust as needed)
    if (totalProcessors > 50) return 4; // Likely has max cannons
    if (totalProcessors > 30) return 3;
    if (totalProcessors > 15) return 2;
    if (totalProcessors > 5) return 1;
    return 0;
  }
  
  calculateDistance(pos1, pos2) {
    if (!pos1 || !pos2) return Infinity;
    
    return Math.sqrt(
      (pos2.x - pos1.x) ** 2 +
      (pos2.y - pos1.y) ** 2 +
      (pos2.z - pos1.z) ** 2
    );
  }
  
  handleEvent(event, data) {
    // Process game events
    switch (event) {
      case 'playerDamaged':
        if (data.id === this.botId) {
          // We're being attacked, update danger level
          this.dangerLevel += data.damage * 2;
          
          // If in collection mode and heavily damaged, switch to retreat
          if (this.state === 'collecting' && data.hp < this.healthRetreatThreshold) {
            this.state = 'retreating';
            this.findRetreatDirection(this.gameState.players[this.botId]);
          }
          
          // Try to identify attacker for counterattack later
          if (data.attackerId) {
            this.attackingPlayer = data.attackerId;
          }
        }
        // If our target is getting attacked, opportunistically join in
        else if (this.targetType === 'player' && data.id === this.target) {
          // Target is even weaker now, maintain attack
          this.lastTargetUpdateTime = Date.now(); // Reset timer to stick with this target
        }
        break;
        
      case 'playerKilled':
        // If our target died, find a new one
        if (this.targetType === 'player' && data.id === this.target) {
          this.target = null;
          this.targetType = null;
          this.state = 'collecting'; // Default back to collecting
          
          // If we were the killer, gain a confidence boost
          if (data.killerId === this.botId) {
            this.dangerLevel = Math.max(0, this.dangerLevel - 20);
          }
        }
        // If our attacker died, reduce danger
        if (this.attackingPlayer === data.id) {
          this.attackingPlayer = null;
          this.dangerLevel = Math.max(0, this.dangerLevel - 15);
        }
        break;
        
      case 'processorCollected':
        // If someone collected a processor we were heading for
        if (this.targetType === 'processor' && data.id === this.target) {
          this.target = null;
          this.targetType = null;
        }
        break;
        
      case 'cannonCollected':
        // If someone collected a cannon we were heading for
        if (this.targetType === 'cannon' && data.id === this.target) {
          this.target = null;
          this.targetType = null;
        }
        break;
        
      case 'structureDestroyed':
        // Update internal state if needed
        break;
    }
  }
}
