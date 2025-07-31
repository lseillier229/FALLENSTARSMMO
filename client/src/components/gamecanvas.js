// ========================
// COMPONENTS/GAMECANVAS.JS - Rendu du jeu
// ========================
import React, { useRef, useEffect, useState } from 'react';

const TILE_SIZE = 32;
const VIEWPORT_WIDTH = 25;
const VIEWPORT_HEIGHT = 19;
const CHUNK_W = 64;
const CHUNK_H = 64;
const CHUNK_MARGIN = 8; // demande un nouveau chunk quand on approche du bord
// Couleurs des terrains
const TERRAIN_COLORS = {
    0: '#8B4513', // Plaine - marron
    1: '#4169E1', // Eau - bleu
    2: '#228B22', // Forêt - vert
    3: '#696969', // Montagne - gris
    4: '#FFD700', // Village - or
    5: '#9932CC', // Donjon - violet
    6: '#F4A460'  // Désert - sable
};

// Emojis pour les entités
const CLASS_EMOJIS = {
    iop: '🔴',
    cra: '🟢', 
    eni: '🔵',
    sadi: '🟤'
};

function GameCanvas({ gameState, onTargetSelect, socket }) {
    const canvasRef = useRef(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [hoveredTile, setHoveredTile] = useState(null);
    // Helper: retourne le type de terrain (x,y absolus) depuis le chunk courant
    const getTile = (x, y) => {
        const wd = gameState.worldData;
        if (!wd || !wd.chunk) return 0;
        const { x0, y0, width, height, tiles } = wd.chunk;
        if (x < x0 || y < y0 || x >= x0 + width || y >= y0 + height) return 0;
        return tiles[y - y0][x - x0];
    };

    // Demande un nouveau chunk quand on approche du bord
    useEffect(() => {
        const wd = gameState.worldData;
        const p = gameState.player;
        if (!socket || !wd || !wd.chunk || !p) return;

        const { x0, y0, width, height } = wd.chunk;
        const nearLeft = (p.x - x0) < CHUNK_MARGIN;
        const nearRight = (x0 + width - 1 - p.x) < CHUNK_MARGIN;
        const nearTop = (p.y - y0) < CHUNK_MARGIN;
        const nearBottom = (y0 + height - 1 - p.y) < CHUNK_MARGIN;

        if (nearLeft || nearRight || nearTop || nearBottom) {
            socket.emit('requestChunk', { centerX: p.x, centerY: p.y, width: CHUNK_W, height: CHUNK_H });
        }
    }, [gameState.player?.x, gameState.player?.y, gameState.worldData?.chunk, socket]);


    useEffect(() => {
        if (!gameState.player || !gameState.worldData) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Effacer le canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawWorld(ctx);
        drawEntities(ctx);
        drawUI(ctx);
        
    }, [gameState, hoveredTile]);

    const drawWorld = (ctx) => {
        const { player, worldData } = gameState;
        const centerX = player.x;
        const centerY = player.y;

        // Calculer la zone visible
        const startX = Math.max(0, centerX - Math.floor(VIEWPORT_WIDTH / 2));
        const startY = Math.max(0, centerY - Math.floor(VIEWPORT_HEIGHT / 2));
        const endX = Math.min(worldData.width, startX + VIEWPORT_WIDTH);
        const endY = Math.min(worldData.height, startY + VIEWPORT_HEIGHT);

        // Dessiner les tuiles de terrain
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const screenX = (x - startX) * TILE_SIZE;
                const screenY = (y - startY) * TILE_SIZE;
                const terrainType = getTile(x, y);

                // Couleur de base
                ctx.fillStyle = TERRAIN_COLORS[terrainType] || '#8B4513';
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

                // Bordure
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

                // Surbrillance si survolé
                if (hoveredTile && hoveredTile.x === x && hoveredTile.y === y) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // Grille de coordonnées (optionnel)
        ctx.font = '10px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        for (let y = startY; y < endY; y += 5) {
            for (let x = startX; x < endX; x += 5) {
                const screenX = (x - startX) * TILE_SIZE + 2;
                const screenY = (y - startY) * TILE_SIZE + 12;
                ctx.fillText(`${x},${y}`, screenX, screenY);
            }
        }
    };

    const drawEntities = (ctx) => {
        const { player, players, monsters } = gameState;
        const centerX = player.x;
        const centerY = player.y;
        const startX = Math.max(0, centerX - Math.floor(VIEWPORT_WIDTH / 2));
        const startY = Math.max(0, centerY - Math.floor(VIEWPORT_HEIGHT / 2));

        // Dessiner les autres joueurs
        players.forEach(otherPlayer => {
            if (otherPlayer.userId === player.userId) return;

            const screenX = (otherPlayer.x - startX) * TILE_SIZE;
            const screenY = (otherPlayer.y - startY) * TILE_SIZE;

            if (screenX >= 0 && screenX < VIEWPORT_WIDTH * TILE_SIZE && 
                screenY >= 0 && screenY < VIEWPORT_HEIGHT * TILE_SIZE) {
                
                drawPlayer(ctx, otherPlayer, screenX, screenY, false);
            }
        });

        // Dessiner les monstres
        monsters.forEach(monster => {
            const screenX = (monster.x - startX) * TILE_SIZE;
            const screenY = (monster.y - startY) * TILE_SIZE;

            if (screenX >= 0 && screenX < VIEWPORT_WIDTH * TILE_SIZE && 
                screenY >= 0 && screenY < VIEWPORT_HEIGHT * TILE_SIZE) {
                
                drawMonster(ctx, monster, screenX, screenY);
            }
        });

        // Dessiner le joueur principal (toujours au centre)
        const playerScreenX = Math.floor(VIEWPORT_WIDTH / 2) * TILE_SIZE;
        const playerScreenY = Math.floor(VIEWPORT_HEIGHT / 2) * TILE_SIZE;
        drawPlayer(ctx, player, playerScreenX, playerScreenY, true);
    };

    const drawPlayer = (ctx, playerData, x, y, isMainPlayer) => {
        // Cercle de base
        const centerX = x + TILE_SIZE / 2;
        const centerY = y + TILE_SIZE / 2;
        const radius = TILE_SIZE * 0.3;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        
        // Couleur selon la classe
        const classColors = {
            iop: '#FF0000',
            cra: '#00FF00', 
            eni: '#0000FF',
            sadi: '#8B4513'
        };
        
        ctx.fillStyle = classColors[playerData.classe] || '#888888';
        if (isMainPlayer) {
            ctx.fillStyle = '#FFD700'; // Or pour le joueur principal
        }
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Nom du joueur
        ctx.font = '12px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(playerData.username, x, y - 5);
        ctx.fillText(playerData.username, x, y - 5);

        // Barre de vie
        const barWidth = TILE_SIZE - 4;
        const barHeight = 4;
        const hpPercent = playerData.hp / playerData.maxHp;
        
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(x + 2, y + TILE_SIZE - 8, barWidth, barHeight);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(x + 2, y + TILE_SIZE - 8, barWidth * hpPercent, barHeight);
    };

    const drawMonster = (ctx, monster, x, y) => {
        const centerX = x + TILE_SIZE / 2;
        const centerY = y + TILE_SIZE / 2;

        // Corps du monstre
        ctx.beginPath();
        ctx.arc(centerX, centerY, TILE_SIZE * 0.25, 0, 2 * Math.PI);
        ctx.fillStyle = '#8B0000';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Niveau
        ctx.font = '10px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(`Lvl${monster.level}`, centerX, y - 2);

        // Barre de vie monstre
        const barWidth = TILE_SIZE - 4;
        const barHeight = 3;
        const hpPercent = monster.hp / monster.maxHp;
        
        ctx.fillStyle = '#660000';
        ctx.fillRect(x + 2, y + TILE_SIZE - 6, barWidth, barHeight);
        ctx.fillStyle = '#FF6666';
        ctx.fillRect(x + 2, y + TILE_SIZE - 6, barWidth * hpPercent, barHeight);
    };

    const drawUI = (ctx) => {
        // Minimap en haut à droite
        drawMinimap(ctx);
        
        // Informations du joueur
        drawPlayerInfo(ctx);
    };

    
    const drawMinimap = (ctx) => {
        const minimapSize = 120;
        const minimapX = canvasRef.current.width - minimapSize - 10;
        const minimapY = 20;

        // Fond et bordure
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
        ctx.strokeStyle = '#FFFFFF';
        ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);

        const wd = gameState.worldData;
        if (!wd || !wd.width || !wd.height) return;

        const scale = minimapSize / Math.max(wd.width, wd.height);

        // (Perf) On ne dessine plus le terrain entier ici.
        // On se contente d'afficher la position du joueur et des autres joueurs.

        // Joueur
        if (gameState.player) {
            const px = minimapX + gameState.player.x * scale;
            const py = minimapY + gameState.player.y * scale;
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Autres joueurs
        if (Array.isArray(gameState.players)) {
            gameState.players.forEach(ply => {
                if (!gameState.player || ply.userId === gameState.player.userId) return;
                const px = minimapX + ply.x * scale;
                const py = minimapY + ply.y * scale;
                ctx.fillStyle = '#00FF00';
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
    };

    const drawPlayerInfo = (ctx) => {
        if (!gameState.player) return;

        const infoX = 10;
        const infoY = 10;
        const infoWidth = 200;
        const infoHeight = 100;

        // Fond
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(infoX, infoY, infoWidth, infoHeight);
        ctx.strokeStyle = '#FFFFFF';
        ctx.strokeRect(infoX, infoY, infoWidth, infoHeight);

        // Texte
        ctx.font = '14px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        
        const player = gameState.player;
        const lines = [
            `${player.username} - Niveau ${player.level}`,
            `HP: ${player.hp}/${player.maxHp}`,
            `PA: ${player.pa || 6}/6 PM: ${player.pm || 3}/3`,
            `Position: (${player.x}, ${player.y})`,
            `Kamas: ${player.kamas || 0}`
        ];

        lines.forEach((line, index) => {
            ctx.fillText(line, infoX + 10, infoY + 20 + index * 16);
        });
    };

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setMousePos({ x, y });

        // Calculer la tuile survolée
        if (gameState.player) {
            const tileX = Math.floor(x / TILE_SIZE);
            const tileY = Math.floor(y / TILE_SIZE);
            
            const centerX = gameState.player.x;
            const centerY = gameState.player.y;
            const startX = Math.max(0, centerX - Math.floor(VIEWPORT_WIDTH / 2));
            const startY = Math.max(0, centerY - Math.floor(VIEWPORT_HEIGHT / 2));
            
            const worldX = startX + tileX;
            const worldY = startY + tileY;
            
            setHoveredTile({ x: worldX, y: worldY });
        }
    };

    const handleClick = (e) => {
        if (!hoveredTile) return;

        // Vérifier s'il y a un monstre à cliquer
        const monster = gameState.monsters.find(m => 
            m.x === hoveredTile.x && m.y === hoveredTile.y
        );

        // Sinon, vérifier s'il y a un joueur cliqué
        const other = gameState.players.find(pl => pl.userId !== gameState.player.userId && pl.x === hoveredTile.x && pl.y === hoveredTile.y);
        if (other && socket) {
            socket.emit('requestPvp', { opponentId: other.userId });
            return;
        }
        if (monster) {
            onTargetSelect(monster.id);
        }
    };

    return (
        <div className="game-canvas-container">
            <canvas
                ref={canvasRef}
                width={VIEWPORT_WIDTH * TILE_SIZE}
                height={VIEWPORT_HEIGHT * TILE_SIZE}
                onMouseMove={handleMouseMove}
                onClick={handleClick}
                style={{ border: '2px solid #333', cursor: 'crosshair' }}
            />
            
            {/* Contrôles */}
            <div className="controls-overlay">
                <div className="controls-help">
                    <p>🎮 <strong>Contrôles:</strong></p>
                    <p>Flèches ou WASD - Se déplacer</p>
                    <p>Clic - Sélectionner cible</p>
                    <p>Espace - Attaquer</p>
                </div>
            </div>
        </div>
    );
}

export default GameCanvas;