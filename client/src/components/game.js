// ========================
// COMPONENTS/GAME.JS - Le jeu principal
// ========================
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import GameCanvas from './gamecanvas';
import UI from './ui';
import './game.css';

function Game({ user }) {
    const [socket, setSocket] = useState(null);
    const [gameState, setGameState] = useState({
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
            if (e.key === ' ' && gameState.selectedTarget) {
                e.preventDefault();
                socket.emit('attack', gameState.selectedTarget);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [socket, gameState.player, gameState.selectedTarget]);

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
                onTargetSelect={handleTargetSelect}
            />
            <UI 
                gameState={gameState}
                socket={socket}
                onTargetSelect={handleTargetSelect}
            />
        </div>
    );
}

export default Game;
