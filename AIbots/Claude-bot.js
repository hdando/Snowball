class SimpleBot {
  constructor(botId, gameState, sendInputs) {
    // Propriétés de base
    this.id = botId;
    this.gameState = gameState;
    this.sendInputs = sendInputs;
    
    // État du bot
    this.lastUpdateTime = Date.now();
    this.updateInterval = 100; // millisecondes
    this.isAlive = true;
    
    // Paramètres de comportement
    this.shootCooldown = 3000; // 3 secondes entre les tirs
    this.lastShootTime = 0;
    this.randomMoveTime = 0; // Temps pendant lequel faire des mouvements aléatoires
    this.randomMoveDirection = { left: false, right: false };
    
    console.log(`SimpleBot initialized with ID: ${this.id}`);
  }
  
  update(gameState) {
    // Mettre à jour notre référence à l'état du jeu
    this.gameState = gameState;
    
    // Obtenir l'état actuel de notre bot
    const me = this.getMyState();
    if (!me || !me.isAlive) {
      // Si le bot est mort, n'envoyer aucun input
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
    
    // Logique principale : Trouver le processeur le plus proche et se diriger vers lui
    const closestProcessor = this.findClosestProcessor(me.position);
    
    if (closestProcessor) {
      // On a trouvé un processeur, se diriger vers lui
      this.moveTowardsTarget(me, closestProcessor.position, shouldFire);
    } else {
      // Aucun processeur trouvé, faire un mouvement aléatoire
      this.sendRandomMovement(shouldFire);
    }
  }
  
  // Récupérer l'état actuel du bot
  getMyState() {
    return this.gameState.players[this.id];
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
  
  // Se déplacer vers une cible
  moveTowardsTarget(me, targetPosition, shouldFire) {
    // Calculer l'angle vers la cible
    const targetAngle = Math.atan2(
      targetPosition.x - me.position.x,
      targetPosition.z - me.position.z
    )+Math.PI;
    
    // Angle actuel du bot
    const currentAngle = me.rotation;
    
    // Calculer la différence d'angle (en tenant compte des bords circulaires)
    let angleDiff = targetAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Tolérance d'angle pour avancer
    const angleTolerance = 0.3; // environ 17 degrés
    
    // Vérifier si un obstacle est sur le chemin
    const hasObstacle = this.checkForObstacle(me, targetPosition);
    
    if (hasObstacle) {
      // Si obstacle, activer le mode mouvement aléatoire pendant 2 secondes
      this.randomMoveTime = Date.now() + 2000;
      this.sendRandomMovement(shouldFire);
      return;
    }
    
    // Envoyer les inputs en fonction de la position relative
	this.sendInputs({
	  // Échanger forward et backward
	  forward: Math.abs(angleDiff) < angleTolerance,
	  backward: false,                                
	  
	  // Garder les commandes de rotation identiques
	  left: angleDiff > 0,
	  right: angleDiff < 0,
	  fire: shouldFire
	});
  }
  
  // Vérification simple d'obstacle
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
    
    // Vérifier les autres joueurs
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
    
    // Vérifier les structures (simplification)
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
    }
    
    // Réagir lorsqu'on est tué
    if (event === 'playerKilled' && data.id === this.id) {
      this.isAlive = false;
    }
    
    // Si un processeur est collecté, réinitialiser le mode mouvement
    if (event === 'processorCollected') {
      this.randomMoveTime = 0;
    }
  }
}

module.exports = SimpleBot;
