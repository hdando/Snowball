const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Créer l'application Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000  // Augmenter le timeout
});

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// États du jeu
const GameState = {
  PLAYING: 'playing',    // Jeu en cours (59 minutes)
  PODIUM: 'podium',      // Affichage du podium (1 minute)
  RESTARTING: 'restarting' // Redémarrage (quelques secondes)
};

// Configuration des durées (en millisecondes)
const GAME_DURATION = 59 * 60 * 1000;  // 59 minutes 
const PODIUM_DURATION = 60 * 1000;     // 1 minute
const RESTART_DURATION = 5 * 1000;     // 5 secondes pour le redémarrage

// État actuel du jeu
let currentGameState = {
  state: GameState.PLAYING,
  startTime: Date.now(),
  endTime: Date.now() + GAME_DURATION,
  winners: [],
  gameId: generateGameId()
};

// État du jeu (données)
const gameState = {
    players: {},
    processors: {},
    cannons: {},
    projectiles: {},
    structures: {} 
};

// ID des processeurs et canons
let processorId = 0;
let cannonId = 0;
let projectileId = 0;

// Fonction pour générer un ID unique pour chaque partie
function generateGameId() {
  return `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Gestion du cycle de jeu
function startGameCycle() {
  console.log(`Nouvelle partie démarrée: ${currentGameState.gameId}`);
  console.log(`La partie se terminera à: ${new Date(currentGameState.endTime).toLocaleTimeString()}`);
  
  // Planifier la fin de la partie
  setTimeout(() => {
    endGame();
  }, GAME_DURATION);
}

// Fonction pour terminer la partie et afficher le podium
function endGame() {
  currentGameState.state = GameState.PODIUM;
  currentGameState.winners = determineWinners();
  
  console.log('Partie terminée. Affichage du podium...');
  console.log('Gagnants:', currentGameState.winners.map(w => w.username));
  
  // Informer tous les joueurs de la fin de partie
  io.emit('gameEnded', {
    winners: currentGameState.winners,
    duration: PODIUM_DURATION
  });
  
  // Planifier le redémarrage
  setTimeout(() => {
    prepareRestart();
  }, PODIUM_DURATION);
}

// Préparer le redémarrage de la partie
function prepareRestart() {
  currentGameState.state = GameState.RESTARTING;
  
  console.log('Préparation du redémarrage...');
  
  // Informer tous les joueurs du redémarrage imminent
  io.emit('gameRestarting', {
    duration: RESTART_DURATION
  });
  
  // Planifier le redémarrage effectif
  setTimeout(() => {
    restartGame();
  }, RESTART_DURATION);
}

// Redémarrer la partie
function restartGame() {
  console.log('Redémarrage de la partie...');
  
  // Réinitialiser l'état du jeu
  resetGameState();
  
  // Informer tous les joueurs du redémarrage
  io.emit('gameRestarted', {
    gameState: gameState,
    gameInfo: {
      gameId: currentGameState.gameId,
      startTime: currentGameState.startTime,
      endTime: currentGameState.endTime
    }
  });
  
  // Démarrer un nouveau cycle
  startGameCycle();
}

// Déterminer les 3 meilleurs joueurs
function determineWinners() {
  // Convertir l'objet joueurs en tableau
  const playerArray = Object.values(gameState.players);
  
  // Trier par nombre de processeurs (ou un autre critère de score)
  const sortedPlayers = playerArray.sort((a, b) => {
    // Calculer le score total (somme des processeurs)
    const scoreA = a.stats && a.stats.processorCounts ? 
      Object.values(a.stats.processorCounts).reduce((sum, count) => sum + count, 0) : 0;
    
    const scoreB = b.stats && b.stats.processorCounts ? 
      Object.values(b.stats.processorCounts).reduce((sum, count) => sum + count, 0) : 0;
    
    return scoreB - scoreA; // Ordre décroissant
  });
  
  // Retourner les 3 premiers (ou moins s'il y a moins de 3 joueurs)
  return sortedPlayers.slice(0, 3).map(player => ({
    id: player.id,
    username: player.username,
    score: player.stats && player.stats.processorCounts ? 
      Object.values(player.stats.processorCounts).reduce((sum, count) => sum + count, 0) : 0,
    stats: player.stats
  }));
}

// Réinitialiser l'état du jeu
function resetGameState() {
  // Sauvegarder la liste des joueurs
  const connectedPlayers = {...gameState.players};
  
  // Réinitialiser l'état du jeu
  gameState.processors = {};
  gameState.cannons = {};
  gameState.projectiles = {};
  
  // Régénérer les structures
  gameState.structures = {};
  generateStaticStructures();
  
  // Réinitialiser les joueurs avec leur position et stats par défaut
  Object.keys(connectedPlayers).forEach(playerId => {
    gameState.players[playerId] = {
      id: playerId,
      position: generateRandomPosition(),
      rotation: Math.random() * Math.PI * 2,
      direction: { x: 0, y: 0, z: -1 },
      stats: {
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
      },
      hp: 100,
      maxHp: 100,
      isAlive: true,
      username: connectedPlayers[playerId].username
    };
  });
  
  // Mise à jour de l'état de la partie actuelle
  currentGameState = {
    state: GameState.PLAYING,
    startTime: Date.now(),
    endTime: Date.now() + GAME_DURATION,
    winners: [],
    gameId: generateGameId()
  };
  
  // Réinitialiser les compteurs d'IDs
  processorId = 0;
  cannonId = 0;
  projectileId = 0;
}

// Fonction utilitaire pour générer une position aléatoire sur la carte
function generateRandomPosition() {
  // Ajuster selon les dimensions de votre carte
  return {
    x: Math.random() * 100 - 50, // -50 à 50
    y: 0.5,                      // Hauteur fixe
    z: Math.random() * 100 - 50  // -50 à 50
  };
}

// fonction pour générer les structures une seule fois au démarrage du serveur
function generateStaticStructures() {
    // Créer le château d'eau
    const waterTowerId = 'water-tower-1';
    gameState.structures[waterTowerId] = {
        id: waterTowerId,
        type: 'waterTower',
        position: {x: 0, y: 0, z: 0}
    };
    
    // Créer les arbres
    const treeCount = 40;
    for (let i = 0; i < treeCount; i++) {
        let x, z;
        do {
            x = (Math.random() * 100 - 50) * 0.8; // -40 à 40
            z = (Math.random() * 100 - 50) * 0.8; // -40 à 40
        } while (Math.sqrt(x*x + z*z) < 20); // Éviter le centre
        
        const treeId = `tree-${i}`;
        gameState.structures[treeId] = {
            id: treeId,
            type: 'tree',
            position: {x, y: 0, z},
            hp: 150,
            maxHp: 150
        };
    }
    
    console.log(`Structures statiques générées: ${Object.keys(gameState.structures).length}`);
}

// Appeler cette fonction au démarrage du serveur
generateStaticStructures();

// Gérer les connexions WebSocket
io.on('connection', (socket) => {
  console.log(`Nouveau joueur connecté: ${socket.id}`);
  
  // Envoyer l'état actuel du jeu et les informations de la partie au nouveau joueur
  socket.emit('gameState', {
    ...gameState,
    gameInfo: {
      state: currentGameState.state,
      gameId: currentGameState.gameId,
      startTime: currentGameState.startTime,
      endTime: currentGameState.endTime
    }
  });
  
  // Si la partie est en mode podium, envoyer aussi les gagnants
  if (currentGameState.state === GameState.PODIUM) {
    socket.emit('gameEnded', {
      winners: currentGameState.winners,
      duration: currentGameState.endTime - Date.now()
    });
  }
  
  // Traiter la création d'un nouveau joueur
  socket.on('playerJoin', (playerData) => {
    // Ajouter le joueur à l'état du jeu
    gameState.players[socket.id] = {
      id: socket.id,
      position: playerData.position,
      rotation: playerData.rotation,
      direction: playerData.direction,
      stats: playerData.stats,
      hp: playerData.hp,
      maxHp: playerData.maxHp,
      isAlive: true,
      username: playerData.username || `Robot-${socket.id.substr(0, 4)}`
    };
    
    // Informer tous les autres joueurs du nouveau venu
    socket.broadcast.emit('playerJoined', {
      id: socket.id,
      ...gameState.players[socket.id]
    });
    
    // Envoyer la liste complète des joueurs au nouveau joueur
    socket.emit('playerList', gameState.players);
	
	// Nouvel événement pour demander l'état du jeu (utile après une reconnexion)
	socket.on('requestGameState', () => {
		console.log(`Joueur ${socket.id} demande un rafraîchissement de l'état du jeu`);
		
		// Envoyer l'état actuel du jeu et les informations de la partie au joueur
		socket.emit('gameState', {
		  players: gameState.players,
		  processors: gameState.processors,
		  cannons: gameState.cannons,
		  projectiles: gameState.projectiles,
		  structures: gameState.structures,
		  gameInfo: {
			state: currentGameState.state,
			gameId: currentGameState.gameId,
			startTime: currentGameState.startTime,
			endTime: currentGameState.endTime
		  }
		});
		
		// Si la partie est en mode podium, envoyer aussi les gagnants
		if (currentGameState.state === GameState.PODIUM) {
		  socket.emit('gameEnded', {
			winners: currentGameState.winners,
			duration: currentGameState.endTime - Date.now()
		  });
		}
  });
  
  socket.on('structureDamaged', (data) => {
    if (gameState.structures[data.structureId]) {
        // Appliquer les dégâts
        gameState.structures[data.structureId].hp -= data.damage;
        
        // Vérifier si la structure est détruite
        if (gameState.structures[data.structureId].hp <= 0) {
            gameState.structures[data.structureId].hp = 0;
            gameState.structures[data.structureId].destroyed = true;
            
            // Informer tous les joueurs
            io.emit('structureDestroyed', {
                id: data.structureId,
                position: gameState.structures[data.structureId].position
            });
        } else {
            // Informer tous les joueurs des dégâts
            io.emit('structureDamaged', {
                id: data.structureId,
                damage: data.damage,
                hp: gameState.structures[data.structureId].hp
            });
        }
    }  
  
  // Mettre à jour la position du joueur
  socket.on('playerUpdate', (playerData) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id] = {
        ...gameState.players[socket.id],
        ...playerData
      };
      
      // Diffuser la mise à jour à tous les autres joueurs
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        ...playerData
      });
    }
  });
  
  // Gérer le tir
  socket.on('playerShoot', (projectileData) => {
    const id = `projectile-${projectileId++}`;
    gameState.projectiles[id] = {
      id,
      ownerId: socket.id,
      ...projectileData
    };
    
    // Diffuser l'information du tir à tous les joueurs
    io.emit('projectileCreated', {
      id,
      ownerId: socket.id,
      ...projectileData
    });
  });
  
  // Gérer l'impact des projectiles
  socket.on('projectileHit', (data) => {
    if (gameState.projectiles[data.projectileId]) {
      delete gameState.projectiles[data.projectileId];
      
      // Si c'est un joueur qui est touché
      if (data.targetType === 'player' && gameState.players[data.targetId]) {
        const damage = data.damage;
        
        // Appliquer les dégâts
        gameState.players[data.targetId].hp -= damage;
        
        // Vérifier si le joueur est mort
        if (gameState.players[data.targetId].hp <= 0) {
          gameState.players[data.targetId].isAlive = false;
          
          // Diffuser l'événement de mort du joueur
          io.emit('playerKilled', {
            id: data.targetId,
            killerId: socket.id
          });
          
          // Créer les processeurs largués
          spawnDroppedProcessors(data.targetId, data.position);
        }
        
        // Diffuser l'information des dégâts à tous les joueurs
        io.emit('playerDamaged', {
          id: data.targetId,
          damage,
          hp: gameState.players[data.targetId].hp
        });
      }
      
      // Diffuser l'information de l'impact à tous les joueurs
      io.emit('projectileDestroyed', {
        id: data.projectileId,
        position: data.position
      });
    }
  });
  
  // Gérer la collecte de processeurs
  socket.on('processorCollected', (data) => {
    if (gameState.processors[data.processorId]) {
      // Supprimer le processeur de l'état du jeu
      delete gameState.processors[data.processorId];
      
      // Diffuser l'information à tous les joueurs
      io.emit('processorRemoved', {
        id: data.processorId
      });
      
      // Mettre à jour les statistiques du joueur
      if (gameState.players[socket.id]) {
        const statToUpdate = data.type;
        const boostValue = data.boost;
        
        // S'assurer que les stats et processorCounts existent
        if (!gameState.players[socket.id].stats) {
          gameState.players[socket.id].stats = {};
        }
        
        if (!gameState.players[socket.id].stats.processorCounts) {
          gameState.players[socket.id].stats.processorCounts = {
            hp: 0, resistance: 0, attack: 0, attackSpeed: 0, 
            range: 0, speed: 0, repairSpeed: 0
          };
        }
        
        switch(statToUpdate) {
          case 'hp':
            gameState.players[socket.id].maxHp += boostValue;
            gameState.players[socket.id].hp += boostValue;
            break;
          case 'resistance':
          case 'attack':
          case 'attackSpeed':
          case 'range':
          case 'speed':
          case 'repairSpeed':
            gameState.players[socket.id].stats[statToUpdate] += boostValue;
            break;
        }
        
        // Incrémenter le compteur de processeurs
        gameState.players[socket.id].stats.processorCounts[statToUpdate]++;
        
        // Diffuser la mise à jour des statistiques
        io.emit('playerStatsUpdated', {
          id: socket.id,
          stats: gameState.players[socket.id].stats,
          hp: gameState.players[socket.id].hp,
          maxHp: gameState.players[socket.id].maxHp
        });
      }
    }
  });
  
  // Gérer la déconnexion
  socket.on('disconnect', () => {
    console.log(`Joueur déconnecté: ${socket.id}`);
    
    // Supprimer le joueur de l'état du jeu
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
    }
    
    // Informer tous les autres joueurs de la déconnexion
    io.emit('playerLeft', socket.id);
  });
});

// Fonction pour créer périodiquement des processeurs
function spawnProcessors() {
  // Ne pas spawner de nouveaux processeurs pendant le podium ou le redémarrage
  if (currentGameState.state !== GameState.PLAYING) return;

  // Types de processeurs
  const processorTypes = [
    'hp', 'resistance', 'attack', 'attackSpeed', 
    'range', 'speed', 'repairSpeed'
  ];
  
  // Limiter le nombre de processeurs présents dans le jeu
  if (Object.keys(gameState.processors).length < 10000) {
    const type = processorTypes[Math.floor(Math.random() * processorTypes.length)];
    const id = `processor-${processorId++}`;
    
    // Position aléatoire sur la carte (ajuster selon les dimensions de votre carte)
    const x = Math.random() * 100 - 50; // -50 à 50
    const z = Math.random() * 100 - 50; // -50 à 50
    const y = 0.5; // Hauteur fixe
    
    // Valeurs de boost
    const boostValues = {
      hp: 1,
      resistance: 1,
      attack: 1,
      attackSpeed: 0.02,
      range: 1,
      speed: 0.003,
      repairSpeed: 0.05
    };
    
    gameState.processors[id] = {
      id,
      type,
      position: { x, y, z },
      boost: boostValues[type]
    };
    
    // Diffuser l'information du nouveau processeur à tous les joueurs
    io.emit('processorCreated', gameState.processors[id]);
  }
}

// Fonction pour créer périodiquement des canons
function spawnCannons() {
  // Ne pas spawner de nouveaux canons pendant le podium ou le redémarrage
  if (currentGameState.state !== GameState.PLAYING) return;

  // Limiter le nombre de canons présents dans le jeu
  if (Object.keys(gameState.cannons).length < 20) {
    const id = `cannon-${cannonId++}`;
    
    // Position aléatoire sur la carte
    const x = Math.random() * 100 - 50; // -50 à 50
    const z = Math.random() * 100 - 50; // -50 à 50
    const y = 0.5; // Hauteur fixe
    
    gameState.cannons[id] = {
      id,
      position: { x, y, z }
    };
    
    // Diffuser l'information du nouveau canon à tous les joueurs
    io.emit('cannonCreated', gameState.cannons[id]);
  }
}

// Fonction pour gérer les processeurs largués par un joueur mort
function spawnDroppedProcessors(playerId, position) {
  if (!gameState.players[playerId]) return;
  
  // Pour chaque type de processeur possédé par le joueur
  const playerStats = gameState.players[playerId].stats;
  if (!playerStats || !playerStats.processorCounts) return;
  
  const processorCounts = playerStats.processorCounts;
  
  Object.entries(processorCounts).forEach(([type, count]) => {
    // Calculer combien de processeurs vont tomber (1/10 des processeurs)
    const dropCount = Math.floor(count / 10);
    
    // Valeurs de boost
    const boostValues = {
      hp: 1,
      resistance: 1,
      attack: 1,
      attackSpeed: 0.02,
      range: 1,
      speed: 0.003,
      repairSpeed: 0.05
    };
    
    // Créer les processeurs
    for (let i = 0; i < dropCount; i++) {
      const id = `processor-${processorId++}`;
      
      // Position aléatoire autour du joueur mort
      const randomOffset = {
        x: (Math.random() - 0.5) * 2,
        y: 0.1,
        z: (Math.random() - 0.5) * 2
      };
      
      gameState.processors[id] = {
        id,
        type,
        position: {
          x: position.x + randomOffset.x,
          y: position.y + randomOffset.y,
          z: position.z + randomOffset.z
        },
        boost: boostValues[type],
        isBouncing: true
      };
      
      // Diffuser l'information du nouveau processeur à tous les joueurs
      io.emit('processorCreated', gameState.processors[id]);
    }
  });
}

// Démarrer les intervalles pour créer des objets
const PROCESSOR_SPAWN_INTERVAL = 1000; // 1 seconde
const CANNON_SPAWN_INTERVAL = 15000; // 15 secondes

setInterval(spawnProcessors, PROCESSOR_SPAWN_INTERVAL);
setInterval(spawnCannons, CANNON_SPAWN_INTERVAL);

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  // Démarrer le cycle de jeu
  startGameCycle();
});
