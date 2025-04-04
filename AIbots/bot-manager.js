const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class BotManager {
  constructor(io, gameState) {
    this.io = io;
    this.gameState = gameState;
    this.bots = [];
    this.botIds = {};
  }

  loadBots() {	  
    // Charger dynamiquement tous les bots
    const botsFolder = path.join(__dirname);
    const botFiles = fs.readdirSync(botsFolder)
      .filter(file => file.endsWith('-bot.js'));
    
    botFiles.forEach(file => {
      try {
        const BotClass = require(path.join(botsFolder, file));
        const botName = file.replace('-bot.js', '').toUpperCase();
        this.bots.push({ name: botName, BotClass });
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
      const existingBots = Object.values(this.botIds).filter(
        instance => instance.constructor.name === bot.BotClass.name
      );
      
      // Limiter à une seule instance par type de bot
      if (existingBots.length === 0) {
        // Générer un ID unique pour ce bot
        const botId = `bot-${bot.name}-${uuidv4().substring(0, 8)}`;
        
        // Créer une instance du bot
        const botInstance = new bot.BotClass(
          botId,
          this.io,
          this.gameState,
          this.emitAction.bind(this)
        );
        
        // Stocker l'instance du bot
        this.botIds[botId] = botInstance;
        
        // Générer une position aléatoire comme un joueur normal
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
        
        console.log(`Bot ${bot.name} créé avec l'ID: ${botId}`);
      } else {
        console.log(`Un bot de type ${bot.name} existe déjà, pas de nouvelle instance créée.`);
      }
    });
    
    // Afficher les joueurs après le spawn pour vérification
    console.log("État du jeu après spawn des bots:", 
      Object.keys(this.gameState.players).map(id => ({
        id, 
        username: this.gameState.players[id].username
      }))
    );
  }
  
  // Implémentation simplifiée d'emitAction - action directe sur le jeu
  emitAction(botId, event, data) {
    console.log(`Bot ${botId} action: ${event}`);
    
    // Traiter l'action directement sans passer par botRoom
    switch (event) {
      case 'playerJoin':
        // S'assurer que le bot n'existe pas déjà
        if (!this.gameState.players[botId]) {
          console.log(`Ajout direct du bot ${botId} à l'état du jeu`);
          this.gameState.players[botId] = {
            id: botId,
            position: data.position || this.generateRandomPosition(),
            rotation: data.rotation || 0,
            direction: data.direction || { x: 0, y: 0, z: -1 },
            stats: data.stats || this.getDefaultPlayerStats(),
            hp: data.hp || 100,
            maxHp: data.maxHp || 100,
            isAlive: true,
            username: data.username || `AI-Bot`
          };
          
          // Informer tous les clients du nouveau joueur bot
          this.io.emit('playerJoined', {
            id: botId,
            ...this.gameState.players[botId]
          });
        }
        break;
        
      case 'playerUpdate':
        // Mettre à jour directement le bot dans l'état du jeu
        if (this.gameState.players[botId]) {
          Object.assign(this.gameState.players[botId], data);
          
          // Informer tous les clients de la mise à jour
          this.io.emit('playerMoved', {
            id: botId,
            ...data
          });
        }
        break;
        
      case 'playerShoot':
        // Traiter le tir du bot directement
        // Générer un ID unique pour le projectile
        const projectileId = `projectile-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Normaliser la direction
        const direction = data.direction;
        const magnitude = Math.sqrt(
          direction.x * direction.x + 
          direction.y * direction.y + 
          direction.z * direction.z
        );
        
        const normalizedDirection = {
          x: direction.x / magnitude,
          y: direction.y / magnitude, 
          z: direction.z / magnitude
        };
        
        // Ajouter le projectile à l'état du jeu
        this.gameState.projectiles[projectileId] = {
          id: projectileId,
          ownerId: botId,
          position: data.position,
          direction: normalizedDirection,
          damage: this.gameState.players[botId]?.stats?.attack || 10,
          range: this.gameState.players[botId]?.stats?.range || 10,
          createdAt: Date.now()
        };
        
        // Informer tous les clients du nouveau projectile
        this.io.emit('projectileCreated', {
          id: projectileId,
          ownerId: botId,
          position: data.position,
          direction: normalizedDirection,
          damage: this.gameState.players[botId]?.stats?.attack || 10,
          range: this.gameState.players[botId]?.stats?.range || 10
        });
        break;
        
      case 'processorCollected':
        // Traiter la collecte de processeur
        if (data.processorId && this.gameState.processors[data.processorId]) {
          const processor = this.gameState.processors[data.processorId];
          
          // Mettre à jour les stats du bot
          if (this.gameState.players[botId]) {
            const player = this.gameState.players[botId];
            
            // Mettre à jour les stats en fonction du type de processeur
            switch(processor.type) {
              case 'hp':
                player.maxHp += processor.boost;
                player.hp += processor.boost;
                break;
              case 'resistance':
              case 'attack':
              case 'attackSpeed':
              case 'range':
              case 'speed':
              case 'repairSpeed':
                player.stats[processor.type] += processor.boost;
                break;
            }
            
            // Incrémenter le compteur de processeurs
            player.stats.processorCounts[processor.type]++;
            
            // Supprimer le processeur du jeu
            delete this.gameState.processors[data.processorId];
            
            // Informer les clients
            this.io.emit('processorRemoved', { id: data.processorId });
            
            // Informer de la mise à jour des stats
            this.io.emit('playerStatsUpdated', {
              id: botId,
              stats: player.stats,
              hp: player.hp,
              maxHp: player.maxHp
            });
          }
        }
        break;
    }
    
    // Notifier le bot de l'action
    if (this.botIds[botId] && this.botIds[botId].handleAction) {
      this.botIds[botId].handleAction(event, data);
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
      y: 0,
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
    let botCount = 0;
    Object.keys(this.botIds).forEach(botId => {
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
      } else {
        botCount++;
      }
    });
    
    if (botCount > 0 && Math.random() < 0.1) { // Afficher seulement occasionnellement
      console.log(`Mise à jour de ${botCount} bots actifs`);
    }
    
    // Copie de l'état du jeu pour les bots
    const gameStateCopy = JSON.parse(JSON.stringify(this.gameState));
    
    // Mettre à jour chaque bot
    Object.values(this.botIds).forEach(bot => {
      if (bot.update) {
        try {
          bot.update(gameStateCopy);
        } catch (error) {
          console.error(`Erreur lors de la mise à jour du bot ${bot.id}:`, error);
        }
      }
    });
  }
  
  // Méthode inutile maintenant que nous n'utilisons plus botRoom
  handleBotAction(botId, action, data) {
    // Redirection directe
    if (this.botIds[botId] && this.botIds[botId].handleAction) {
      this.botIds[botId].handleAction(action, data);
    }
  }
  
  cleanupBots() {
    // Supprimer les bots de l'état du jeu
    Object.keys(this.botIds).forEach(botId => {
      delete this.gameState.players[botId];
    });
    
    // Réinitialiser la liste des bots
    this.botIds = {};
  }
}

module.exports = BotManager;
