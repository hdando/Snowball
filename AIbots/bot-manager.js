const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const THREE = require('three'); // Importer Three.js

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
        const randomRotation = Math.random() * Math.PI * 2;
        
        // Créer le vecteur de direction avec Three.js
        const directionVector = new THREE.Vector3(0, 0, -1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0), 
          randomRotation
        );
        
        // Ajouter directement le bot à l'état du jeu
        this.gameState.players[botId] = {
          id: botId,
          position: position,
          rotation: randomRotation,
          // Convertir le vecteur Three.js en objet simple
          direction: {
            x: directionVector.x,
            y: directionVector.y,
            z: directionVector.z
          },
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
        // Convertir en Vector3 pour utiliser les méthodes de Three.js
        const botPosition = new THREE.Vector3(bot.position.x, bot.position.y, bot.position.z);
        const processorPosition = new THREE.Vector3(
          processor.position.x, 
          processor.position.y, 
          processor.position.z
        );
        
        // Calculer la distance avec Three.js
        const distance = botPosition.distanceTo(processorPosition);
        
        // Distance de collecte (ajustée pour l'échelle du bot)
        let collectDistance = 2;
        if (bot.stats && bot.stats.processorCounts) {
          const totalProcessors = Object.values(bot.stats.processorCounts)
            .reduce((sum, count) => sum + count, 0);
          collectDistance *= (0.9 + (totalProcessors * 0.005));
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
        // Utiliser Three.js pour le calcul de distance
        const botPosition = new THREE.Vector3(bot.position.x, bot.position.y, bot.position.z);
        const cannonPosition = new THREE.Vector3(
          cannon.position.x, 
          cannon.position.y, 
          cannon.position.z
        );
        
        const distance = botPosition.distanceTo(cannonPosition);
        
        // Distance de collecte (ajustée pour l'échelle du bot)
        let collectDistance = 2;
        if (bot.stats && bot.stats.processorCounts) {
          const totalProcessors = Object.values(bot.stats.processorCounts)
            .reduce((sum, count) => sum + count, 0);
          collectDistance *= (0.9 + (totalProcessors * 0.005));
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
      
      console.log(`Bot ${botId} ajouté au système de collision`);
      
      // Vérifier à nouveau que le bot existe toujours après le délai
      if (this.gameState.players[botId]) {
        console.log(`Envoi différé de createBotCollider pour ${botId} après 2 secondes`);
        
        this.io.emit('createBotCollider', {
          botId: botId,
          position: this.gameState.players[botId].position,
          rotation: this.gameState.players[botId].rotation,
          username: this.gameState.players[botId].username,
          hasCollision: true
        });
      } else {
        console.log(`Bot ${botId} n'existe plus après le délai, annulation de la création du collider`);
      }
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
    
    // Utiliser Three.js pour générer le vecteur
    const randomVector = new THREE.Vector3(
      Math.cos(angle) * radius,
      0, // Y = 0 (hauteur au sol)
      Math.sin(angle) * radius
    );
    
    // Retourner un objet simple pour compatibilité
    return {
      x: randomVector.x,
      y: randomVector.y,
      z: randomVector.z
    };
  }
  
  getDefaultPlayerStats() {
    return {
      resistance: 10,
      attack: 10,
      attackSpeed: 0.5,
      range: 10,
      speed: 0.04,
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
        
        // Générer une position et direction avec Three.js
        const randomPosition = this.generateRandomPosition();
        const randomRotation = Math.random() * Math.PI * 2;
        
        // Créer le vecteur de direction avec Three.js
        const direction = new THREE.Vector3(0, 0, -1)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), randomRotation);
        
        this.gameState.players[botId] = {
          id: botId,
          position: randomPosition,
          rotation: randomRotation,
          direction: {
            x: direction.x,
            y: direction.y,
            z: direction.z
          },
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
  
  // Calcule la distance entre 2 positions en utilisant Three.js
  calculateDistance(pos1, pos2) {
    if (!pos1 || !pos2) return Infinity;
    
    const vector1 = new THREE.Vector3(pos1.x, pos1.y, pos1.z);
    const vector2 = new THREE.Vector3(pos2.x, pos2.y, pos2.z);
    
    return vector1.distanceTo(vector2);
  }

  // Process bot inputs avec Three.js
  processBotInputs() {
    Object.entries(this.botInputs).forEach(([botId, inputs]) => {
      const bot = this.gameState.players[botId];
      if (!bot || !bot.isAlive) return;
      
      // Get bot stats
      const botSpeed = bot.stats?.speed || 0.04;
      const botRotationSpeed = 0.02;
      
      // Convertir la position et la rotation en objets Three.js
      const botPosition = new THREE.Vector3(bot.position.x, bot.position.y, bot.position.z);
      const botDirection = new THREE.Vector3(bot.direction.x, bot.direction.y, bot.direction.z);
      let botRotation = bot.rotation;
      
      // Mémoriser la position d'origine pour les collisions
      const originalPosition = botPosition.clone();
      
      // Appliquer les rotations
      if (inputs.left) {
        botRotation += botRotationSpeed;
        // Recalculer la direction avec Three.js
        botDirection.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), botRotation);
      }
      if (inputs.right) {
        botRotation -= botRotationSpeed;
        // Recalculer la direction avec Three.js
        botDirection.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), botRotation);
      }
      
      // Calculer la nouvelle position potentielle
      const newPosition = botPosition.clone();
      if (inputs.forward) {
        // Ajouter un vecteur de direction mis à l'échelle par la vitesse
        newPosition.add(botDirection.clone().multiplyScalar(botSpeed));
      }
      if (inputs.backward) {
        // Soustraire un vecteur de direction mis à l'échelle par la vitesse
        newPosition.sub(botDirection.clone().multiplyScalar(botSpeed));
      }
      
      // Vérifier les collisions
      let willCollide = false;
      
      // Vérifier les collisions avec les autres joueurs
      Object.entries(this.gameState.players).forEach(([playerId, player]) => {
        if (playerId === botId || !player.isAlive) return;
        
        const playerPosition = new THREE.Vector3(
          player.position.x, 
          player.position.y, 
          player.position.z
        );
        
        // Calculer la distance avec Three.js
        const distance = newPosition.distanceTo(playerPosition);
        
        // Ajuster les rayons de collision en fonction de l'échelle
        let playerScale = 1.0;
        if (player.stats && player.stats.processorCounts) {
          const totalProcessors = Object.values(player.stats.processorCounts)
            .reduce((sum, count) => sum + count, 0);
          playerScale = 1.0 + (totalProcessors * 0.005);
        }
        
        let botScale = 1.0;
        if (bot.stats && bot.stats.processorCounts) {
          const totalProcessors = Object.values(bot.stats.processorCounts)
            .reduce((sum, count) => sum + count, 0);
          botScale = 1.0 + (totalProcessors * 0.005);
        }
        
        // Rayon de collision combiné
        const combinedRadius = (0.75 * botScale) + (0.75 * playerScale);
        
        if (distance < combinedRadius) {
          willCollide = true;
        }
      });
      
      // Vérifier les collisions avec les structures
      Object.values(this.gameState.structures).forEach(structure => {
        if (structure.destroyed) return;
        
        const structurePosition = new THREE.Vector3(
          structure.position.x, 
          structure.position.y, 
          structure.position.z
        );
        
        const distance = newPosition.distanceTo(structurePosition);
        // Rayon de collision différent selon le type de structure
        const collisionRadius = structure.type === 'waterTower' ? 5 : 2;
        
        if (distance < collisionRadius) {
          willCollide = true;
        }
      });
      
      // Si collision détectée, essayer des directions alternatives
      if (willCollide) {
        // Créer des directions alternatives
        const potentialAngles = [
          botRotation + Math.PI/4,  // 45° droite
          botRotation - Math.PI/4,  // 45° gauche
          botRotation + Math.PI/2,  // 90° droite
          botRotation - Math.PI/2,  // 90° gauche
          botRotation + Math.PI     // Inverse
        ];
        
        // Convertir les angles en vecteurs
        const potentialDirections = potentialAngles.map(angle => {
          const dir = new THREE.Vector3(
            Math.sin(angle),
            0,
            Math.cos(angle)
          );
          return dir;
        });
        
        let foundValidDirection = false;
        
        for (const dir of potentialDirections) {
          // Position de test en utilisant Three.js
          const testPosition = originalPosition.clone().addScaledVector(dir, botSpeed);
          
          // Vérifier si la direction est libre
          let directionClear = true;
          
          // Vérifier les joueurs
          Object.entries(this.gameState.players).forEach(([playerId, player]) => {
            if (playerId === botId || !player.isAlive) return;
            
            const playerPosition = new THREE.Vector3(
              player.position.x, 
              player.position.y, 
              player.position.z
            );
            
            // Calculer les rayons de collision précis
            let playerScale = 1.0;
            if (player.stats && player.stats.processorCounts) {
              const totalProcessors = Object.values(player.stats.processorCounts)
                .reduce((sum, count) => sum + count, 0);
              playerScale = 1.0 + (totalProcessors * 0.005);
            }
            
            let botScale = 1.0;
            if (bot.stats && bot.stats.processorCounts) {
              const totalProcessors = Object.values(bot.stats.processorCounts)
                .reduce((sum, count) => sum + count, 0);
              botScale = 1.0 + (totalProcessors * 0.005);
            }
            
            // Rayon combiné basé sur la taille des joueurs
            const combinedRadius = (0.75 * botScale) + (0.75 * playerScale);
            
            if (testPosition.distanceTo(playerPosition) < combinedRadius) {
              directionClear = false;
            }
          });
          
          // Vérifier les structures
          Object.values(this.gameState.structures).forEach(structure => {
            if (structure.destroyed) return;
            
            const structurePosition = new THREE.Vector3(
              structure.position.x, 
              structure.position.y, 
              structure.position.z
            );
            
            const collisionRadius = structure.type === 'waterTower' ? 5 : 2;
            
            if (testPosition.distanceTo(structurePosition) < collisionRadius) {
              directionClear = false;
            }
          });
          
          if (directionClear) {
            // Utiliser la nouvelle position
            newPosition.copy(testPosition);
            foundValidDirection = true;
            break;
          }
        }
        
        // Si aucune direction valide n'est trouvée, rester sur place
        if (!foundValidDirection) {
          newPosition.copy(originalPosition);
        }
      }
      
      // Gérer le tir
      if (inputs.fire) {
        this.handleBotShoot(botId);
      }
      
      // Mettre à jour la position, rotation et direction du bot dans l'état du jeu
      bot.position = {
        x: newPosition.x,
        y: newPosition.y,
        z: newPosition.z
      };
      bot.rotation = botRotation;
      bot.direction = {
        x: botDirection.x,
        y: botDirection.y,
        z: botDirection.z
      };
      
      // Informer tous les clients
      this.io.emit('playerMoved', {
        id: botId,
        position: bot.position,
        rotation: botRotation,
        direction: bot.direction
      });
    });
  }
  
  // Gérer le tir d'un bot avec Three.js
  handleBotShoot(botId) {
    const bot = this.gameState.players[botId];
    if (!bot || !bot.isAlive) return;
    
    // Vérifier le cooldown de tir
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
    
    // Calculer l'échelle du bot
    let botScale = 1.0;
    if (bot.stats && bot.stats.processorCounts) {
      const totalProcessors = Object.values(bot.stats.processorCounts)
        .reduce((sum, count) => sum + count, 0);
      botScale = 1.0 + (totalProcessors * 0.005);
    }
    
    // Convertir la position et direction en objets Three.js
    const botPosition = new THREE.Vector3(bot.position.x, bot.position.y, bot.position.z);
    const botRotation = new THREE.Euler(0, bot.rotation, 0, 'XYZ');
    const botDirection = new THREE.Vector3(bot.direction.x, bot.direction.y, bot.direction.z);
    
    // Déterminer si on utilise le canon principal ou un canon latéral
    const sideCannonCount = this.botSideCannons[botId] || 0;
    const useSideCannon = Math.random() > 0.7 && sideCannonCount > 0;
    
    let projectilePosition = new THREE.Vector3();
    
    if (useSideCannon) {
      // Position pour les canons latéraux avec Three.js
      const isLeftSide = Math.random() > 0.5;
      const rowIndex = Math.floor(Math.random() * Math.min(2, sideCannonCount / 2));
      
      // Position locale du canon
      const xOffset = (isLeftSide ? -0.25 : 0.25) * botScale;
      const yOffset = (0.9 - (rowIndex * 0.45)) * botScale;
      const zOffset = -0.2 * botScale;
      
      // Position locale du bout du canon
      const localBarrelZ = -0.36 * botScale;
      
      // Créer la position locale puis la transformer en position mondiale
      const localPosition = new THREE.Vector3(xOffset, yOffset, zOffset + localBarrelZ);
      
      // Appliquer la rotation du bot
      localPosition.applyEuler(botRotation);
      
      // Position mondiale = position du bot + position locale transformée
      projectilePosition.copy(botPosition).add(localPosition);
      
      // Ajuster la hauteur Y
      const headHeight = 1.3 * botScale;
      projectilePosition.y = botPosition.y + headHeight + yOffset;
      
    } else {
      // Position pour le canon principal
      const headHeight = 1.3 * botScale;
      const barrelTipZ = -0.4 * botScale;
      
      // Créer un vecteur pour le bout du canon dans l'espace local
      const localBarrelTip = new THREE.Vector3(0, 0, barrelTipZ);
      
      // Transformer selon la rotation du bot
      localBarrelTip.applyEuler(botRotation);
      
      // Position mondiale
      projectilePosition.copy(botPosition).add(localBarrelTip);
      projectilePosition.y = botPosition.y + headHeight;
    }
    
    // Ajouter le projectile à l'état du jeu
    this.gameState.projectiles[projectileId] = {
      id: projectileId,
      ownerId: botId,
      position: {
        x: projectilePosition.x,
        y: projectilePosition.y,
        z: projectilePosition.z
      },
      direction: bot.direction,
      damage: bot.stats?.attack || 10,
      range: bot.stats?.range || 10,
      createdAt: currentTime
    };
    
    // Informer tous les clients du nouveau projectile
    this.io.emit('projectileCreated', {
      id: projectileId,
      ownerId: botId,
      position: {
        x: projectilePosition.x,
        y: projectilePosition.y,
        z: projectilePosition.z
      },
      direction: bot.direction,
      damage: bot.stats?.attack || 10,
      range: bot.stats?.range || 10
    });
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
        
        // Utiliser Three.js pour calculer la distance
        const lastVector = new THREE.Vector3(lastPos.x, lastPos.y, lastPos.z);
        const currentVector = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
        
        const distance = lastVector.distanceTo(currentVector);
        
        // Si la distance est très petite, le bot est peut-être bloqué
        if (distance < 0.01) {
          this.stuckCounters[botId]++;
          
          // Si le bot est bloqué depuis trop longtemps, forcer un mouvement aléatoire
          if (this.stuckCounters[botId] > 100) {
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
    
    // Générer une nouvelle direction aléatoire avec Three.js
    const randomAngle = Math.random() * Math.PI * 2;
    const newDirection = new THREE.Vector3(
      Math.sin(randomAngle),
      0,
      Math.cos(randomAngle)
    );
    
    // Appliquer la nouvelle direction et rotation
    bot.rotation = randomAngle;
    bot.direction = {
      x: newDirection.x,
      y: newDirection.y,
      z: newDirection.z
    };
    
    // Forcer un mouvement dans cette direction (vitesse boostée pour s'échapper)
    const botSpeed = bot.stats?.speed || 0.02;
    const moveVector = newDirection.clone().multiplyScalar(botSpeed * 10);
    
    bot.position.x += moveVector.x;
    bot.position.z += moveVector.z;
    
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
