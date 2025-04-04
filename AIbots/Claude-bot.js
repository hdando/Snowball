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
  
	moveTowardsTarget(targetPosition) {
	  // Vérifier si les positions sont définies
	  if (!this.position || !targetPosition) return;
	  
	  // Calculer la direction vers la cible
	  const direction = this.getDirectionTowards(targetPosition);
	  
	  // Mettre à jour la rotation et la direction
	  const rotation = Math.atan2(direction.x, direction.z);
	  this.emitAction('playerUpdate', {
		rotation: rotation,
		direction: direction
	  });
	  
	  // Utiliser la vitesse des stats ou une valeur par défaut si non disponible
	  const speed = (this.stats && typeof this.stats.speed === 'number') 
		? this.stats.speed 
		: 0.02;
	  
	  // Calculer la nouvelle position en se déplaçant vers la cible
	  const newPosition = {
		x: this.position.x + direction.x * speed,
		y: 0.5, // Fixer la hauteur au niveau du sol
		z: this.position.z + direction.z * speed
	  };
	  
	  // Limiter le mouvement dans les limites de la carte
	  const mapRadius = 98; // Légèrement inférieur à la limite de 100
	  const distanceFromCenter = Math.sqrt(
		newPosition.x * newPosition.x + 
		newPosition.z * newPosition.z
	  );
	  
	  // Si la position est en dehors des limites, ajuster
	  if (distanceFromCenter > mapRadius) {
		const scale = mapRadius / distanceFromCenter;
		newPosition.x *= scale;
		newPosition.z *= scale;
	  }
	  
	  // Envoyer la mise à jour de position
	  this.emitAction('playerUpdate', {
		position: newPosition
	  });
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
