class ClaudeBot {
  constructor(botId, io, gameState, emitAction) {
    // Propriétés de base
    this.id = botId;
    this.io = io;
    this.gameState = gameState;
    this.emitAction = emitAction;
    
    // État du bot
    this.lastUpdateTime = Date.now();
    this.updateInterval = 100; // milliseconds
    this.isAlive = true;
    this.lastShootTime = 0;
    
    // Gestion des obstacles
    this.obstacles = [];
    this.avoidanceRadius = 3; // Distance à maintenir avec les obstacles
    this.stuckCounter = 0;
    this.lastPosition = null;
    
    // Paramètres de déplacement
    this.pathfindingMode = 'direct'; // 'direct', 'detour', ou 'random'
    this.detourAngle = 0; // Angle pour contourner les obstacles
    
    // Gestion des retours d'état du serveur
    this.pendingActions = {};        // Actions en attente de confirmation
    this.actionTimeout = 2000;       // Délai d'expiration pour les actions (ms)
    this.positionRejections = 0;     // Compteur de rejets de position
    this.lastServerState = null;     // Dernier état connu validé par le serveur
    this.serverSyncCounter = 0;      // Compteur pour forcer une synchronisation périodique
    
    console.log(`ClaudeBot with obstacle avoidance and server feedback handling initialized with ID: ${this.id}`);
  }
  
  update(gameState) {
  update(gameState) {
    // Mettre à jour notre référence à l'état du jeu
    this.gameState = gameState;
    
    // Calculer le delta de temps
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Ne prendre des décisions qu'à des intervalles spécifiques pour éviter le spam
    if (deltaTime < this.updateInterval) return;
    
    // Obtenir l'état actuel de notre bot
    const me = this.getMyState();
    if (!me || !me.isAlive) {
      this.isAlive = me ? me.isAlive : false;
      return;
    }
    
    // Mettre à jour l'état "vivant"
    this.isAlive = true;
    
    // Mettre à jour la liste des obstacles
    this.updateObstacles();
    
    // Vérifier si on est coincé
    this.checkIfStuck(me);
    
    // Vérifier les actions en attente et supprimer celles expirées
    this.cleanupPendingActions(currentTime);
    
    // Fonction principale : trouver et collecter le processeur le plus proche
    this.findAndCollectProcessor(me);
    
    // Stocker la position actuelle pour la détection "coincé"
    this.lastPosition = {...me.position};
    
    // Stocker le dernier état connu du serveur
    this.lastServerState = me;
    
    // Incrémenter le compteur de synchronisation
    this.serverSyncCounter++;
    
    // Forcer une synchronisation périodique avec le serveur
    if (this.serverSyncCounter >= 100) { // Toutes les ~10 secondes (100 * 100ms)
      this.serverSyncCounter = 0;
      this.requestServerSync();
    }
  }
  
  // Récupérer l'état actuel de notre bot dans l'état du jeu
  getMyState() {
    return this.gameState.players[this.id];
  }
  
  // Nouvelle méthode pour demander explicitement une synchronisation
  requestServerSync() {
    this.emitAction(this.id, 'requestGameState', {});
    console.log(`Bot ${this.id} requested server sync`);
  }
  
  // Nettoyer les actions en attente expirées
  cleanupPendingActions(currentTime) {
    Object.keys(this.pendingActions).forEach(actionId => {
      const action = this.pendingActions[actionId];
      if (currentTime - action.timestamp > this.actionTimeout) {
        console.log(`Action ${actionId} expired without response, retry logic triggered`);
        
        // Si c'était une action importante, la retenter
        if (action.type === 'movement' || action.type === 'processorCollection') {
          this.retryAction(action);
        }
        
        // Supprimer l'action expirée
        delete this.pendingActions[actionId];
      }
    });
  }
  
  // Nouvelle méthode pour réessayer une action échouée
  retryAction(action) {
    // Pour l'instant, juste demander une synchronisation
    this.requestServerSync();
    
    // Si trop d'échecs de mouvement, passer temporairement en mode aléatoire
    if (action.type === 'movement') {
      this.positionRejections++;
      
      if (this.positionRejections >= 3) {
        console.log(`Bot ${this.id} has ${this.positionRejections} position rejections, switching to random movement`);
        this.pathfindingMode = 'random';
        this.randomMovement();
        
        // Réinitialiser après un délai
        setTimeout(() => {
          this.positionRejections = 0;
          this.pathfindingMode = 'direct';
        }, 3000);
      }
    }
  }
  
  // Mettre à jour la liste des obstacles
  updateObstacles() {
    this.obstacles = [];
    
    // Ajouter les structures statiques comme obstacles
    if (this.gameState.structures) {
      Object.values(this.gameState.structures).forEach(structure => {
        if (structure.type === 'waterTower' || structure.type === 'tree') {
          // Ignorer les structures détruites
          if (!structure.destroyed) {
            this.obstacles.push({
              position: structure.position,
              // Rayon plus grand pour le château d'eau, plus petit pour les arbres
              radius: structure.type === 'waterTower' ? 6 : 2
            });
          }
        }
      });
    }
    
    // Ajouter également les autres joueurs comme obstacles
    if (this.gameState.players) {
      Object.values(this.gameState.players).forEach(player => {
        // Ne pas s'éviter soi-même
        if (player.id !== this.id && player.isAlive) {
          this.obstacles.push({
            position: player.position,
            radius: 1.5  // Rayon d'évitement pour les joueurs
          });
        }
      });
    }
  }
  
  // Vérifier si le bot est coincé
  checkIfStuck(me) {
    if (!this.lastPosition) return;
    
    const distance = this.calculateDistance(me.position, this.lastPosition);
    
    // Si on a à peine bougé pendant plusieurs mises à jour, on est peut-être coincé
    if (distance < 0.01) {
      this.stuckCounter++;
      
      // Coincé trop longtemps (environ 2 secondes)
      if (this.stuckCounter > 20) {
        console.log(`Bot ${this.id} is stuck, changing movement strategy`);
        this.stuckCounter = 0;
        
        // Passer en mode aléatoire pour s'échapper
        this.pathfindingMode = 'random';
        this.randomMovement();
        
        // Forcer une synchronisation avec le serveur
        this.requestServerSync();
        
        // Revenir au mode direct après un délai
        setTimeout(() => {
          this.pathfindingMode = 'direct';
        }, 1500);
      }
    } else {
      this.stuckCounter = 0; // Réinitialiser le compteur si on bouge
    }
  }
  
  // Fonction principale pour trouver et collecter le processeur le plus proche
  findAndCollectProcessor(me) {
    // En mode aléatoire (pour s'échapper), ne pas chercher de processeur
    if (this.pathfindingMode === 'random') {
      return;
    }
    
    // Obtenir tous les processeurs du jeu
    const processors = Object.values(this.gameState.processors);
    if (processors.length === 0) {
      // Aucun processeur trouvé, se déplacer aléatoirement
      this.randomMovement();
      return;
    }
    
    // Trouver le processeur le plus proche
    let closestProcessor = null;
    let minDistance = Infinity;
    
    processors.forEach(processor => {
      const distance = this.calculateDistance(me.position, processor.position);
      if (distance < minDistance) {
        minDistance = distance;
        closestProcessor = processor;
      }
    });
    
    if (closestProcessor) {
      // Si on est assez proche, tenter de collecter le processeur
      if (minDistance < 1.5) {
        this.collectProcessor(closestProcessor.id);
      } else {
        // On a trouvé un processeur, se déplacer vers lui en évitant les obstacles
        this.moveTowardTarget(me, closestProcessor.position);
      }
    } else {
      // Aucun processeur accessible, se déplacer aléatoirement
      this.randomMovement();
    }
  }
  
  // Nouvelle méthode pour collecter un processeur
  collectProcessor(processorId) {
    const actionId = `collect-${Date.now()}`;
    
    // Enregistrer l'action en attente
    this.pendingActions[actionId] = {
      type: 'processorCollection',
      processorId: processorId,
      timestamp: Date.now()
    };
    
    // Émettre l'action de collecte
    this.emitAction(this.id, 'processorCollected', {
      processorId: processorId
    });
    
    console.log(`Bot ${this.id} attempting to collect processor ${processorId}`);
  }
  
  // Se déplacer vers une cible en évitant les obstacles
  moveTowardTarget(me, targetPosition) {
    // Calculer la direction directe vers la cible
    const directDirection = this.getDirectionToTarget(me.position, targetPosition);
    
    // Vérifier s'il y a des obstacles sur le chemin
    const hasObstacle = this.checkForObstacles(me.position, targetPosition);
    
    if (!hasObstacle || this.pathfindingMode === 'direct') {
      // Pas d'obstacle ou mode direct forcé, aller tout droit
      this.pathfindingMode = 'direct';
      this.moveInDirection(me, directDirection);
    } else {
      // Obstacle détecté, passer en mode détour
      this.pathfindingMode = 'detour';
      this.navigateAroundObstacle(me, targetPosition);
    }
  }
  
  // Naviguer autour des obstacles pour atteindre une cible
  navigateAroundObstacle(me, targetPosition) {
    // Trouver l'obstacle le plus proche sur notre chemin
    const obstacleInPath = this.findClosestObstacleInPath(me.position, targetPosition);
    
    if (!obstacleInPath) {
      // Pas d'obstacle trouvé, revenir au mode direct
      this.pathfindingMode = 'direct';
      const direction = this.getDirectionToTarget(me.position, targetPosition);
      this.moveInDirection(me, direction);
      return;
    }
    
    // Calculer la direction originale vers la cible
    const originalDirection = this.getDirectionToTarget(me.position, targetPosition);
    
    // Si on n'a pas encore d'angle de détour, en choisir un
    if (this.detourAngle === 0) {
      // Choisir aléatoirement entre contourner par la gauche ou la droite
      this.detourAngle = Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2;
    }
    
    // Calculer la direction de détour (perpendiculaire à la direction originale)
    const detourDirection = {
      x: Math.cos(this.detourAngle) * originalDirection.x - Math.sin(this.detourAngle) * originalDirection.z,
      z: Math.sin(this.detourAngle) * originalDirection.x + Math.cos(this.detourAngle) * originalDirection.z
    };
    
    // Se déplacer dans la direction de détour
    this.moveInDirection(me, detourDirection);
    
    // Vérifier si on peut maintenant aller directement à la cible
    // (quand on a suffisamment contourné l'obstacle)
    const newStart = {
      x: me.position.x + detourDirection.x * 2, // Projection de notre prochaine position
      y: me.position.y,
      z: me.position.z + detourDirection.z * 2
    };
    
    if (!this.checkForObstacles(newStart, targetPosition)) {
      // On peut revenir au chemin direct
      this.pathfindingMode = 'direct';
      this.detourAngle = 0;
    }
  }
  
  // Trouver l'obstacle le plus proche sur notre chemin
  findClosestObstacleInPath(start, end) {
    const direction = this.getDirectionToTarget(start, end);
    const distance = this.calculateDistance(start, end);
    
    let closestObstacle = null;
    let minDistance = Infinity;
    
    for (const obstacle of this.obstacles) {
      // Calculer le vecteur du début à l'obstacle
      const obstacleVector = {
        x: obstacle.position.x - start.x,
        z: obstacle.position.z - start.z
      };
      
      // Calculer le produit scalaire de la direction et du vecteur de l'obstacle
      const dotProduct = direction.x * obstacleVector.x + direction.z * obstacleVector.z;
      
      // Ne considérer que les obstacles devant nous
      if (dotProduct <= 0) continue;
      
      // Calculer le point le plus proche sur la ligne par rapport à l'obstacle
      const projectionLength = Math.min(dotProduct, distance);
      
      const closestPoint = {
        x: start.x + direction.x * projectionLength,
        z: start.z + direction.z * projectionLength
      };
      
      // Calculer la distance du point le plus proche à l'obstacle
      const obstacleDistance = Math.sqrt(
        Math.pow(closestPoint.x - obstacle.position.x, 2) +
        Math.pow(closestPoint.z - obstacle.position.z, 2)
      );
      
      // Si la distance est inférieure au rayon de l'obstacle plus notre rayon d'évitement,
      // alors l'obstacle est sur notre chemin
      if (obstacleDistance < obstacle.radius + this.avoidanceRadius) {
        // Garder l'obstacle le plus proche
        if (projectionLength < minDistance) {
          minDistance = projectionLength;
          closestObstacle = obstacle;
        }
      }
    }
    
    return closestObstacle;
  }
  
  // Vérifier s'il y a des obstacles entre deux points
  checkForObstacles(start, end) {
    const direction = this.getDirectionToTarget(start, end);
    const distance = this.calculateDistance(start, end);
    
    for (const obstacle of this.obstacles) {
      // Calculer le vecteur du début à l'obstacle
      const obstacleVector = {
        x: obstacle.position.x - start.x,
        z: obstacle.position.z - start.z
      };
      
      // Calculer le produit scalaire
      const dotProduct = direction.x * obstacleVector.x + direction.z * obstacleVector.z;
      
      // Ne considérer que les obstacles devant nous
      if (dotProduct <= 0) continue;
      
      // Calculer le point le plus proche sur la ligne
      const projectionLength = Math.min(dotProduct, distance);
      
      const closestPoint = {
        x: start.x + direction.x * projectionLength,
        z: start.z + direction.z * projectionLength
      };
      
      // Calculer la distance du point le plus proche à l'obstacle
      const obstacleDistance = Math.sqrt(
        Math.pow(closestPoint.x - obstacle.position.x, 2) +
        Math.pow(closestPoint.z - obstacle.position.z, 2)
      );
      
      // Si la distance est inférieure au rayon de l'obstacle, alors la ligne intersecte l'obstacle
      if (obstacleDistance < obstacle.radius + 0.5) {
        return true;
      }
    }
    
    return false;
  }
  
  // Calculer la direction du point de départ vers la cible
  getDirectionToTarget(start, target) {
    // Calculer le vecteur du départ vers la cible
    const vecX = target.x - start.x;
    const vecZ = target.z - start.z;
    
    // Calculer la magnitude
    const magnitude = Math.sqrt(vecX * vecX + vecZ * vecZ);
    
    // Normaliser le vecteur
    if (magnitude > 0) {
      return {
        x: vecX / magnitude,
        z: vecZ / magnitude
      };
    } else {
      // Direction par défaut si le départ et la cible sont identiques
      return { x: 1, z: 0 };
    }
  }
  
	// Se déplacer dans une direction donnée
	moveInDirection(me, direction) {
	  // Obtenir l'état actuel du bot si non fourni
	  if (!me) {
		me = this.getMyState();
		if (!me) return; // Si on ne peut pas obtenir l'état, abandonner
	  }
	  
	  // Normaliser la direction si ce n'est pas déjà fait
	  const magnitude = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
	  
	  const normalizedDirection = {
		x: direction.x / magnitude,
		z: direction.z / magnitude
	  };
	  
	  // Calculer l'angle de rotation
	  const angle = Math.atan2(normalizedDirection.x, normalizedDirection.z);
	  
	  // Calculer la nouvelle position en appliquant la vitesse
	  const speed = me.stats?.speed || 0.02;
	  const deltaTime = Date.now() - this.lastUpdateTime;
	  const moveDistance = speed * (deltaTime / 16); // Normaliser par rapport à ~60 FPS
	  
	  const newPosition = {
		x: me.position.x + normalizedDirection.x * moveDistance,
		y: me.position.y, // Maintenir la même hauteur Y
		z: me.position.z + normalizedDirection.z * moveDistance
	  };
	  
	  // Émettre le mouvement avec la nouvelle position
	  this.emitAction(this.id, 'playerUpdate', {
		position: newPosition,
		direction: {
		  x: normalizedDirection.x,
		  y: 0,
		  z: normalizedDirection.z
		},
		rotation: angle
	  });
	}
  
  // Déplacement aléatoire
  randomMovement() {
    // Générer une direction aléatoire
    const angle = Math.random() * Math.PI * 2;
    
    const direction = {
      x: Math.sin(angle),
      z: Math.cos(angle)
    };
    
    // Se déplacer dans cette direction
    this.moveInDirection(null, direction);
  }
  
  // Calculer la distance entre deux points
  calculateDistance(a, b) {
    return Math.sqrt(
      Math.pow(b.x - a.x, 2) +
      Math.pow(b.z - a.z, 2)
    );
  }
  
  // Gérer les actions reçues du serveur
  handleAction(action, data) {
    switch (action) {
      case 'playerKilled':
        if (data.id === this.id) {
          this.isAlive = false;
          console.log(`Bot ${this.id} died`);
        }
        break;
        
      case 'positionReset':
        // Le serveur a rejeté notre position
        this.positionRejections++;
        console.log(`Bot ${this.id} position rejected by server (${this.positionRejections} times)`);
        
        // Si la position est rejetée trop souvent, passer temporairement en mode aléatoire
        if (this.positionRejections >= 3) {
          console.log(`Bot ${this.id} switching to random movement due to position rejections`);
          this.pathfindingMode = 'random';
          this.randomMovement();
          
          // Réinitialiser après un délai
          setTimeout(() => {
            this.positionRejections = 0;
            this.pathfindingMode = 'direct';
          }, 3000);
        }
        break;
        
      case 'gameState':
        // Mise à jour de l'état du jeu
        if (data.players && data.players[this.id]) {
          // Mettre à jour notre état stocké
          this.lastServerState = data.players[this.id];
          console.log(`Bot ${this.id} received state sync from server`);
        }
        break;
        
      case 'processorRemoved':
        // Un processeur a été supprimé (potentiellement collecté par nous)
        // Rechercher et supprimer l'action en attente correspondante
        Object.keys(this.pendingActions).forEach(actionId => {
          const action = this.pendingActions[actionId];
          if (action.type === 'processorCollection' && action.processorId === data.id) {
            console.log(`Bot ${this.id} successfully collected processor ${data.id}`);
            delete this.pendingActions[actionId];
          }
        });
        break;
        
      case 'playerStatsUpdated':
        // Nos statistiques ont été mises à jour (après collecte d'un processeur, etc.)
        if (data.id === this.id) {
          console.log(`Bot ${this.id} stats updated`);
        }
        break;
    }
  }
}

module.exports = ClaudeBot;
