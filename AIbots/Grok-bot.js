class ChampionBot {
    constructor() {
        this.targetSnowball = null;
        this.avoidDirection = null;
        this.lastPosition = null;
        this.stuckCounter = 0;
        this.aggressionLevel = 0.8;
    }

    update(data, playerId) {
        const player = data.players[playerId];
        if (!player) return { angle: 0, throwing: false };

        const snowballs = Object.values(data.snowballs);
        const otherPlayers = Object.values(data.players).filter(p => p.id !== playerId);
        
        // Track position to detect being stuck
        const currentPosition = { x: player.x, y: player.y };
        if (this.lastPosition && 
            Math.abs(currentPosition.x - this.lastPosition.x) < 0.1 && 
            Math.abs(currentPosition.y - this.lastPosition.y) < 0.1) {
            this.stuckCounter++;
        } else {
            this.stuckCounter = 0;
        }
        this.lastPosition = currentPosition;

        // Calculate threats and opportunities
        let closestThreat = null;
        let minThreatDist = Infinity;
        let closestTarget = null;
        let minTargetDist = Infinity;
        
        // Analyze snowballs
        snowballs.forEach(snowball => {
            const dist = this.distance(player, snowball);
            if (dist < minThreatDist && this.isThreat(player, snowball)) {
                minThreatDist = dist;
                closestThreat = snowball;
            }
        });

        // Analyze players
        otherPlayers.forEach(p => {
            const dist = this.distance(player, p);
            if (dist < minTargetDist && p.size > 0) {
                minTargetDist = dist;
                closestTarget = p;
            }
        });

        // Decision making
        let angle = 0;
        let throwing = false;

        // Priority 1: Avoid immediate threats
        if (closestThreat && minThreatDist < 100) {
            angle = this.getAvoidAngle(player, closestThreat);
            this.avoidDirection = angle;
        }
        // Priority 2: Attack when safe
        else if (closestTarget && minTargetDist < 300 && player.size > 0 && Math.random() < this.aggressionLevel) {
            angle = this.getAttackAngle(player, closestTarget);
            throwing = true;
            this.targetSnowball = null;
        }
        // Priority 3: Move strategically
        else {
            // If stuck, randomize direction
            if (this.stuckCounter > 20) {
                angle = Math.random() * 2 * Math.PI;
            }
            // Move toward center or chase target
            else if (closestTarget && minTargetDist < 600) {
                angle = this.getAttackAngle(player, closestTarget);
            } else {
                angle = this.getCenterAngle(player);
            }
            this.avoidDirection = null;
        }

        // Wall avoidance
        const wallAngle = this.avoidWalls(player);
        if (wallAngle !== null) {
            angle = wallAngle;
        }

        // Adjust aggression based on size
        this.aggressionLevel = Math.min(0.9, Math.max(0.6, player.size / 100));

        return { angle, throwing };
    }

    distance(p1, p2) {
        return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    }

    isThreat(player, snowball) {
        const dx = snowball.x - player.x;
        const dy = snowball.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const vx = snowball.vx;
        const vy = snowball.vy;
        
        // Check if snowball is moving toward player
        const dot = dx * vx + dy * vy;
        return dist < 150 && dot < 0;
    }

    getAvoidAngle(player, threat) {
        const dx = player.x - threat.x;
        const dy = player.y - threat.y;
        return Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.3;
    }

    getAttackAngle(player, target) {
        // Predict target movement
        const leadTime = this.distance(player, target) / 200; // Approximate snowball speed
        const targetX = target.x + target.vx * leadTime;
        const targetY = target.y + target.vy * leadTime;
        
        const dx = targetX - player.x;
        const dy = targetY - player.y;
        return Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.1;
    }

    getCenterAngle(player) {
        const centerX = 400; // Assuming 800x800 canvas
        const centerY = 400;
        const dx = centerX - player.x;
        const dy = centerY - player.y;
        return Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.2;
    }

    avoidWalls(player) {
        const margin = 50;
        const canvasSize = 800;
        
        if (player.x < margin) return Math.PI / 2;
        if (player.x > canvasSize - margin) return -Math.PI / 2;
        if (player.y < margin) return 0;
        if (player.y > canvasSize - margin) return Math.PI;
        
        return null;
    }
}
