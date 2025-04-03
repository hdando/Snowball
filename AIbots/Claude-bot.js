class ClaudeBot {
  constructor(id, io, gameState, emitAction) {
    this.id = id;
    this.io = io;
    this.gameState = gameState;
    this.emitAction = (event, data) => emitAction(id, event, data);
    this.position = null;
    this.hp = 100;
    this.lastDecisionTime = Date.now();
    this.target = null;
    this.state = 'exploring'; // exploring, collecting, fighting
  }

  update(gameState) {
    // Ne pas prendre de décision trop souvent (simuler le temps de réflexion humain)
    const now = Date.now();
    if (now - this.lastDecisionTime < 100) return;
    this.lastDecisionTime = now;
    
    // Mettre à jour les connaissances du bot sur l'état du jeu
    this.updateGameKnowledge(gameState);
    
    // Prendre une décision en fonction de l'état actuel
    switch (this.state) {
      case 'exploring':
        this.explore();
        break;
      case 'collecting':
        this.collectProcessor();
        break;
      case 'fighting':
        this.fight();
        break;
    }
  }
  
  updateGameKnowledge(gameState) {
    // Mettre à jour notre position
    if (gameState.players[this.id]) {
      this.position = gameState.players[this.id].position;
      this.hp = gameState.players[this.id].hp;
      this.stats = gameState.players[this.id].stats;
    }
    
    // Analyser l'environnement
    this.nearbyProcessors = this.findNearbyProcessors(gameState.processors);
    this.nearbyPlayers = this.findNearbyPlayers(gameState.players);
    
    // Prendre une décision sur l'état
    this.decideState();
  }
  
  decideState() {
    // Priorité à la collecte si un processeur est proche
    if (this.nearbyProcessors.length > 0) {
      this.state = 'collecting';
      this.target = this.nearbyProcessors[0];
      return;
    }
    
    // Si un joueur avec moins de HP est proche, l'attaquer
    const vulnerablePlayer = this.nearbyPlayers.find(p => p.hp < this.hp);
    if (vulnerablePlayer) {
      this.state = 'fighting';
      this.target = vulnerablePlayer;
      return;
    }
    
    // Sinon, explorer
    this.state = 'exploring';
  }
  
  findNearbyProcessors(processors) {
    if (!this.position || !processors) return [];
    
    return Object.values(processors)
      .map(p => {
        const distance = this.calculateDistance(this.position, p.position);
        return { ...p, distance };
      })
      .filter(p => p.distance < 20)
      .sort((a, b) => a.distance - b.distance);
  }
  
  findNearbyPlayers(players) {
    if (!this.position || !players) return [];
    
    return Object.entries(players)
      .filter(([id, _]) => id !== this.id)
      .map(([id, player]) => {
        const distance = this.calculateDistance(this.position, player.position);
        return { id, ...player, distance };
      })
      .filter(p => p.distance < 15 && p.isAlive !== false)
      .sort((a, b) => a.distance - b.distance);
  }
  
  calculateDistance(pos1, pos2) {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.y - pos1.y, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }
  
  explore() {
    // Générer un mouvement aléatoire
    if (Math.random() < 0.3) {
      // Rotation aléatoire
      this.emitAction('playerUpdate', {
        rotation: Math.random() * Math.PI * 2,
        direction: this.getRandomDirection()
      });
    } else {
      // Avancer dans la direction actuelle
      this.moveForward();
    }
  }
  
  collectProcessor() {
    if (!this.target) {
      this.state = 'exploring';
      return;
    }
    
    // Déplacer vers le processeur
    this.moveTowards(this.target.position);
    
    // Si très proche, tenter de collecter
    if (this.calculateDistance(this.position, this.target.position) < 2) {
      this.emitAction('processorCollected', {
        processorId: this.target.id
      });
      this.target = null;
    }
  }
  
  fight() {
    if (!this.target || !this.target.isAlive) {
      this.state = 'exploring';
      return;
    }
    
    // Se déplacer vers la cible
    this.moveTowards(this.target.position);
    
    // Si à portée, tirer
    if (this.calculateDistance(this.position, this.target.position) < this.stats.range) {
      // Calculer la direction vers la cible
      const direction = this.getDirectionTowards(this.target.position);
      
      // Tirer
      this.emitAction('playerShoot', {
        position: this.position,
        direction: direction
      });
    }
  }
  
  moveForward() {
    const currentDirection = this.gameState.players[this.id]?.direction || { x: 0, y: 0, z: -1 };
    const newPosition = {
      x: this.position.x + currentDirection.x * this.stats.speed * 20,
      y: this.position.y,
      z: this.position.z + currentDirection.z * this.stats.speed * 20
    };
    
    this.emitAction('playerUpdate', {
      position: newPosition
    });
  }
  
  moveTowards(targetPosition) {
    // Calculer la direction vers la cible
    const direction = this.getDirectionTowards(targetPosition);
    
    // Mettre à jour la rotation et la direction
    const rotation = Math.atan2(direction.x, direction.z);
    this.emitAction('playerUpdate', {
      rotation: rotation,
      direction: direction
    });
    
    // Calculer la nouvelle position en se déplaçant vers la cible
    const newPosition = {
      x: this.position.x + direction.x * this.stats.speed * 20,
      y: this.position.y,
      z: this.position.z + direction.z * this.stats.speed * 20
    };
    
    // Envoyer la mise à jour de position
    this.emitAction('playerUpdate', {
      position: newPosition
    });
  }
  
  getDirectionTowards(targetPosition) {
    const dx = targetPosition.x - this.position.x;
    const dz = targetPosition.z - this.position.z;
    const magnitude = Math.sqrt(dx * dx + dz * dz);
    
    return {
      x: dx / magnitude,
      y: 0,
      z: dz / magnitude
    };
  }
  
  getRandomDirection() {
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.sin(angle),
      y: 0,
      z: Math.cos(angle)
    };
  }
  
  handleAction(action, data) {
    // Traiter les événements reçus du serveur
    switch (action) {
      case 'playerDamaged':
        if (data.id === this.id && this.hp < 30) {
          // Fuir si HP bas
          this.state = 'exploring';
        }
        break;
        
      case 'processorRemoved':
        if (this.target && this.target.id === data.id) {
          this.target = null;
          this.state = 'exploring';
        }
        break;
    }
  }
}

module.exports = ClaudeBot;