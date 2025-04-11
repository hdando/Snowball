class HunterBot {
  constructor(id, gameState, sendInputs) {
    this.id = id;                // ID unique du bot
    this.gameState = gameState;  // Référence à l'état du jeu
    this.sendInputs = sendInputs; // Fonction pour envoyer les inputs
    
    // État interne du bot
    this.state = 'COLLECTING_CANNONS'; // Deux états: COLLECTING_CANNONS ou HUNTING_PLAYERS
    this.targetId = null;              // ID de la cible (canon ou joueur)
    this.collectedCannons = 0;         // Compteur de canons collectés
    
    // État non persistant
    this.targetPosition = null;       // Position de la cible actuelle
    this.lastPathUpdateTime = 0;      // Dernier moment où on a mis à jour le chemin
    this.pathUpdateInterval = 500;    // Intervalle de mise à jour du chemin en ms
    
    console.log(`[HunterBot ${this.id}] Initialized`);
  }
  
  update(gameState) {
    // Mettre à jour la référence à l'état du jeu
    this.gameState = gameState;
    
    // Récupérer le bot depuis l'état du jeu
    const bot = gameState.players[this.id];
    if (!bot || !bot.isAlive) return;
    
    // Mettre à jour le contexte
    const currentTime = Date.now();
    const shouldUpdatePath = currentTime - this.lastPathUpdateTime > this.pathUpdateInterval;
    
    // Logique principale basée sur l'état
    if (this.state === 'COLLECTING_CANNONS' && this.collectedCannons >= 4) {
      // Transition vers l'état de chasse aux joueurs
      this.state = 'HUNTING_PLAYERS';
      this.targetId = null;
      this.targetPosition = null;
      console.log(`[HunterBot ${this.id}] Switching to HUNTING_PLAYERS mode`);
    }
    
    // Choisir une cible si nécessaire ou mettre à jour la position de la cible actuelle
    if (!this.targetId || !this.isTargetValid() || shouldUpdatePath) {
      this.chooseTarget();
      this.lastPathUpdateTime = currentTime;
    }
    
    // Si une cible est définie, se diriger vers elle et agir en conséquence
    if (this.targetId && this.targetPosition) {
      this.moveTowardsTarget(bot);
      
      // Si on chasse un joueur, lui tirer dessus quand on est assez proche
      if (this.state === 'HUNTING_PLAYERS') {
        this.shootAtTarget(bot);
      }
    } else {
      // Pas de cible, juste se déplacer aléatoirement
      this.moveRandomly();
    }
  }
  
  // Vérifier si la cible est toujours valide et mettre à jour sa position
  isTargetValid() {
    if (this.state === 'COLLECTING_CANNONS') {
      const cannon = this.gameState.cannons[this.targetId];
      if (cannon) {
        this.targetPosition = cannon.position;
        return true;
      }
      return false;
    } else {
      const target = this.gameState.players[this.targetId];
      if (target && target.isAlive && this.targetId !== this.id) {
        this.targetPosition = target.position;
        return true;
      }
      return false;
    }
  }
  
  // Choisir une nouvelle cible en fonction de l'état
  chooseTarget() {
    if (this.state === 'COLLECTING_CANNONS') {
      this.targetId = this.findClosestCannon();
      if (this.targetId) {
        this.targetPosition = this.gameState.cannons[this.targetId].position;
        console.log(`[HunterBot ${this.id}] Targeting cannon ${this.targetId}`);
      }
    } else {
      this.targetId = this.findClosestPlayer();
      if (this.targetId) {
        this.targetPosition = this.gameState.players[this.targetId].position;
        console.log(`[HunterBot ${this.id}] Targeting player ${this.targetId}`);
      }
    }
  }
  
  // Trouver le canon le plus proche
  findClosestCannon() {
    const bot = this.gameState.players[this.id];
    if (!bot) return null;
    
    let closestCannonId = null;
    let minDistance = Infinity;
    
    for (const cannonId in this.gameState.cannons) {
      const cannon = this.gameState.cannons[cannonId];
      const distance = this.calculateDistance(
        bot.position,
        cannon.position
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestCannonId = cannonId;
      }
    }
    
    return closestCannonId;
  }
  
  // Trouver le joueur le plus proche
  findClosestPlayer() {
    const bot = this.gameState.players[this.id];
    if (!bot) return null;
    
    let closestPlayerId = null;
    let minDistance = Infinity;
    
    for (const playerId in this.gameState.players) {
      // Ignorer ce bot lui-même et les joueurs morts
      const player = this.gameState.players[playerId];
      if (playerId === this.id || !player.isAlive) continue;
      
      const distance = this.calculateDistance(
        bot.position,
        player.position
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPlayerId = playerId;
      }
    }
    
    return closestPlayerId;
  }
  
  // Se diriger vers la cible
  moveTowardsTarget(bot) {
    if (!this.targetPosition) return;
    
    // Calculer l'angle vers la cible
    const angleToTarget = Math.atan2(
      this.targetPosition.z - bot.position.z,
      this.targetPosition.x - bot.position.x
    );
    
    // Angle actuel du bot
    const currentAngle = Math.atan2(bot.direction.z, bot.direction.x);
    
    // Différence d'angle (normalisée entre -PI et PI)
    let angleDifference = angleToTarget - currentAngle;
    while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;
    while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI;
    
    // Déterminer les inputs de mouvement
    const inputs = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      fire: false
    };
    
    // Détection d'obstacles
    const obstacleInfo = this.detectObstaclesAhead(bot);
    
    if (obstacleInfo.hasObstacle) {
      // Stratégie d'évitement d'obstacles
      if (obstacleInfo.side === 'left') {
        // Obstacle à gauche, tourner à droite
        inputs.right = true;
      } else {
        // Obstacle à droite, tourner à gauche
        inputs.left = true;
      }
      
      // Si l'obstacle est trop proche, reculer légèrement
      if (obstacleInfo.distance < 1.5) {
        inputs.backward = true;
      } else {
        // Sinon, continuer d'avancer mais en tournant
        inputs.forward = true;
      }
    } else {
      // Pas d'obstacle, navigation normale
      
      // Rotation : utiliser left/right pour s'aligner avec la cible
      if (angleDifference > 0.1) {
        inputs.left = true;
      } else if (angleDifference < -0.1) {
        inputs.right = true;
      }
      
      // Avancer vers la cible si on est à peu près dans la bonne direction
      if (Math.abs(angleDifference) < Math.PI / 2) {
        inputs.forward = true;
      }
    }
    
    // Calculer la distance à la cible
    const distance = this.calculateDistance(bot.position, this.targetPosition);
    
    // Si on est très proche d'un canon et qu'on le chasse, ralentir
    if (this.state === 'COLLECTING_CANNONS' && distance < 1) {
      inputs.forward = distance > 0.2; // S'arrêter si très proche
    }
    
    // Envoyer les inputs au serveur
    this.sendInputs(inputs);
  }
  
  // Détecter les obstacles devant le bot
  detectObstaclesAhead(bot) {
    const result = {
      hasObstacle: false,
      distance: Infinity,
      side: 'center'  // 'left', 'right', ou 'center'
    };
    
    // Distance de détection
    const detectionRange = 5;
    
    // Vérifier les structures (obstacles statiques)
    for (const structureId in this.gameState.structures) {
      const structure = this.gameState.structures[structureId];
      if (structure.destroyed) continue;
      
      const distance = this.calculateDistance(bot.position, structure.position);
      
      // Si l'obstacle est trop loin, l'ignorer
      if (distance > detectionRange) continue;
      
      // Calculer l'angle relatif vers l'obstacle
      const angleToObstacle = Math.atan2(
        structure.position.z - bot.position.z,
        structure.position.x - bot.position.x
      );
      
      // Angle actuel du bot
      const currentAngle = Math.atan2(bot.direction.z, bot.direction.x);
      
      // Différence d'angle (normalisée entre -PI et PI)
      let angleDifference = angleToObstacle - currentAngle;
      while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;
      while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI;
      
      // Obstacle devant (angle relatif inférieur à 60 degrés)
      if (Math.abs(angleDifference) < Math.PI / 3) {
        // Si c'est l'obstacle le plus proche jusqu'à présent
        if (distance < result.distance) {
          result.hasObstacle = true;
          result.distance = distance;
          result.side = angleDifference > 0 ? 'left' : 'right';
        }
      }
    }
    
    // Vérifier aussi les autres joueurs comme obstacles potentiels
    for (const playerId in this.gameState.players) {
      // Ignorer le bot lui-même
      if (playerId === this.id) continue;
      
      const player = this.gameState.players[playerId];
      if (!player.isAlive) continue;
      
      // Si c'est la cible actuelle en mode chasse, ne pas l'éviter
      if (this.state === 'HUNTING_PLAYERS' && playerId === this.targetId) continue;
      
      const distance = this.calculateDistance(bot.position, player.position);
      
      // Si l'obstacle est trop loin, l'ignorer
      if (distance > detectionRange) continue;
      
      // Calculer l'angle relatif vers l'obstacle
      const angleToObstacle = Math.atan2(
        player.position.z - bot.position.z,
        player.position.x - bot.position.x
      );
      
      // Angle actuel du bot
      const currentAngle = Math.atan2(bot.direction.z, bot.direction.x);
      
      // Différence d'angle
      let angleDifference = angleToObstacle - currentAngle;
      while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;
      while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI;
      
      // Obstacle devant (angle relatif inférieur à 60 degrés)
      if (Math.abs(angleDifference) < Math.PI / 3) {
        // Si c'est l'obstacle le plus proche jusqu'à présent
        if (distance < result.distance) {
          result.hasObstacle = true;
          result.distance = distance;
          result.side = angleDifference > 0 ? 'left' : 'right';
        }
      }
    }
    
    return result;
  }
  
  // Se déplacer aléatoirement
  moveRandomly() {
    // Générer des mouvements aléatoires
    const randomMove = Math.floor(Math.random() * 4);
    const inputs = {
      forward: randomMove === 0,
      backward: randomMove === 1,
      left: randomMove === 2,
      right: randomMove === 3,
      fire: false
    };
    
    this.sendInputs(inputs);
  }
  
  // Tirer sur la cible
  shootAtTarget(bot) {
    if (!this.targetPosition) return;
    
    const distance = this.calculateDistance(bot.position, this.targetPosition);
    const range = bot.stats?.range || 10;
    
    // Tirer si on est assez proche et approximativement dans la bonne direction
    if (distance <= range * 0.9) {
      // Calculer l'angle vers la cible
      const angleToTarget = Math.atan2(
        this.targetPosition.z - bot.position.z,
        this.targetPosition.x - bot.position.x
      );
      
      // Angle actuel du bot
      const currentAngle = Math.atan2(bot.direction.z, bot.direction.x);
      
      // Différence d'angle absolue
      let angleDifference = Math.abs(angleToTarget - currentAngle);
      while (angleDifference > Math.PI) angleDifference = 2 * Math.PI - angleDifference;
      
      // Tirer si on est à peu près dans la bonne direction
      if (angleDifference < Math.PI / 4) {
        this.sendInputs({
          forward: false,
          backward: false,
          left: false,
          right: false,
          fire: true
        });
      }
    }
  }
  
  // Calculer la distance entre deux positions
  calculateDistance(pos1, pos2) {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.y - pos1.y, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }
  
  // Gérer les événements du jeu
  handleEvent(event, data) {
    // Suivre les canons collectés
    if (event === 'cannonCollected' && data.playerId === this.id) {
      this.collectedCannons++;
      console.log(`[HunterBot ${this.id}] Cannon collected! Total: ${this.collectedCannons}`);
      
      // Changer d'état si on a collecté assez de canons
      if (this.collectedCannons >= 4 && this.state === 'COLLECTING_CANNONS') {
        this.state = 'HUNTING_PLAYERS';
        this.targetId = null;
        this.targetPosition = null;
        console.log(`[HunterBot ${this.id}] Switching to HUNTING_PLAYERS mode after collection`);
      }
    }
    
    // Réagir quand quelqu'un nous tire dessus en cherchant éventuellement à riposter
    if ((event === 'playerDamaged' || event === 'playerKilled') && data.id === this.id) {
      if (this.state === 'HUNTING_PLAYERS' && data.killerId && this.targetId !== data.killerId) {
        // Changer de cible pour viser celui qui nous attaque
        this.targetId = data.killerId;
        if (this.gameState.players[this.targetId]) {
          this.targetPosition = this.gameState.players[this.targetId].position;
          console.log(`[HunterBot ${this.id}] Under attack! Retargeting to ${this.targetId}`);
        }
      }
    }
  }
}

module.exports = HunterBot;
