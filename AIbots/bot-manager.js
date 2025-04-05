const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class BotManager {
  constructor(io, gameState) {
    this.io = io;
    this.gameState = gameState;
    this.bots = [];
    this.botInstances = {};
    this.lastPositions = {}; // Pour suivre les positions précédentes des bots
    this.stuckCounters = {}; // Pour suivre les bots potentiellement bloqués
    
    // Stockage d'état des touches pour chaque bot
    this.botInputs = {};
    
    // Intervalle de collecte automatique
    this.collectionCheckInterval = null;
    
    // Suivi des canons latéraux pour chaque bot
    this.botSideCannons = {};
  }

  loadBots() {	  
    // Charger dynamiquement tous les bots
    const botsFolder = path.join(__dirname);
    const botFiles = fs.readdirSync(botsFolder)
      .filter(file => file.endsWith('-bot.js'));
    
    console.log("Fichiers de bots détectés:", botFiles);
    
    botFiles.forEach(file => {
      try {
        const BotClass = require(path.join(botsFolder, file));
        const botName = file.replace('-bot.js', '').toUpperCase();
        this.bots.push({ name: botName, BotClass });
        console.log(`Bot ${botName} chargé avec succès`);
      } catch (error) {
        console.error(`Failed to load bot: ${file}`, error);
      }
    });

    console.log(`Loaded ${this.bots.length} AI bots`);
  }

  spawnBots() {
    // Pour chaque type de bot disponible
    this.bots.forEach(bot => {
      // Vérifier combien d'instances de ce type de bot existent déjà
      const existingBots = Object.values(this.botInstances).filter(
        instance => instance.constructor.name === bot.BotClass.name
      );
      
      // Limiter à une seule instance par type de bot
      if (existingBots.length === 0) {
        // Générer un ID unique pour ce bot
        const botId = `bot-${bot.name}-${uuidv4().substring(0, 8)}`;
        
        // Créer une instance du bot avec le nouveau système d'inputs
        const botInstance = new bot.BotClass(
          botId,
          this.gameState,
          this.sendInputs.bind(this, botId)
        );
        
        // Stocker l'instance du bot
        this.botInstances[botId] = botInstance;
        this.lastPositions[botId] = null;
        this.stuckCounters[botId] = 0;
        this.botSideCannons[botId] = 0; // Initialiser à 0 canons latéraux
        
        // Initialiser les inputs du bot
        this.botInputs[botId] = {
          forward: false,
          backward: false,
          left: false,
          right: false,
          fire: false
        };
        
        // Générer une position aléatoire pour le bot
        const position = this.generateRandomPosition();
        
        // Ajouter directement le bot à l'état du jeu
        this.gameState.players[botId] = {
          id: botId,
          position: position,
          rotation: Math.random() * Math.PI * 2,
          direction: { x: 0, y: 0, z: -1 },
          stats: this.getDefaultPlayerStats(),
          hp: 100,
          maxHp: 100,
          isAlive: true,
          username: `AI-${bot.name}`
        };
        
        // Informer tous les clients du nouveau bot
        this.io.emit('playerJoined', {
          id: botId,
          ...this.gameState.players[botId]
        });
        
        // Ajouter le bot au système de collision
        this.addBotToCollisionSystem(botId);
        
        console.log(`Bot ${bot.name} créé avec l'ID: ${botId}`);
      } else {
        console.log(`Un bot de type ${bot.name} existe déjà, pas de nouvelle instance créée.`);
      }
    });
    
    // Démarrer la vérification périodique pour la collecte de processeurs
    if (!this.collectionCheckInterval) {
      this.collectionCheckInterval = setInterval(() => {
        this.checkProcessorCollection();
        this.checkCannonCollection();
      }, 200); // Vérifier toutes les 200ms
    }
    
    // Afficher les joueurs après le spawn pour vérification
    console.log("État du jeu après spawn des bots:", 
      Object.keys(this.gameState.players).map(id => ({
        id, 
        username: this.gameState.players[id].username
      }))
    );
  }
  
  // Méthode pour vérifier si les bots peuvent collecter des processeurs
  checkProcessorCollection() {
    if (!this.gameState.processors) return;
    
    // Pour chaque bot
    Object.keys(this.botInstances).forEach(botId => {
      const bot = this.gameState.players[botId];
      if (!bot || !bot.isAlive) return;
      
      // Pour chaque processeur, vérifier si le bot est assez proche
      Object.entries(this.gameState.processors).forEach(([processorId, processor]) => {
        // Calculer la distance
        const distance = this.calculateDistance(bot.position, processor.position);
        
        // Distance de collecte (ajustée pour l'échelle du bot)
        let collectDistance = 2;
        if (bot.stats && bot.stats.processorCounts) {
          const totalProcessors = Object.values(bot.stats.processorCounts)
            .reduce((sum, count) => sum + count, 0);
          collectDistance *= (1 + (totalProcessors * 0.005));
        }
        
        // Si assez proche, déclencher la collecte
        if (distance <= collectDistance) {
          this.collectProcessor(botId, processorId, processor);
        }
      });
    });
  }
  
  // Méthode pour vérifier si les bots peuvent collecter des canons
  checkCannonCollection() {
    if (!this.gameState.cannons) return;
    
    // Pour chaque bot
    Object.keys(this.botInstances).forEach(botId => {
      const bot = this.gameState.players[botId];
      if (!bot || !bot.isAlive) return;
      
      // Pour chaque canon, vérifier si le bot est assez proche
      Object.entries(this.gameState.cannons).forEach(([cannonId, cannon]) => {
        // Calculer la distance
        const distance = this.calculateDistance(bot.position, cannon.position);
        
        // Distance de collecte (ajustée pour l'échelle du bot)
        let collectDistance = 2;
        if (bot.stats && bot.stats.processorCounts) {
          const totalProcessors = Object.values(bot.stats.processorCounts)
            .reduce((sum, count) => sum + count, 0);
          collectDistance *= (1 + (totalProcessors * 0.005));
        }
        
        // Si assez proche, déclencher la collecte
        if (distance <= collectDistance) {
          this.collectCannon(botId, cannonId, cannon);
        }
      });
    });
  }
  
  // Méthode pour collecter un canon par un bot
  collectCannon(botId, cannonId, cannon) {
    const bot = this.gameState.players[botId];
    if (!bot) return;
    
    // Limiter le nombre de canons latéraux (comme pour les joueurs)
    const maxSideCannons = 4;
    if (this.botSideCannons[botId] >= maxSideCannons) {
      return; // Ne pas collecter plus de canons que la limite
    }
    
    // Supprimer le canon de l'état du jeu
    delete this.gameState.cannons[cannonId];
    
    // Informer tous les clients
    this.io.emit('cannonRemoved', {
      id: cannonId
    });
    
    // Incrémenter le compteur de canons pour ce bot
    this.botSideCannons[botId]++;
    
    // Notifier les bots de la collecte
    this.notifyBots('cannonCollected', {
      id: cannonId,
      playerId: botId
    });
    
    console.log(`Bot ${botId} a collecté un canon latéral (total: ${this.botSideCannons[botId]})`);
  }
  
  // Méthode pour collecter un processeur par un bot
  collectProcessor(botId, processorId, processor) {
    const bot = this.gameState.players[botId];
    if (!bot || !processor) return;
    
    // Supprimer le processeur de l'état du jeu
    delete this.gameState.processors[processorId];
    
    // Informer tous les clients
    this.io.emit('processorRemoved', {
      id: processorId
    });
    
    // Mettre à jour les stats du bot
    if (!bot.stats) {
      bot.stats = this.getDefaultPlayerStats();
    }
    
    if (!bot.stats.processorCounts) {
      bot.stats.processorCounts = {
        hp: 0, resistance: 0, attack: 0, attackSpeed: 0, 
        range: 0, speed: 0, repairSpeed: 0
      };
    }
    
    // Appliquer le boost selon le type
    const processorType = processor.type;
    const boostValue = processor.boost;
    
    switch(processorType) {
      case 'hp':
        bot.maxHp += boostValue;
        bot.hp += boostValue;
        break;
      case 'resistance':
      case 'attack':
      case 'attackSpeed':
      case 'range':
      case 'speed': 
      case 'repairSpeed':
        bot.stats[processorType] += boostValue;
        break;
    }
    
    // Incrémenter le compteur
    bot.stats.processorCounts[processorType]++;
    
    // Calculer le total des processeurs
    const totalProcessors = Object.values(bot.stats.processorCounts)
      .reduce((sum, count) => sum + count, 0);
    
    // Diffuser la mise à jour des stats
    this.io.emit('playerStatsUpdated', {
      id: botId,
      stats: bot.stats,
      hp: bot.hp,
      maxHp: bot.maxHp,
      totalProcessors: totalProcessors
    });
    
    // Notifier les bots de la collecte
    this.notifyBots('processorCollected', {
      id: processorId,
      type: processorType,
      playerId: botId
    });
    
    console.log(`Bot ${botId} a collecté un processeur de type ${processorType}`);
  }
  
  // Méthode pour recevoir les inputs d'un bot et les stocker
  sendInputs(botId, inputs) {
    // Valider l'existence du bot
    if (!this.botInstances[botId] || !this.gameState.players[botId]) {
      return;
    }
    
    // Actualiser les inputs du bot
    this.botInputs[botId] = {
      forward: !!inputs.forward,
      backward: !!inputs.backward,
      left: !!inputs.left,
      right: !!inputs.right,
      fire: !!inputs.fire
    };
  }
  
  // Méthode pour ajouter un bot au système de collision
  addBotToCollisionSystem(botId) {
    try {
      if (!this.gameState.players[botId]) {
        console.error(`Bot ${botId} non trouvé dans l'état du jeu, impossible d'ajouter au système de collision`);
        return;
      }
      
      // Envoyer un message spécial à tous les clients pour créer un collider pour ce bot
      this.io.emit('createBotCollider', {
        botId: botId,
        position: this.gameState.players[botId].position,
        rotation: this.gameState.players[botId].rotation,
        username: this.gameState.players[botId].username,
        hasCollision: true  // Assurer que la collision est activée
      });
      
      console.log(`Bot ${botId} ajouté au système de collision`);
    } catch (error) {
      console.error(`Erreur lors de l'ajout du bot ${botId} au système de collision:`, error);
    }
  }
  
  generateRandomPosition() {
    const angle = Math.random() * Math.PI * 2;
    const mapRadius = 100;
    const minRadius = mapRadius * 0.90;
    const maxRadius = mapRadius * 0.95;
    const radius = minRadius + Math.random() * (maxRadius - minRadius);
    
    return {
      x: Math.cos(angle) * radius,
      y: 0,  // Hauteur au sol (sera ajustée pour les projectiles)
      z: Math.sin(angle) * radius
    };
  }
  
  getDefaultPlayerStats() {
    return {
      resistance: 10,
      attack: 10,
      attackSpeed: 0.5,
      range: 10,
      speed: 0.02,
      repairSpeed: 0.5,
      processorCounts: {
        hp: 0,
        resistance: 0,
        attack: 0,
        attackSpeed: 0,
        range: 0,
        speed: 0,
        repairSpeed: 0
      }
    };
  }

  updateBots() {
    // Vérifier si des bots sont manquants
    Object.keys(this.botInstances).forEach(botId => {
      if (!this.gameState.players[botId]) {
        console.log(`Bot ${botId} manquant dans l'état du jeu, tentative de réinsertion`);
        
        // Réinsérer le bot dans l'état du jeu
        const botName = botId.split('-')[1] || 'BOT';
        this.gameState.players[botId] = {
          id: botId,
          position: this.generateRandomPosition(),
          rotation: Math.random() * Math.PI * 2,
          direction: { x: 0, y: 0, z: -1 },
          stats: this.getDefaultPlayerStats(),
          hp: 100,
          maxHp: 100,
          isAlive: true,
          username: `AI-${botName}`
        };
        
        // Informer tous les clients
        this.io.emit('playerJoined', {
          id: botId,
          ...this.gameState.players[botId]
        });
        
        // Ajouter au système de collision
        this.addBotToCollisionSystem(botId);
      }
    });
    
    // Copie de l'état du jeu pour les bots
    const gameStateCopy = JSON.parse(JSON.stringify(this.gameState));
    
    // Mettre à jour chaque bot (demander leur nouvelle intention d'inputs)
    Object.entries(this.botInstances).forEach(([botId, bot]) => {
      if (bot.update && this.gameState.players[botId] && this.gameState.players[botId].isAlive) {
        try {
          bot.update(gameStateCopy);
        } catch (error) {
          console.error(`Erreur lors de la mise à jour du bot ${botId}:`, error);
        }
      }
    });
    
    // Traiter les inputs de chaque bot et les appliquer
    this.processBotInputs();
    
    // Vérifier si les bots sont bloqués
    this.checkForStuckBots();
  }
  
  // Traiter les inputs stockés et les convertir en actions de jeu
  processBotInputs() {
    Object.entries(this.botInputs).forEach(([botId, inputs]) => {
      const bot = this.gameState.players[botId];
      if (!bot || !bot.isAlive) return;
      
      // Récupérer les stats du bot
      const botSpeed = bot.stats?.speed || 0.02;
      const botRotationSpeed = 0.02; // Même vitesse de rotation que les joueurs
      
      // Calculer les nouvelles position et rotation
      let newPosition = {...bot.position};
      let newRotation = bot.rotation;
      let newDirection = {...bot.direction};
      
      // Appliquer les rotations
      if (inputs.left) {
        newRotation += botRotationSpeed;
        // Recalculer la direction
        newDirection = {
          x: Math.sin(newRotation),
          y: 0,
          z: Math.cos(newRotation)
        };
      }
      if (inputs.right) {
        newRotation -= botRotationSpeed;
        // Recalculer la direction
        newDirection = {
          x: Math.sin(newRotation),
          y: 0,
          z: Math.cos(newRotation)
        };
      }
      
      // Appliquer les mouvements
      if (inputs.forward) {
        newPosition.x += newDirection.x * botSpeed;
        newPosition.z += newDirection.z * botSpeed;
      }
      if (inputs.backward) {
        newPosition.x -= newDirection.x * botSpeed;
        newPosition.z -= newDirection.z * botSpeed;
      }
      
      // Gérer le tir
      if (inputs.fire) {
        this.handleBotShoot(botId);
      }
      
      // Mettre à jour la position et la rotation du bot dans l'état du jeu
      this.gameState.players[botId].position = newPosition;
      this.gameState.players[botId].rotation = newRotation;
      this.gameState.players[botId].direction = newDirection;
      
      // Informer tous les clients de la mise à jour
      this.io.emit('playerMoved', {
        id: botId,
        position: newPosition,
        rotation: newRotation,
        direction: newDirection
      });
    });
  }
  
  // Gérer le tir d'un bot
  handleBotShoot(botId) {
    const bot = this.gameState.players[botId];
    if (!bot || !bot.isAlive) return;
    
    // Vérifier le cooldown de tir (utiliser la même règle que pour les joueurs)
    const currentTime = Date.now();
    const lastShootTime = bot.lastShootTime || 0;
    const attackSpeed = bot.stats?.attackSpeed || 0.5;
    const cooldown = 1000 / attackSpeed; // Cooldown en millisecondes
    
    if (currentTime - lastShootTime < cooldown) {
      return; // Encore en cooldown
    }
    
    // Mettre à jour le dernier temps de tir
    bot.lastShootTime = currentTime;
    
    // Créer l'ID du projectile
    const projectileId = `projectile-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Calculer l'échelle du bot basée sur le nombre de processeurs collectés
    let botScale = 1.0;
    if (bot.stats && bot.stats.processorCounts) {
      const totalProcessors = Object.values(bot.stats.processorCounts)
        .reduce((sum, count) => sum + count, 0);
      botScale = 1.0 + (totalProcessors * 0.005); // 0.5% par processeur
    }
    
    // Déterminer si on utilise le canon principal ou un canon latéral
    const sideCannonCount = this.botSideCannons[botId] || 0;
    const useSideCannon = Math.random() > 0.7 && sideCannonCount > 0;
    let projectilePosition;
    
    if (useSideCannon) {
      // Position pour les canons latéraux
      // Simuler les positions des canons latéraux comme dans index.html
      
      // Choisir aléatoirement un canon gauche ou droit
      const isLeftSide = Math.random() > 0.5;
      // Choisir aléatoirement une rangée (0 ou 1)
      const rowIndex = Math.floor(Math.random() * Math.min(2, sideCannonCount / 2));
      
      // Reproduire les calculs de position des canons latéraux
      const xOffset = (isLeftSide ? -0.25 : 0.25) * botScale;
      const yOffset = (0.9 - (rowIndex * 0.45)) * botScale;
      const zOffset = -0.2 * botScale;
      
      // Position du bout du canon latéral
      const localBarrelZ = -0.12; // Longueur approximative du canon
      
      // Position dans l'espace 3D
      const headHeight = 1.3 * botScale; // Hauteur de la tête du robot
      const worldY = bot.position.y + headHeight + yOffset;
      
      // Calculer la position mondiale en tenant compte de la rotation du bot
      const cosAngle = Math.cos(bot.rotation);
      const sinAngle = Math.sin(bot.rotation);
      
      // Composante X (latérale)
      const worldX = bot.position.x + 
                    (xOffset * cosAngle) + 
                    ((zOffset + localBarrelZ) * sinAngle);
      
      // Composante Z (avant/arrière)
      const worldZ = bot.position.z + 
                    (xOffset * sinAngle) - 
                    ((zOffset + localBarrelZ) * cosAngle);
      
      projectilePosition = {
        x: worldX,
        y: worldY,
        z: worldZ
      };
    } else {
      // Position pour le canon principal
      // Simuler la position du canon principal comme dans index.html
      
      // Hauteur de la tête du robot
      const headHeight = 1.3 * botScale;
      
      // Position du bout du canon (valeur négative car orienté vers l'avant)
      const barrelTipZ = -0.7 * botScale;
      
      // Calculer la position mondiale en tenant compte de la rotation du bot
      const worldY = bot.position.y + headHeight;
      const worldX = bot.position.x + (barrelTipZ * Math.sin(bot.rotation));
      const worldZ = bot.position.z + (barrelTipZ * Math.cos(bot.rotation));
      
      projectilePosition = {
        x: worldX,
        y: worldY,
        z: worldZ
      };
    }
    
    // Ajouter le projectile à l'état du jeu
    this.gameState.projectiles[projectileId] = {
      id: projectileId,
      ownerId: botId,
      position: projectilePosition,
      direction: bot.direction,
      damage: bot.stats?.attack || 10,
      range: bot.stats?.range || 10,
      createdAt: currentTime
    };
    
    // Informer tous les clients du nouveau projectile
    this.io.emit('projectileCreated', {
      id: projectileId,
      ownerId: botId,
      position: projectilePosition,
      direction: bot.direction,
      damage: bot.stats?.attack || 10,
      range: bot.stats?.range || 10
    });
  }
  
  // Calculer la distance entre deux positions
  calculateDistance(pos1, pos2) {
    if (!pos1 || !pos2) return Infinity;
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }
  
  // Vérifier si des bots sont bloqués
  checkForStuckBots() {
    Object.keys(this.botInstances).forEach(botId => {
      const bot = this.gameState.players[botId];
      if (!bot || !bot.isAlive) return;
      
      // Vérifier si le bot a bougé depuis la dernière mise à jour
      if (this.lastPositions[botId]) {
        const lastPos = this.lastPositions[botId];
        const currentPos = bot.position;
        
        // Calculer la distance parcourue
        const distance = Math.sqrt(
          Math.pow(currentPos.x - lastPos.x, 2) + 
          Math.pow(currentPos.z - lastPos.z, 2)
        );
        
        // Si la distance est très petite, le bot est peut-être bloqué
        if (distance < 0.01) {
          this.stuckCounters[botId]++;
          
          // Si le bot est bloqué depuis trop longtemps, forcer un mouvement aléatoire
          if (this.stuckCounters[botId] > 50) {
            console.log(`Bot ${botId} semble bloqué, application d'un mouvement aléatoire`);
            this.applyRandomMovement(botId);
            this.stuckCounters[botId] = 0;
          }
        } else {
          // Réinitialiser le compteur s'il a bougé
          this.stuckCounters[botId] = 0;
        }
      }
      
      // Stocker la position actuelle pour la prochaine vérification
      this.lastPositions[botId] = {...bot.position};
    });
  }
  
  // Appliquer un mouvement aléatoire à un bot bloqué
  applyRandomMovement(botId) {
    const bot = this.gameState.players[botId];
    if (!bot) return;
    
    // Générer une nouvelle direction aléatoire
    const randomAngle = Math.random() * Math.PI * 2;
    const newDirection = {
      x: Math.sin(randomAngle),
      y: 0,
      z: Math.cos(randomAngle)
    };
    
    // Appliquer la nouvelle direction et rotation
    bot.rotation = randomAngle;
    bot.direction = newDirection;
    
    // Forcer un mouvement dans cette direction
    const botSpeed = bot.stats?.speed || 0.02;
    bot.position.x += newDirection.x * botSpeed * 10; // Boosted speed to escape stuck position
    bot.position.z += newDirection.z * botSpeed * 10;
    
    // Informer les clients
    this.io.emit('playerMoved', {
      id: botId,
      position: bot.position,
      rotation: bot.rotation,
      direction: bot.direction
    });
  }
  
  // Notifier les bots des événements du jeu
  notifyBots(event, data) {
    // Pour chaque bot concerné par l'événement
    const botId = event === 'playerKilled' || event === 'playerDamaged' ? data.id : null;
    
    if (botId && this.botInstances[botId]) {
      // Notifier le bot spécifique
      if (this.botInstances[botId].handleEvent) {
        this.botInstances[botId].handleEvent(event, data);
      }
    } else {
      // Événement global, notifier tous les bots
      Object.entries(this.botInstances).forEach(([id, bot]) => {
        if (bot.handleEvent) {
          bot.handleEvent(event, data);
        }
      });
    }
  }
  
  cleanupBots() {
    // Arrêter l'intervalle de vérification de collecte
    if (this.collectionCheckInterval) {
      clearInterval(this.collectionCheckInterval);
      this.collectionCheckInterval = null;
    }
    
    // Supprimer les bots de l'état du jeu
    Object.keys(this.botInstances).forEach(botId => {
      delete this.gameState.players[botId];
      delete this.lastPositions[botId];
      delete this.stuckCounters[botId];
      delete this.botInputs[botId];
      delete this.botSideCannons[botId];
    });
    
    // Réinitialiser la liste des bots
    this.botInstances = {};
    
    console.log("Tous les bots ont été nettoyés");
  }
}

module.exports = BotManager;
