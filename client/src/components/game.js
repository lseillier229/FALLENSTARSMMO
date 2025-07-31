// ========================
// COMPONENTS/GAME.JS - Le jeu principal
// ========================
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import GameCanvas from './gamecanvas';
import UI from './ui';
import CombatUI from './combatui';
import './game.css';

function Game({ user }) {
    const [socket, setSocket] = useState(null);
    const [gameState, setGameState] = useState({
        combat: { active: false, player: null, monster: null, skills: [], turn: 'player', log: [] },
        player: null,
        worldData: null,
        players: [],
        monsters: [],
        selectedTarget: null,
        chatMessages: []
    });
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Connexion WebSocket
        const newSocket = io('http://localhost:3001');
        setSocket(newSocket);

        // Authentification
        newSocket.emit('authenticate', localStorage.getItem('token'));

        // Événements WebSocket
        newSocket.on('authSuccess', (data) => {
            setGameState(prev => ({
                ...prev,
                player: data.player,
                worldData: data.worldData
            }));
            setConnected(true);
        });
        // Liste des joueurs en ligne (init + diagnostic multi)
        newSocket.on('onlineList', ({ players }) => {
            setGameState(prev => ({ ...prev, players: Array.isArray(players) ? players : [] }));
        });

        // Mise à jour incrémentale quand un joueur rejoint
        newSocket.on('playerJoined', (p) => {
            if (!p) return;
            setGameState(prev => {
                const others = (prev.players || []).filter(x => x.userId !== p.userId);
                return { ...prev, players: [...others, p] };
            });
        });

        // Et quand un joueur part
        newSocket.on('playerLeft', ({ userId }) => {
            setGameState(prev => ({ ...prev, players: (prev.players || []).filter(p => p.userId !== userId) }));
        });

        // Réception d'un chunk de terrain
        newSocket.on('chunk', ({ chunk }) => {
            setGameState(prev => ({
                ...prev,
                worldData: { ...(prev.worldData || {}), chunk }
            }));
        });

        newSocket.on('combatEnded', (data) => {
            setGameState(prev => ({
                ...prev,
                player: { 
                    ...prev.player, 
                    xp: data.player.xp, 
                    level: data.player.level,
                    hp: data.player.hp,
                    maxHp: data.player.maxHp,
                    kamas: data.player.kamas 
                },
                combat: { active: false, player: null, monster: null, skills: [], turn: 'player', log: [] },
                chatMessages: [
                    ...prev.chatMessages, 
                    { 
                        type: 'system', 
                        text: data.message, 
                        timestamp: Date.now() 
                    }
                ]
            }));
            
            // Afficher le loot obtenu
            if (data.loot && data.loot.length > 0) {
                const lootMessages = data.loot.map(item => {
                    if (item.type === 'gold') {
                        return { 
                            type: 'loot', 
                            text: `💰 +${item.amount} kamas`, 
                            timestamp: Date.now() 
                        };
                    }
                    return { 
                        type: 'loot', 
                        text: `📦 ${item.name} (${item.rarity})`, 
                        timestamp: Date.now(),
                        rarity: item.rarity 
                    };
                });
                
                setGameState(prev => ({
                    ...prev,
                    chatMessages: [...prev.chatMessages, ...lootMessages]
                }));
            }
        });

        newSocket.on('authError', (error) => {
            console.error('Erreur auth:', error);
            localStorage.removeItem('token');
            window.location.reload();
        });

        newSocket.on('worldUpdate', (data) => {
            setGameState(prev => ({
                ...prev,
                players: data.players,
                monsters: data.monsters
            }));
        });

        newSocket.on('moveSuccess', (data) => {
            setGameState(prev => ({
                ...prev,
                player: {
                    ...prev.player,
                    x: data.x,
                    y: data.y,
                    pm: data.pm
                }
            }));
        });

        
        // Combat events
        newSocket.on('combatStarted', (data) => {
            setGameState(prev => ({
                ...prev,
                combat: {
                    active: true,
                    player: data.player,
                    monster: data.monster,
                    skills: data.skills || [],
                    turn: data.turn || 'player',
                    log: [{ side: 'system', text: 'Combat engagé !' }]
                }
            }));
        });

        newSocket.on('combatUpdate', (data) => {
            setGameState(prev => ({
                ...prev,
                player: { ...prev.player, hp: data.player.hp, pa: data.player.pa },
                combat: {
                    ...prev.combat,
                    player: data.player,
                    monster: data.monster,
                    turn: data.turn,
                    log: [...prev.combat.log, ...data.log]
                }
            }));
        });

        newSocket.on('combatEnded', (data) => {
            setGameState(prev => ({
                ...prev,
                player: { 
                    ...prev.player, 
                    xp: data.player.xp, 
                    level: data.player.level,
                    hp: data.player.hp,
                    maxHp: data.player.maxHp,
                    kamas: data.player.kamas 
                },
                combat: { active: false, player: null, monster: null, skills: [], turn: 'player', log: [] },
                chatMessages: [...prev.chatMessages, { type: 'system', text: data.message, timestamp: Date.now() }]
            }));
        });
        // Repos
        newSocket.on('restResult', ({ hp, maxHp }) => {
            setGameState(prev => ({
                ...prev,
                player: { ...prev.player, hp, maxHp }
            }));
        });

        // Joueur K.O.
        newSocket.on('playerDied', ({ respawnIn }) => {
            setGameState(prev => ({
                ...prev,
                combat: { active: false, player: null, monster: null, skills: [], turn: 'player', log: [] },
                player: { ...prev.player, hp: 0, inCombat: false, isDead: true },
                chatMessages: [
                    ...prev.chatMessages,
                    { type: 'system', text: `💀 Vous êtes K.O. Réapparition dans ${Math.floor(respawnIn/1000)}s.`, timestamp: Date.now() }
                ]
            }));
        });

        // Réapparition
        newSocket.on('respawn', ({ player }) => {
            setGameState(prev => ({
                ...prev,
                player: { ...prev.player, ...player },
                chatMessages: [
                    ...prev.chatMessages,
                    { type: 'system', text: `🔁 Réapparu en (${player.x}, ${player.y}).`, timestamp: Date.now() }
                ]
            }));
        });



        newSocket.on('attackResult', (data) => {
            // Afficher les dégâts
            setGameState(prev => ({
                ...prev,
                chatMessages: [...prev.chatMessages, {
                    type: 'combat',
                    text: `Tu infliges ${data.damage} dégâts !`,
                    timestamp: Date.now()
                }]
            }));
        });

        newSocket.on('monsterKilled', (data) => {
            setGameState(prev => ({
                ...prev,
                player: {
                    ...prev.player,
                    xp: data.xp,
                    kamas: data.kamas
                },
                chatMessages: [...prev.chatMessages, {
                    type: 'victory',
                    text: `Monstre vaincu ! +${data.xp} XP, +${data.kamas} kamas`,
                    timestamp: Date.now()
                }]
            }));
        });

        return () => newSocket.close();
    }, []);

    // Gestion du clavier
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (!socket || !gameState.player) return;

            const keyMap = {
                'ArrowUp': 'up',
                'ArrowDown': 'down',
                'ArrowLeft': 'left',
                'ArrowRight': 'right',
                'z': 'up',
                's': 'down',
                'q': 'left',
                'd': 'right'
            };

            const direction = keyMap[e.key];
            if (direction) {
                e.preventDefault();
                socket.emit('move', direction);
            }

            // Attaque avec espace
            if (e.key === ' ') {
                e.preventDefault();
                // En combat, les attaques se font via la barre de compétences.
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [socket, gameState.player, gameState.selectedTarget]);

    const handleUseSkill = (skillId) => {
        if (!socket || !gameState.combat?.active) return;
        const monsterId = gameState.combat.monster?.id;
        socket.emit('useSkill', { targetId: monsterId, skillId });
    };
    const handleFlee = () => {
        if (!socket || !gameState.combat?.active) return;
        socket.emit('flee');
    };

    const handleRest = () => {
        if (!socket || gameState.player?.inCombat || gameState.player?.isDead) return;
        socket.emit('rest');
    };

    const handleTargetSelect = (targetId) => {
        setGameState(prev => ({
            ...prev,
            selectedTarget: targetId
        }));
    };

    if (!connected) {
        return (
            <div className="game-loading">
                <div className="loading-spinner"></div>
                <h2>🌍 Connexion au monde...</h2>
            </div>
        );
    }

    return (
        <div className="game-container">
            <GameCanvas 
                gameState={gameState}
                socket={socket}
                onTargetSelect={handleTargetSelect}
            />
            <UI 
                gameState={gameState}
                socket={socket}
                onTargetSelect={handleTargetSelect}
            />
            {gameState.combat?.active && (
                <CombatUI
                    combat={gameState.combat}
                    onUseSkill={handleUseSkill}
                    onClose={() => setGameState(prev => ({ ...prev, combat: { ...prev.combat, active:false } }))}
                />
            )}
        </div>
    );
}

export default Game;
