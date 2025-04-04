// claude-bot.js
class ClaudeBot {
  constructor(botId, io, gameState, emitAction) {
    this.id = botId;
    this.io = io;
    this.gameState = gameState;
    this.emitAction = emitAction;
    this.lastMoveTime = Date.now();
    this.lastAttackTime = Date.now();
    this.moveInterval = 2000;
    this.attackCooldown = 1000;
    this.initialized = false;
  }


  update(gameState) {
    // Vérifier si le bot est dans l'état du jeu
    const botData = gameState.players[this.id];
    
    if (!botData) {
      console.log(`Bot ${this.id} non trouvé dans gameState. Attente d'initialisation...`);
      return;
    }
    // First successful update - log initialization
    if (!this.initialized) {
      console.log(`Bot ${this.id} initialized at position:`, botData.position);
      this.initialized = true;
    }
	
    if (!botData.isAlive) return;
    
    console.log(`Bot ${this.id} opérationnel à position:`, botData.position);

    // Reste du code comme avant...
    const now = Date.now();
    
    // Logique de recherche de cible
    this.findTarget(gameState, botData);
    
    // Logique de mouvement
    if (now - this.lastMoveTime > this.moveInterval) {
      this.moveTowardsTarget(botData);
      this.lastMoveTime = now;
    }
    
    // Logique d'attaque
    if (now - this.lastAttackTime > this.attackCooldown) {
      this.attackNearbyPlayer(gameState, botData);
    }
  }
  
  findTarget(gameState, botData) {
    let closestDistance = Infinity;
    let closestTarget = null;
    let targetType = null;
    
    // Check for processors first (priority target)
    for (const id in gameState.processors) {
      const processor = gameState.processors[id];
      const distance = this.calculateDistance(botData.position, processor.position);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestTarget = processor;
        targetType = 'processor';
      }
    }
    
    // Check for players if no processor is close enough
    if (closestDistance > 30) {
      for (const id in gameState.players) {
        // Skip self
        if (id === this.id) continue;
        
        const player = gameState.players[id];
        if (player.isAlive) {
          const distance = this.calculateDistance(botData.position, player.position);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestTarget = player;
            targetType = 'player';
          }
        }
      }
    }
    
    this.target = closestTarget;
    this.targetType = targetType;
  }
  
  moveTowardsTarget(botData) {
    // If we have a target, move towards it
    if (this.target) {
      // Calculate direction vector
      const dirX = this.target.position.x - botData.position.x;
      const dirZ = this.target.position.z - botData.position.z;
      
      // Normalize direction
      const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
      this.direction = {
        x: dirX / length,
        y: 0,
        z: dirZ / length
      };
      
      // Calculate rotation from direction
      const rotation = Math.atan2(this.direction.x, this.direction.z);
      
      // Update position based on direction
      const newPosition = {
        x: botData.position.x + this.direction.x * botData.stats.speed * 50,
        y: botData.position.y,
        z: botData.position.z + this.direction.z * botData.stats.speed * 50
      };
      
      // Send move update
      this.emitAction(this.id, 'playerUpdate', {
        position: newPosition,
        rotation: rotation,
        direction: this.direction
      });
    } else {
      // Random movement if no target
      const angle = Math.random() * Math.PI * 2;
      this.direction = {
        x: Math.sin(angle),
        y: 0,
        z: Math.cos(angle)
      };
      
      const newPosition = {
        x: botData.position.x + this.direction.x * botData.stats.speed * 50,
        y: botData.position.y,
        z: botData.position.z + this.direction.z * botData.stats.speed * 50
      };
      
      this.emitAction(this.id, 'playerUpdate', {
        position: newPosition,
        rotation: angle,
        direction: this.direction
      });
    }
  }
  
  attackNearbyPlayer(gameState, botData) {
    for (const id in gameState.players) {
      // Skip self
      if (id === this.id) continue;
      
      const player = gameState.players[id];
      if (player.isAlive) {
        const distance = this.calculateDistance(botData.position, player.position);
        
        // If player is in attack range, shoot
        if (distance <= botData.stats.range) {
          // Calculate direction to player
          const dirX = player.position.x - botData.position.x;
          const dirZ = player.position.z - botData.position.z;
          
          // Normalize direction
          const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
          const shootDirection = {
            x: dirX / length,
            y: 0,
            z: dirZ / length
          };
          
          // Shoot
          this.emitAction(this.id, 'playerShoot', {
            position: botData.position,
            direction: shootDirection
          });
          
          this.lastAttackTime = Date.now();
          return; // Only shoot at one player per update
        }
      }
    }
  }
  
  // Helper to calculate distance between two positions
  calculateDistance(pos1, pos2) {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.y - pos1.y, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }
  
  // Optional: handle events related to this bot
  handleAction(action, data) {
    // Handle specific events if needed
  }
}

module.exports = ClaudeBot;
