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
	console.log("Fichiers de bots détectés:", botFiles);
	try {
	  const BotClass = require(path.join(botsFolder, botFiles[0]));
	  console.log("Premier bot chargé avec succès");
	} catch (error) {
	  console.error("Erreur lors du chargement:", error);
	}
    });

    console.log(`Loaded ${this.bots.length} AI bots`);
  }

	spawnBots() {
	  this.bots.forEach(bot => {
		const botId = `bot-${bot.name}-${uuidv4().substring(0, 8)}`;
		const botInstance = new bot.BotClass(
		  botId,
		  this.io,
		  this.gameState,
		  this.emitAction.bind(this)
		);
		
		this.botIds[botId] = botInstance;
		
		// Position aléatoire comme un joueur normal
		const position = this.generateRandomPosition();
		
		// MODIFICATIONS ICI: Ajouter directement le bot à gameState.players
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
		
		console.log(`Bot ${bot.name} spawned with ID: ${botId} and added directly to gameState`);
	  });
	}

  emitAction(botId, event, data) {
    // Émuler l'envoi d'un événement depuis un client
    this.io.sockets.adapter.rooms.get('botRoom')?.forEach(socketId => {
      this.io.sockets.sockets.get(socketId)?.emit('botAction', {
        botId,
        event,
        data
      });
    });
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
    const gameStateCopy = JSON.parse(JSON.stringify(this.gameState));
    
    Object.values(this.botIds).forEach(bot => {
      if (bot.update) {
        try {
          bot.update(gameStateCopy);
        } catch (error) {
          console.error(`Error updating bot ${bot.id}:`, error);
        }
      }
    });
  }
  
  // Recevoir des notifications concernant les bots
  handleBotAction(botId, action, data) {
    const bot = this.botIds[botId];
    if (bot && bot.handleAction) {
      bot.handleAction(action, data);
    }
  }
  
  cleanupBots() {
    this.botIds = {};
  }
}

module.exports = BotManager;
