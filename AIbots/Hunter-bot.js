class AdvancedBot {
  constructor(botId, gameState, sendInputs) {
    // Propriétés de base
    this.id = botId;
    this.gameState = gameState;
    this.sendInputs = sendInputs;
    
    // États du bot
    this.BEHAVIOR = {
      COLLECTING_PROCESSORS: 'collecting_processors',
      COLLECTING_CANNONS: 'collecting_cannons',
      HUNTING: 'hunting'
    };
    
    // État initial
    this.currentBehavior = this.BEHAVIOR.COLLECTING_PROCESSORS;
    
    // Compteurs et suivi
    this.processorCount = 0;
    this.cannonCount = 0;
    
    // Autres propriétés
    this.lastUpdateTime = Date.now();
    this.updateInterval = 100;
    this.isAlive = true;
    this.shootCooldown = 3000; // Normal en mode collecte
    this.lastShootTime = 0;
    this.randomMoveTime = 0;
    this.randomMoveDirection = { left: false, right: false };
    
    // Propriétés spécifiques à la chasse
    this.currentTarget = null;
    this.targetUpdateTime = 0;
    this.targetUpdateInterval = 2000; // Mettre à jour la cible toutes les 2 secondes
    
    console.log(`AdvancedBot initialized with ID: ${this.id}`);
  }
  
  update(gameState) {
    // Mise à jour de l'état du jeu
    this.gameState = gameState;
    
    // Obtenir mon état actuel
    const me = this.getMyState();
    if (!me || !me.isAlive) {
      this.sendInputs({
        forward: false,
        backward: false,
        left: false,
        right: false,
        fire: false
      });
      return;
    }
    
    // Mettre à jour les compteurs depuis l'état du jeu
    this.updateCounters(me);
    
    // Mettre à jour le comportement en fonction des compteurs
    this.updateBehavior();
    
    const currentTime = Date.now();
    
    // Décider si on tire (tous les X secondes)
    const shouldFire = currentTime - this.lastShootTime > this.shootCooldown;
    if (shouldFire) {
      this.lastShootTime = currentTime;
    }
    
    // Si on est en mode mouvement aléatoire (après collision)
    if (currentTime < this.randomMoveTime) {
      this.sendRandomMovement(shouldFire);
      return;
    }
    
    // Logique en fonction du comportement actuel
    switch (this.currentBehavior) {
      case this.BEHAVIOR.COLLECTING_PROCESSORS:
        this.behaviorCollectProcessors(me, shouldFire);
        break;
      case this.BEHAVIOR.COLLECTING_CANNONS:
        this.behaviorCollectCannons(me, shouldFire);
        break;
      case this.BEHAVIOR.HUNTING:
        this.behaviorHunt(me, shouldFire);
        break;
    }
  }
  
  // Récupérer l'état actuel du bot
  getMyState() {
    return this.gameState.players[this.id];
  }
  
  // Mettre à jour les compteurs
  updateCounters(me) {
    if (me.stats && me.stats.processorCounts) {
      this.processorCount = Object.values(me.stats.processorCounts).reduce((sum, count) => sum + count, 0);
    }
    
    // Le nombre de canons est géré via handleEvent
  }
  
  // Mettre à jour le comportement
  updateBehavior() {
    if (this.currentBehavior === this.BEHAVIOR.COLLECTING_PROCESSORS && this.processorCount >= 50) {
      this.currentBehavior = this.BEHAVIOR.COLLECTING_CANNONS;
      console.log(`Bot ${this.id} passe en mode collecte de canons`);
    } else if (this.currentBehavior === this.BEHAVIOR.COLLECTING_CANNONS && this.cannonCount >= 4) {
      this.currentBehavior = this.BEHAVIOR.HUNTING;
      console.log(`Bot ${this.id} passe en mode chasse`);
      
      // Réduire le cooldown de tir pour être plus agressif en mode chasse
      this.shootCooldown = 1000; // 1 seconde
    }
  }
  
  // Comportement: collecter des processeurs
  behaviorCollectProcessors(me, shouldFire) {
    // Trouver le processeur le plus proche
    const closestProcessor = this.findClosestProcessor(me.position);
    
    if (closestProcessor) {
      // On a trouvé un processeur, se diriger vers lui
      this.moveTowardsTarget(me, closestProcessor.position, shouldFire);
    } else {
      // Aucun processeur trouvé, faire un mouvement aléatoire
      this.sendRandomMovement(shouldFire);
    }
  }
  
  // Comportement: collecter des canons
  behaviorCollectCannons(me, shouldFire) {
    // Trouver le canon le plus proche
    const closestCannon = this.findClosestCannon(me.position);
    
    if (closestCannon) {
      // On a trouvé un canon, se diriger vers lui
      this.moveTowardsTarget(me, closestCannon.position, shouldFire);
    } else {
      // Aucun canon trouvé, chercher des processeurs comme backup
      const closestProcessor = this.findClosestProcessor(me.position);
      
      if (closestProcessor) {
        this.moveTowardsTarget(me, closestProcessor.position, shouldFire);
      } else {
        this.sendRandomMovement(shouldFire);
      }
    }
  }
  
  // Comportement: chasser les autres joueurs
  behaviorHunt(me, shouldFire) {
    const currentTime = Date.now();
    
    // Mettre à jour la cible périodiquement
    if (!this.currentTarget || currentTime - this.targetUpdateTime > this.targetUpdateInterval) {
      const newTarget = this.findClosestPlayer(me);
      
      if (newTarget) {
        this.currentTarget = {
          id: newTarget.id,
          position: { ...newTarget.position },
          lastSeen: currentTime
        };
        this.targetUpdateTime = currentTime;
      } else {
        this.currentTarget = null;
      }
    }
    
    // Vérifier si la cible existe toujours
    if (this.currentTarget) {
      const targetPlayer = this.gameState.players[this.currentTarget.id];
      
      if (targetPlayer && targetPlayer.isAlive) {
        // Mettre à jour la position connue de la cible
        this.currentTarget.position = { ...targetPlayer.position };
        this.currentTarget.lastSeen = currentTime;
        
        // Poursuivre la cible
        this.moveTowardsTarget(me, this.currentTarget.position, shouldFire, true);
      } else {
        // La cible n'existe plus ou est morte
        this.currentTarget = null;
      }
    }
    
    // Si pas de cible, chercher un processeur ou faire un mouvement aléatoire
    if (!this.currentTarget) {
      const closestProcessor = this.findClosestProcessor(me.position);
      
      if (closestProcessor) {
        this.moveTowardsTarget(me, closestProcessor.position, shouldFire);
      } else {
        this.sendRandomMovement(shouldFire);
      }
    }
  }
  
  // Trouver le processeur le plus proche
  findClosestProcessor(position) {
    const processors = Object.values(this.gameState.processors || {});
    
    if (processors.length === 0) {
      return null;
    }
    
    let closest = null;
    let minDistance = Infinity;
    
    processors.forEach(processor => {
      const distance = this.calculateDistance(position, processor.position);
      if (distance < minDistance) {
        minDistance = distance;
        closest = processor;
      }
    });
    
    return closest;
  }
  
  // Trouver le canon le plus proche
  findClosestCannon(position) {
    const cannons = Object.values(this.gameState.cannons || {});
    
    if (cannons.length === 0) {
      return null;
    }
    
    let closest = null;
    let minDistance = Infinity;
    
    cannons.forEach(cannon => {
      const distance = this.calculateDistance(position, cannon.position);
      if (distance < minDistance) {
        minDistance = distance;
        closest = cannon;
      }
    });
    
    return closest;
  }
  
  // Trouver le joueur le plus proche
  findClosestPlayer(me) {
    const players = Object.values(this.gameState.players || {});
    
    if (players.length <= 1) {
      return null; // Uniquement moi-même
    }
    
    let closest = null;
    let minDistance = Infinity;
    
    players.forEach(player => {
      // Ignorer moi-même, les bots et les joueurs morts
      if (player.id === this.id || !player.isAlive || player.id.startsWith('bot-')) {
        return;
      }
      
      const distance = this.calculateDistance(me.position, player.position);
      if (distance < minDistance) {
        minDistance = distance;
        closest = player;
      }
    });
    
    return closest;
  }
  
  // Se déplacer vers une cible
  moveTowardsTarget(me, targetPosition, shouldFire, isHunting = false) {
    // Calculer l'angle vers la cible
    const targetAngle = Math.atan2(
      targetPosition.x - me.position.x,
      targetPosition.z - me.position.z
    ) + Math.PI;
    
    // Angle actuel du bot
    const currentAngle = me.rotation;
    
    // Calculer la différence d'angle (en tenant compte des bords circulaires)
    let angleDiff = targetAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Tolérance d'angle pour avancer
    const angleTolerance = 0.3; // environ 17 degrés
    
    // Vérifier si un obstacle est sur le chemin (sauf en mode chasse)
    const hasObstacle = !isHunting && this.checkForObstacle(me, targetPosition);
    
    if (hasObstacle) {
      // Si obstacle, activer le mode mouvement aléatoire pendant 2 secondes
      this.randomMoveTime = Date.now() + 2000;
      this.sendRandomMovement(shouldFire);
      return;
    }
    
    // Envoyer les inputs en fonction de la position relative
    this.sendInputs({
      forward: Math.abs(angleDiff) < angleTolerance,
      backward: false,
      left: angleDiff > 0,
      right: angleDiff < 0,
      fire: shouldFire
    });
  }
  
  // Vérification d'obstacle
  checkForObstacle(me, targetPosition) {
    // Simplification : vérifier uniquement s'il y a un joueur ou une structure proche
    // sur le chemin direct vers la cible
    
    const direction = {
      x: targetPosition.x - me.position.x,
      z: targetPosition.z - me.position.z
    };
    
    // Normaliser la direction
    const distance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (distance === 0) return false;
    
    direction.x /= distance;
    direction.z /= distance;
    
    // Vérifier les autres joueurs (uniquement en mode collecte, pas en chasse)
    if (this.currentBehavior !== this.BEHAVIOR.HUNTING) {
      for (const playerId in this.gameState.players) {
        if (playerId === this.id) continue; // Ignorer soi-même
        
        const player = this.gameState.players[playerId];
        if (!player.isAlive) continue; // Ignorer les joueurs morts
        
        // Vecteur du bot à l'autre joueur
        const toPlayer = {
          x: player.position.x - me.position.x,
          z: player.position.z - me.position.z
        };
        
        // Distance au joueur
        const playerDist = Math.sqrt(toPlayer.x * toPlayer.x + toPlayer.z * toPlayer.z);
        if (playerDist > distance) continue; // Le joueur est plus loin que la cible
        
        // Projection du vecteur joueur sur la direction
        const dot = toPlayer.x * direction.x + toPlayer.z * direction.z;
        if (dot <= 0) continue; // Le joueur est derrière nous
        
        // Distance du joueur à la ligne de vue
        const projX = direction.x * dot;
        const projZ = direction.z * dot;
        const perpX = toPlayer.x - projX;
        const perpZ = toPlayer.z - projZ;
        const perpDist = Math.sqrt(perpX * perpX + perpZ * perpZ);
        
        if (perpDist < 1.5) return true; // Obstacle détecté
      }
    }
    
    // Vérifier les structures
    for (const structureId in this.gameState.structures) {
      const structure = this.gameState.structures[structureId];
      if (structure.destroyed) continue; // Ignorer les structures détruites
      
      // Vecteur du bot à la structure
      const toStructure = {
        x: structure.position.x - me.position.x,
        z: structure.position.z - me.position.z
      };
      
      // Distance à la structure
      const structDist = Math.sqrt(toStructure.x * toStructure.x + toStructure.z * toStructure.z);
      if (structDist > distance) continue; // La structure est plus loin que la cible
      
      // Projection du vecteur structure sur la direction
      const dot = toStructure.x * direction.x + toStructure.z * direction.z;
      if (dot <= 0) continue; // La structure est derrière nous
      
      // Distance de la structure à la ligne de vue
      const projX = direction.x * dot;
      const projZ = direction.z * dot;
      const perpX = toStructure.x - projX;
      const perpZ = toStructure.z - projZ;
      const perpDist = Math.sqrt(perpX * perpX + perpZ * perpZ);
      
      // Rayon de collision différent selon le type
      const collisionRadius = structure.type === 'waterTower' ? 5 : 2;
      
      if (perpDist < collisionRadius) return true; // Obstacle détecté
    }
    
    return false;
  }
  
  // Envoyer un mouvement aléatoire
  sendRandomMovement(shouldFire) {
    // Si nous n'avons pas encore choisi de direction aléatoire ou si c'est le moment de changer
    if (!this.randomMoveDirection.set || Math.random() < 0.05) {
      this.randomMoveDirection = {
        forward: Math.random() > 0.3, // 70% de chance d'avancer
        backward: false,
        left: Math.random() > 0.5, // 50% de chance de tourner à gauche
        right: Math.random() < 0.5, // 50% de chance de tourner à droite
        set: true
      };
      
      // Éviter de tourner à gauche et à droite en même temps
      if (this.randomMoveDirection.left && this.randomMoveDirection.right) {
        this.randomMoveDirection.right = false;
      }
    }
    
    // Envoyer les inputs aléatoires
    this.sendInputs({
      forward: this.randomMoveDirection.forward,
      backward: this.randomMoveDirection.backward,
      left: this.randomMoveDirection.left,
      right: this.randomMoveDirection.right,
      fire: shouldFire
    });
  }
  
  // Calcule la distance entre deux points
  calculateDistance(a, b) {
    return Math.sqrt(
      Math.pow(b.x - a.x, 2) +
      Math.pow(b.z - a.z, 2)
    );
  }
  
  // Traiter les événements du jeu
  handleEvent(event, data) {
    // Réagir lorsqu'on est touché
    if (event === 'playerDamaged' && data.id === this.id) {
      // Si on prend des dégâts, entrer en mode mouvement aléatoire pendant 1 seconde
      this.randomMoveTime = Date.now() + 1000;
      // Réinitialiser la direction aléatoire pour une nouvelle
      this.randomMoveDirection.set = false;
      
      // En mode chasse, si on est attaqué et qu'on connaît l'attaquant, le cibler
      if (this.currentBehavior === this.BEHAVIOR.HUNTING && data.killerId) {
        const attacker = this.gameState.players[data.killerId];
        if (attacker && attacker.isAlive) {
          this.currentTarget = {
            id: data.killerId,
            position: { ...attacker.position },
            lastSeen: Date.now()
          };
          this.targetUpdateTime = Date.now();
        }
      }
    }
    
    // Réagir lorsqu'on est tué
    if (event === 'playerKilled' && data.id === this.id) {
      this.isAlive = false;
    }
    
    // Suivi des processeurs collectés
    if (event === 'processorCollected' && data.playerId === this.id) {
      // Incrémenter notre compteur
      this.processorCount++;
      this.randomMoveTime = 0;
    }
    
    // Suivi des canons collectés
    if (event === 'cannonCollected' && data.playerId === this.id) {
      // Incrémenter notre compteur de canons
      this.cannonCount++;
      this.randomMoveTime = 0;
    }
    
    // Ajuster le comportement si nécessaire
    this.updateBehavior();
  }
}

module.exports = AdvancedBot;
