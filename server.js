const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const BotManager = require('./AIbots/bot-manager');

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

// CONSTANTES ET UTILITAIRES
// -------------------------

// Limites de la carte pour validation
const MAP_BOUNDS = {
  radius: 100,  // Rayon du cercle
  minY: 0, maxY: 10
};

// Vérifier si une position est valide (dans les limites de la carte)
function isValidPosition(position) {
  if (!position || typeof position !== 'object') return false;
  
  // Calculer la distance du centre (0,0)
  const distanceFromCenter = Math.sqrt(
    Math.pow(position.x, 2) + 
    Math.pow(position.z, 2)
  );
  
  return (
    distanceFromCenter <= MAP_BOUNDS.radius &&
    position.y >= MAP_BOUNDS.minY && 
    position.y <= MAP_BOUNDS.maxY
  );
}

// Calculer la distance entre deux positions
function calculateDistance(pos1, pos2) {
  if (!pos1 || !pos2) return Infinity;
  return Math.sqrt(
    Math.pow(pos2.x - pos1.x, 2) +
    Math.pow(pos2.y - pos1.y, 2) +
    Math.pow(pos2.z - pos1.z, 2)
  );
}

// Fonctions de validation diverses
function isInRange(value, min, max) {
  return value >= min && value <= max;
}

function validateNumber(value, min, max, defaultValue) {
  if (typeof value !== 'number' || isNaN(value)) return defaultValue;
  return isInRange(value, min, max) ? value : defaultValue;
}

// ÉTAT DU JEU
// -----------

// États du jeu
const GameState = {
  PLAYING: 'playing',    // Jeu en cours (59 minutes)
  PODIUM: 'podium',      // Affichage du podium (1 minute)
  RESTARTING: 'restarting' // Redémarrage (quelques secondes)
};

// Configuration des durées (en millisecondes)
const GAME_DURATION = 10 * 60 * 1000;  // 10 minutes
const PODIUM_DURATION = 30 * 1000;     // 30 secondes
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

// Initialisation du gestionnaire de bots
const botManager = new BotManager(io, gameState);
console.log("====== BOT MANAGER CRÉÉ ======");
try {
  botManager.loadBots();
  console.log("====== BOTS CHARGÉS ======");
} catch (error) {
  console.error("ERREUR CHARGEMENT BOTS:", error);
}

// Compteurs pour les IDs
let processorId = 0;
let cannonId = 0;
let projectileId = 0;

// Fonction pour générer un ID unique pour chaque partie
function generateGameId() {
  return `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Validation des stats du joueur
function validatePlayerStats(stats) {
  if (!stats) return getDefaultPlayerStats();
  
  const defaultStats = getDefaultPlayerStats();
  return {
    resistance: validateNumber(stats.resistance, 0, 1000, defaultStats.resistance),
    attack: validateNumber(stats.attack, 0, 1000, defaultStats.attack),
    attackSpeed: validateNumber(stats.attackSpeed, 0.01, 10, defaultStats.attackSpeed),
    range: validateNumber(stats.range, 1, 100, defaultStats.range),
    speed: validateNumber(stats.speed, 0.001, 0.2, defaultStats.speed),
    repairSpeed: validateNumber(stats.repairSpeed, 0, 10, defaultStats.repairSpeed),
    processorCounts: stats.processorCounts || defaultStats.processorCounts
  };
}

// Obtenir les stats par défaut pour un joueur
function getDefaultPlayerStats() {
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

// CYCLE DE JEU
// ------------

// Gestion du cycle de jeu
function startGameCycle() {
  console.log("====== DÉMARRAGE CYCLE DE JEU ======");
  // Réinitialiser correctement les temps
  currentGameState.startTime = Date.now();
  currentGameState.endTime = Date.now() + GAME_DURATION;
  
  console.log(`Nouvelle partie démarrée: ${currentGameState.gameId}`);
  console.log(`La partie se terminera à: ${new Date(currentGameState.endTime).toLocaleTimeString()}`);
  
  // Spawn des bots après une courte pause pour s'assurer que le jeu est prêt
  setTimeout(() => {
    console.log("====== SPAWN DES BOTS ======");
    try {
      botManager.spawnBots();
      console.log("====== BOTS SPAWNED ======");
    } catch (error) {
      console.error("ERREUR SPAWN BOTS:", error);
    }
  }, 1000);
  
  // Créer un intervalle pour les mises à jour des bots
  const botUpdateInterval = setInterval(() => {
    botManager.updateBots();
  }, 50); // Mettre à jour les bots 20 fois par seconde
  
  // Planifier la fin de la partie en utilisant l'endTime calculé
  const timeToEnd = currentGameState.endTime - Date.now();
  
  // Planifier la fin de la partie
  setTimeout(() => {
    // Arrêter les mises à jour des bots
    clearInterval(botUpdateInterval);  
    botManager.cleanupBots();
    
    endGame();
  }, timeToEnd); // Utiliser le temps calculé, pas GAME_DURATION directement
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
  
  // Nettoyer les bots avant de réinitialiser
  botManager.cleanupBots();
  
  // Réinitialiser l'état du jeu
  resetGameState();
  
  // Forcer tous les clients à rafraîchir leurs pages
  io.emit('forceRefresh', {
    reason: "game_restart",
    timestamp: Date.now()
  });
  
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
  // Mémoriser les joueurs connectés
  const connectedPlayers = {};
  Object.entries(gameState.players).forEach(([id, player]) => {
    if (!id.startsWith('bot-')) {
      connectedPlayers[id] = {
        username: player.username
      };
    }
  });

  // Réinitialiser l'état du jeu
  gameState.players = {};
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
      stats: getDefaultPlayerStats(),
      hp: 100,
      maxHp: 100,
      isAlive: true,
      username: connectedPlayers[playerId].username
    };
  });
  
  // Mise à jour de l'état de la partie actuelle
  currentGameState = {
    state: GameState.PLAYING,
    startTime: null, // Les temps seront définis dans startGameCycle()
    endTime: null,   // Les temps seront définis dans startGameCycle()
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
  // Générer une position aléatoire dans une zone annulaire entre 90% et 95% du rayon
  const angle = Math.random() * Math.PI * 2;
  const minRadius = MAP_BOUNDS.radius * 0.90; // 90% du rayon
  const maxRadius = MAP_BOUNDS.radius * 0.95; // 95% du rayon
  const radius = minRadius + Math.random() * (maxRadius - minRadius);
  
  return {
    x: Math.cos(angle) * radius,
    y: 0,  // Hauteur fixe
    z: Math.sin(angle) * radius
  };
}

// GÉNÉRATION DES STRUCTURES ET OBJETS
// -----------------------------------

// Fonction pour générer les structures une seule fois au démarrage du serveur
function generateStaticStructures() {
  // Créer le château d'eau
  const waterTowerId = 'water-tower-1';
  gameState.structures[waterTowerId] = {
    id: waterTowerId,
    type: 'waterTower',
    position: {x: 0, y: 0, z: 0}
  };
  
  // Créer les arbres
  const treeCount = 100;
  for (let i = 0; i < treeCount; i++) {
    let x, z;
	do {
		// Générer une position aléatoire dans un cercle de 80% du rayon de la carte
		const angle = Math.random() * Math.PI * 2; // Angle aléatoire entre 0 et 2π
		const mapRadius = MAP_BOUNDS.radius; // Rayon total de la carte
		const maxTreeRadius = mapRadius * 0.8; // 80% du rayon de la carte
		const radius = Math.random() * maxTreeRadius; // Rayon aléatoire entre 0 et 80% du rayon

		x = Math.cos(angle) * radius;
		z = Math.sin(angle) * radius;
	} while (Math.sqrt(x*x + z*z) < 25); // Éviter le centre
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

// Fonction pour créer périodiquement des processeurs
function spawnProcessors() {
  // Ne pas spawner de nouveaux processeurs pendant le podium ou le redémarrage
  if (currentGameState.state !== GameState.PLAYING) return;
  
  // Limite plus raisonnable pour la performance
  const PROCESSOR_LIMIT = 10000;

  // Types de processeurs
  const processorTypes = [
    'hp', 'resistance', 'attack', 'attackSpeed', 
    'range', 'speed', 'repairSpeed'
  ];
  
  // Limiter le nombre de processeurs présents dans le jeu
  if (Object.keys(gameState.processors).length < PROCESSOR_LIMIT) {
    const type = processorTypes[Math.floor(Math.random() * processorTypes.length)];
    const id = `processor-${processorId++}`;
    
	// Position aléatoire dans 90% du rayon de la carte autour du château d'eau
	const angle = Math.random() * Math.PI * 2;
	const mapRadius = MAP_BOUNDS.radius; // Rayon total de la carte
	const maxSpawnRadius = mapRadius * 0.9; // 90% du rayon
	const radius = Math.random() * maxSpawnRadius;
	const x = Math.cos(angle) * radius;
	const z = Math.sin(angle) * radius;
	const y = 0.5; // Hauteur augmentée pour meilleure visibilité
	
    // Valeurs de boost
    const boostValues = {
      hp: 1,
      resistance: 1,
      attack: 1,
      attackSpeed: 0.02,
      range: 1,
      speed: 0.002,
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
  if (Object.keys(gameState.cannons).length < 50) {
    const id = `cannon-${cannonId++}`;
    
    // Position aléatoire autour du château d'eau
	let x, z;
	const waterTowerPosition = {x: 0, y: 0, z: 0}; // Position du château d'eau au centre
	const minDistance = 5; // Distance minimale du château d'eau
	const maxDistance = 25; // Rayon maximal d'apparition

	do {
	  // Générer une position dans un cercle
	  const angle = Math.random() * Math.PI * 2;
	  const radius = minDistance + Math.random() * (maxDistance - minDistance);
	  x = waterTowerPosition.x + Math.cos(angle) * radius;
	  z = waterTowerPosition.z + Math.sin(angle) * radius;
	} while (!isValidPosition({x, y: 0.5, z})); // Vérifier que la position est valide

	const y = 0.5; // Hauteur augmentée pour meilleure visibilité
    
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
  if (!gameState.players[playerId] || !isValidPosition(position)) return;
  
  // Pour chaque type de processeur possédé par le joueur
  const playerStats = gameState.players[playerId].stats;
  if (!playerStats || !playerStats.processorCounts) return;
  
  const processorCounts = playerStats.processorCounts;
  
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
  
  Object.entries(processorCounts).forEach(([type, count]) => {
    // Calculer combien de processeurs vont tomber (1/2 des processeurs)
    const dropCount = Math.floor(count / 2);
    
    if (dropCount <= 0) return;
    
    // Créer les processeurs
    for (let i = 0; i < dropCount; i++) {
      const id = `processor-${processorId++}`;
      
      // Position aléatoire autour du joueur mort
      const randomOffset = {
        x: (Math.random() - 0.5) * 2,
        y: 0.1,
        z: (Math.random() - 0.5) * 2
      };
      
      const processorPosition = {
        x: position.x + randomOffset.x,
        y: 0 + randomOffset.y,
        z: position.z + randomOffset.z
      };
      
      // Vérifier que la position est valide
      if (!isValidPosition(processorPosition)) continue;
      
      gameState.processors[id] = {
        id,
        type,
        position: processorPosition,
        boost: boostValues[type],
      };
      
      // Diffuser l'information du nouveau processeur à tous les joueurs
      io.emit('processorCreated', gameState.processors[id]);
    }
  });
}

// GESTION DES CONNEXIONS ET ÉVÉNEMENTS
// -----------------------------------

// Fonction pour traiter les joueurs qui rejoignent
function handlePlayerJoin(socket, playerData) {
  // Validation des données du joueur
  if (!playerData || typeof playerData !== 'object') {
    console.log("Données de joueur invalides:", playerData);
    return;
  }
  
  // Vérifier la position
  const position = isValidPosition(playerData.position) 
    ? playerData.position 
    : generateRandomPosition();
  
  // Valider les autres champs
  const username = playerData.username || `Robot-${socket.id.substr(0, 4)}`;
  const stats = validatePlayerStats(playerData.stats);
  const hp = validateNumber(playerData.hp, 1, 1000, 100);
  const maxHp = validateNumber(playerData.maxHp, 1, 1000, 100);
  
  // Ajouter le joueur à l'état du jeu
  gameState.players[socket.id] = {
    id: socket.id,
    position: position,
    rotation: playerData.rotation || 0,
    direction: playerData.direction || { x: 0, y: 0, z: -1 },
    stats: stats,
    hp: hp,
    maxHp: maxHp,
    isAlive: true,
    username: username
  };
  
  // Informer tous les autres joueurs du nouveau venu
  socket.broadcast.emit('playerJoined', {
    id: socket.id,
    ...gameState.players[socket.id]
  });
  
  // Envoyer la liste complète des joueurs au nouveau joueur
  socket.emit('playerList', gameState.players);
  
  console.log(`Joueur ${username} (${socket.id}) a rejoint la partie`);
}

function handlePlayerUpdate(socket, playerData) {
  if (!gameState.players[socket.id]) return;
  
  // Vérifier si la position est valide
  if (playerData.position && !isValidPosition(playerData.position)) {
    console.log(`Position invalide reçue de ${socket.id}:`, playerData.position);
    socket.emit('positionReset', gameState.players[socket.id].position);
    return;
  }
  
  // Vérifier si le déplacement est réaliste (pas de téléportation)
  if (playerData.position && gameState.players[socket.id].position) {
    const lastPos = gameState.players[socket.id].position;
    const distance = calculateDistance(playerData.position, lastPos);
    
    // Calculer la distance maximale possible basée sur la vitesse
    const playerSpeed = gameState.players[socket.id].stats?.speed || 0.02;
    const maxDistance = playerSpeed * 60; // Valeur arbitraire à ajuster
    
    if (distance > maxDistance) {
      console.log(`Mouvement suspect de ${socket.id}: ${distance.toFixed(2)} unités (max ${maxDistance.toFixed(2)})`);
      socket.emit('positionReset', lastPos);
      return;
    }
  }
  
  // Valider les autres champs avant de mettre à jour
  const validatedUpdate = {};
  
  if (playerData.position) validatedUpdate.position = playerData.position;
  if (typeof playerData.rotation === 'number') validatedUpdate.rotation = playerData.rotation;
  if (playerData.direction) validatedUpdate.direction = playerData.direction;
  if (typeof playerData.isAlive === 'boolean') validatedUpdate.isAlive = playerData.isAlive;
  if (typeof playerData.hp === 'number') {
    validatedUpdate.hp = validateNumber(
      playerData.hp, 
      0, 
      gameState.players[socket.id].maxHp, 
      gameState.players[socket.id].hp
    );
  }
  
  // Si tout est OK, mettre à jour
  gameState.players[socket.id] = {
    ...gameState.players[socket.id],
    ...validatedUpdate
  };
  
  // Diffuser la mise à jour aux autres joueurs
  socket.broadcast.emit('playerMoved', {
    id: socket.id,
    ...validatedUpdate
  });
}

function handlePlayerShoot(socket, projectileData) {
  // Validation des données
  if (!projectileData || !isValidPosition(projectileData.position) || !projectileData.direction) {
    console.log("Données de projectile invalides:", projectileData);
    return;
  }
  
  // Vérifier si le joueur existe et est vivant
  if (!gameState.players[socket.id] || !gameState.players[socket.id].isAlive) {
    console.log(`Tentative de tir par un joueur mort ou inexistant: ${socket.id}`);
    return;
  }
  
  // Vérifier si le tir provient bien de la position du joueur
  const playerPos = gameState.players[socket.id].position;
  const distance = calculateDistance(playerPos, projectileData.position);
  
  if (distance > 5) { // 5 unités = distance raisonnable pour le canon
    console.log(`Position de tir suspecte: ${distance.toFixed(2)} unités de distance`);
    return;
  }
  
  // Normaliser la direction
  const direction = projectileData.direction;
  const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
  if (magnitude === 0) {
    console.log("Direction de projectile invalide (magnitude 0)");
    return;
  }
  
  const normalizedDirection = {
    x: direction.x / magnitude,
    y: direction.y / magnitude,
    z: direction.z / magnitude
  };
  
  // Limiter les valeurs de dégâts et portée aux stats du joueur
  const playerStats = gameState.players[socket.id].stats;
  const damage = playerStats ? playerStats.attack : 10;
  const range = playerStats ? playerStats.range : 10;
  
  // Utiliser l'ID fourni par le client s'il existe, sinon en générer un
  const id = projectileData.projectileId || `projectile-${projectileId++}`;
  
  // Stocker la référence au projectile dans gameState
  gameState.projectiles[id] = {
    id,
    ownerId: socket.id,
    position: projectileData.position,
    direction: normalizedDirection,
    damage: damage,
    range: range,
    createdAt: Date.now()
  };
  
  // Diffuser l'information du tir à tous les joueurs
  io.emit('projectileCreated', {
    id,
    ownerId: socket.id,
    position: projectileData.position,
    direction: normalizedDirection,
    damage: damage,
    range: range
  });
}

function handleProcessorCollected(socket, data) {
  // Validation de base
  if (!data || !data.processorId) {
    console.log("Données de processeur incomplètes");
    return;
  }

  // Vérifier que le processeur existe
  if (!gameState.processors[data.processorId]) {
    console.log(`Processeur inexistant ou déjà collecté: ${data.processorId}`);

    // Envoyer une mise à jour de synchronisation au joueur
    socket.emit('syncGameState', {
      processors: Object.keys(gameState.processors),
      players: { [socket.id]: gameState.players[socket.id] }
    });
    return;
  }
  
  // Vérifier que le joueur existe
  if (!gameState.players[socket.id]) {
    console.log(`Joueur inexistant pour collecte: ${socket.id}`);
    return;
  }
  
  // Vérifier la distance entre le joueur et le processeur
  const distance = calculateDistance(
    gameState.players[socket.id].position,
    gameState.processors[data.processorId].position
  );
  
  // Distance maximale de collecte (ajustée selon l'échelle du joueur)
  let baseCollectDistance = 2;
  // Si le joueur a des stats, on peut ajuster en fonction de son échelle approximative
  if (gameState.players[socket.id].stats && gameState.players[socket.id].stats.processorCounts) {
    const totalProcessors = Object.values(gameState.players[socket.id].stats.processorCounts)
      .reduce((sum, count) => sum + count, 0);
    // Augmenter la distance de collecte de 0.5% par processeur collecté
    baseCollectDistance *= (1 + (totalProcessors * 0.005));
  }
  
  if (distance > baseCollectDistance) {
    console.log(`Distance de collecte suspecte: ${distance.toFixed(2)} > ${baseCollectDistance.toFixed(2)}`);
    return;
  }
  
  // Si toutes les vérifications passent, poursuivre avec la collecte
  const processor = gameState.processors[data.processorId];
  const processorType = processor.type;
  const boostValue = processor.boost;
  
  // Supprimer le processeur de l'état du jeu
  delete gameState.processors[data.processorId];
  
  // Diffuser l'information à tous les joueurs
  io.emit('processorRemoved', {
    id: data.processorId
  });
  
  // Mettre à jour les statistiques du joueur
  if (!gameState.players[socket.id].stats) {
    gameState.players[socket.id].stats = getDefaultPlayerStats();
  }
  
  if (!gameState.players[socket.id].stats.processorCounts) {
    gameState.players[socket.id].stats.processorCounts = {
      hp: 0, resistance: 0, attack: 0, attackSpeed: 0, 
      range: 0, speed: 0, repairSpeed: 0
    };
  }
  
  // Mettre à jour la statistique correspondante
  switch(processorType) {
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
      gameState.players[socket.id].stats[processorType] += boostValue;
      break;
  }
  
  // Incrémenter le compteur de processeurs
  gameState.players[socket.id].stats.processorCounts[processorType]++;
    
  // Calculer le total des processeurs
  const totalProcessors = Object.values(gameState.players[socket.id].stats.processorCounts).reduce((sum, count) => sum + count, 0);
  
  // Diffuser la mise à jour des statistiques
  io.emit('playerStatsUpdated', {
    id: socket.id,
    stats: gameState.players[socket.id].stats,
    hp: gameState.players[socket.id].hp,
    maxHp: gameState.players[socket.id].maxHp,
    totalProcessors: totalProcessors
  });
  
  // Notification aux bots de la collecte
  botManager.notifyBots('processorCollected', {
    id: data.processorId,
    type: processorType,
    playerId: socket.id
  });
}

function handleCannonCollected(socket, data) {
  // Validation de base
  if (!data || !data.cannonId) {
    console.log("Données de canon incomplètes");
    return;
  }
  
  // Vérifier que le canon existe
  if (!gameState.cannons[data.cannonId]) {
    console.log(`Canon inexistant: ${data.cannonId}`);
    return;
  }
  
  // Vérifier que le joueur existe
  if (!gameState.players[socket.id]) {
    console.log(`Joueur inexistant pour collecte: ${socket.id}`);
    return;
  }
  
  // Vérifier la distance entre le joueur et le canon
  const distance = calculateDistance(
    gameState.players[socket.id].position,
    gameState.cannons[data.cannonId].position
  );
  
  // Distance maximale de collecte (ajustée selon l'échelle du joueur)
  let baseCollectDistance = 2;
  if (gameState.players[socket.id].stats && gameState.players[socket.id].stats.processorCounts) {
    const totalProcessors = Object.values(gameState.players[socket.id].stats.processorCounts)
      .reduce((sum, count) => sum + count, 0);
    baseCollectDistance *= (1 + (totalProcessors * 0.005));
  }
  
  if (distance > baseCollectDistance) {
    console.log(`Distance de collecte de canon suspecte: ${distance.toFixed(2)} > ${baseCollectDistance.toFixed(2)}`);
    return;
  }
  
  // Supprimer le canon de l'état du jeu
  delete gameState.cannons[data.cannonId];
  
  // Diffuser l'information à tous les joueurs
  io.emit('cannonRemoved', {
    id: data.cannonId
  });
  
  // Notification aux bots
  botManager.notifyBots('cannonCollected', {
    id: data.cannonId,
    playerId: socket.id
  });
}

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
		endTime: currentGameState.endTime,
		currentTime: Date.now() // Ajouter l'heure actuelle du serveur pour référence
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
    handlePlayerJoin(socket, playerData);
    // Après avoir géré la connexion du joueur, ré-émettre les colliders
    botManager.resendBotColliders(socket);
  });
  
  // Gérer les dégâts aux structures
  socket.on('structureDamaged', (data) => {
    // Validation des données
    if (!data || !data.structureId || typeof data.damage !== 'number' || !isValidPosition(data.position)) {
      console.log("Données de structure invalides:", data);
      return;
    }
    
    if (gameState.structures[data.structureId]) {
      // Vérifier si le joueur est à portée raisonnable de la structure
      const structure = gameState.structures[data.structureId];
      const playerPosition = gameState.players[socket.id]?.position;
      
      if (playerPosition) {
        const distance = calculateDistance(playerPosition, structure.position);
        const MAX_STRUCTURE_ATTACK_RANGE = 20; // Distance maximale pour pouvoir attaquer une structure
        
        if (distance > MAX_STRUCTURE_ATTACK_RANGE) {
          console.log(`Tentative d'attaque de structure trop éloignée: ${distance.toFixed(2)} > ${MAX_STRUCTURE_ATTACK_RANGE}`);
          return;
        }
      }
      
      // Valider et limiter les dégâts
      const damage = Math.min(Math.max(1, data.damage), 50);
      
      // Appliquer les dégâts
      if (!structure.hp) structure.hp = 150; // Valeur par défaut si non définie
      if (!structure.maxHp) structure.maxHp = 150;
      
      structure.hp -= damage;
      
      // Vérifier si la structure est détruite
      if (structure.hp <= 0) {
        structure.hp = 0;
        structure.destroyed = true;
        
        // Informer tous les joueurs
        io.emit('structureDestroyed', {
          id: data.structureId,
          position: structure.position
        });
        
        // Notification aux bots
        botManager.notifyBots('structureDestroyed', {
          id: data.structureId,
          position: structure.position
        });
      } else {
        // Informer tous les joueurs des dégâts
        io.emit('structureDamaged', {
          id: data.structureId,
          damage: damage,
          hp: structure.hp
        });
        
        // Notification aux bots
        botManager.notifyBots('structureDamaged', {
          id: data.structureId,
          damage: damage,
          hp: structure.hp
        });
      }
    }
  });  
  
  // Mettre à jour la position du joueur
  socket.on('playerUpdate', (playerData) => {
    handlePlayerUpdate(socket, playerData);
  });
  
  // Gérer le tir
  socket.on('playerShoot', (projectileData) => {
    handlePlayerShoot(socket, projectileData);
  });
  
  // Gérer l'impact des projectiles
  socket.on('projectileHit', (data) => {
    // Validation de base
    if (!data.targetId || !isValidPosition(data.position)) {
      console.log("Données d'impact incomplètes ou invalides", data);
      return;
    }
    
    // Deux modes de validation : par ID direct ou par propriétaire/position
    let projectile = null;
    
    // Mode 1: Validation par ID (ancien système)
    if (data.projectileId && gameState.projectiles[data.projectileId]) {
      projectile = gameState.projectiles[data.projectileId];
    } 
    // Mode 2: Validation par propriétaire et position (nouveau système)
    else if (data.ownerId && data.position) {
      // Rechercher le projectile le plus probable (appartenant à ce joueur et proche de la position d'impact)
      const potentialProjectiles = Object.values(gameState.projectiles).filter(p => 
        p.ownerId === socket.id && 
        calculateDistance(p.position, data.position) < p.range * 0.5  // 50% de la portée pour la marge
      );
      
      // Si des projectiles potentiels sont trouvés, prendre le plus proche
      if (potentialProjectiles.length > 0) {
        projectile = potentialProjectiles.sort((a, b) => 
          calculateDistance(a.position, data.position) - calculateDistance(b.position, data.position)
        )[0];
      }
    }
    
    // Si aucun projectile n'est trouvé, utiliser un mode de validation simplifié
    if (!projectile) {
      console.log(`Projectile non trouvé, utilisation du mode de validation simplifié pour ${socket.id}`);
      
      // Vérifier que le joueur tire et que la cible existe
      if (!gameState.players[socket.id]) {
        console.log(`Tireur inexistant: ${socket.id}`);
        return;
      }
      
      if (data.targetType === 'player' && !gameState.players[data.targetId]) {
        console.log(`Impact avec joueur inexistant: ${data.targetId}`);
        return;
      }
      
      // Vérifier que le joueur ne triche pas en attaquant des cibles trop loin
      if (data.targetType === 'player') {
        const attackerPos = gameState.players[socket.id].position;
        const targetPos = gameState.players[data.targetId].position;
        const distance = calculateDistance(attackerPos, targetPos);
        const maxRange = gameState.players[socket.id].stats?.range || 10;
        
        if (distance > maxRange * 1.2) { // 20% de marge
          console.log(`Attaque à distance suspecte: ${distance.toFixed(2)} > ${maxRange}`);
          return;
        }
        
        // Créer un "faux" projectile pour le traitement
        projectile = {
          ownerId: socket.id,
          damage: gameState.players[socket.id].stats?.attack || 10
        };
      } else {
        return; // Abandonner si pas de joueur ciblé dans le mode simplifié
      }
    } else {
      // Pour les projectiles identifiés normalement, vérifier que le tireur est bien le propriétaire
      if (projectile.ownerId !== socket.id) {
        console.log(`Tentative d'usurpation de projectile: ${socket.id} pour ${projectile.ownerId}`);
        return;
      }
      
      // Vérifier le temps de vie du projectile
      const projectileAge = Date.now() - projectile.createdAt;
      const maxLifetime = 5000; // 5 secondes max
      
      if (projectileAge > maxLifetime) {
        console.log(`Projectile trop ancien: ${projectileAge}ms`);
        if (projectile.id) delete gameState.projectiles[projectile.id];
        return;
      }
      
      // Vérifier la distance d'impact
      if (projectile.position) {
        const distanceFromStart = calculateDistance(projectile.position, data.position);
        if (distanceFromStart > projectile.range * 1.1) { // 10% de marge d'erreur
          console.log(`Distance d'impact suspecte: ${distanceFromStart.toFixed(2)} > ${projectile.range}`);
          return;
        }
      }
    }
    
    // Vérification spécifique pour une cible joueur
    if (data.targetType === 'player' && data.targetId) {
      const targetPosition = gameState.players[data.targetId].position;
      const targetDistance = calculateDistance(data.position, targetPosition);
      
      // 3 unités = rayon de collision raisonnable (ajustement selon échelle du joueur)
      let collisionRadius = 3;
      
      // Ajuster le rayon de collision en fonction de la taille du joueur
      if (gameState.players[data.targetId].stats && gameState.players[data.targetId].stats.processorCounts) {
        const totalProcessors = Object.values(gameState.players[data.targetId].stats.processorCounts)
          .reduce((sum, count) => sum + count, 0);
        // Augmenter le rayon de 0.5% par processeur
        collisionRadius *= (1 + (totalProcessors * 0.005));
      }
      
      if (targetDistance > collisionRadius) {
        console.log(`Cible trop éloignée de l'impact: ${targetDistance.toFixed(2)} > ${collisionRadius}`);
        return;
      }
    }
    
    // Si toutes les vérifications passent, traiter l'impact
    if (projectile.id) delete gameState.projectiles[projectile.id];
    
    if (data.targetType === 'player' && gameState.players[data.targetId]) {
      // Calculer les dégâts en tenant compte de la résistance
      const rawDamage = projectile.damage || data.damage || 10;
      const resistance = gameState.players[data.targetId].stats?.resistance || 10;
      const reductionRatio = 1 - 1/(1 + resistance/100);
      const damage = Math.max(1, Math.round(rawDamage * (1 - reductionRatio)));
      
      // Appliquer les dégâts
      gameState.players[data.targetId].hp -= damage;
      
      // Vérifier si le joueur est mort
      if (gameState.players[data.targetId].hp <= 0) {
        gameState.players[data.targetId].hp = 0;
        gameState.players[data.targetId].isAlive = false;
        
        // Diffuser l'événement de mort du joueur
        io.emit('playerKilled', {
          id: data.targetId,
          killerId: socket.id
        });
        
        // Notification aux bots
        botManager.notifyBots('playerKilled', {
          id: data.targetId,
          killerId: socket.id
        });
        
        // Créer les processeurs largués
        spawnDroppedProcessors(data.targetId, data.position);
      }
      
      // Diffuser l'information des dégâts à tous les joueurs
      io.emit('playerDamaged', {
        id: data.targetId,
        damage: damage,
        hp: gameState.players[data.targetId].hp
      });
      
      // Notification aux bots
      botManager.notifyBots('playerDamaged', {
        id: data.targetId,
        damage: damage,
        hp: gameState.players[data.targetId].hp
      });
    }
    
    // Diffuser l'information de l'impact à tous les joueurs
    io.emit('projectileDestroyed', {
      id: data.projectileId || `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      position: data.position
    });
  });
 
  // Gérer la collecte de processeurs
  socket.on('processorCollected', (data) => {
    handleProcessorCollected(socket, data);
  });
  
  // Nouvel événement pour la collecte de canons
  socket.on('cannonCollected', (data) => {
    handleCannonCollected(socket, data);
  });
  
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
  
  // Gérer la déconnexion
  socket.on('disconnect', () => {
    console.log(`Joueur déconnecté: ${socket.id}`);
    
    // Pour l'instant, supprimer le joueur de l'état du jeu
    if (gameState.players[socket.id]) {
      // Vérifier si c'est un bot (mais ne pas les gérer ici, cela se fait via le botManager)
      const isBot = socket.id.startsWith('bot-');
      if (!isBot) {
        delete gameState.players[socket.id];
      }
    }
    
    // Informer tous les autres joueurs de la déconnexion (uniquement pour les joueurs humains)
    if (!socket.id.startsWith('bot-')) {
      io.emit('playerLeft', socket.id);
    }
  }); 
  
  socket.on('requestProcessorsUpdate', () => {
    // Envoyer la liste complète des processeurs actuels
    socket.emit('processorsUpdate', gameState.processors);
  });
});

// Appeler cette fonction au démarrage du serveur
generateStaticStructures();

// Démarrer les intervalles pour créer des objets
const PROCESSOR_SPAWN_INTERVAL = 500; // 0.5 seconde
const CANNON_SPAWN_INTERVAL = 30000; // 30 secondes

setInterval(spawnProcessors, PROCESSOR_SPAWN_INTERVAL);
setInterval(spawnCannons, CANNON_SPAWN_INTERVAL);

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  // Démarrer le cycle de jeu
  startGameCycle();
});
