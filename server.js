const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Créer l'application Express
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// État du jeu
const gameState = {
    players: {},
    processors: {},
    cannons: {},
    projectiles: {},
    structures: {} 
};

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

// ID des processeurs et canons
let processorId = 0;
let cannonId = 0;
let projectileId = 0;

// Gérer les connexions WebSocket
io.on('connection', (socket) => {
  console.log(`Nouveau joueur connecté: ${socket.id}`);
  
  // Envoyer l'état actuel du jeu au nouveau joueur
  socket.emit('gameState', gameState);
  
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
	});  
  
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
  // Types de processeurs
  const processorTypes = [
    'hp', 'resistance', 'attack', 'attackSpeed', 
    'range', 'speed', 'repairSpeed'
  ];
  
  // Limiter le nombre de processeurs présents dans le jeu
  if (Object.keys(gameState.processors).length < 500) {
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
const CANNON_SPAWN_INTERVAL = 5000; // 5 secondes

setInterval(spawnProcessors, PROCESSOR_SPAWN_INTERVAL);
setInterval(spawnCannons, CANNON_SPAWN_INTERVAL);

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
