<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot Warfare</title>
    <style>
        body { margin: 0; overflow: hidden; }
        canvas { display: block; }
        #info {
            position: absolute;
            bottom: 10px;
            left: 10px;
            color: white;
            font-family: Arial, sans-serif;
            background-color: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border-radius: 5px;
            width: 250px;
        }
        .stat {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
        }
        .stat-value {
            font-weight: bold;
        }
        .controls {
            font-size: 12px;
            margin-top: 10px;
            color: #aaa;
        }
        .floating-text {
            position: absolute;
            font-family: Arial, sans-serif;
            font-size: 16px;
            font-weight: bold;
            text-shadow: 0px 0px 3px #000;
            pointer-events: none;
            opacity: 1;
            transform: translateY(0);
            transition: opacity 1s, transform 1s;
            z-index: 100;
        }
        
        /* Styles pour le cycle de jeu */
        .podium-screen {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(20,20,50,0.95));
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 2000;
          color: white;
          font-family: 'Arial', sans-serif;
        }

        .podium-title {
          font-size: 42px;
          margin-bottom: 40px;
          text-transform: uppercase;
          text-shadow: 0 0 10px rgba(255,215,0,0.7);
          animation: glow 2s infinite alternate;
        }

        @keyframes glow {
          from {
            text-shadow: 0 0 10px rgba(255,215,0,0.7);
          }
          to {
            text-shadow: 0 0 20px rgba(255,215,0,1), 0 0 30px gold;
          }
        }

        .podium-container {
          display: flex;
          justify-content: center;
          align-items: flex-end;
          width: 80%;
          max-width: 800px;
          height: 350px;
          margin-bottom: 50px;
        }

        .podium-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          border-radius: 10px 10px 0 0;
          transition: all 0.5s ease-in-out;
          box-shadow: 0 0 20px rgba(0,0,0,0.5);
          overflow: hidden;
        }

        .podium-position {
          font-size: 36px;
          margin: 10px 0;
        }

        .podium-username {
          font-size: 22px;
          font-weight: bold;
          margin: 5px 0;
          text-align: center;
          padding: 0 10px;
        }

        .podium-score {
          font-size: 18px;
          margin: 5px 0 10px 0;
        }

        .podium-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background-color: #333;
          margin: 10px 0;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 32px;
        }

        .restart-counter {
          font-size: 24px;
          margin-top: 30px;
          animation: pulse 1s infinite alternate;
        }

        @keyframes pulse {
          from {
            transform: scale(1);
          }
          to {
            transform: scale(1.05);
          }
        }

        .game-clock {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 15px;
          border-radius: 20px;
          font-family: 'Arial', sans-serif;
          font-size: 16px;
          z-index: 1000;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
        }

        .game-info {
          display: flex;
          align-items: center;
        }

        .time-warning {
          color: #ff5555;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          50% {
            opacity: 0.5;
          }
        }
    </style>
</head>
<body>
	<div id="login-screen" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); display: flex; justify-content: center; align-items: center; z-index: 1000;">
		<div style="background-color: #333; padding: 20px; border-radius: 10px; text-align: center; max-width: 400px;">
			<h2 style="color: white; margin-bottom: 20px;">Robot Warfare</h2>
			<p style="color: white; margin-bottom: 20px;">Entrez un nom d'utilisateur pour rejoindre la bataille!</p>
			<input type="text" id="username-input" placeholder="Votre nom" style="padding: 8px; width: 80%; margin-bottom: 15px; border-radius: 5px; border: none;">
			<button id="join-button" style="background-color: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer;">Rejoindre</button>
		</div>
	</div>
    <div id="info">
        <div class="stat">
            <span>HP:</span>
            <span id="hp" class="stat-value">100</span><span class="stat-value">/</span><span id="maxhp" class="stat-value">100</span>
        </div>
        <div class="stat">
            <span>Défense:</span>
            <span id="def" class="stat-value">10</span>
        </div>
        <div class="stat">
            <span>Attaque:</span>
            <span id="atk" class="stat-value">10</span>
        </div>
        <div class="stat">
            <span>Cadence de tir:</span>
            <span id="atkspeed" class="stat-value">0.5</span>
        </div>
        <div class="stat">
            <span>Portée:</span>
            <span id="range" class="stat-value">10</span>
        </div>
        <div class="stat">
            <span>Vitesse:</span>
            <span id="speed" class="stat-value">0.02</span>
        </div>
        <div class="stat">
            <span>Réparation:</span>
            <span id="repair" class="stat-value">0.1</span>
        </div>
		<div class="stat">
			<span>Processeurs:</span>
			<span id="processors" class="stat-value">0</span>
		</div>
        <div class="controls">
            ← → : rotation | ↑ ↓ : avancer/reculer | Ctrl gauche: attaque
        </div>
    </div>
	<div id="scoreboard" style="position: absolute; top: 10px; right: 10px; color: white; font-family: Arial, sans-serif; background-color: rgba(0, 0, 0, 0.7); padding: 10px; border-radius: 5px; max-height: 300px; overflow-y: auto; width: 250px;">
		<h3 style="margin: 0 0 10px 0; text-align: center;">Joueurs</h3>
		<div id="players-list"></div>
	</div>
    <script type="module">
        import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.167.1/build/three.module.js';

		import { io } from 'https://cdn.socket.io/4.4.1/socket.io.esm.min.js';
		function disposeThreeObject(obj) {
			if (!obj) return;
			
			// Arrêter les animations éventuelles
			if (obj.userData && obj.userData.animationId) {
				cancelAnimationFrame(obj.userData.animationId);
			}
			
			// Parcourir les enfants récursivement
			while (obj.children && obj.children.length > 0) {
				disposeThreeObject(obj.children[0]);
				obj.remove(obj.children[0]);
			}
			
			// Disposer de la géométrie
			if (obj.geometry) {
				obj.geometry.dispose();
			}
			
			// Disposer des matériaux
			if (obj.material) {
				if (Array.isArray(obj.material)) {
					obj.material.forEach(mat => {
						if (mat.map) mat.map.dispose();
						if (mat.emissiveMap) mat.emissiveMap.dispose();
						if (mat.normalMap) mat.normalMap.dispose();
						if (mat.specularMap) mat.specularMap.dispose();
						mat.dispose();
					});
				} else {
					if (obj.material.map) obj.material.map.dispose();
					if (obj.material.emissiveMap) obj.material.emissiveMap.dispose();
					if (obj.material.normalMap) obj.material.normalMap.dispose();
					if (obj.material.specularMap) obj.material.specularMap.dispose();
					obj.material.dispose();
				}
			}
			
			// Nettoyer les éventuelles textures
			if (obj.texture) {
				obj.texture.dispose();
			}
		}
		// Nom d'utilisateur par défaut
		let username = `Robot-${Math.floor(Math.random() * 1000)}`;
		
		// Établir la connexion WebSocket
		const socket = io('https://airobotwarfare.onrender.com',{
			reconnectionAttempts: 5,       // Augmenter le nombre de tentatives de reconnexion
			reconnectionDelay: 1000,       // Commencer avec un délai court (1 seconde)
			reconnectionDelayMax: 5000,    // Maximum 5 secondes entre les tentatives
			timeout: 10000,                // Timeout de connexion de 10 secondes
			forceNew: true,                // Forcer une nouvelle connexion
			transports: ['websocket', 'polling']  // Essayer WebSocket d'abord, puis polling
		});
		
		// Configurer les écouteurs d'événements immédiatement
		setupSocketListeners();
		
		// Gestion des erreurs de connexion
		socket.on('connect_error', (err) => {
			console.error('Erreur de connexion au serveur:', err);
			showConnectionError();
		});

		// Afficher une notification d'erreur de connexion
		function showConnectionError() {
			const errorDiv = document.createElement('div');
			errorDiv.style.position = 'absolute';
			errorDiv.style.top = '10px';
			errorDiv.style.left = '50%';
			errorDiv.style.transform = 'translateX(-50%)';
			errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
			errorDiv.style.color = 'white';
			errorDiv.style.padding = '10px';
			errorDiv.style.borderRadius = '5px';
			errorDiv.style.zIndex = '1000';
			errorDiv.textContent = 'Erreur de connexion au serveur. Veuillez rafraîchir la page.';
			document.body.appendChild(errorDiv);
		}
		
		// Classe pour le contrôleur de caméra
		class CameraController {
			constructor(player) {
				// Référence au joueur
				this.player = player;
				
				// Mode de caméra actuel (troisième personne par défaut)
				this.mode = 'thirdPerson';
				
				// Paramètres de la caméra
				this.distance = 30;      // Distance entre la caméra et le joueur
				this.minDistance = 5;    // Distance minimale (pour zoom)
				this.maxDistance = 100;  // Distance maximale (pour zoom)
				this.height = 10;        // Hauteur relative de la caméra
				
				// Angles de rotation (en radians)
				this.rotationHorizontal = Math.PI;  // Rotation horizontale autour du joueur (commence derrière)
				this.rotationVertical = Math.PI / 6;  // Rotation verticale (inclinaison)
				this.minVerticalRotation = 0.1;  // Limite pour ne pas passer sous le sol
				this.maxVerticalRotation = Math.PI / 2 - 0.1;  // Limite pour ne pas passer au-dessus
				
				// État de la souris
				this.isMouseDown = false;
				this.mouseX = 0;
				this.mouseY = 0;
				
				// Sensibilité des contrôles
				this.rotationSpeed = 0.005;  // Vitesse de rotation avec la souris
				this.zoomSpeed = 1;        // Vitesse de zoom avec la molette (augmentée)
				
				// Retour automatique à la position troisième personne
				this.returnToThirdPerson = true;    // Si la caméra doit revenir derrière le joueur
				this.returnSpeed = 0.05;           // Vitesse de retour
				
				// Mettre en place les écouteurs d'événements
				this.setupEventListeners();
				
				// Ajouter les informations d'aide à l'interface
				this.addCameraControlsHelp();
			}
			
			// Configurer les écouteurs d'événements pour la souris
			setupEventListeners() {
				// Mouvement de la souris
				document.addEventListener('mousemove', (event) => {
					if (this.isMouseDown) {
						const deltaX = event.clientX - this.mouseX;
						const deltaY = event.clientY - this.mouseY;
						
						this.rotationHorizontal -= deltaX * this.rotationSpeed*1.1;
						this.rotationVertical += deltaY * this.rotationSpeed;
						
						// Limiter la rotation verticale pour éviter les problèmes
						this.rotationVertical = Math.max(this.minVerticalRotation, Math.min(this.maxVerticalRotation, this.rotationVertical));
					}
					
					this.mouseX = event.clientX;
					this.mouseY = event.clientY;
				});
				
				// Clic de souris
				document.addEventListener('mousedown', (event) => {
					// Clic droit uniquement pour la rotation de caméra
					if (event.button === 2) {
						this.isMouseDown = true;
						event.preventDefault();
					}
				});
				
				// Relâchement du clic
				document.addEventListener('mouseup', (event) => {
					if (event.button === 2) {
						this.isMouseDown = false;
					}
				});
				
				// Zoom avec la molette
				document.addEventListener('wheel', (event) => {
					const zoomAmount = event.deltaY * this.zoomSpeed / 100;
					this.distance += zoomAmount;
					this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
					
					event.preventDefault();
				}, { passive: false });
				
				// Empêcher le menu contextuel du clic droit
				document.addEventListener('contextmenu', (event) => {
					event.preventDefault();
				});
				
				// Touches pour changer de mode
				document.addEventListener('keydown', (event) => {
					if (event.key === 'c' || event.key === 'C') {
						this.toggleCameraMode();
					}
				});
			}
			
			// Passer au mode suivant
			toggleCameraMode() {
				const modes = ['thirdPerson', 'firstPerson', 'topDown'];
				const currentIndex = modes.indexOf(this.mode);
				const nextIndex = (currentIndex + 1) % modes.length;
				this.mode = modes[nextIndex];
				
				console.log(`Mode caméra: ${this.getCameraModeDescription()}`);
				this.updateCameraHelpDisplay();
				
				return this.mode;
			}
			
			// Obtenir une description du mode
			getCameraModeDescription() {
				switch (this.mode) {
					case 'thirdPerson': return "Vue troisième personne";
					case 'firstPerson': return "Vue première personne";
					case 'topDown': return "Vue de dessus";
					default: return "Mode inconnu";
				}
			}
			
			// Mettre à jour la position de la caméra
			updateCamera(camera) {
				if (!this.player.isAlive) return;
				
				switch(this.mode) {
					case 'thirdPerson':
						this.updateThirdPersonCamera(camera);
						break;
					case 'firstPerson':
						this.updateFirstPersonCamera(camera);
						break;
					case 'topDown':
						this.updateTopDownCamera(camera);
						break;
				}
			}
			
			// Mode troisième personne - caméra suivant le joueur
			updateThirdPersonCamera(camera) {
				// Si le bouton droit n'est pas enfoncé et qu'on est en mode retour automatique
				if (!this.isMouseDown && this.returnToThirdPerson && this.mode === 'thirdPerson') {
					// Calculer l'angle cible en utilisant la direction du joueur
					// La direction est stockée dans le joueur
					const playerDirection = this.player.direction.clone();
					
					// Calculer l'angle à partir du vecteur de direction (face à l'opposé)
					const targetAngle = Math.atan2(-playerDirection.x, -playerDirection.z);
					
					// Normaliser la différence d'angle
					let angleDiff = targetAngle - this.rotationHorizontal;
					if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
					if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
					
					// Appliquer un retour progressif
					if (Math.abs(angleDiff) > 0.05) {
						this.rotationHorizontal += angleDiff * this.returnSpeed;
					}
				}
				
				// Calculer la position de la caméra en coordonnées sphériques 
				const x = this.player.mesh.position.x + Math.sin(this.rotationHorizontal) * Math.cos(this.rotationVertical) * this.distance;
				const z = this.player.mesh.position.z + Math.cos(this.rotationHorizontal) * Math.cos(this.rotationVertical) * this.distance;
				const y = this.player.mesh.position.y + Math.sin(this.rotationVertical) * this.distance + this.height;
				
				// Mettre à jour la position de la caméra
				camera.position.set(x, y, z);
				
				// Restaurer le FOV normal
				camera.fov = 15;
				camera.updateProjectionMatrix();
				
				// Faire regarder la caméra vers le joueur
				camera.lookAt(
					this.player.mesh.position.x,
					this.player.mesh.position.y + 1, // Viser un peu au-dessus du centre du robot
					this.player.mesh.position.z
				);
			}
			
			// Mode première personne
			updateFirstPersonCamera(camera) {
				// Vérifier que le joueur est en vie
				if (!this.player.isAlive) return;

				try {
					// Position du groupe du canon (qui contient le viseur)
					const cannonPosition = new THREE.Vector3();
					
					// Obtenir la position mondiale du groupe du canon
					this.player.cannonGroup.updateWorldMatrix(true, false);
					cannonPosition.setFromMatrixPosition(this.player.cannonGroup.matrixWorld);
					
					// Ajouter un petit décalage vers le haut pour simuler la position du viseur
					cannonPosition.y += 0.2;
					
					// Positionner la caméra là où serait le viseur
					camera.position.copy(cannonPosition);
					
					// Obtenir la direction du canon
					const direction = new THREE.Vector3(0, 0, -1);
					direction.applyQuaternion(this.player.cannonGroup.getWorldQuaternion(new THREE.Quaternion()));
					
					// Assurer que la direction reste horizontale
					direction.y = 0;
					direction.normalize();
					
					// Calculer le point vers lequel la caméra regarde
					const lookTarget = new THREE.Vector3();
					lookTarget.copy(cannonPosition).add(direction.multiplyScalar(10));
					
					// Modifier le FOV pour une vue grand angle en première personne
					camera.fov = 80;
					camera.updateProjectionMatrix();
					
					camera.lookAt(lookTarget);
				} catch (error) {
					console.error("Erreur dans updateFirstPersonCamera:", error);
				}
			}
			
			// Mode vue de dessus
			updateTopDownCamera(camera) {
				const height = this.distance;
				
				// Position de la caméra au-dessus du joueur
				camera.position.set(
					this.player.mesh.position.x,
					this.player.mesh.position.y + height,
					this.player.mesh.position.z
				);
				
				// Orientation vers le joueur avec une rotation autour de l'axe vertical
				const target = new THREE.Vector3(
					this.player.mesh.position.x + Math.sin(this.rotationHorizontal) * 0.5,
					this.player.mesh.position.y,
					this.player.mesh.position.z + Math.cos(this.rotationHorizontal) * 0.5
				);
				
				// Restaurer le FOV normal
				camera.fov = 15;
				camera.updateProjectionMatrix();
				
				camera.lookAt(target);
			}
			
			// Ajouter les informations d'aide pour les contrôles de caméra
			addCameraControlsHelp() {
				// Créer l'élément d'aide
				const cameraHelp = document.createElement('div');
				cameraHelp.id = 'camera-help';
				cameraHelp.style.cssText = `
					position: absolute;
					top: 10px;
					left: 10px;
					color: white;
					font-family: Arial, sans-serif;
					background-color: rgba(0, 0, 0, 0.7);
					padding: 10px;
					border-radius: 5px;
					width: 250px;
					font-size: 14px;
				`;
				
				// Ajouter l'élément à la page
				document.body.appendChild(cameraHelp);
				
				// Mettre à jour l'affichage initial
				this.updateCameraHelpDisplay();
			}
			
			// Mettre à jour l'affichage de l'aide
			updateCameraHelpDisplay() {
				const cameraHelp = document.getElementById('camera-help');
				if (!cameraHelp) return;
				
				let helpContent = `<strong>Contrôles de caméra</strong><br>`;
				helpContent += `Mode actuel: <strong>${this.getCameraModeDescription()}</strong><br><br>`;
				helpContent += `<strong>Souris:</strong><br>`;
				helpContent += `Clic droit : Rotation de caméra<br>`;
				helpContent += `Molette: Zoom avant/arrière<br><br>`;
				helpContent += `<strong>Clavier:</strong><br>`;
				helpContent += `<strong>C</strong>: Changer de mode caméra<br>`;
				
				cameraHelp.innerHTML = helpContent;
			}
		}		
		
		// Classe pour les processeurs
        class Processor {
            constructor(scene, position, type, collisionSystem) {
                // Type de processeur (hp, resistance, attack, attackSpeed, range, speed, repairSpeed)
                this.type = type;
                
                // Propriétés visuelles selon le type
                const typeProperties = {
                    hp: { color: 0x00ff00, boost: 1 },             // Vert
                    resistance: { color: 0xffa500, boost: 1 },     // Orange
                    attack: { color: 0xff0000, boost: 1 },         // Rouge
                    attackSpeed: { color: 0xffff00, boost: 0.02 }, // Jaune
                    range: { color: 0x0000ff, boost: 1 },          // Bleu
                    speed: { color: 0x4b0082, boost: 0.003 },      // Indigo
                    repairSpeed: { color: 0x8a2be2, boost: 0.05 }  // Violet
                };
                
                this.boost = typeProperties[type].boost;
                const color = typeProperties[type].color;
                
                // Création du groupe pour contenir le processeur
                this.mesh = new THREE.Group();
                this.mesh.position.copy(position);
                
                // Matériau de base pour le processeur
                const baseMaterial = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.3,
                    metalness: 0.8,
                    emissive: color,
                    emissiveIntensity: 0.3
                });
                
                // Base du processeur (carré plat)
                const baseGeometry = new THREE.BoxGeometry(0.2, 0.02, 0.2);
                this.base = new THREE.Mesh(baseGeometry, baseMaterial);
                this.mesh.add(this.base);
                
                // Créer quelques "composants" simples pour ressembler à un processeur
                // Puce centrale
                const chipGeometry = new THREE.BoxGeometry(0.1, 0.03, 0.1);
                const chip = new THREE.Mesh(chipGeometry, baseMaterial);
                chip.position.y = 0.05;
                this.mesh.add(chip);
                
                // Quelques détails pour ressembler à un processeur
                const detailGeometry = new THREE.BoxGeometry(0.02, 0.01, 0.02);
                for (let i = 0; i < 4; i++) {
                    const detail = new THREE.Mesh(detailGeometry, baseMaterial);
                    // Placer les détails aux coins de la puce
                    detail.position.set(
                        (i % 2 ? 0.04 : -0.04),
                        0.04,
                        (i < 2 ? 0.04 : -0.04)
                    );
                    this.mesh.add(detail);
                }
                
                // Animation de flottement
                this.floatHeight = position.y;
                this.floatSpeed = 0.5;
                this.floatOffset = Math.random() * Math.PI * 2;
                
                // Ajouter à la scène
                scene.add(this.mesh);
                
                // Gestion des collisions
                this.collider = this.base;
                this.hasCollision = true;
                this.scene = scene;
                this.collisionSystem = collisionSystem;
                this.collisionSystem.addObject(this);
                
                // État d'animation pour le rebond quand un joueur est détruit
                this.isBouncing = false;
                this.bounceVelocity = { x: 0, y: 0, z: 0 };
                this.gravity = 0.005;
                this.friction = 0.98;
            }
            
            // Mise à jour du processeur
            update() {
                if (this.isBouncing) {
                    // Animation de rebond physique
                    this.updateBounce();
                } else {
                    // Animation de flottement standard
                    this.updateFloat();
                }
                
                // Rotation douce
                this.mesh.rotation.y += 0.01;
            }
            
            // Animation de flottement
            updateFloat() {
                const time = performance.now() * 0.001;
                // Amplitude de flottement augmentée pour plus de mouvement
                this.mesh.position.y = this.floatHeight + Math.sin(time * this.floatSpeed + this.floatOffset) * 0.15;
            }
            
            // Animation de rebond
            updateBounce() {
                // Appliquer la gravité à la vélocité verticale
                this.bounceVelocity.y -= this.gravity;
                
                // Mettre à jour la position
                this.mesh.position.x += this.bounceVelocity.x;
                this.mesh.position.y += this.bounceVelocity.y;
                this.mesh.position.z += this.bounceVelocity.z;
                
                // Appliquer la friction aux composantes horizontales
                this.bounceVelocity.x *= this.friction;
                this.bounceVelocity.z *= this.friction;
                
                // Rebond au sol
                if (this.mesh.position.y < 0.5) {
                    this.mesh.position.y = 0.5;
                    
                    // Rebond avec perte d'énergie
                    if (Math.abs(this.bounceVelocity.y) > 0.01) {
                        this.bounceVelocity.y = -this.bounceVelocity.y * 0.6;
                    } else {
                        // Arrêter le rebond si l'énergie est trop basse
                        this.bounceVelocity.y = 0;
                        this.isBouncing = false;
                        this.floatHeight = 0.5;
                    }
                }
                
                // Vérifier les limites de la carte pour éviter que les processeurs ne sortent
                const mapHalfWidth = 50; // Moitié de la largeur de la carte
                const mapHalfHeight = 50; // Moitié de la hauteur de la carte
                
                // Bornes X
                if (Math.abs(this.mesh.position.x) > mapHalfWidth - 1) {
                    // Inverser la direction et réduire la vélocité
                    if (this.mesh.position.x > 0) {
                        this.mesh.position.x = mapHalfWidth - 1;
                    } else {
                        this.mesh.position.x = -(mapHalfWidth - 1);
                    }
                    this.bounceVelocity.x = -this.bounceVelocity.x * 0.8;
                }
                
                // Bornes Z
                if (Math.abs(this.mesh.position.z) > mapHalfHeight - 1) {
                    // Inverser la direction et réduire la vélocité
                    if (this.mesh.position.z > 0) {
                        this.mesh.position.z = mapHalfHeight - 1;
                    } else {
                        this.mesh.position.z = -(mapHalfHeight - 1);
                    }
                    this.bounceVelocity.z = -this.bounceVelocity.z * 0.8;
                }
            }
            
            // Initialiser un rebond avec une vélocité aléatoire
            startBounce(origin) {
                this.isBouncing = true;
                
                // Direction aléatoire par rapport à l'origine
                const angle = Math.random() * Math.PI * 2;
                const distance = 0.5 + Math.random() * 1.5;
                
                this.bounceVelocity = {
                    x: Math.cos(angle) * distance * 0.05,
                    y: 0.1 + Math.random() * 0.1,
                    z: Math.sin(angle) * distance * 0.05
                };
            }
            
            // Détruire le processeur
            destroy() {
                this.scene.remove(this.mesh);
                this.collisionSystem.removeObject(this);
            }
        }

        // Classe pour les canons ramassables
        class Cannon {
            constructor(scene, position, collisionSystem) {
                // Groupe pour contenir le canon
                this.mesh = new THREE.Group();
                this.mesh.position.copy(position);
                
                // Matériau pour le canon
                const cannonMaterial = new THREE.MeshStandardMaterial({
                    color: 0x444444,
                    roughness: 0.5,
                    metalness: 0.8,
                    emissive: 0x222222,
                    emissiveIntensity: 0.2
                });
                
                // Base du canon
                const baseGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.08, 8);
                this.base = new THREE.Mesh(baseGeometry, cannonMaterial);
                this.mesh.add(this.base);
                
                // Canon
                const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.04, 0.15, 8);
                barrelGeometry.rotateX(Math.PI / 2);
                this.barrel = new THREE.Mesh(barrelGeometry, cannonMaterial);
                this.barrel.position.y = 0.06;
                this.barrel.position.z = -0.08;
                this.mesh.add(this.barrel);
                
                // Détails visuels
                const detailMaterial = new THREE.MeshStandardMaterial({
                    color: 0x666666,
                    roughness: 0.4,
                    metalness: 0.9
                });
                
                // Anneau autour du canon
                const ringGeometry = new THREE.TorusGeometry(0.04, 0.01, 8, 16);
                ringGeometry.rotateX(Math.PI / 2);
                this.ring = new THREE.Mesh(ringGeometry, detailMaterial);
                this.ring.position.y = 0.06;
                this.ring.position.z = -0.03;
                this.mesh.add(this.ring);
                
                // Animation de flottement
                this.floatHeight = position.y;
                this.floatSpeed = 0.7;
                this.floatOffset = Math.random() * Math.PI * 2;
                
                // Ajouter à la scène
                scene.add(this.mesh);
                
                // Gestion des collisions
                this.collider = this.base;
                this.hasCollision = true;
                this.scene = scene;
                this.collisionSystem = collisionSystem;
                this.collisionSystem.addObject(this);
                
                // Propriété pour identifier le type d'objet
                this.type = 'cannon';
                
                // État d'animation pour le rebond
                this.isBouncing = false;
                this.bounceVelocity = { x: 0, y: 0, z: 0 };
                this.gravity = 0.005;
                this.friction = 0.98;
            }
            
            // Mise à jour du canon
            update() {
                if (this.isBouncing) {
                    // Animation de rebond physique
                    this.updateBounce();
                } else {
                    // Animation de flottement standard
                    this.updateFloat();
                }
                
                // Rotation douce
                this.mesh.rotation.y += 0.015;
            }
            
            // Animation de flottement
            updateFloat() {
                const time = performance.now() * 0.001;
                this.mesh.position.y = this.floatHeight + Math.sin(time * this.floatSpeed + this.floatOffset) * 0.15;
            }
            
            // Animation de rebond
            updateBounce() {
                // Appliquer la gravité à la vélocité verticale
                this.bounceVelocity.y -= this.gravity;
                
                // Mettre à jour la position
                this.mesh.position.x += this.bounceVelocity.x;
                this.mesh.position.y += this.bounceVelocity.y;
                this.mesh.position.z += this.bounceVelocity.z;
                
                // Appliquer la friction aux composantes horizontales
                this.bounceVelocity.x *= this.friction;
                this.bounceVelocity.z *= this.friction;
                
                // Rebond au sol
                if (this.mesh.position.y < 0.5) {
                    this.mesh.position.y = 0.5;
                    
                    // Rebond avec perte d'énergie
                    if (Math.abs(this.bounceVelocity.y) > 0.01) {
                        this.bounceVelocity.y = -this.bounceVelocity.y * 0.6;
                    } else {
                        // Arrêter le rebond si l'énergie est trop basse
                        this.bounceVelocity.y = 0;
                        this.isBouncing = false;
                        this.floatHeight = 0.5;
                    }
                }
                
                // Vérifier les limites de la carte
                const mapHalfWidth = 50;
                const mapHalfHeight = 50;
                
                // Bornes X
                if (Math.abs(this.mesh.position.x) > mapHalfWidth - 1) {
                    if (this.mesh.position.x > 0) {
                        this.mesh.position.x = mapHalfWidth - 1;
                    } else {
                        this.mesh.position.x = -(mapHalfWidth - 1);
                    }
                    this.bounceVelocity.x = -this.bounceVelocity.x * 0.8;
                }
                
                // Bornes Z
                if (Math.abs(this.mesh.position.z) > mapHalfHeight - 1) {
                    if (this.mesh.position.z > 0) {
                        this.mesh.position.z = mapHalfHeight - 1;
                    } else {
                        this.mesh.position.z = -(mapHalfHeight - 1);
                    }
                    this.bounceVelocity.z = -this.bounceVelocity.z * 0.8;
                }
            }
            
            // Initialiser un rebond avec une vélocité aléatoire
            startBounce(origin) {
                this.isBouncing = true;
                
                // Direction aléatoire par rapport à l'origine
                const angle = Math.random() * Math.PI * 2;
                const distance = 0.5 + Math.random() * 1.5;
                
                this.bounceVelocity = {
                    x: Math.cos(angle) * distance * 0.05,
                    y: 0.1 + Math.random() * 0.1,
                    z: Math.sin(angle) * distance * 0.05
                };
            }
            
            // Détruire le canon
            destroy() {
                this.scene.remove(this.mesh);
                this.collisionSystem.removeObject(this);
            }
        }

        // Classe pour la gestion des collisions
        class CollisionSystem {
            constructor() {
                this.collidableObjects = [];
            }

            // Ajouter un objet au système de collision
            addObject(object) {
                if (object.collider && object.hasCollision) {
                    this.collidableObjects.push(object);
                }
            }

            // Retirer un objet du système de collision
            removeObject(object) {
                const index = this.collidableObjects.indexOf(object);
                if (index !== -1) {
                    this.collidableObjects.splice(index, 1);
                }
            }

            // Vérifier s'il y a collision entre deux objets
            checkCollision(obj1, obj2) {
                // Vérification simple basée sur les boîtes englobantes
                const box1 = new THREE.Box3().setFromObject(obj1.collider);
                const box2 = new THREE.Box3().setFromObject(obj2.collider);
                
                return box1.intersectsBox(box2);
            }

            // Vérifier les collisions pour un objet spécifique
            checkCollisionForObject(obj) {
                let collisions = [];
                
                for (const other of this.collidableObjects) {
                    // Ne pas vérifier la collision avec soi-même
                    if (other === obj) continue;
                    
                    if (this.checkCollision(obj, other)) {
                        collisions.push(other);
                    }
                }
                
                return collisions;
            }
			checkRayCollision(origin, direction, maxDistance, excludeObject) {
				const intersects = [];
				
				for (const obj of this.collidableObjects) {
					if (obj === excludeObject) continue;
					if (!obj.hasCollision || !obj.collider) continue;
					
					const raycaster = new THREE.Raycaster(origin, direction, 0, maxDistance);
					const objIntersects = raycaster.intersectObject(obj.collider, true);
					
					if (objIntersects.length > 0) {
						objIntersects.forEach(intersect => {
							intersects.push({
								distance: intersect.distance,
								point: intersect.point,
								normal: intersect.face.normal,
								object: obj
							});
						});
					}
				}
				
				// Trier par distance
				intersects.sort((a, b) => a.distance - b.distance);
				return intersects;
			}
        }

        // Classe pour les projectiles
        class Projectile {
            constructor(scene, position, direction, owner, collisionSystem) {
                // Groupe pour contenir le projectile et sa traînée
                this.group = new THREE.Group();
                this.group.position.copy(position);
                scene.add(this.group);
                
                // Propriétés de mouvement
                this.direction = direction.normalize();
                this.speed = 1;
                this.distance = 0;
                this.maxDistance = owner.range;
                
                // Propriétés de combat
                this.damage = owner.attack;
                this.owner = owner;
                
                // Créer un obus en forme de capsule (plus réaliste qu'une sphère)
                const capsuleLength = 0.05;
                const capsuleRadius = 0.03;
                const capsuleGeometry = new THREE.CapsuleGeometry(capsuleRadius, capsuleLength, 8, 8);
                const capsuleMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0xffcc00,  // Couleur dorée pour un obus
                    metalness: 0.8,
                    roughness: 0.2,
                    emissive: 0xff4400,
                    emissiveIntensity: 0.2
                });
                this.mesh = new THREE.Mesh(capsuleGeometry, capsuleMaterial);
                
                // Orienter l'obus dans la direction du tir
                this.mesh.rotation.x = Math.PI / 2;
                this.mesh.position.z = 0;
                this.group.add(this.mesh);
                

                
                // Propriétés de collision
                this.collider = this.mesh;
                this.hasCollision = true;
                this.collisionSystem = collisionSystem;
                this.collisionSystem.addObject(this);
                
                // Référence à la scène pour pouvoir supprimer le projectile
                this.scene = scene;
                
                // Ajouter une petite lumière au projectile
                this.light = new THREE.PointLight(0xff7700, 0.8, 1);
                this.light.position.copy(position);
                scene.add(this.light);
            }
            
            
			// Mettre à jour le projectile
			update() {
				// Déplacer le projectile
				this.group.position.add(this.direction.clone().multiplyScalar(this.speed));
				this.light.position.copy(this.group.position);
				
				// Faire tourner légèrement l'obus pour un effet réaliste
				this.mesh.rotation.z += 0.1;
							   
				// Mettre à jour la distance parcourue
				this.distance += this.speed;
				
				// Vérifier si le projectile a atteint sa portée maximale
				if (this.distance >= this.maxDistance) {
					this.explode();
					return false;
				}
				
				// Vérifier les collisions
				const collisions = this.collisionSystem.checkCollisionForObject(this);
				
				for (const obj of collisions) {
					// Ignorer le propriétaire du projectile
					if (obj === this.owner) continue;
					
					// Vérifier si c'est un objet avec lequel on peut collisionner
					if (obj.userData && (obj.userData.type === 'wall' || obj.userData.type === 'floor' || 
										 obj.userData.type === 'structure' || obj.userData.type === 'tree')) {
						// Si l'objet est destructible (possède takeDamage), infliger des dégâts
						if (obj.takeDamage) {
							// IMPORTANT: Envoyer au serveur si c'est le joueur principal
							if (player && player.isMainPlayer) {
								socket.emit('structureDamaged', {
									structureId: obj.id || '',
									damage: this.damage,
									position: {
										x: obj.mesh.position.x,
										y: obj.mesh.position.y,
										z: obj.mesh.position.z
									}
								});
							}
							obj.takeDamage(this.damage);
						}
						this.explode();
						return false;
					}
					
					// Si c'est un autre joueur, infliger des dégâts et créer une explosion
					else if (obj.takeDamage && obj !== this.owner) {
						// Déterminer l'ID du joueur touché (différent selon si c'est un joueur ou un autre objet)
						let targetId = '';
						
						// Vérifier si l'objet touché est un joueur
						if (obj instanceof Player) {
							targetId = obj.playerId;
							console.log("Joueur touché:", obj.username, "ID:", targetId);
							
							// Appliquer directement l'effet visuel localement pour feedback immédiat
							if (!player.isMainPlayer) { // Si c'est un autre joueur qui tire
								obj.showDamageEffect();
								createDamageText(obj.mesh.position, this.damage);
							}
						}
						
						// IMPORTANT: Envoyer l'impact au serveur uniquement si c'est le joueur principal
						if (player && player.isMainPlayer) {
							socket.emit('projectileHit', {
								projectileId: this.id || '',
								targetId: targetId,
								targetType: obj instanceof Player ? 'player' : 'structure',
								damage: this.damage,
								position: {
									x: this.group.position.x,
									y: this.group.position.y,
									z: this.group.position.z
								}
							});
							console.log("Impact envoyé au serveur:", targetId, this.damage);
						}
						
						this.explode();
						return false;
					}
				}
				
				return true;
			}
            // Créer une explosion et détruire le projectile
            explode() {
                // Créer un effet d'explosion
                this.createExplosionEffect();
                
                // Supprimer le projectile après un court délai pour voir l'explosion
                setTimeout(() => {
                    this.destroy();
                }, 100);
            }
            
            // Créer un effet d'explosion
            createExplosionEffect() {
                // Matériau pour l'explosion
                const explosionMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0xff6600,
                    emissive: 0xff9900,
                    emissiveIntensity: 1,
                    transparent: true,
                    opacity: 0.9
                });
                
                // Créer une sphère pour l'explosion
                const explosionGeometry = new THREE.SphereGeometry(0.3, 16, 16);
                const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
                explosion.position.copy(this.group.position);
                this.scene.add(explosion);
                
                // Faire grandir puis disparaître l'explosion
                let scale = 0.1;
                const expandExplosion = () => {
                    scale += 0.15;
                    explosion.scale.set(scale, scale, scale);
                    explosionMaterial.opacity -= 0.05;
                    
                    if (scale < 2) {
                        requestAnimationFrame(expandExplosion);
                    } else {
                        this.scene.remove(explosion);
						this.animationId = null; //suivre l'ID d'animation
                    }
                };
                
				this.animationId = requestAnimationFrame(expandExplosion);
                
                // Augmenter temporairement la luminosité du projectile
                this.light.intensity = 3;
                this.light.distance = 6;
            }
            
            // Détruire le projectile
            destroy() {
				// Annuler toutes les animations en cours
				if (this.animationId) {
					cancelAnimationFrame(this.animationId);
					this.animationId = null;
				}{
                this.scene.remove(this.group);
                this.scene.remove(this.light);
                this.collisionSystem.removeObject(this);
				}
			}		
	    }

		// Classe pour le réservoir d'eau sur tour en béton
		class WaterTower {
			constructor(scene, position, collisionSystem) {
				// Groupe principal pour contenir toute la structure
				this.mesh = new THREE.Group();
				this.mesh.position.copy(position);
				scene.add(this.mesh);
				
				// Références pour la gestion des collisions
				this.scene = scene;
				this.collisionSystem = collisionSystem;
				
				// Dimensions de la tour
				this.towerTopRadius = 1.5;
				this.towerBottomRadius = 2;
				this.towerHeight = 12;
				this.towerY = this.towerHeight / 2; // Position Y du centre de la tour
				
				// Dimensions de la base
				this.baseRadius = 2.5;
				this.baseHeight = 1;
				this.baseY = this.baseHeight / 2; // Position Y du centre de la base
				
				// Dimensions du réservoir (cône inversé)
				this.tankRadius = 3;    // Rayon de la base du cône
				this.tankHeight = 4;    // Hauteur du cône
				this.tankY = 12;        // Position Y du centre du réservoir
				
				// Dimensions du collider
				this.calculateColliderDimensions();
				
				// Matériaux
				this.concreteMaterial = new THREE.MeshStandardMaterial({
					color: 0x9c9c9c,          // Gris béton
					roughness: 0.9,           // Très rugueux
					metalness: 0.1,           // Peu métallique
					flatShading: true         // Rendu simple
				});
				
				this.tankMaterial = new THREE.MeshStandardMaterial({
					color: 0x9a9a9a,          // Gris métal un peu plus foncé
					roughness: 0.7,
					metalness: 0.3,
					flatShading: true
				});
				
				// Création des parties de la structure
				this.createTower();
				this.createWaterTank();
				
				// Configuration des collisions
				this.setupCollisions();
			}
			
			// Calculer les dimensions du collider en fonction de la structure
			calculateColliderDimensions() {
				// Rayon du collider exactement celui de la base
				this.colliderRadiusBottom = this.baseRadius;
				this.colliderRadiusTop = this.tankRadius; // Le cône est plus large au sommet
				
				// Hauteur totale (base + tour + cône)
				this.colliderHeight = this.tankY + (this.tankHeight / 2);
				
				// Position Y du collider
				this.colliderY = this.colliderHeight / 2;
			}
			
			// Créer la tour en béton
			createTower() {
				// Tour cylindrique principale
				const towerGeometry = new THREE.CylinderGeometry(
					this.towerTopRadius, 
					this.towerBottomRadius, 
					this.towerHeight, 
					8
				);
				this.tower = new THREE.Mesh(towerGeometry, this.concreteMaterial);
				this.tower.position.y = this.towerY;
				this.tower.castShadow = true;
				this.tower.receiveShadow = true;
				this.mesh.add(this.tower);
				
				// Base de la tour (légèrement plus large)
				const baseGeometry = new THREE.CylinderGeometry(
					this.baseRadius, 
					this.baseRadius, 
					this.baseHeight, 
					8
				);
				this.base = new THREE.Mesh(baseGeometry, this.concreteMaterial);
				this.base.position.y = this.baseY;
				this.base.castShadow = true;
				this.base.receiveShadow = true;
				this.mesh.add(this.base);
			}
			
			// Créer le réservoir d'eau (cône inversé)
			createWaterTank() {
				// Réservoir en forme de cône inversé
				const tankGeometry = new THREE.ConeGeometry(
					this.tankRadius,  // Rayon de la base du cône
					this.tankHeight,  // Hauteur du cône
					8                 // Segments
				);
				// Rotation pour l'inverser (pointe vers le bas)
				tankGeometry.rotateX(Math.PI);
				
				this.tank = new THREE.Mesh(tankGeometry, this.tankMaterial);
				this.tank.position.y = this.tankY;
				this.tank.castShadow = true;
				this.tank.receiveShadow = true;
				this.mesh.add(this.tank);
			}
			
			// Configurer les collisions
			setupCollisions() {
				// Créer un collider adapté aux dimensions de la structure
				const colliderGeometry = new THREE.CylinderGeometry(
					this.colliderRadiusBottom,//rayon du sommet
					this.colliderRadiusBottom, //rayon de la base du cylindre
					this.colliderHeight, //hauteur du cylindre
					8	//Nombre de segments sur la circonférence
				);
				const colliderMaterial = new THREE.MeshBasicMaterial({
					transparent: true,
					opacity: 0.0, // Invisible
					wireframe: true
				});
				
				this.colliderMesh = new THREE.Mesh(colliderGeometry, colliderMaterial);
				this.colliderMesh.position.y = this.colliderY;
				this.mesh.add(this.colliderMesh);
				
				// Définir le collider pour la détection de collision
				this.collider = this.colliderMesh;
				this.hasCollision = true;
				
				// Ajouter au système de collision
				this.collisionSystem.addObject(this);
				
				// Type d'objet pour le système de collision
				this.userData = { type: 'structure' };
			}
			
			// Méthode pour détruire l'objet proprement
			destroy() {
				this.scene.remove(this.mesh);
				this.collisionSystem.removeObject(this);
			}
		}

		// Classe pour l'arbre destructible avec variables de classe
		class Tree {
			constructor(scene, position, collisionSystem) {
				// Groupe principal pour contenir toute la structure
				this.mesh = new THREE.Group();
				this.mesh.position.copy(position);
				scene.add(this.mesh);
				
				// Références pour la gestion des collisions
				this.scene = scene;
				this.collisionSystem = collisionSystem;
				
				// Dimensions du tronc
				this.trunkHeight = 3;
				this.trunkTopRadius = 0.5;
				this.trunkBottomRadius = 0.7;
				this.trunkY = this.trunkHeight / 2; // Position Y du centre du tronc
				
				// Dimensions du feuillage
				this.foliageHeight = 5;
				this.foliageRadius = 2;
				this.foliageY = this.trunkHeight + (this.foliageHeight / 2); // Position Y du centre du feuillage
				
				// Dimensions du collider
				this.totalHeight = this.trunkHeight + this.foliageHeight;
				this.colliderY = this.totalHeight / 2;
				
				// Points de vie de l'arbre
				this.hp = 150;
				this.maxHp = 150;
				this.isAlive = true;
				
				// Créer la structure de l'arbre
				this.createTree();
				
				// Configuration des collisions
				this.setupCollisions();
			}
			
			// Créer la structure de l'arbre
			createTree() {
				// Matériaux
				this.trunkMaterial = new THREE.MeshStandardMaterial({
					color: 0x8B4513,          // Brun pour le tronc
					roughness: 0.9,
					metalness: 0.1
				});
				
				this.foliageMaterial = new THREE.MeshStandardMaterial({
					color: 0x228B22,          // Vert pour le feuillage
					roughness: 0.8,
					metalness: 0.0
				});
				
				this.originalTrunkColor = this.trunkMaterial.color.clone();
				this.originalFoliageColor = this.foliageMaterial.color.clone();
				
				// Tronc (cylindre)
				const trunkGeometry = new THREE.CylinderGeometry(
					this.trunkTopRadius, 
					this.trunkBottomRadius, 
					this.trunkHeight, 
					8
				);
				this.trunk = new THREE.Mesh(trunkGeometry, this.trunkMaterial);
				this.trunk.position.y = this.trunkY;
				this.trunk.castShadow = true;
				this.trunk.receiveShadow = true;
				this.mesh.add(this.trunk);
				
				// Feuillage (cône)
				const foliageGeometry = new THREE.ConeGeometry(
					this.foliageRadius, 
					this.foliageHeight, 
					8
				);
				this.foliage = new THREE.Mesh(foliageGeometry, this.foliageMaterial);
				this.foliage.position.y = this.foliageY;
				this.foliage.castShadow = true;
				this.foliage.receiveShadow = true;
				this.mesh.add(this.foliage);
			}
			
			// Configurer les collisions
			setupCollisions() {
				// Un seul collider qui englobe tout l'arbre
				const colliderGeometry = new THREE.CylinderGeometry(
					this.trunkBottomRadius,  // Utiliser le rayon du feuillage en haut
					this.trunkBottomRadius, // Utiliser le rayon du tronc en bas
					this.totalHeight,
					8	//nombre de segments
				);
				
				const colliderMaterial = new THREE.MeshBasicMaterial({
					transparent: true,
					opacity: 0.0, // Invisible
					wireframe: true
				});
				
				this.colliderMesh = new THREE.Mesh(colliderGeometry, colliderMaterial);
				this.colliderMesh.position.y = this.colliderY;
				this.mesh.add(this.colliderMesh);
				
				// Définir le collider pour la détection de collision
				this.collider = this.colliderMesh;
				this.hasCollision = true;
				
				// Ajouter au système de collision
				this.collisionSystem.addObject(this);
				
				// Type d'objet pour le système de collision
				this.userData = { type: 'tree' };
			}
			
			// Méthode pour recevoir des dégâts
			takeDamage(amount) {
				if (!this.isAlive) return;
				
			
				// Afficher le texte des dégâts
				//createDamageText(this.mesh.position, amount); Mis en commentaire pour éviter de voir le message deux fois
				
				// Effet visuel de dégâts
				this.showDamageEffect();
			}
			
			// Effet visuel pour les dégâts
			showDamageEffect() {
				// Changement temporaire de couleur pour indiquer les dégâts
				this.trunkMaterial.color.set(0xff0000);  // Rouge quand touché
				this.foliageMaterial.color.set(0xff0000);  // Rouge quand touché
				
				// Revenir aux couleurs d'origine après un délai
				setTimeout(() => {
					// Utiliser les couleurs originales stockées en tant que propriétés
					this.trunkMaterial.color.copy(this.originalTrunkColor);
					this.foliageMaterial.color.copy(this.originalFoliageColor);
				}, 200);
			}
			
			// Méthode appelée quand l'arbre est détruit
			die() {
				if (!this.isAlive) return; // Éviter de déclencher plusieurs fois
				
				this.isAlive = false;
				
				// Supprimer l'arbre de la scène
				this.destroy();
			}
			
			// Méthode pour détruire l'objet proprement
			destroy() {
				this.scene.remove(this.mesh);
				this.collisionSystem.removeObject(this);
			}
		}		
		
		// Classe pour la carte de jeu
        class GameMap {
            constructor(scene, collisionSystem) {
                this.width = 100;  // Largeur de la carte
                this.height = 100; // Hauteur de la carte
                this.collisionSystem = collisionSystem;
                this.scene = scene;
                this.structures = [];
				this.trees=[];
				
                // Créer un sol
                const floorGeometry = new THREE.PlaneGeometry(this.width, this.height);
                const floorMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x4b6043,
                    side: THREE.DoubleSide,
                    roughness: 0.8
                });
                this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
                this.floor.rotation.x = Math.PI / 2; // Rotation pour que le plan soit horizontal
                this.floor.position.y = 0;
                scene.add(this.floor);
                
                // Ajouter le sol au système de collision
                this.floor.userData.type = 'floor';
                this.collider = this.floor;  // Le collider est le mesh lui-même
                this.hasCollision = true;    // Activer les collisions
                this.userData = { type: 'floor' };
                this.collisionSystem.addObject(this);
                
                // Créer les bordures
                this.createBorders(scene);
                
				//Créer les structures
				//this.createStructures();
				
                // Grille pour aider à visualiser l'espace
                const gridHelper = new THREE.GridHelper(Math.max(this.width, this.height), Math.max(this.width, this.height) / 5);
                scene.add(gridHelper);
                
                // Gestion des processeurs
                this.processors = [];
                this.processorTypes = [
                    'hp', 'resistance', 'attack', 'attackSpeed', 
                    'range', 'speed', 'repairSpeed'
                ];
                
                // Fréquence d'apparition pour chaque type (en millisecondes)
                this.spawnRates = {
                    hp: 1000,         // 1 par seconde
                    resistance: 1000,
                    attack: 1000,
                    attackSpeed: 1000,
                    range: 1000,
                    speed: 1000,
                    repairSpeed: 1000
                };
                
                // Compteurs de temps pour le spawn de chaque type
                this.spawnCounters = {};
                this.processorTypes.forEach(type => {
                    this.spawnCounters[type] = 0;
                });
                
                // Nombre maximum de processeurs
                this.maxProcessors = 10000;
                
                // Gestion des canons
                this.cannons = [];
                this.cannonSpawnRate = 5000; // 5 secondes
                this.cannonSpawnCounter = 0;
            }
            
            // Créer des bordures visuelles autour de la carte
            createBorders(scene) {
                const borderMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0xff0000,
                    roughness: 0.7
                });
                
                // Hauteur des murs
                const wallHeight = 5;
                
                // Bordure Nord
                const northGeometry = new THREE.BoxGeometry(this.width, wallHeight, 1);
                this.northBorder = new THREE.Mesh(northGeometry, borderMaterial);
                this.northBorder.position.set(0, wallHeight/2, -this.height/2);
                this.northBorder.userData.type = 'wall';
                scene.add(this.northBorder);
                
                // Ajouter au système de collision
                this.northBorderObj = {
                    collider: this.northBorder,
                    hasCollision: true,
                    userData: { type: 'wall' }
                };
                this.collisionSystem.addObject(this.northBorderObj);
                
                // Bordure Sud
                const southGeometry = new THREE.BoxGeometry(this.width, wallHeight, 1);
                this.southBorder = new THREE.Mesh(southGeometry, borderMaterial);
                this.southBorder.position.set(0, wallHeight/2, this.height/2);
                this.southBorder.userData.type = 'wall';
                scene.add(this.southBorder);
                
                // Ajouter au système de collision
                this.southBorderObj = {
                    collider: this.southBorder,
                    hasCollision: true,
                    userData: { type: 'wall' }
                };
                this.collisionSystem.addObject(this.southBorderObj);
                
                // Bordure Est
                const eastGeometry = new THREE.BoxGeometry(1, wallHeight, this.height);
                this.eastBorder = new THREE.Mesh(eastGeometry, borderMaterial);
                this.eastBorder.position.set(this.width/2, wallHeight/2, 0);
                this.eastBorder.userData.type = 'wall';
                scene.add(this.eastBorder);
                
                // Ajouter au système de collision
                this.eastBorderObj = {
                    collider: this.eastBorder,
                    hasCollision: true,
                    userData: { type: 'wall' }
                };
                this.collisionSystem.addObject(this.eastBorderObj);
                
                // Bordure Ouest
                const westGeometry = new THREE.BoxGeometry(1, wallHeight, this.height);
                this.westBorder = new THREE.Mesh(westGeometry, borderMaterial);
                this.westBorder.position.set(-this.width/2, wallHeight/2, 0);
                this.westBorder.userData.type = 'wall';
                scene.add(this.westBorder);
                
                // Ajouter au système de collision
                this.westBorderObj = {
                    collider: this.westBorder,
                    hasCollision: true,
                    userData: { type: 'wall' }
                };
                this.collisionSystem.addObject(this.westBorderObj);
            }
            
			
			// Créer des arbres
			createTrees() {
				// Créer quelques arbres à des positions aléatoires
				const treeCount = 40; // Nombre d'arbres à créer
				
				for (let i = 0; i < treeCount; i++) {
					// Position aléatoire sur la carte (éviter le centre où se trouve la tour d'eau)
					let x, z;
					do {
						x = (Math.random() * this.width - this.width / 2) * 0.8;
						z = (Math.random() * this.height - this.height / 2) * 0.8;
					} while (Math.sqrt(x*x + z*z) < 20); // Éviter le centre
					
					const tree = new Tree(
						this.scene,
						new THREE.Vector3(x, 0, z),
						this.collisionSystem
					);
					
					this.trees.push(tree);
					this.structures.push(tree);
				}
			}
			
			// Créer les structures
			createStructures() {
				// Créer un château d'eau au centre de la carte
				const waterTower = new WaterTower(
					this.scene,
					new THREE.Vector3(0, 0, 0),
					this.collisionSystem
				);
				this.structures.push(waterTower);
				
				//Créer des arbres
				this.createTrees();
			}
	
            // Méthode pour créer un processeur aléatoirement sur la carte
            spawnProcessor(type) {
                // Vérifier si on a atteint le nombre maximum de processeurs
                if (this.processors.length >= this.maxProcessors) {
                    return;
                }
                
                // Position aléatoire sur la carte
                const x = Math.random() * this.width - this.width / 2;
                const z = Math.random() * this.height - this.height / 2;
                const y = 0.5; // Hauteur augmentée pour meilleure visibilité
                
                const position = new THREE.Vector3(x, y, z);
                
                // Créer le processeur
                const processor = new Processor(this.scene, position, type, this.collisionSystem);
                this.processors.push(processor);
                
                return processor;
            }
            
            // Méthode pour créer un canon
            spawnCannon() {
                // Vérifier si on a atteint le nombre maximum de canons (moins que les processeurs)
                if (this.cannons.length >= 20) {
                    return;
                }
                
                // Position aléatoire sur la carte
                const x = Math.random() * this.width - this.width / 2;
                const z = Math.random() * this.height - this.height / 2;
                const y = 0.5; // Hauteur augmentée pour meilleure visibilité
                
                const position = new THREE.Vector3(x, y, z);
                
                // Créer le canon
                const cannon = new Cannon(this.scene, position, this.collisionSystem);
                this.cannons.push(cannon);
                
                return cannon;
            }
            
   
            // Méthode pour supprimer un canon de la liste
            removeCannon(cannon) {
                const index = this.cannons.indexOf(cannon);
                if (index !== -1) {
                    this.cannons.splice(index, 1);
                }
            }
            
            
            // Mettre à jour les processeurs existants et créer de nouveaux si nécessaire
            updateProcessors(deltaTime) {
                // Mettre à jour les processeurs existants
                for (let i = this.processors.length - 1; i >= 0; i--) {
                    this.processors[i].update();
                }
                
                // Vérifier s'il faut créer de nouveaux processeurs
                this.processorTypes.forEach(type => {
                    this.spawnCounters[type] += deltaTime * 1000; // Convertir en millisecondes
                    
                    if (this.spawnCounters[type] >= this.spawnRates[type]) {
                        this.spawnProcessor(type);
                        this.spawnCounters[type] = 0;
                    }
                });
            }
            
            // Mettre à jour les canons
            updateCanons(deltaTime) {
                // Mise à jour des canons existants
                for (let i = this.cannons.length - 1; i >= 0; i--) {
                    this.cannons[i].update();
                }
                
                
                // Vérifier s'il faut créer un nouveau canon
                this.cannonSpawnCounter += deltaTime * 1000;
                if (this.cannonSpawnCounter >= this.cannonSpawnRate) {
                    this.spawnCannon();
                    this.cannonSpawnCounter = 0;
                }
                
            }
            
            // Supprimer un processeur de la liste
            removeProcessor(processor) {
                const index = this.processors.indexOf(processor);
                if (index !== -1) {
                    this.processors.splice(index, 1);
                }
            }
            
            // Faire apparaître plusieurs processeurs à un endroit donné (lors de la mort d'un joueur)
            spawnProcessorsAtLocation(position, typeAmounts) {
                Object.entries(typeAmounts).forEach(([type, amount]) => {
                    for (let i = 0; i < amount; i++) {
                        // Créer un nouveau processeur à la position donnée
                        const randomOffset = new THREE.Vector3(
                            (Math.random() - 0.5) * 2,
                            0.1,
                            (Math.random() - 0.5) * 2
                        );
                        
                        const spawnPos = position.clone().add(randomOffset);
                        spawnPos.y = 0.5; // S'assurer que les processeurs largués sont aussi en hauteur
                        const processor = new Processor(this.scene, spawnPos, type, this.collisionSystem);
                        this.processors.push(processor);
                        
                        // Démarrer l'animation de rebond
                        processor.startBounce(position);
                    }
                });
            }
        }

		// Classe pour le robot du joueur
		class Player {
			constructor(scene, gameMap, collisionSystem, playerId = null, isMainPlayer = true) {
				// Propriétés multijoueur
				this.playerId = playerId || `player-${Math.random().toString(36).substr(2, 9)}`;
				this.isMainPlayer = isMainPlayer;
				this.username = username || `Robot-${Math.floor(Math.random() * 1000)}`; // Utiliser le nom défini lors de la connexion
				
				// Groupe pour contenir toutes les parties du robot
				this.mesh = new THREE.Group();
				scene.add(this.mesh);
				
				// Propriétés de mouvement
				this.speed = 0.03;  
				this.rotationSpeed = 0.02; // Vitesse de rotation
				this.direction = new THREE.Vector3(0, 0, -1); // Direction initiale (vers le haut de l'écran)
				
				// Initialiser bodyParts avant de créer les composants du robot
				this.bodyParts = [];
				
				// Dimensions du corps (référence pour d'autres calculs)
				this.bodyWidth = 0.5;
				this.bodyHeight = 1;
				this.bodyDepth = 0.5;
				this.frameThickness = 0.08;
				this.bottomThickness = this.frameThickness * 6; // Épaisseur du panneau inférieur
				
				// Dimensions des colonnes de processeurs (définies comme propriétés de classe)
				this.columnWidth = 0.04;
				this.columnDepth = 0.15;
				
				// La hauteur des colonnes sera calculée dans createRobotBody() 
				// une fois qu'on aura la position exacte des panneaux
				this.columnHeight = 0;
				this.columnBottomY = 0;
				this.columnTopY = 0;
				
				// Créer le corps du robot
				this.createRobotBody();
				
				// Créer les roues
				this.createTracks();
				
				// Créer le canon
				this.createCannon();
				
				// Créer le collider APRÈS avoir créé toutes les parties du robot
				this.createCollider();
				
				// Stocker les couleurs originales pour l'effet de dégâts
				this.storeOriginalColors();

				// Propriétés de collision
				this.hasCollision = true;   // Activer les collisions
				
				// Référence à la scène, la carte et au système de collision
				this.scene = scene;
				this.gameMap = gameMap;
				this.collisionSystem = collisionSystem;
				this.collisionSystem.addObject(this);
				
				// Position initiale aléatoire sur la carte
				this.setRandomPosition();
				
				// Projectiles actifs
				this.projectiles = [];
				
				// Nouvelles propriétés de combat
				this.hp = 100;             // Points de vie
				this.maxHp = 100;          // Points de vie maximum
				this.resistance = 10;      // Résistance aux dégâts (défense)
				this.attack = 10;          // Puissance d'attaque
				this.attackSpeed = 0.5;    // Attaques par seconde
				this.range = 10;           // Portée d'attaque
				this.repairSpeed = 0.5;    // Vitesse de réparation (HP récupérés par seconde)
				this.isAlive = true;       // État du joueur
				
				// Échelle initiale pour la croissance
				this.baseScale = 1.0;
				
				// Compteurs pour les processeurs ramassés
				this.processorCounts = {
					hp: 0,
					resistance: 0,
					attack: 0,
					attackSpeed: 0,
					range: 0,
					speed: 0,
					repairSpeed: 0
				};
				
				// Total des processeurs pour tous les types
				this.totalProcessors = 0;
				
				// Gestion du cooldown d'attaque
				this.canAttack = true;
				this.lastAttackTime = 0;
				this.attackCooldown = 1000 / this.attackSpeed; // Conversion en millisecondes
				
                // Propriétés pour les canons
                this.sideCannons = []; // Canons supplémentaires sur les côtés
                this.maxSideCannons = 4; // Nombre maximum de canons supplémentaires
                this.sideCannonsGroup = new THREE.Group(); // Groupe pour contenir les canons latéraux
                this.mesh.add(this.sideCannonsGroup);
                
				// Mise à jour de l'interface utilisateur (uniquement pour le joueur principal)
				if (this.isMainPlayer) {
					this.updateUI();
				}
			}
			
			// Méthode pour créer le collider (nouvelle méthode)
			createCollider() {
				// Boîte de collision correspondant exactement au corps du robot
				const colliderGeometry = new THREE.BoxGeometry(
					this.bodyWidth + this.frameThickness,
					this.bodyHeight + (this.frameThickness/2) + (this.bottomThickness/2)+ 0.3, //0.2 est la hauteur du canon?
					this.bodyDepth
				);
				
				const colliderMaterial = new THREE.MeshBasicMaterial({ 
					transparent: true,
					opacity: 0.0, // Invisible en production
					wireframe: true
				});
				
				this.colliderMesh = new THREE.Mesh(colliderGeometry, colliderMaterial);
				this.colliderMesh.position.y = 0.5; // Centré verticalement par rapport au robot
				this.mesh.add(this.colliderMesh);
				
				// Définir le collider pour la détection de collision
				this.collider = this.colliderMesh;
			}
			
			// Définir une position aléatoire sur la carte
			setRandomPosition() {
				const halfWidth = this.gameMap.width / 2 - 2;  // -2 pour éviter de coller aux bords
				const halfHeight = this.gameMap.height / 2 - 2;
				
				this.mesh.position.x = Math.random() * halfWidth * 2 - halfWidth;
				this.mesh.position.y = 0.5;  // Moitié de la hauteur du cube
				this.mesh.position.z = Math.random() * halfHeight * 2 - halfHeight;
			}

			// Méthode pour déplacer le robot
			move(keys) {
				if (!this.isAlive) return;
				
				// Sauvegarde de la position actuelle pour pouvoir revenir en arrière si nécessaire
				const oldPosition = this.mesh.position.clone();
				
				// Rotation à gauche/droite
				if (keys.ArrowLeft) {
					// Tourner le robot
					this.mesh.rotation.y += this.rotationSpeed;
					
					// Mettre à jour le vecteur de direction
					this.direction.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
					
					// Animer les roues (rotation des roues)
					this.animateWheelsTurn(-1);
				}
				if (keys.ArrowRight) {
					// Tourner le robot
					this.mesh.rotation.y -= this.rotationSpeed;
					
					// Mettre à jour le vecteur de direction
					this.direction.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
					
					// Animer les roues (rotation des roues)
					this.animateWheelsTurn(1);
				}
				
				// Déplacement avant/arrière selon l'orientation
				if (keys.ArrowUp) {
					this.mesh.position.add(this.direction.clone().multiplyScalar(this.speed));
					
					// Animer les roues (mouvement vers l'avant)
					this.animateWheelsMovement(1);
				}
				if (keys.ArrowDown) {
					this.mesh.position.add(this.direction.clone().multiplyScalar(-this.speed));
					
					// Animer les roues (mouvement vers l'arrière)
					this.animateWheelsMovement(-1);
				}
				
				// Vérifier les collisions
				const collisions = this.collisionSystem.checkCollisionForObject(this);
				
				// Traiter les collisions
				this.handleCollisions(collisions, oldPosition);
				
			    // Si c'est le joueur principal, envoyer la mise à jour au serveur
				if (this.isMainPlayer && (keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight)) {
					socket.emit('playerUpdate', {
						position: this.mesh.position,
						rotation: this.mesh.rotation.y,
						direction: this.direction,
						isAlive: this.isAlive
					});
				}
			}
			
			// Méthode pour gérer les collisions
			handleCollisions(collisions, oldPosition) {
				// Séparer les collisions par type
				const blockingCollisions = [];
				const processorCollisions = [];
				const cannonCollisions = [];
				
				collisions.forEach(obj => {
					if (obj instanceof Processor) {
						processorCollisions.push(obj);
					} else if (obj instanceof Cannon) {
						cannonCollisions.push(obj);
					} else if (!(obj.userData && obj.userData.type === 'floor')) {
						blockingCollisions.push(obj);
					}
				});
				
				// Traiter les collectibles
				processorCollisions.forEach(processor => this.collectProcessor(processor));
				cannonCollisions.forEach(cannon => {
					if (this.addSideCannon()) {
						cannon.destroy();
						this.gameMap.removeCannon(cannon);
					}
				});
				
				// Gérer les collisions physiques avec les obstacles
				if (blockingCollisions.length > 0) {
					this.handlePhysicalCollisions(blockingCollisions, oldPosition);
				}
			}

			handlePhysicalCollisions(blockingCollisions, oldPosition) {
				// Direction de mouvement actuelle
				const movementDirection = new THREE.Vector3()
					.subVectors(this.mesh.position, oldPosition)
					.normalize();
				
				// Distance parcourue
				const distanceMoved = this.mesh.position.distanceTo(oldPosition);
				
				if (distanceMoved < 0.001) return; // Pas de mouvement significatif
				
				// Créer un raycaster pour la détection précise des collisions
				const raycaster = new THREE.Raycaster(
					oldPosition,
					movementDirection,
					0,
					distanceMoved * 1.1 // Légèrement plus long pour sécurité
				);
				
				// Collecter tous les objets de collision
				const colliderMeshes = blockingCollisions.map(obj => obj.collider);
				
				// Effectuer le raycasting
				const intersects = raycaster.intersectObjects(colliderMeshes, false);
				
				if (intersects.length > 0) {
					// Trouver l'intersection la plus proche
					const closestIntersect = intersects[0];
					
					// Calculer le point de contact
					const contactPoint = closestIntersect.point;
					
					// Obtenir la normale de surface au point d'impact
					const surfaceNormal = closestIntersect.face.normal.clone();
					
					// Si l'objet a une matrice de rotation, appliquer cette rotation à la normale
					if (closestIntersect.object.parent) {
						const parentRotation = new THREE.Matrix4();
						parentRotation.extractRotation(closestIntersect.object.parent.matrixWorld);
						surfaceNormal.applyMatrix4(parentRotation);
					}
					
					// Calculer le vecteur de réflexion (rebond)
					const reflectionVector = movementDirection.clone()
						.reflect(surfaceNormal)
						.normalize();
					
					// Décomposer le mouvement en composantes parallèle et perpendiculaire à la surface
					const dotProduct = movementDirection.dot(surfaceNormal);
					const parallelComponent = surfaceNormal.clone().multiplyScalar(dotProduct);
					const perpendicularComponent = new THREE.Vector3()
						.subVectors(movementDirection, parallelComponent);
					
					// Friction de surface (réduire la composante parallèle)
					const friction = 0.8; // 0 = glissant, 1 = totalement bloqué
					perpendicularComponent.multiplyScalar(1 - friction);
					
					// Calculer la nouvelle direction (glissement le long de la surface)
					const newDirection = perpendicularComponent.normalize();
					
					// Calculer la nouvelle position avec glissement
					// Placer le joueur légèrement avant le point de contact
					const safetyMargin = 0.05;
					const distanceToContact = oldPosition.distanceTo(contactPoint) - safetyMargin;
					
					// Positionner au point de contact sécurisé
					this.mesh.position.copy(oldPosition)
						.addScaledVector(movementDirection, distanceToContact);
					
					// Appliquer le glissement (seulement une petite fraction du mouvement original)
					const slideDistance = distanceMoved * 0.3 * (1 - friction);
					this.mesh.position.addScaledVector(newDirection, slideDistance);
					
					// Maintenir la hauteur Y
					this.mesh.position.y = oldPosition.y;
					
					// Effet visuel facultatif: petite secousse lors de l'impact
					this.showCollisionEffect(surfaceNormal);
				}
			}

			showCollisionEffect(normal) {
				// Intensité de l'effet basée sur la normale d'impact
				const intensity = Math.abs(normal.dot(this.direction)) * 0.3;
				if (intensity < 0.1) return; // Ignorer les impacts faibles
				
				// Animation de secousse
				const originalPosition = this.bodyGroup.position.clone();
				
				// Calculer le vecteur de secousse perpendiculaire à la direction de déplacement
				const shakeVector = new THREE.Vector3()
					.crossVectors(this.direction, new THREE.Vector3(0, 1, 0))
					.normalize()
					.multiplyScalar(intensity * 0.05);
				
				// Séquence de secousse
				this.bodyGroup.position.add(shakeVector);
				
				setTimeout(() => {
					this.bodyGroup.position.copy(originalPosition);
					setTimeout(() => {
						this.bodyGroup.position.sub(shakeVector.multiplyScalar(0.7));
						setTimeout(() => {
							this.bodyGroup.position.copy(originalPosition);
						}, 50);
					}, 50);
				}, 50);
			}
			// Collecter un processeur
			collectProcessor(processor) {
				const type = processor.type;
				const boost = processor.boost;
				
		        // Informer le serveur de la collecte
				if (this.isMainPlayer) {
					socket.emit('processorCollected', {
						processorId: processor.id || '',
						type: type,
						boost: boost
					});
				}
				
				// Augmenter le compteur du type correspondant
				const oldCount = this.processorCounts[type];
				this.processorCounts[type]++;
				this.totalProcessors++;
				
				// Texte et couleur selon le type de processeur
				let boostText = "";
				let textColor = "#FFFFFF";
				
				// Mettre à jour les statistiques en fonction du type
				switch(type) {
					case 'hp':
						this.maxHp += boost;
						// Augmenter également les HP actuels
						this.hp += boost;
						boostText = "HP+";
						textColor = "#00ff00"; // Vert
						break;
					case 'resistance':
						this.resistance += boost;
						boostText = "DEF+";
						textColor = "#ffa500"; // Orange
						break;
					case 'attack':
						this.attack += boost;
						boostText = "ATK+";
						textColor = "#ff0000"; // Rouge
						break;
					case 'attackSpeed':
						this.attackSpeed += boost;
						// Mettre à jour le cooldown d'attaque
						this.attackCooldown = 1000 / this.attackSpeed;
						boostText = "ATS+";
						textColor = "#ffff00"; // Jaune
						break;
					case 'range':
						this.range += boost;
						boostText = "RNG+";
						textColor = "#0000ff"; // Bleu
						break;
					case 'speed':
						this.speed += boost;
						boostText = "SPD+";
						textColor = "#4b0082"; // Indigo
						break;
					case 'repairSpeed':
						this.repairSpeed += boost;
						boostText = "RPS+";
						textColor = "#8a2be2"; // Violet
						break;
				}
				
				// Créer l'effet visuel de texte flottant
				this.createFloatingText(processor.mesh.position, boostText, textColor);
				
				// Faire grandir le robot
				this.baseScale += 0.005; // +0.5% par processeur
				this.updateScale();
				
				// Mettre à jour les indicateurs visuels
				this.updateProcessorIndicators();
				
				// Vérifier si on vient d'atteindre un multiple de 10
				const newCount = this.processorCounts[type];
				if (Math.floor(newCount / 10) > Math.floor(oldCount / 10)) {
					// Faire pulser la colonne uniquement si on vient de franchir un palier
					this.pulseProcessorColumn(this.processorColumns[type], type);
				}
				
				// Mettre à jour l'interface utilisateur
				this.updateUI();
				
				// Détruire le processeur
				processor.destroy();
				this.gameMap.removeProcessor(processor);
			}
			
			addSideCannon() {
				// Vérifier si on a atteint le nombre maximum de canons
				if (this.sideCannons.length >= this.maxSideCannons) {
					console.log("Nombre maximum de canons atteint");
					return false;
				}
				
				const cannonIndex = this.sideCannons.length;
				
				// Créer un nouveau groupe pour ce canon
				const cannonGroup = new THREE.Group();
				
				// Déterminer le côté (gauche ou droit) et la rangée
				const isLeftSide = cannonIndex % 2 === 0; // Pair = gauche, Impair = droite
				const rowIndex = Math.floor(cannonIndex / 2); // Détermine la rangée, indépendamment du côté
				
				const xOffset = isLeftSide ? -0.25 : 0.25; // Position latérale
				const yOffset = 0.9 - (rowIndex * 0.45); // Hauteur variable
				const zOffset = -0.2; // Espacement avant-arrière

				cannonGroup.position.set(
					xOffset,
					yOffset, // Hauteur dynamique
					zOffset
				);
				
				// Orienter le canon vers l'avant
				cannonGroup.rotation.y = 0;
				
				// Matériaux
				const barrelMaterial = new THREE.MeshStandardMaterial({ 
					color: 0x666666,
					roughness: 0.4,
					metalness: 0.8
				});
				
				const baseMaterial = new THREE.MeshStandardMaterial({ 
					color: 0x444444,
					roughness: 0.6,
					metalness: 0.6
				});
				
				// Base du canon
				const baseGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.2);
				const base = new THREE.Mesh(baseGeometry, baseMaterial);
				cannonGroup.add(base);
				
				// Canon
				const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10);
				barrelGeometry.rotateX(Math.PI / 2); // Orienter horizontalement
				const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
				barrel.position.z = -0.12; // Positionner à l'avant
				cannonGroup.add(barrel);
				
				// Ajouter le canon au groupe des canons latéraux
				this.sideCannonsGroup.add(cannonGroup);
				
				// Ajouter à la liste des canons avec une référence à son groupe et au canon
				this.sideCannons.push({
					group: cannonGroup,
					barrel: barrel,
					basePosition: barrel.position.z // Pour l'animation de recul
				});
				
				// Ajouter aux parties du corps pour les effets de dégâts
				this.bodyParts.push(base, barrel);
				
				// Créer un texte flottant pour indiquer l'ajout du canon
				this.createFloatingText(this.mesh.position, "CANON+", "#ffffff");
				
				return true;
			}
            
			// Mettre à jour l'échelle du robot
			updateScale() {
				this.mesh.scale.set(this.baseScale, this.baseScale, this.baseScale);
				    // Signaler au système de collision que notre collider a changé
				if (this.collisionSystem) {
					// Retirer temporairement l'objet du système de collision
					this.collisionSystem.removeObject(this);
					// Le rajouter pour que le système recalcule les dimensions
					this.collisionSystem.addObject(this);
				}
			}
			
			// Animation des chenilles lors du mouvement avant/arrière
			animateWheelsMovement(direction) {
				// Animer uniquement les segments de chenilles
				if (this.leftTrackSegments && this.rightTrackSegments) {
					// Décaler les segments vers l'avant ou l'arrière
					const segmentShift = 0.003 * direction * (this.speed / 0.02);
					
					// Animer les segments gauches et droits de manière identique lors du mouvement droit
					[this.leftTrackSegments, this.rightTrackSegments].forEach(segments => {
						segments.forEach(segment => {
							segment.position.z += segmentShift;
							
							// Si le segment sort des limites, le replacer à l'autre extrémité
							const limit = 0.35; // Moitié de la longueur de la chenille
							if (segment.position.z > limit) {
								segment.position.z = -limit;
							} else if (segment.position.z < -limit) {
								segment.position.z = limit;
							}
						});
					});
				}
			}
			
			// Animation des chenilles lors de la rotation
			animateWheelsTurn(direction) {
				// Simuler un différentiel de rotation des chenilles lors d'un virage
				// direction: 1 pour droite, -1 pour gauche
				
				// Animer uniquement les segments de chenilles avec différentiel
				if (this.leftTrackSegments && this.rightTrackSegments) {
					// Le côté extérieur se déplace plus vite que le côté intérieur
					// Augmentons la différence de vitesse pour un effet plus visible
					const leftShift = direction > 0 ? -0.001 : -0.004;
					const rightShift = direction > 0 ? -0.004 : -0.001;
					
					// Animer les segments gauches
					this.leftTrackSegments.forEach(segment => {
						segment.position.z += leftShift;
						const limit = 0.35;
						if (segment.position.z > limit) {
							segment.position.z = -limit;
						} else if (segment.position.z < -limit) {
							segment.position.z = limit;
						}
					});
					
					// Animer les segments droits
					this.rightTrackSegments.forEach(segment => {
						segment.position.z += rightShift;
						const limit = 0.35;
						if (segment.position.z > limit) {
							segment.position.z = -limit;
						} else if (segment.position.z < -limit) {
							segment.position.z = limit;
						}
					});
				}
			}
			
			// Méthode pour gérer l'attaque
			doAttack(keys, time) {
				if (!this.isAlive) return false;
				
				// Mettre à jour l'orientation du canon pour qu'il suive la direction du joueur
				this.updateCannonDirection();
				
				// Vérifier si le joueur appuie sur Ctrl gauche et si l'attaque est disponible
				if (keys.Control && this.canAttack) {
					console.log("Attaque! Puissance:", this.attack, "Portée:", this.range);
					
					// Créer un projectile dans la direction que regarde le joueur
					try {
						const projectile = this.fireProjectile();
						
						// Vérifier que le projectile a bien été créé
						if (projectile && projectile.group) {
							// Si c'est le joueur principal, informer le serveur
							if (this.isMainPlayer) {
								socket.emit('playerShoot', {
								    projectileId: projectile.id, // Ajouter l'ID temporaire
									position: projectile.group.position,
									direction: projectile.direction,
									damage: this.attack,
									range: this.range
								});
							}
						}
					} catch (error) {
						console.error("Erreur lors du tir:", error);
					}
					
					// Mettre en place le cooldown
					this.canAttack = false;
					this.lastAttackTime = time;
					
					return true; // Une attaque a été effectuée
				}
				
				// Vérifier si le cooldown est terminé
				if (!this.canAttack && (time - this.lastAttackTime) >= this.attackCooldown) {
					this.canAttack = true;
				}
				
				// Mettre à jour les projectiles
				this.updateProjectiles();
				
				return false;
			}
			
			// Mettre à jour l'orientation du canon
			updateCannonDirection() {
				// Le canon pointe toujours dans la même direction que le robot
				// La rotation est déjà gérée par la hiérarchie des objets 3D
				// Mais on pourrait ajouter ici des animations supplémentaires
				
				// Faire légèrement bouger le canon pour un effet de "respiration"
				const time = performance.now() * 0.001;
				const breathingOffset = Math.sin(time * 2) * 0.005;
				this.cannonGroup.position.y = 0 + breathingOffset;
			}
			
			// Créer un projectile
            fireProjectile() {
                // Utiliser la direction actuelle du joueur
                const direction = this.direction.clone();
                
                // Tir du canon simple
                this.fireFromBarrel(this.cannonBarrel, direction);
                    
                // Effet de recul du canon
                this.showRecoilEffect();
                
                // Tir des canons latéraux
                this.sideCannons.forEach(cannon => {
                    // Direction de tir basée sur la rotation du canon
                    const cannonDirection = new THREE.Vector3(0, 0, -1);
                    cannonDirection.applyQuaternion(cannon.group.getWorldQuaternion(new THREE.Quaternion()));
                    
                    // Position mondiale du bout du canon
                    const barrelTip = new THREE.Vector3(0, 0, cannon.basePosition - 0.1);
                    const worldPosition = new THREE.Vector3();
                    
                    // Convertir la position locale en position mondiale
                    cannon.group.updateMatrixWorld();
                    worldPosition.copy(barrelTip).applyMatrix4(cannon.group.matrixWorld);
                    
                    // Créer le projectile
                    const projectile = new Projectile(this.scene, worldPosition, cannonDirection, this, this.collisionSystem);
                    this.projectiles.push(projectile);
                    
                    // Effet de recul
                    this.showSideCannonRecoilEffect(cannon);
                });
            }
            
            // Méthode auxiliaire pour tirer depuis un canon spécifique
			fireFromBarrel(barrel, direction) {
				// Position mondiale du bout du canon
				const barrelTip = new THREE.Vector3(0, 0, -0.7);
				const worldPosition = new THREE.Vector3();
				
				// Convertir la position locale en position mondiale
				this.cannonGroup.updateMatrixWorld();
				worldPosition.copy(barrelTip).applyMatrix4(this.cannonGroup.matrixWorld);
				
				// Créer un ID temporaire pour le projectile
				const tempId = `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
				
				// Créer le projectile
				const projectile = new Projectile(this.scene, worldPosition, direction, this, this.collisionSystem);
				projectile.id = tempId; // Assigner l'ID temporaire
				this.projectiles.push(projectile);
				
				return projectile;
			}    
			
            // Effet de recul pour les canons latéraux
			showSideCannonRecoilEffect(cannon) {
				// Si l'état initial n'est pas enregistré, le faire maintenant
				if (!cannon.initialPosition) {
					cannon.initialPosition = cannon.barrel.position.clone();
				}
				
				// Reculer le canon
				cannon.barrel.position.z += 0.08;
				
				// Revenir à la position initiale stockée
				setTimeout(() => {
					if (cannon.initialPosition) {
						cannon.barrel.position.copy(cannon.initialPosition);
					}
				}, 100);
			}
			
			// Effet de recul lors du tir
			showRecoilEffect() {
				// Si l'état initial n'est pas enregistré, le faire maintenant
				if (!this.cannonBarrelInitialState) {
					this.cannonBarrelInitialState = {
						position: this.cannonBarrel.position.clone()
					};
				}
				
				// Reculer le canon
				this.cannonBarrel.position.z += 0.1;
				
				// Revenir à la position initiale stockée
				setTimeout(() => {
					if (this.cannonBarrelInitialState) {
						this.cannonBarrel.position.copy(this.cannonBarrelInitialState.position);
					}
				}, 100);
			}
			
			// Mettre à jour les projectiles
			updateProjectiles() {
				for (let i = this.projectiles.length - 1; i >= 0; i--) {
					const isActive = this.projectiles[i].update();
					if (!isActive) {
						this.projectiles.splice(i, 1);
					}
				}
			}
			
			// Méthode pour recevoir des dégâts
			takeDamage(amount) {
				if (!this.isAlive) return;
				
				// Réduire les dégâts en fonction de la résistance
				const reductionRatio = 1 - 1/(1 + this.resistance/100);
				const actualDamage = Math.max(1, Math.round(amount * (1 - reductionRatio)));
				
				this.hp -= actualDamage;
				console.log(`Robot touché! Dégâts: ${actualDamage}, HP restants: ${this.hp}`);
				
				// Afficher le texte des dégâts
				createDamageText(this.mesh.position, actualDamage);
				
				// Effet visuel de dégâts
				this.showDamageEffect();
				
				// Mettre à jour l'interface utilisateur
				this.updateUI();
				
				// Vérifier si le joueur est mort
				if (this.hp <= 0) {
					console.log("Le robot est détruit!");
					this.hp = 0; // Empêcher les HP négatifs
					this.updateUI();
					this.die();
				}
				
				// Si c'est le joueur principal, mettre à jour le serveur
				if (this.isMainPlayer) {
					socket.emit('playerUpdate', {
						hp: this.hp,
						isAlive: this.isAlive
					});
				}
			}
			
			// Méthode appelée quand le robot est détruit
			die() {
				if (!this.isAlive) return; // Éviter de déclencher plusieurs fois
				
				this.isAlive = false;
				
				// Marquer le robot comme mort
				console.log("Le robot est détruit! Libération des processeurs...");
				
				// Créer un objet pour suivre combien de processeurs de chaque type vont tomber
				const droppedProcessors = {};
				
				// Pour chaque type de processeur, faire tomber 1/10 des processeurs
				Object.entries(this.processorCounts).forEach(([type, count]) => {
					// Calculer combien de processeurs vont tomber (arrondi à l'entier)
					const dropCount = Math.floor(count / 10);
					
					if (dropCount > 0) {
						droppedProcessors[type] = dropCount;
					}
				});
				
				// Faire apparaître les processeurs autour de la position du robot
				this.gameMap.spawnProcessorsAtLocation(this.mesh.position, droppedProcessors);
				
				// Effet visuel de destruction
				this.showDestructionEffect();
				
                // Réinitialiser les canons lors de la mort
                this.sideCannons = [];
                this.sideCannonsGroup.clear();
                
			}
				
			// Effet visuel lors de la destruction du robot
			showDestructionEffect() {
				// Masquer visuellement le robot (vous pourriez ajouter une animation plus complexe)
				this.mesh.visible = false;
				
				// Créer une explosion à la position du robot
				const explosionGeometry = new THREE.SphereGeometry(1, 16, 16);
				const explosionMaterial = new THREE.MeshStandardMaterial({ 
					color: 0xff6600,
					emissive: 0xff9900,
					emissiveIntensity: 1,
					transparent: true,
					opacity: 0.9
				});
				
				const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
				explosion.position.copy(this.mesh.position);
				this.scene.add(explosion);
				
				// Faire grandir puis disparaître l'explosion
				let scale = 0.1;
				const expandExplosion = () => {
					scale += 0.2;
					explosion.scale.set(scale, scale, scale);
					explosionMaterial.opacity -= 0.03;
					
					if (scale < 5) {
						requestAnimationFrame(expandExplosion);
					} else {
						this.scene.remove(explosion);
					}
				};
				
				expandExplosion();
			}
			
			//Conserver les couleurs originales
			storeOriginalColors() {
				// Créer un tableau pour stocker les couleurs originales de chaque partie
				this.originalBodyColors = [];
				this.bodyParts.forEach(part => {
					if (part && part.material && part.material.color) {
						this.originalBodyColors.push(part.material.color.clone());
					} else {
						// Couleur par défaut au cas où
						this.originalBodyColors.push(new THREE.Color(0x3a7d44));
					}
				});
			}

			// Effet visuel pour les dégâts
			showDamageEffect() {
				// Change la couleur du corps du robot pendant un court moment
				this.bodyParts.forEach(part => {
					if (part && part.material) {
						part.material.color.set(0xff0000);  // Rouge quand touché
					}
				});
				
				// Revenir aux couleurs d'origine après un délai
				setTimeout(() => {
					this.bodyParts.forEach((part, index) => {
						if (part && part.material && index < this.originalBodyColors.length) {
							part.material.color.copy(this.originalBodyColors[index]);
						}
					});
				}, 200);
			}
			
			// Créer le corps du robot (cadre rectangulaire avec colonnes à l'intérieur)
			createRobotBody() {
				// Groupe pour le corps
				this.bodyGroup = new THREE.Group();
				this.mesh.add(this.bodyGroup);
				
				// Matériaux pour le corps et les cadres
				const bodyMaterial = new THREE.MeshStandardMaterial({ 
					color: 0x3a7d44,  // Vert militaire
					roughness: 0.7,
					metalness: 0.5
				});
				
				const frameMaterial = new THREE.MeshStandardMaterial({ 
					color: 0x294d2f,  // Vert foncé pour les bordures
					roughness: 0.6,
					metalness: 0.7
				});
				
				// Dimensions du corps
				const bodyWidth = this.bodyWidth;
				const bodyHeight = this.bodyHeight;
				const bodyDepth = this.bodyDepth;
				const frameThickness = this.frameThickness;
				
				// Créer le cadre rectangulaire vide (en créant 5 panneaux séparés)
				
				// Panneau inférieur (plus épais)
				const bottomGeometry = new THREE.BoxGeometry(bodyWidth, this.bottomThickness, bodyDepth);
				const bottomPanel = new THREE.Mesh(bottomGeometry, frameMaterial);
				bottomPanel.position.y = 0.215 + (this.bottomThickness - frameThickness)/2; // Ajusté pour la nouvelle épaisseur
				bottomPanel.castShadow = true;
				bottomPanel.receiveShadow = true;
				this.bodyGroup.add(bottomPanel);
				
				// Panneau supérieur
				const topGeometry = new THREE.BoxGeometry(bodyWidth, frameThickness, bodyDepth);
				const topPanel = new THREE.Mesh(topGeometry, frameMaterial);
				topPanel.position.y = 0.215 + bodyHeight - frameThickness;
				topPanel.castShadow = true;
				topPanel.receiveShadow = true;
				this.bodyGroup.add(topPanel);
				
				// Panneaux latéraux
				const leftGeometry = new THREE.BoxGeometry(frameThickness, bodyHeight, bodyDepth);
				const leftPanel = new THREE.Mesh(leftGeometry, frameMaterial);
				leftPanel.position.x = -bodyWidth/2 + frameThickness/2;
				leftPanel.position.y = 0.215 + bodyHeight/2;
				leftPanel.castShadow = true;
				leftPanel.receiveShadow = true;
				this.bodyGroup.add(leftPanel);
				
				const rightGeometry = new THREE.BoxGeometry(frameThickness, bodyHeight, bodyDepth);
				const rightPanel = new THREE.Mesh(rightGeometry, frameMaterial);
				rightPanel.position.x = bodyWidth/2 - frameThickness/2;
				rightPanel.position.y = 0.215 + bodyHeight/2;
				rightPanel.castShadow = true;
				rightPanel.receiveShadow = true;
				this.bodyGroup.add(rightPanel);
				
				// Référence pour les autres méthodes
				this.body = this.bodyGroup;
				
				// Ajouter les parties à bodyParts
				this.bodyParts.push(bottomPanel, topPanel, leftPanel, rightPanel);
				
				// Créer une plaque de base non transparente
				const basePlateGeometry = new THREE.BoxGeometry(bodyWidth - 2*frameThickness, frameThickness/2, bodyDepth - 2*frameThickness);
				const basePlateMaterial = new THREE.MeshStandardMaterial({
					color: 0x555555,
					roughness: 0.5,
					metalness: 0.8
				});
				const basePlate = new THREE.Mesh(basePlateGeometry, basePlateMaterial);
				basePlate.position.y = 0.05 + frameThickness*1.5;
				this.bodyGroup.add(basePlate);
				this.bodyParts.push(basePlate);
				
				// Calculer les positions et dimensions pour les colonnes de processeurs
				// Le bas du conteneur est juste au-dessus du panneau inférieur (sans espacement supplémentaire)
				this.columnBottomY = 0.2 + this.bottomThickness;
				
				// Le haut du conteneur est juste en dessous du panneau supérieur
				this.columnTopY = 0.2 + bodyHeight - frameThickness - 0.02;
				
				// Calculer la hauteur du conteneur
				this.columnHeight = this.columnTopY - this.columnBottomY;
				
				// Position centrale du conteneur (pour le positionnement Three.js qui est basé sur le centre)
				this.columnCenterY = this.columnBottomY + this.columnHeight / 2;
				
				// Ajustement supplémentaire pour aligner parfaitement les conteneurs
				this.columnCenterY -= 0.05; // Décaler légèrement vers le bas
				
				// Créer les colonnes d'indicateurs de processeurs
				this.createProcessorColumns();
			}
			
			// Créer les colonnes d'indicateurs pour les processeurs
			createProcessorColumns() {
				// Garder une référence aux colonnes pour pouvoir les mettre à jour
				this.processorColumns = {};
				
				// Définir les propriétés et leurs couleurs associées
				const propertyColors = {
					hp: 0x00ff00,           // Vert pour HP
					resistance: 0xffa500,   // Orange pour défense
					attack: 0xff0000,       // Rouge pour attaque
					attackSpeed: 0xffff00,  // Jaune pour cadence
					range: 0x0000ff,        // Bleu pour portée
					speed: 0x4b0082,        // Indigo pour vitesse
					repairSpeed: 0x8a2be2   // Violet pour réparation
				};
				
				// Créer une colonne pour chaque propriété
				const columnCount = Object.keys(propertyColors).length;
				const spacing = this.columnWidth * 1.1;
				const totalWidth = spacing * (columnCount - 1);
				const startX = -totalWidth / 2;
				
				let index = 0;
				for (const [prop, color] of Object.entries(propertyColors)) {
					// Créer la colonne de niveau directement
					const columnMaterial = new THREE.MeshStandardMaterial({
						color: color,
						roughness: 0.3,
						metalness: 0.8,
						emissive: color,
						emissiveIntensity: 0.3
					});
					
					// La colonne a la même largeur que précédemment mais est positionnée directement
					const columnGeometry = new THREE.BoxGeometry(this.columnWidth * 0.8, this.columnHeight, this.columnDepth * 0.8);
					const column = new THREE.Mesh(columnGeometry, columnMaterial);
					
					// Positionner la colonne directement dans le corps
					const xPos = startX + index * spacing;
					column.position.set(xPos, this.columnCenterY, 0);
					
					// Commencer avec une petite hauteur
					column.scale.y = 0.1;
					
					// Ajout direct au corps
					this.bodyGroup.add(column);
					
					// Stocker une référence à la colonne
					this.processorColumns[prop] = column;
					
					// Ajouter aux parties du corps
					this.bodyParts.push(column);
					
					index++;
				}
			}
			
			// Créer un effet de texte flottant
			createFloatingText(position, text, color) {
				// Convertir la position 3D en position 2D sur l'écran
				const vector = position.clone();
				vector.project(camera); // Projeter la position 3D sur l'écran 2D
				
				// Convertir les coordonnées normalisées (-1 à 1) en coordonnées de l'écran
				const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
				const y = -(vector.y * 0.5 - 0.5) * window.innerHeight;
				
				// Créer l'élément de texte
				const textElement = document.createElement('div');
				textElement.className = 'floating-text';
				textElement.textContent = text;
				textElement.style.color = color;
				textElement.style.left = x + 'px';
				textElement.style.top = y + 'px';
				document.body.appendChild(textElement);
				
				// Démarrer l'animation
				setTimeout(() => {
					textElement.style.opacity = '0';
					textElement.style.transform = 'translateY(-50px)';
				}, 10);
				
				// Supprimer l'élément après l'animation
				setTimeout(() => {
					document.body.removeChild(textElement);
				}, 1000);
			}
			
			// Créer les roues et chenilles
			createTracks() {
				// Groupe pour les chenilles
				this.tracksGroup = new THREE.Group();
				this.mesh.add(this.tracksGroup);
				
				// Matériau pour les chenilles
				const trackMaterial = new THREE.MeshStandardMaterial({
					color: 0x333333,
					roughness: 0.8,
					metalness: 0.4
				});
				
				// Initialiser le tableau des roues vide (mais maintenu pour compatibilité)
				this.wheels = [];
				
				// Créer uniquement les chenilles
				this.createTrackBelts(trackMaterial);
			}
			
			// Méthode pour créer les chenilles
			createTrackBelts(material) {
				// Créer les chenilles gauche et droite
				const trackWidth = 0.15; // Plus larges pour compenser l'absence de roues
				const trackHeight = 0.07; // Plus hautes pour une meilleure visibilité
				const trackLength = 0.9; // Longues chenilles
				
				// Groupe pour les segments de chenilles
				this.leftTrackSegments = [];
				this.rightTrackSegments = [];
				
				// Matériau pour les chenilles principales
				const mainTrackMaterial = new THREE.MeshStandardMaterial({
					color: 0x222222,
					roughness: 0.8,
					metalness: 0.5
				});
				
				// Chenille gauche (base)
				const leftTrackGeometry = new THREE.BoxGeometry(trackWidth, trackHeight, trackLength);
				const leftTrack = new THREE.Mesh(leftTrackGeometry, mainTrackMaterial);
				leftTrack.position.set(-0.2, 0.15, 0);
				this.tracksGroup.add(leftTrack);
				this.bodyParts.push(leftTrack);
				
				// Chenille droite (base)
				const rightTrackGeometry = new THREE.BoxGeometry(trackWidth, trackHeight, trackLength);
				const rightTrack = new THREE.Mesh(rightTrackGeometry, mainTrackMaterial);
				rightTrack.position.set(0.2, 0.15, 0);
				this.tracksGroup.add(rightTrack);
				this.bodyParts.push(rightTrack);
				
				// Ajouter des segments articulés à chaque chenille
				const segmentCount = 16; // Plus de segments pour plus de détails
				const segmentWidth = trackWidth * 0.95;
				const segmentHeight = trackHeight * 0.8;
				const segmentDepth = trackLength / segmentCount;
				
				// Fonction pour créer les segments sur une chenille
				const createSegments = (xPos, isLeft) => {
					const segments = [];
					const startZ = -trackLength/2 + segmentDepth/2;
					
					for (let i = 0; i < segmentCount; i++) {
						const segmentGeometry = new THREE.BoxGeometry(segmentWidth, segmentHeight, segmentDepth * 0.85);
						const segment = new THREE.Mesh(segmentGeometry, material);
						segment.position.set(xPos, 0.15, startZ + i * segmentDepth);
						
						// Ajouter des détails sur chaque segment
						const detailGeometry = new THREE.BoxGeometry(segmentWidth * 1.1, segmentHeight * 0.3, segmentDepth * 0.2);
						const detail = new THREE.Mesh(detailGeometry, material);
						detail.position.y = segmentHeight * 0.3;
						segment.add(detail);
						
						// Ajouter des crampons pour une apparence de chenille
						if (i % 2 === 0) { // Alterne les segments avec crampons
							const cramponGeometry = new THREE.BoxGeometry(segmentWidth * 1.2, segmentHeight * 0.5, segmentDepth * 0.4);
							const crampon = new THREE.Mesh(cramponGeometry, mainTrackMaterial);
							crampon.position.y = -segmentHeight * 0.5;
							segment.add(crampon);
							this.bodyParts.push(crampon);
						}
						
						this.tracksGroup.add(segment);
						this.bodyParts.push(segment, detail);
						segments.push(segment);
					}
					
					return segments;
				};
				
				// Créer les segments
				this.leftTrackSegments = createSegments(-0.2, true);
				this.rightTrackSegments = createSegments(0.2, false);
				
				// Ajouter les galets de guidage aux extrémités des chenilles
				this.addTrackGuides();
			}
			
			// Ajouter les galets de guidage aux extrémités des chenilles
			addTrackGuides() {
				const guideMaterial = new THREE.MeshStandardMaterial({
					color: 0x444444,
					roughness: 0.5,
					metalness: 0.7
				});
				
				// Créer les galets de guidage aux extrémités des chenilles
				const createGuides = (xPos) => {
					// Guide avant
					const frontGuideGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12);
					frontGuideGeometry.rotateZ(Math.PI / 2);
					const frontGuide = new THREE.Mesh(frontGuideGeometry, guideMaterial);
					frontGuide.position.set(xPos, 0.15, -0.4);
					this.tracksGroup.add(frontGuide);
					
					// Guide arrière
					const rearGuideGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12);
					rearGuideGeometry.rotateZ(Math.PI / 2);
					const rearGuide = new THREE.Mesh(rearGuideGeometry, guideMaterial);
					rearGuide.position.set(xPos, 0.15, 0.4);
					this.tracksGroup.add(rearGuide);
					
					// Ajouter aux parties du corps
					this.bodyParts.push(frontGuide, rearGuide);
				};
				
				// Créer les galets de guidage pour les deux chenilles
				createGuides(-0.2);
				createGuides(0.2);
			}
			
			// Créer le canon
			createCannon() {
				// Créer la tête du robot avec la caméra et le canon
				this.createRobotHead();
				// Stocker la position initiale du canon principal
				this.storeMainCannonPosition();
			}
			
			// Stocker la position initiale du canon principal
			storeMainCannonPosition() {
				// Stocker la position initiale du canon principal
				if (this.cannonBarrel) {
					this.cannonBarrelInitialState = {
						position: this.cannonBarrel.position.clone()
					};
				}
			}
			
			//Stocker les positions initiales
			storeInitialCannonPositions() {
				// Stocker la position initiale du canon principal
				if (this.cannonBarrel) {
					this.cannonBarrelInitialState = {
						position: this.cannonBarrel.position.clone()
					};
				}
				
				// Stocker les positions initiales des canons latéraux
				this.sideCannons.forEach(cannon => {
					cannon.initialPosition = cannon.barrel.position.clone();
				});
			}
			
			// Créer la tête du robot
			createRobotHead() {
				// Groupe pour la tête qui sera positionnée au-dessus du corps
				this.headGroup = new THREE.Group();
				this.headGroup.position.y = 1.3; // Ajusté pour le nouveau corps plus haut
				this.bodyGroup.add(this.headGroup);
				
				// Matériaux
				const headMaterial = new THREE.MeshStandardMaterial({ 
					color: 0x555555,
					roughness: 0.5,
					metalness: 0.7
				});
				
				const glassMaterial = new THREE.MeshStandardMaterial({ 
					color: 0x88ccff,
					roughness: 0.1,
					metalness: 0.9,
					transparent: true,
					opacity: 0.3,
					emissive: 0x1155aa,
					emissiveIntensity: 0.5
				});
				
				// Base de la tête (forme cylindrique)
				const headBaseGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.15, 12);
				this.headBase = new THREE.Mesh(headBaseGeometry, headMaterial);
				this.headBase.castShadow = true;
				this.headBase.receiveShadow = true;
				this.headGroup.add(this.headBase);
				
				// Dôme supérieur (caméra)
				const domeGeometry = new THREE.SphereGeometry(0.18, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
				this.dome = new THREE.Mesh(domeGeometry, headMaterial);
				this.dome.position.y = 0.08;
				this.dome.castShadow = true;
				this.headBase.add(this.dome);
				
				// "Vitre" de la caméra (lentille)
				const lensGeometry = new THREE.CircleGeometry(0.1, 16);
				this.lens = new THREE.Mesh(lensGeometry, glassMaterial);
				this.lens.position.set(0, 0.05, 0);
				this.lens.rotation.x = -Math.PI / 2;
				this.dome.add(this.lens);
				
				// Groupe pour le canon qui sera orienté dans la direction du mouvement
				this.cannonGroup = new THREE.Group();
				this.cannonGroup.position.z = 0;
				this.cannonGroup.position.y = -0.5;
				this.headGroup.add(this.cannonGroup);
				
				// Matériaux pour le canon
				const barrelMaterial = new THREE.MeshStandardMaterial({ 
					color: 0x666666,
					roughness: 0.4,
					metalness: 0.8
				});
				
				const baseMaterial = new THREE.MeshStandardMaterial({ 
					color: 0x444444,
					roughness: 0.6,
					metalness: 0.6
				});
				
				
				// Canon lui-même
				const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 10);
				this.cannonBarrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
				this.cannonBarrel.rotation.x = Math.PI / 2; // Orienter horizontalement
				this.cannonBarrel.position.z = -0.35; // Positionner à l'avant
				this.cannonBarrel.castShadow = true;
				this.cannonGroup.add(this.cannonBarrel);
				this.cannonBarrelBasePosition = -0.35; // Position initiale du canon
				// Ajouter des détails au canon
				this.addCannonDetails();
				
				// Ajouter aux parties du corps
				this.bodyParts.push(this.headBase, this.dome, this.lens, this.cannonBarrel);
			}
			
			// Ajouter des détails au canon
			addCannonDetails() {
				const detailMaterial = new THREE.MeshStandardMaterial({ 
					color: 0x333333,
					roughness: 0.6,
					metalness: 0.7
				});
				
				// Viseur sur le dessus du canon
				const sightGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.15);
				this.sight = new THREE.Mesh(sightGeometry, detailMaterial);
				this.sight.position.set(0, 0.05, -0.2);
				this.sight.castShadow = true;
				this.cannonGroup.add(this.sight);
				

				// Ajouter aux parties du corps
				this.bodyParts.push(this.sight);
			}
			
			// Méthode pour mettre à jour l'interface utilisateur
			updateUI() {
				document.getElementById('hp').textContent = Math.floor(this.hp);
				document.getElementById('maxhp').textContent = Math.floor(this.maxHp);
				document.getElementById('atk').textContent = Math.floor(this.attack);
				document.getElementById('def').textContent = Math.floor(this.resistance);
				document.getElementById('atkspeed').textContent = this.attackSpeed.toFixed(2);
				document.getElementById('range').textContent = Math.floor(this.range);
				document.getElementById('speed').textContent = this.speed.toFixed(3);
				document.getElementById('repair').textContent = this.repairSpeed.toFixed(2);
				document.getElementById('processors').textContent = this.totalProcessors;
				
				// Mettre à jour les indicateurs visuels des processeurs
				this.updateProcessorIndicators();
			}
			
			// Mettre à jour les indicateurs visuels des processeurs
			updateProcessorIndicators() {
				// Mettre à jour le niveau de remplissage de chaque colonne
				const propertyNames = ['hp', 'resistance', 'attack', 'attackSpeed', 'range', 'speed', 'repairSpeed'];
				
				propertyNames.forEach(prop => {
					const column = this.processorColumns[prop];
					if (column) {
						// Calculer le niveau de remplissage (0 à 1)
						const count = this.processorCounts[prop];
						const fillLevel = Math.min(1, count / 100); // Plein à 100 processeurs
						
						// Mettre à jour la hauteur de la colonne
						column.scale.y = 0.1 + fillLevel * 0.9; // Minimum 0.1, maximum 1
						
						// Ajuster la position Y pour que la colonne grandisse vers le haut à partir du centre
						column.position.y = this.columnCenterY - (this.columnHeight / 2) + (column.scale.y * this.columnHeight / 2);
					}
				});
			}
			
			// Créer un effet de pulsation pour une colonne de processeur
			pulseProcessorColumn(column, type) {
				const originalEmissive = column.material.emissiveIntensity;
				const originalScale = column.scale.clone();
				
				// Animation de pulsation
				let pulseStep = 0;
				const maxSteps = 20;
				
				const doPulse = () => {
					// Calculer l'intensité de la pulsation (sinusoïdale)
					const pulseIntensity = Math.sin((pulseStep / maxSteps) * Math.PI);
					
					// Mettre à jour l'émission et l'échelle
					column.material.emissiveIntensity = originalEmissive + pulseIntensity * 0.7;
					
					// Échelle légèrement plus grande sur X et Z
					const scaleMod = 1 + pulseIntensity * 0.2;
					column.scale.x = originalScale.x * scaleMod;
					column.scale.z = originalScale.z * scaleMod;
					
					pulseStep++;
					
					if (pulseStep <= maxSteps) {
						requestAnimationFrame(doPulse);
					} else {
						// Restaurer les valeurs d'origine
						column.material.emissiveIntensity = originalEmissive;
						column.scale.x = originalScale.x;
						column.scale.z = originalScale.z;
					}
				};
				
				doPulse();
			}
			
			// Réparer automatiquement le robot
			repair(deltaTime) {
				if (!this.isAlive) return;
				
				if (this.hp < this.maxHp) {
					// Réparer en fonction du temps écoulé
					this.hp = Math.min(this.maxHp, this.hp + this.repairSpeed * deltaTime);
					// Mettre à jour l'interface utilisateur
					this.updateUI();
				}
			}
		}    
		
		function createServerStructure(structureData) {
			// Créer les structures en fonction de leur type
			switch(structureData.type) {
				case 'waterTower':
					createServerWaterTower(structureData);
					break;
				case 'tree':
					createServerTree(structureData);
					break;
			}
		}

		function createServerWaterTower(structureData) {
			const position = new THREE.Vector3(
				structureData.position.x,
				structureData.position.y,
				structureData.position.z
			);
			
			const waterTower = new WaterTower(scene, position, collisionSystem);
			waterTower.id = structureData.id;
			
			// Ajouter à la liste des structures de la carte
			gameMap.structures.push(waterTower);
		}

		function createServerTree(structureData) {
			const position = new THREE.Vector3(
				structureData.position.x,
				structureData.position.y,
				structureData.position.z
			);
			
			const tree = new Tree(scene, position, collisionSystem);
			tree.id = structureData.id;
			
			// Mettre à jour les points de vie si fournis
			if (structureData.hp !== undefined) {
				tree.hp = structureData.hp;
				tree.maxHp = structureData.maxHp || tree.maxHp;
			}
			
			// Marquer comme détruit si nécessaire
			if (structureData.destroyed) {
				tree.isAlive = false;
				tree.die();
			}
			
			// Ajouter aux listes
			gameMap.trees.push(tree);
			gameMap.structures.push(tree);
		}
		// Configuration de la scène
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB);  // Ciel bleu
        const camera = new THREE.PerspectiveCamera(15, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        // Ajout d'une lumière ambiante
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // Ajout d'une lumière directionnelle principale (soleil)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 70, 30);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        scene.add(directionalLight);
        
        // Activer les ombres dans le rendu
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Ombres plus douces

        // Initialisation du système de collision
        const collisionSystem = new CollisionSystem();

        // Initialisation de la carte
        const gameMap = new GameMap(scene, collisionSystem);

        // Initialisation du robot du joueur
        const player = new Player(scene, gameMap, collisionSystem);
        
        // Initialisation du contrôleur de caméra
        const cameraController = new CameraController(player);

        // Positionnement et configuration de la caméra
        camera.position.set(0, 30, 30); // Position la caméra en hauteur et en retrait
        camera.lookAt(player.mesh.position); // Oriente la caméra vers le joueur

        // Gestion des touches
        const keys = { 
            ArrowUp: false, 
            ArrowDown: false, 
            ArrowLeft: false, 
            ArrowRight: false, 
            Control: false 
        };

        document.addEventListener('keydown', (event) => {
            if (event.key in keys) {
                keys[event.key] = true;
                event.preventDefault(); // Empêcher le défilement de la page avec les flèches
            }
        });

        document.addEventListener('keyup', (event) => {
            if (event.key in keys) keys[event.key] = false;
        });

		const loginScreen = document.getElementById('login-screen');
		const usernameInput = document.getElementById('username-input');
		const joinButton = document.getElementById('join-button');

		// État du jeu
		let gameStarted = false;

		// Écouteur d'événement pour le bouton de connexion
		joinButton.addEventListener('click', joinGame);

		// Permettre la validation avec la touche Entrée
		usernameInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') joinGame();
		});

		// Fonction pour rejoindre la partie
        function joinGame() {
            // Récupérer le nom d'utilisateur
            if (usernameInput.value.trim() !== '') {
                username = usernameInput.value.trim();
                player.username = username;
            }
            
            // Masquer l'écran de connexion
            loginScreen.style.display = 'none';
            
            // Vérifier si la connexion socket est déjà établie
            if (socket.connected) {
                console.log("Connexion déjà établie. Démarrage du jeu...");
                startGame();
            } else {
                console.log("En attente de la connexion au serveur...");
                // Attendre la connexion avant de démarrer le jeu
                socket.on('connect', () => {
                    console.log("Connexion établie. Démarrage du jeu...");
                    startGame();
                });
            }
        }
       
	   // Fonction pour mettre à jour la caméra
        function updateCamera() {
            // Utiliser le contrôleur de caméra pour mettre à jour la position
            cameraController.updateCamera(camera);
        }

        // Stockage des autres joueurs
		const otherPlayers = {};

		// Gérer les événements de socket.io pour le cycle de jeu
		function setupSocketListeners() {
			// Recevoir l'état initial du jeu
			socket.on('gameState', (state) => {
				console.log('État initial du jeu reçu:', state);
				
				// Traiter les structures statiques
				if (state.structures) {
					console.log(`Structures reçues: ${Object.keys(state.structures).length}`);
					// IMPORTANT : Vider les structures existantes avant d'en créer de nouvelles
					gameMap.structures.forEach(structure => {
					  if (structure.destroy) structure.destroy();
					});
					gameMap.structures = [];
					
					Object.values(state.structures).forEach(structureData => {
						console.log(`Création de la structure ${structureData.id} de type ${structureData.type}`);
						createServerStructure(structureData);
					});
				} else {
					console.warn("Aucune structure reçue du serveur!");
				}
				
				// Traiter les joueurs existants
				Object.entries(state.players).forEach(([id, playerData]) => {
					if (id !== socket.id) {
						createOtherPlayer(id, playerData);
					}
				});
				
				// Traiter les processeurs existants
				Object.values(state.processors).forEach(processorData => {
					createServerProcessor(processorData);
				});
				
				// Traiter les canons existants
				Object.values(state.cannons).forEach(cannonData => {
					createServerCannon(cannonData);
				});
				
				// Afficher l'horloge si nous recevons aussi des informations sur la partie
				if (state.gameInfo) {
					showGameClock(state.gameInfo.endTime);
				}
			});
            
            // Gestion des événements de cycle de jeu
            socket.on('gameEnded', (data) => {
                console.log('La partie est terminée!', data);
                
                // Afficher le podium
                showPodium(data.winners);
                
                // Démarrer le compte à rebours pour le redémarrage
                startCountdown(data.duration / 1000, 'Redémarrage dans');
            });

            socket.on('gameRestarting', (data) => {
                console.log('Redémarrage imminent...');
                
                // Avertir le joueur du redémarrage imminent
                showRestartingMessage();
                
                // Démarrer un compte à rebours court
                startCountdown(data.duration / 1000, 'Redémarrage dans');
            });

            socket.on('gameRestarted', (data) => {
                console.log('Nouvelle partie!', data);
                
                // Masquer le podium
                hidePodium();
                
                // Réinitialiser l'interface utilisateur
                resetUI();
                
                // Mettre à jour l'état du jeu
                updateGameState(data.gameState);
                
                // Afficher l'horloge de la partie
                showGameClock(data.gameInfo.endTime);
            });

			// Un nouveau joueur rejoint
			socket.on('playerJoined', (playerData) => {
				console.log('Nouveau joueur rejoint:', playerData);
				createOtherPlayer(playerData.id, playerData);
				updateScoreboard();
			});
			
			// Recevoir la liste complète des joueurs
			socket.on('playerList', (players) => {
				Object.entries(players).forEach(([id, playerData]) => {
					if (id !== socket.id && !otherPlayers[id]) {
						createOtherPlayer(id, playerData);
					}
				});
				updateScoreboard();
			});
			
			// Un joueur se déplace
			socket.on('playerMoved', (playerData) => {
				if (otherPlayers[playerData.id]) {
					updateOtherPlayerPosition(playerData.id, playerData);
				}
			});
			
			// Un joueur tire
			socket.on('projectileCreated', (projectileData) => {
				if (projectileData.ownerId !== socket.id) {
					createServerProjectile(projectileData);
				}
			});
			
			// Un projectile est créé par le serveur
			socket.on('projectileCreated', (projectileData) => {
				if (projectileData.ownerId !== socket.id) {
					// C'est un projectile d'un autre joueur
					createServerProjectile(projectileData);
				} else {
					// C'est notre propre projectile, mettre à jour l'ID
					// Chercher le projectile temporaire correspondant à la position
					const position = new THREE.Vector3(
						projectileData.position.x,
						projectileData.position.y,
						projectileData.position.z
					);
					
					// Trouver le projectile local qui correspond le mieux
					let closestProjectile = null;
					let minDistance = Infinity;
					
					for (const p of player.projectiles) {
						if (p.id && p.id.startsWith('temp-')) {
							const dist = p.group.position.distanceTo(position);
							if (dist < minDistance) {
								minDistance = dist;
								closestProjectile = p;
							}
						}
					}
					
					// Mettre à jour l'ID si on a trouvé un projectile correspondant
					if (closestProjectile && minDistance < 1.0) {
						console.log(`Mise à jour du projectile: ${closestProjectile.id} -> ${projectileData.id}`);
						closestProjectile.id = projectileData.id;
					}
				}
			});
			
			// Un joueur est touché
			socket.on('playerDamaged', (data) => {
				console.log("Événement playerDamaged reçu:", data);
				
				if (data.id === socket.id) {
					// C'est nous qui sommes touchés, mais nous gérons nos propres dégâts
					// Uniquement synchroniser en cas de différence importante
					if (Math.abs(player.hp - data.hp) > 5) {
						player.hp = data.hp;
						player.updateUI();
					}
					// Voir l'effet visuel quand on est touché
					createDamageText(player.mesh.position, data.damage);
					player.showDamageEffect();
					
				} else if (otherPlayers[data.id]) {
					console.log("Joueur touché trouvé:", otherPlayers[data.id].username);
					// Un autre joueur est touché
					otherPlayers[data.id].hp = data.hp;
					createDamageText(otherPlayers[data.id].mesh.position, data.damage);
					
					// S'assurer que les couleurs originales sont stockées
					if (!otherPlayers[data.id].originalBodyColors || 
						otherPlayers[data.id].originalBodyColors.length === 0) {
						otherPlayers[data.id].storeOriginalColors();
					}
					
					// Appliquer l'effet visuel
					otherPlayers[data.id].showDamageEffect();
				} else {
					console.log("Joueur touché non trouvé dans la liste:", data.id);
				}
			});
			
			// Un joueur est tué
			socket.on('playerKilled', (data) => {
				if (data.id === socket.id) {
					// Nous sommes morts (devrait déjà être géré localement)
					if (player.isAlive) {
						player.die();
					}
				} else if (otherPlayers[data.id]) {
					// Un autre joueur est mort
					otherPlayers[data.id].die();
				}
				updateScoreboard();
			});
			
			// Un joueur quitte
			socket.on('playerLeft', (playerId) => {
				if (otherPlayers[playerId]) {
					removeOtherPlayer(playerId);
					updateScoreboard();
				}
			});
			
			// Un nouveau processeur est créé
			socket.on('processorCreated', (processorData) => {
				createServerProcessor(processorData);
			});
			
			// Un processeur est supprimé
			socket.on('processorRemoved', (data) => {
				removeServerProcessor(data.id);
			});
			
			// Un nouveau canon est créé
			socket.on('cannonCreated', (cannonData) => {
				createServerCannon(cannonData);
			});
			
			// Un canon est supprimé
			socket.on('cannonRemoved', (data) => {
				removeServerCannon(data.id);
			});
			
			// Mise à jour des statistiques d'un joueur
			socket.on('playerStatsUpdated', (data) => {
				if (data.id === socket.id) {
					// Synchroniser nos statistiques si nécessaire
					// Généralement elles seront déjà à jour localement
				} else if (otherPlayers[data.id]) {
					// Mettre à jour les statistiques d'un autre joueur
					updateOtherPlayerStats(data.id, data);
				}
				updateScoreboard();
			});
			
			// Ajouter des gestionnaires pour les dégâts aux structures
			socket.on('structureDamaged', (data) => {
				// Trouver la structure dans la liste
				const structure = gameMap.structures.find(s => s.id === data.id);
				if (structure && structure.takeDamage) {
					structure.hp = data.hp;
					structure.showDamageEffect();
					createDamageText(structure.mesh.position, data.damage);
				}
			});
			
			socket.on('structureDestroyed', (data) => {
				// Trouver la structure dans la liste
				const structure = gameMap.structures.find(s => s.id === data.id);
				if (structure && structure.die) {
					structure.die();
				}
			});
		}

		function startGame() {
			
			// Marquer le jeu comme démarré
			gameStarted = true;
			
			// Informer le serveur que ce joueur rejoint la partie
			console.log("Envoi des informations du joueur au serveur...");
			socket.emit('playerJoin', {
				position: {
					x: player.mesh.position.x,
					y: player.mesh.position.y,
					z: player.mesh.position.z
				},
				rotation: player.mesh.rotation.y,
				direction: {
					x: player.direction.x,
					y: player.direction.y,
					z: player.direction.z
				},
				stats: {
					resistance: player.resistance,
					attack: player.attack,
					attackSpeed: player.attackSpeed,
					range: player.range,
					speed: player.speed,
					repairSpeed: player.repairSpeed,
					processorCounts: player.processorCounts
				},
				hp: player.hp,
				maxHp: player.maxHp,
				username: player.username
			});
			
			// Ajouter un tag de nom au joueur principal
			addPlayerNameTag(player);
			
			// Mettre à jour le tableau de score
			updateScoreboard();
			
			// Créer l'interface pour le cycle de jeu
			createGameCycleUI();
		}

		// Fonction pour mettre à jour le tableau de score
		function updateScoreboard() {
			const playersList = document.getElementById('players-list');
			playersList.innerHTML = '';
			
			// Trier les joueurs par score (processeurs collectés)
			const sortedPlayers = Object.values(otherPlayers).concat(player)
				.filter(p => p.isAlive !== false)
				.sort((a, b) => (b.totalProcessors || 0) - (a.totalProcessors || 0));
			
			// Ne prendre que les 10 premiers joueurs
			const top10Players = sortedPlayers.slice(0, 10);
			
			top10Players.forEach((p, index) => {
				const isCurrentPlayer = p === player;
				const playerDiv = document.createElement('div');
				playerDiv.style.padding = '5px';
				playerDiv.style.marginBottom = '5px';
				playerDiv.style.borderRadius = '3px';
				playerDiv.style.backgroundColor = isCurrentPlayer ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)';
				playerDiv.style.display = 'flex';
				playerDiv.style.justifyContent = 'space-between';
				
				// Ajouter le rang dans l'affichage (index + 1 car les indices commencent à 0)
				playerDiv.innerHTML = `
					<span><strong>#${index + 1}</strong> ${p.username || 'Joueur inconnu'}</span>
					<span>${p.totalProcessors || 0} procs</span>
				`;
				
				playersList.appendChild(playerDiv);
			});
		}

		// Fonction pour créer un autre joueur
		function createOtherPlayer(id, playerData) {
			// Créer un nouveau joueur avec le mode "autre joueur"
			const otherPlayer = new Player(scene, gameMap, collisionSystem, id, false);
			
			// Utiliser les données reçues
			otherPlayer.mesh.position.copy(playerData.position);
			otherPlayer.mesh.rotation.y = playerData.rotation;
			otherPlayer.direction.copy(playerData.direction);
			otherPlayer.hp = playerData.hp;
			otherPlayer.maxHp = playerData.maxHp;
			otherPlayer.isAlive = playerData.isAlive;
			otherPlayer.username = playerData.username;
			
			// Mettre à jour les statistiques si présentes
			if (playerData.stats) {
				otherPlayer.resistance = playerData.stats.resistance;
				otherPlayer.attack = playerData.stats.attack;
				otherPlayer.attackSpeed = playerData.stats.attackSpeed;
				otherPlayer.range = playerData.stats.range;
				otherPlayer.speed = playerData.stats.speed;
				otherPlayer.repairSpeed = playerData.stats.repairSpeed;
				
				if (playerData.stats.processorCounts) {
					otherPlayer.processorCounts = playerData.stats.processorCounts;
					otherPlayer.totalProcessors = 0;
					Object.values(otherPlayer.processorCounts).forEach(count => {
						otherPlayer.totalProcessors += count;
					});
				}
			}
			if (otherPlayer.cannonGroup) {
				otherPlayer.cannonGroup.position.y += 0.5; // Ajuster uniquement le canon
			}
			// Stocker la référence
			otherPlayers[id] = otherPlayer;
			
			// Ajouter le nom au-dessus du joueur
			addPlayerNameTag(otherPlayer);
			
			return otherPlayer;
		}

		// Fonction pour mettre à jour la position d'un autre joueur
		function updateOtherPlayerPosition(id, playerData) {
			const otherPlayer = otherPlayers[id];
			if (!otherPlayer) return;
			
			// Mettre à jour la position et la rotation
			otherPlayer.mesh.position.set(
				playerData.position.x,
				playerData.position.y,
				playerData.position.z
			);
			otherPlayer.mesh.rotation.y = playerData.rotation;
			otherPlayer.direction.copy(playerData.direction);
			
			// Mettre à jour l'état vivant/mort
			if (playerData.isAlive !== undefined) {
				otherPlayer.isAlive = playerData.isAlive;
			}
			
			// Mettre à jour le tag de nom
			updatePlayerNameTag(otherPlayer);
		}

		// Fonction pour mettre à jour les statistiques d'un autre joueur
		function updateOtherPlayerStats(id, data) {
			const otherPlayer = otherPlayers[id];
			if (!otherPlayer) return;
			
			// Mettre à jour les points de vie
			otherPlayer.hp = data.hp;
			otherPlayer.maxHp = data.maxHp;
			
			// Mettre à jour les autres statistiques si présentes
			if (data.stats) {
				otherPlayer.resistance = data.stats.resistance;
				otherPlayer.attack = data.stats.attack;
				otherPlayer.attackSpeed = data.stats.attackSpeed;
				otherPlayer.range = data.stats.range;
				otherPlayer.speed = data.stats.speed;
				otherPlayer.repairSpeed = data.stats.repairSpeed;
				
				if (data.stats.processorCounts) {
					otherPlayer.processorCounts = data.stats.processorCounts;
					otherPlayer.totalProcessors = 0;
					Object.values(otherPlayer.processorCounts).forEach(count => {
						otherPlayer.totalProcessors += count;
					});
				}
				// Mettre à jour l'échelle du joueur en fonction du nombre total de processeurs
				if (otherPlayer.totalProcessors > 0) {
					// Calculer l'échelle (même logique que dans la méthode collectProcessor)
					otherPlayer.baseScale = 1.0 + (otherPlayer.totalProcessors * 0.005);
					// Appliquer l'échelle
					otherPlayer.mesh.scale.set(otherPlayer.baseScale, otherPlayer.baseScale, otherPlayer.baseScale);
				}
			}
		}

		// Fonction pour supprimer un autre joueur
		function removeOtherPlayer(id) {
			if (otherPlayers[id]) {
				// Supprimer le tag de nom
				removePlayerNameTag(otherPlayers[id]);
				
				// Supprimer le joueur de la scène
				scene.remove(otherPlayers[id].mesh);
				
				// Supprimer de la liste des joueurs
				delete otherPlayers[id];
			}
		}

		// Fonction pour ajouter un tag de nom au-dessus d'un joueur
		function addPlayerNameTag(player) {
			// Créer un élément de texte HTML
			const nameTag = document.createElement('div');
			nameTag.className = 'player-name-tag';
			nameTag.style.position = 'absolute';
			nameTag.style.color = 'white';
			nameTag.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
			nameTag.style.padding = '2px 5px';
			nameTag.style.borderRadius = '3px';
			nameTag.style.fontSize = '12px';
			nameTag.style.pointerEvents = 'none';
			nameTag.style.textAlign = 'center';
			nameTag.style.whiteSpace = 'nowrap';
			nameTag.textContent = player.username || 'Joueur';
			document.body.appendChild(nameTag);
			
			// Stocker la référence sur le joueur
			player.nameTag = nameTag;
			
			// Mettre à jour initialement
			updatePlayerNameTag(player);
		}

		// Fonction pour mettre à jour la position du tag de nom
		function updatePlayerNameTag(player) {
			if (!player.nameTag || !player.isAlive) return;
			
			// Calculer la position 2D à partir de la position 3D
			const vector = new THREE.Vector3();
			vector.setFromMatrixPosition(player.mesh.matrixWorld);
			vector.y += 2; // Positionner au-dessus du joueur
			
			vector.project(camera);
			
			// Convertir en coordonnées CSS
			const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
			const y = -(vector.y * 0.5 - 0.5) * window.innerHeight;
			
			// Mettre à jour le style
			player.nameTag.style.left = `${x - (player.nameTag.offsetWidth / 2)}px`;
			player.nameTag.style.top = `${y - 30}px`; // Décalage vers le haut
			
			// Ajouter une barre de vie
			const hpPercent = (player.hp / player.maxHp) * 100;
			
			// Déterminer la couleur en fonction du pourcentage de vie
			let hpColor;
			if (hpPercent > 75) hpColor = '#00ff00'; // Vert
			else if (hpPercent > 50) hpColor = '#ffff00'; // Jaune
			else if (hpPercent > 25) hpColor = '#ff9900'; // Orange
			else hpColor = '#ff0000'; // Rouge
			
			player.nameTag.innerHTML = `
				${player.username || 'Joueur'}
				<div style="width: 50px; height: 5px; background-color: #333; margin-top: 2px; border-radius: 2px;">
					<div style="width: ${hpPercent}%; height: 100%; background-color: ${hpColor}; border-radius: 2px;"></div>
				</div>
			`;
		}

		// Fonction pour supprimer le tag de nom
		function removePlayerNameTag(player) {
			if (player.nameTag) {
				document.body.removeChild(player.nameTag);
				player.nameTag = null;
			}
		}

		// Fonction pour créer un processeur venant du serveur
		function createServerProcessor(processorData) {
			const position = new THREE.Vector3(
				processorData.position.x,
				processorData.position.y,
				processorData.position.z
			);
			
			const processor = new Processor(scene, position, processorData.type, collisionSystem);
			processor.id = processorData.id;
			processor.boost = processorData.boost;
			
			// Si le processeur rebondit (largué par un joueur)
			if (processorData.isBouncing) {
				processor.startBounce();
			}
			
			// Ajouter à la liste des processeurs de la carte
			gameMap.processors.push(processor);
		}

		// Fonction pour supprimer un processeur
		function removeServerProcessor(id) {
			// Trouver le processeur dans la liste
			const processorIndex = gameMap.processors.findIndex(p => p.id === id);
			if (processorIndex !== -1) {
				const processor = gameMap.processors[processorIndex];
				processor.destroy();
				gameMap.processors.splice(processorIndex, 1);
			}
		}

		// Fonction pour créer un canon venant du serveur
		function createServerCannon(cannonData) {
			const position = new THREE.Vector3(
				cannonData.position.x,
				cannonData.position.y,
				cannonData.position.z
			);
			
			const cannon = new Cannon(scene, position, collisionSystem);
			cannon.id = cannonData.id;
			
			// Ajouter à la liste des canons de la carte
			gameMap.cannons.push(cannon);
		}
		
		// Fonction pour supprimer un canon
		function removeServerCannon(id) {
			// Trouver le canon dans la liste
			const cannonIndex = gameMap.cannons.findIndex(c => c.id === id);
			if (cannonIndex !== -1) {
				const cannon = gameMap.cannons[cannonIndex];
				cannon.destroy();
				gameMap.cannons.splice(cannonIndex, 1);
			}
		}

		// Fonction pour créer un projectile venant du serveur
		function createServerProjectile(projectileData) {
			// Trouver le joueur propriétaire
			let owner;
			if (projectileData.ownerId === socket.id) {
				owner = player;
			} else if (otherPlayers[projectileData.ownerId]) {
				owner = otherPlayers[projectileData.ownerId];
			} else {
				// Si le propriétaire n'est pas trouvé, créer un propriétaire temporaire
				// avec seulement les propriétés nécessaires
				owner = {
					attack: projectileData.damage || 10,
					range: projectileData.maxDistance || 10,
					projectiles: []  // Tableau vide pour éviter les erreurs
				};
			}
			
			// Créer le projectile
			const position = new THREE.Vector3(
				projectileData.position.x,
				projectileData.position.y,
				projectileData.position.z
			);
			
			const direction = new THREE.Vector3(
				projectileData.direction.x,
				projectileData.direction.y,
				projectileData.direction.z
			);
			
			const projectile = new Projectile(scene, position, direction, owner, collisionSystem);
			projectile.id = projectileData.id;
			
			// Utiliser les valeurs spécifiques du projectile si fournies
			if (projectileData.damage) projectile.damage = projectileData.damage;
			if (projectileData.maxDistance) projectile.maxDistance = projectileData.maxDistance;
			
			// Si c'est un autre joueur qui tire, faire un effet visuel sur son canon
			if (otherPlayers[projectileData.ownerId]) {
				otherPlayers[projectileData.ownerId].showRecoilEffect();
			}
			// Stocker l'ID du projectile venant du serveur
			projectile.id = projectileData.id;
			console.log(`Projectile créé: ${projectileData.id} par joueur ${projectileData.ownerId}`);
			
			// Ajouter à la liste des projectiles du propriétaire seulement si le propriétaire existe encore
			if (projectileData.ownerId === socket.id) {
				player.projectiles.push(projectile);
			} else if (otherPlayers[projectileData.ownerId]) {
				otherPlayers[projectileData.ownerId].projectiles.push(projectile);
			}
			// Ne pas stocker le projectile si le propriétaire n'existe plus
		}
		
		// Créer les éléments d'UI nécessaires au cycle de jeu
		function createGameCycleUI() {
			// Créer l'horloge de jeu
			const gameClock = document.createElement('div');
			gameClock.id = 'game-clock';
			gameClock.className = 'game-clock';
			document.body.appendChild(gameClock);
			
			// Créer l'écran de podium
			const podiumScreen = document.createElement('div');
			podiumScreen.id = 'podium-screen';
			podiumScreen.className = 'podium-screen';
			podiumScreen.style.display = 'none';
			document.body.appendChild(podiumScreen);
		}

		// Afficher le podium avec les gagnants
		function showPodium(winners) {
			// Supprimer l'ancien podium s'il existe
			const oldPodium = document.getElementById('podium-screen');
			if (oldPodium) {
				document.body.removeChild(oldPodium);
			}
			
			// Créer l'écran de podium
			const podiumScreen = document.createElement('div');
			podiumScreen.id = 'podium-screen';
			podiumScreen.className = 'podium-screen';
			
			// Titre
			const title = document.createElement('h1');
			title.className = 'podium-title';
			title.textContent = "🏆 Fin de partie - Podium 🏆";
			podiumScreen.appendChild(title);
			
			// Conteneur du podium
			const podiumContainer = document.createElement('div');
			podiumContainer.className = 'podium-container';
			
			// Définir l'ordre d'affichage et les caractéristiques
			const podiumConfig = [
				{ position: 1, index: 0, height: '280px', medal: '🥇', color: 'linear-gradient(to bottom, #FFD700, #FFA500)', title: '1er' },
				{ position: 0, index: 1, height: '220px', medal: '🥈', color: 'linear-gradient(to bottom, #C0C0C0, #A9A9A9)', title: '2ème' },
				{ position: 2, index: 2, height: '180px', medal: '🥉', color: 'linear-gradient(to bottom, #CD7F32, #8B4513)', title: '3ème' }
			];
			
			// Créer chaque marche du podium
			podiumConfig.forEach(config => {
				const winner = winners[config.position];
				if (!winner) return; // Pas de joueur à cette position
				
				const podiumStep = document.createElement('div');
				podiumStep.className = 'podium-step';
				podiumStep.style.width = '200px';
				podiumStep.style.height = '0px'; // Démarrer à 0 pour l'animation
				podiumStep.style.background = config.color;
				podiumStep.style.margin = '0 10px';
				
				// Avatar (utilise la première lettre du nom d'utilisateur)
				const avatar = document.createElement('div');
				avatar.className = 'podium-avatar';
				avatar.textContent = winner.username.charAt(0).toUpperCase();
				
				// Position
				const position = document.createElement('div');
				position.className = 'podium-position';
				position.textContent = config.medal;
				
				// Nom d'utilisateur
				const username = document.createElement('div');
				username.className = 'podium-username';
				username.textContent = winner.username;
				
				// Score
				const score = document.createElement('div');
				score.className = 'podium-score';
				score.textContent = `Score: ${winner.score} points`;
				
				// Ajouter les éléments à la marche
				podiumStep.appendChild(position);
				podiumStep.appendChild(avatar);
				podiumStep.appendChild(username);
				podiumStep.appendChild(score);
				
				// Ajouter au conteneur
				podiumContainer.appendChild(podiumStep);
				
				// Animer après un court délai (animation d'apparition)
				setTimeout(() => {
					podiumStep.style.height = config.height;
				}, 500 + config.index * 300);
			});
			
			podiumScreen.appendChild(podiumContainer);
			
			// Compteur de redémarrage
			const restartCounter = document.createElement('div');
			restartCounter.id = 'restart-counter';
			restartCounter.className = 'restart-counter';
			podiumScreen.appendChild(restartCounter);
			
			// Ajouter à la page
			document.body.appendChild(podiumScreen);
		}

		// Masquer le podium
		function hidePodium() {
			const podiumScreen = document.getElementById('podium-screen');
			if (podiumScreen) {
				podiumScreen.style.display = 'none';
			}
		}

		// Démarrer un compte à rebours
		function startCountdown(seconds, prefix) {
			const restartCounter = document.getElementById('restart-counter');
			if (!restartCounter) return;
			
			let remainingSeconds = Math.floor(seconds);
			
			const updateCounter = () => {
				restartCounter.textContent = `${prefix}: ${remainingSeconds}s`;
				
				if (remainingSeconds > 0) {
					remainingSeconds--;
					setTimeout(updateCounter, 1000);
				}
			};
			
			updateCounter();
		}

		// Afficher l'horloge de la partie
		function showGameClock(endTime) {
			const gameClock = document.getElementById('game-clock');
			if (!gameClock) return;
			
			gameClock.style.display = 'block';
			
			// Mettre à jour l'horloge chaque seconde
			const updateClock = () => {
				const now = Date.now();
				const timeLeft = endTime - now;
				
				if (timeLeft <= 0) {
					gameClock.innerHTML = "<div class='game-info time-warning'>⏱️ Fin de partie!</div>";
					return;
				}
				
				// Formater le temps restant
				const minutes = Math.floor(timeLeft / 60000);
				const seconds = Math.floor((timeLeft % 60000) / 1000);
				const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
				
				// Ajouter une classe d'alerte si moins de 5 minutes
				const isWarning = timeLeft < 5 * 60 * 1000;
				
				gameClock.innerHTML = `
					<div class='game-info ${isWarning ? "time-warning" : ""}'>
						⏱️ Temps restant: ${timeString}
					</div>
				`;
				
				// Continuer à mettre à jour
				requestAnimationFrame(updateClock);
			};
			
			updateClock();
		}

		// Afficher un message de redémarrage
		function showRestartingMessage() {
			const notification = document.createElement('div');
			notification.style.position = 'absolute';
			notification.style.top = '50%';
			notification.style.left = '50%';
			notification.style.transform = 'translate(-50%, -50%)';
			notification.style.backgroundColor = 'rgba(200, 0, 0, 0.9)';
			notification.style.color = 'white';
			notification.style.padding = '30px 50px';
			notification.style.borderRadius = '10px';
			notification.style.fontSize = '32px';
			notification.style.fontWeight = 'bold';
			notification.style.zIndex = '3000';
			notification.style.boxShadow = '0 0 30px rgba(255, 0, 0, 0.7)';
			notification.style.textAlign = 'center';
			notification.style.animation = 'pulse 0.5s infinite alternate';
			notification.innerHTML = '⚠️ REDÉMARRAGE DU SERVEUR<br>Préparation de la nouvelle partie...';
			
			// Ajouter l'animation
			const style = document.createElement('style');
			style.textContent = `
				@keyframes pulse {
					from { transform: translate(-50%, -50%) scale(1); }
					to { transform: translate(-50%, -50%) scale(1.05); }
				}
			`;
			document.head.appendChild(style);
			
			document.body.appendChild(notification);
			
			// Supprimer après quelques secondes
			setTimeout(() => {
				document.body.removeChild(notification);
				if (style.parentNode) {
					document.head.removeChild(style);
				}
			}, 4000);
		}

		// Réinitialiser l'interface utilisateur
		function resetUI() {
			// Réinitialiser les statistiques
			document.getElementById('hp').textContent = '100';
			document.getElementById('maxhp').textContent = '100';
			document.getElementById('atk').textContent = '10';
			document.getElementById('def').textContent = '10';
			document.getElementById('atkspeed').textContent = '0.5';
			document.getElementById('range').textContent = '10';
			document.getElementById('speed').textContent = '0.02';
			document.getElementById('repair').textContent = '0.1';
			document.getElementById('processors').textContent = '0';
			
			// Mettre à jour le tableau de score
			updateScoreboard();
		}

		// Mettre à jour l'état du jeu
		function updateGameState(newState) {
			// Supprimer tous les éléments de jeu existants
			
			// Arrêter toutes les animations en cours
			cancelAnimationFrame(animationId);  // Assurez-vous que l'ID d'animation principal est accessible

			// Supprimer les processeurs
			gameMap.processors.forEach(processor => {
				if (processor.isBouncing) {
					processor.isBouncing = false;  // Arrêter les animations de rebond
				}
				processor.destroy();
			});
			gameMap.processors = [];
			
			// Supprimer les canons
			gameMap.cannons.forEach(cannon => {
				if (cannon.isBouncing) {
					cannon.isBouncing = false;  // Arrêter les animations de rebond
				}
				cannon.destroy();
			});
			gameMap.cannons = [];
			
			// Nettoyer explicitement les projectiles de tous les joueurs
			Object.values(otherPlayers).forEach(otherPlayer => {
				otherPlayer.projectiles.forEach(projectile => {
					projectile.destroy();
				});
				otherPlayer.projectiles = [];
			});
			
			player.projectiles.forEach(projectile => {
				projectile.destroy();
			});
			player.projectiles = [];
			
			// Supprimer les structures
			gameMap.structures.forEach(structure => {
				if (structure.destroy) {
					structure.destroy();
				}
			});
			gameMap.structures = [];
			
			// Supprimer les autres joueurs
			Object.values(otherPlayers).forEach(otherPlayer => {
				removeOtherPlayer(otherPlayer.playerId);
			});
			
			// Réinitialiser le joueur principal
			player.hp = 100;
			player.maxHp = 100;
			player.resistance = 10;
			player.attack = 10;
			player.attackSpeed = 0.5;
			player.range = 10;
			player.speed = 0.02;
			player.repairSpeed = 0.5;
			player.baseScale = 1.0;
			player.processorCounts = {
				hp: 0,
				resistance: 0,
				attack: 0,
				attackSpeed: 0,
				range: 0,
				speed: 0,
				repairSpeed: 0
			};
			player.totalProcessors = 0;
			player.updateUI();
			player.setRandomPosition();
			player.isAlive = true;
			
			// Si le joueur était invisible, le rendre visible à nouveau
			player.mesh.visible = true;
			
			// Créer les nouvelles structures et objets
			if (newState) {
				// Traiter les structures
				if (newState.structures) {
					Object.values(newState.structures).forEach(structureData => {
						createServerStructure(structureData);
					});
				}
				
				// Traiter les processeurs
				if (newState.processors) {
					Object.values(newState.processors).forEach(processorData => {
						createServerProcessor(processorData);
					});
				}
				
				// Traiter les canons
				if (newState.cannons) {
					Object.values(newState.cannons).forEach(cannonData => {
						createServerCannon(cannonData);
					});
				}
			}
		}

        // Boucle d'animation
        let lastTime = 0;
        let processorSpawnEnabled = true; // Variable pour activer/désactiver l'apparition des processeurs

        function animate(time) {
            requestAnimationFrame(animate);
            
            // Convertir le temps en millisecondes et calculer le delta
            const currentTime = time;
            const deltaTime = (currentTime - lastTime) / 1000; // Convertir en secondes
            
            // Déplacer le joueur selon les touches pressées
            player.move(keys);
            
            // Gérer les attaques
            player.doAttack(keys, currentTime);
            
            // Réparer automatiquement le robot
            player.repair(deltaTime);
            
            // Mettre à jour les processeurs sur la carte
			for (let i = gameMap.processors.length - 1; i >= 0; i--) {
				gameMap.processors[i].update();
			}
			// Mettre à jour seulement les canons existants
			for (let i = gameMap.cannons.length - 1; i >= 0; i--) {
				gameMap.cannons[i].update();
			}
			
			// Mettre à jour les autres joueurs
			for (const id in otherPlayers) {
				// Réparer automatiquement
				otherPlayers[id].repair(deltaTime);
				
				// Mettre à jour les projectiles
				otherPlayers[id].updateProjectiles();
				
				// Mettre à jour le tag de nom
				updatePlayerNameTag(otherPlayers[id]);
			}
			
			// Mettre à jour périodiquement le tableau de score (1 fois par seconde)
			if (Math.floor(time / 1000) !== Math.floor(lastTime / 1000)) {
				updateScoreboard();
			}
            
            // Mettre à jour la caméra pour suivre le joueur
            updateCamera();
            
            // Rendu de la scène
            renderer.render(scene, camera);
            
            lastTime = currentTime;
        }
		
		function cleanupGame() {
			// Arrêter toutes les animations
			cancelAnimationFrame(animationId);
			
			// Nettoyer tous les objets avec des animations
			gameMap.processors.forEach(p => p.destroy());
			gameMap.cannons.forEach(c => c.destroy());
			gameMap.structures.forEach(s => { if (s.destroy) s.destroy(); });
			
			// Nettoyer les projectiles
			player.projectiles.forEach(p => p.destroy());
			Object.values(otherPlayers).forEach(op => {
				op.projectiles.forEach(p => p.destroy());
			});
			
			// Nettoyer les tags de noms
			removePlayerNameTag(player);
			Object.values(otherPlayers).forEach(op => removePlayerNameTag(op));
			
			// Supprimer les écouteurs d'événements
			document.removeEventListener('keydown', keydownHandler);
			document.removeEventListener('keyup', keyupHandler);
			window.removeEventListener('resize', resizeHandler);
			
			// Déconnecter du serveur
			socket.disconnect();
			
			console.log("Jeu nettoyé avec succès.");
		}

		// Ajouter un écouteur d'événement pour nettoyer avant de quitter
		window.addEventListener('beforeunload', cleanupGame);

		function createDamageText(position, amount) {
			// Convertir la position 3D en position 2D sur l'écran
			const vector = position.clone();
			vector.project(camera); // Projeter la position 3D sur l'écran 2D
			
			// Convertir les coordonnées normalisées (-1 à 1) en coordonnées de l'écran
			const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
			const y = -(vector.y * 0.5 - 0.5) * window.innerHeight;
			
			// Créer l'élément de texte
			const textElement = document.createElement('div');
			textElement.className = 'floating-text';
			textElement.textContent = `-${amount}HP`;
			textElement.style.color = "#ff0000"; // Rouge pour les dégâts
			textElement.style.left = x + 'px';
			textElement.style.top = y + 'px';
			document.body.appendChild(textElement);
			
			// Démarrer l'animation
			setTimeout(() => {
				textElement.style.opacity = '0';
				textElement.style.transform = 'translateY(-50px)';
			}, 10);
			
			// Supprimer l'élément après l'animation
			setTimeout(() => {
				document.body.removeChild(textElement);
			}, 1000);
		}

        // Gestion du redimensionnement de la fenêtre
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Démarrer l'animation
        requestAnimationFrame(animate);
    </script>
</body>
</html>
