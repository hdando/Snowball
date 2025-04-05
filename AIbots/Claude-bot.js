class ClaudeBot {
  constructor(botId, gameState, sendInputs) {
    // Propriétés de base
    this.id = botId;
    this.gameState = gameState;
    this.sendInputs = sendInputs;
    
    // État du bot
    this.lastUpdateTime = Date.now();
    this.updateInterval = 100; // milliseconds
    this.isAlive = true;
    this.lastShootTime = 0;
    this.shootCooldown = 2000; // ms entre les tirs
    
    // Gestion des obstacles
    this.obstacles = [];
    this.avoidanceRadius = 3; // Distance à maintenir avec les obstacles
    this.lastPosition = null;
    
    // Paramètres de déplacement
    this.currentTarget = null;
    this.pathfindingMode = 'direct'; // 'direct', 'detour', ou 'random'
    this.randomModeEndTime = 0; // Temps de fin du mode aléatoire
    this.randomChangeInterval = 500; // ms entre les changements de direction aléatoires
    this.lastRandomChange = 0;
    
    // Comportement de collecte
    this.collectRadius = 1.5; // Rayon pour considérer un objet comme collecté
    this.lastProcessorId = null; // Dernier processeur ciblé
    
    console.log(`ClaudeBot initialized with new input system with ID: ${this.id}`);
  }
  
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
      // Envoyer des inputs nuls si on est mort
      this.sendInputs({
        forward: false,
        backward: false,
        left: false,
        right: false,
        fire: false
      });
      return;
    }
    
    // Mettre à jour l'état "vivant"
    this.isAlive = true;
    
    // Mettre à jour la liste des obstacles
    this.updateObstacles();
    
    // Déterminer les inputs en fonction de la stratégie actuelle
    let inputs;
    
    // Vérifier si on est en mode aléatoire temporaire
    if (this.pathfindingMode === 'random' && currentTime < this.randomModeEndTime) {
      inputs = this.getRandomInputs(currentTime);
    } else {
      // Mode normal - chercher et collecter des processeurs
      this.pathfindingMode = 'direct';
      inputs = this.getInputsForProcessorCollection(me, currentTime);
    }
    
    // Envoyer les inputs au gestionnaire de bot
    this.sendInputs(inputs);
    
    // Stocker la position actuelle pour la prochaine mise à jour
    this.lastPosition = {...me.position};
  }
  
  // Obtenir des inputs aléatoires pour sortir d'une situation bloquée
  getRandomInputs(currentTime) {
    // Changer les inputs aléatoirement à intervalles réguliers
    if (currentTime - this.lastRandomChange > this.randomChangeInterval) {
      this.lastRandomChange = currentTime;
      
      // Générer des inputs aléatoires
      const randomInputs = {
        forward: Math.random() > 0.3, // Favoriser le mouvement avant
        backward: Math.random() > 0.7, // Moins souvent en arrière
        left: Math.random() > 0.5,
        right: Math.random() > 0.5,
        fire: Math.random() > 0.9 // Tirer occasionnellement
      };
      
      // Éviter d'activer à la fois gauche et droite ou avant et arrière
      if (randomInputs.left && randomInputs.right) {
        randomInputs.right = false;
      }
      if (randomInputs.forward && randomInputs.backward) {
        randomInputs.backward = false;
      }
      
      return randomInputs;
    }
    
    // Si pas de changement prévu, conserver les inputs précédents (ils seront définis par le BotManager)
    return {
      forward: true, // Par défaut, continuer d'avancer en mode aléatoire
      backward: false,
      left: Math.random() > 0.5, // Changer aléatoirement la direction
      right: Math.random() > 0.5,
      fire: false
    };
  }
  
  // Déterminer les inputs pour collecter le processeur le plus proche
  getInputsForProcessorCollection(me, currentTime) {
    // Obtenir tous les processeurs du jeu
    const processors = Object.values(this.gameState.processors);
    if (processors.length === 0) {
      // Aucun processeur trouvé, se déplacer aléatoirement
      this.switchToRandomMode(currentTime, 2000); // Mode aléatoire pendant 2 secondes
      return this.getRandomInputs(currentTime);
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
    
    // Si on est assez proche du processeur, considérer qu'on l'a collecté
    if (minDistance < this.collectRadius) {
      // Continuer à avancer pour s'assurer de collecter le processeur
      return {
        forward: true,
        backward: false,
        left: false,
        right: false,
        fire: false
      };
    }
    
    // Vérifier s'il y a des obstacles sur le chemin direct
    const hasObstacle = this.checkForObstacles(me.position, closestProcessor.position);
    
    // Si on rencontre un obstacle et qu'on n'est pas déjà en mode de contournement, passer en mode aléatoire
    if (hasObstacle && this.pathfindingMode === 'direct') {
      this.switchToRandomMode(currentTime, 1000); // Mode aléatoire pendant 1 seconde
      return this.getRandomInputs(currentTime);
    }
    
    // Calculer l'angle vers le processeur
    const targetAngle = Math.atan2(
      closestProcessor.position.x - me.position.x,
      closestProcessor.position.z - me.position.z
    );
    
    // Angle actuel du bot
    const currentAngle = me.rotation;
    
    // Calculer la différence d'angle (en tenant compte des bords circulaires)
    let angleDiff = targetAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Déterminer s'il faut tourner à gauche ou à droite
    const turnLeft = angleDiff > 0;
    const turnRight = angleDiff < 0;
    
    // Précision angulaire (à quel point on peut être désaligné et continuer d'avancer)
    const anglePrecision = 0.3; // environ 17 degrés
    
    // Si l'angle est suffisamment précis, avancer; sinon, tourner seulement
    const shouldMove = Math.abs(angleDiff) < anglePrecision;
    
    // Décider s'il faut tirer (en fonction du cooldown)
    const shouldFire = currentTime - this.lastShootTime > this.shootCooldown;
    if (shouldFire) {
      this.lastShootTime = currentTime;
    }
    
    return {
      forward: shouldMove,
      backward: false,
      left: turnLeft,
      right: turnRight,
      fire: shouldFire
    };
  }
  
  // Passer en mode de déplacement aléatoire
  switchToRandomMode(currentTime, duration) {
    this.pathfindingMode = 'random';
    this.randomModeEndTime = currentTime + duration;
    this.lastRandomChange = currentTime;
  }
  
  // Récupérer l'état actuel de notre bot dans l'état du jeu
  getMyState() {
    return this.gameState.players[this.id];
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
    
    // Ajouter les autres joueurs comme obstacles (sauf nous-mêmes)
    if (this.gameState.players) {
      Object.values(this.gameState.players).forEach(player => {
        if (player.id !== this.id && player.isAlive) {
          this.obstacles.push({
            position: player.position,
            radius: 1.5 // Rayon approximatif d'un joueur
          });
        }
      });
    }
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
  
  // Calculer la distance entre deux points
  calculateDistance(a, b) {
    return Math.sqrt(
      Math.pow(b.x - a.x, 2) +
      Math.pow(b.z - a.z, 2)
    );
  }
  
  // Gérer les événements envoyés par le serveur
  handleEvent(event, data) {
    switch (event) {
      case 'playerKilled':
        if (data.id === this.id) {
          this.isAlive = false;
          console.log(`Bot ${this.id} died`);
        }
        break;
      case 'playerDamaged':
        if (data.id === this.id) {
          // Eventuellement, on pourrait ajuster notre stratégie quand on est touché
          // Par exemple fuir si on est à faible vie
        }
        break;
      case 'processorCollected':
        if (data.processorId === this.lastProcessorId) {
          // Réinitialiser notre cible actuelle
          this.lastProcessorId = null;
        }
        break;
    }
  }
}

module.exports = ClaudeBot;
