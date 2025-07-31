// ========================
// COMPONENTS/UI.JS - Interface utilisateur corrigée
// ========================
import React, { useState, useEffect } from 'react';
import './ui.css';
import Spellbook from './spellbook';
import Inventory from './inventory';

function UI({ gameState, socket, onTargetSelect }) {
  const [chatInput, setChatInput] = useState('');
  const [showInventory, setShowInventory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSpellbook, setShowSpellbook] = useState(false);
  const [playerSkills, setPlayerSkills] = useState({ available: [], equipped: [] });

  // Charger les compétences du joueur
  useEffect(() => {
    if (socket && gameState.player) {
      socket.emit('getSkills');
      
      socket.on('skillsData', (data) => {
        setPlayerSkills(data);
      });

      return () => {
        socket.off('skillsData');
      };
    }
  }, [socket, gameState.player]);

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (chatInput.trim() && socket) {
      socket.emit('chat', chatInput.trim());
      setChatInput('');
    }
  };

  const handleAction = (action) => {
    if (!socket) return;
    switch (action) {
      case 'togglePvp':
        socket.emit('togglePvp', { enabled: !gameState.player?.pvpEnabled });
        break;
      case 'rest': 
        socket.emit('rest'); 
        break;
      case 'flee': 
        if (gameState.combat?.active) {
          socket.emit('flee');
        }
        break;
      default: 
        break;
    }
  };

  const handleEquipSkills = (skillIds) => {
    if (socket) {
      socket.emit('equipSkills', { skills: skillIds });
      // Mettre à jour localement aussi
      setPlayerSkills(prev => ({ ...prev, equipped: skillIds }));
      setShowSpellbook(false);
    }
  };

  return (
    <div className="ui-overlay">
      {/* Panel d'actions */}
      <div className="action-panel">
        <h3>⚡ Actions</h3>
        <button onClick={() => handleAction('rest')} className="action-btn">
          💊 Se soigner
        </button>
        {gameState.combat?.active && (
          <button onClick={() => handleAction('flee')} className="action-btn">
            🏃 Fuir le combat
          </button>
        )}
        <button onClick={() => setShowInventory(true)} className="action-btn">
            🎒 Inventaire
        </button>
        <button onClick={() => setShowStats(!showStats)} className="action-btn">
          📊 Statistiques
        </button>
        <button onClick={() => setShowSpellbook(true)} className="action-btn">
          📜 Grimoire
        </button>
        <button className="action-btn" onClick={() => handleAction('togglePvp')}>
          {gameState.player?.pvpEnabled ? 'PVP: ON' : 'PVP: OFF'}
        </button>
      </div>

      {/* Chat */}
      <div className="chat-panel">
        <div className="chat-messages">
          {gameState.chatMessages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.type}`}>
              <span className="timestamp">
                {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
              <span className="message">{msg.text}</span>
            </div>
          ))}
        </div>
        <form onSubmit={handleChatSubmit} className="chat-input-form">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Tape ton message..."
            className="chat-input"
            maxLength={200}
          />
          <button type="submit" className="chat-send">💬</button>
        </form>
      </div>

      {/* Panel joueurs en ligne */}
      <div className="players-panel">
        <h3>👥 Joueurs en ligne ({gameState.players?.length || 0})</h3>
        {(gameState.players || []).map((player) => (
          <div key={player.userId} className="player-item">
            <span className={`player-status ${player.inCombat ? 'combat' : 'normal'}`}>
              {player.isDead ? '💀' : player.inCombat ? '⚔️' : '🟢'}
            </span>
            <span className="player-name">{player.username}</span>
            <span className="player-level">Niv. {player.level}</span>
          </div>
        ))}
      </div>

      {/* Modal Inventaire */}
      {showInventory && (
          <Inventory 
              socket={socket}
              onClose={() => setShowInventory(false)}
          />
      )}

      {/* Modal Statistiques */}
      {showStats && gameState.player && (
        <div className="modal-overlay" onClick={() => setShowStats(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>📊 Statistiques de {gameState.player.username}</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Classe :</span>
                <span className="stat-value">{gameState.player.classe.toUpperCase()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Niveau :</span>
                <span className="stat-value">{gameState.player.level}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Expérience :</span>
                <span className="stat-value">
                  {gameState.player.xp}/{gameState.player.level * 100}
                </span>
                <div className="progress-bar">
                  <div
                    className="progress-fill xp"
                    style={{ width: `${(gameState.player.xp / (gameState.player.level * 100)) * 100}%` }}
                  />
                </div>
              </div>
              <div className="stat-item">
                <span className="stat-label">Points de Vie :</span>
                <span className="stat-value">
                  {gameState.player.hp}/{gameState.player.maxHp}
                </span>
                <div className="progress-bar">
                  <div
                    className="progress-fill hp"
                    style={{ width: `${(gameState.player.hp / gameState.player.maxHp) * 100}%` }}
                  />
                </div>
              </div>
              <div className="stat-item">
                <span className="stat-label">Points d'Action :</span>
                <span className="stat-value">{gameState.player.pa || 6}/6</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Kamas :</span>
                <span className="stat-value">💰 {gameState.player.kamas || 0}</span>
              </div>
            </div>
            <button onClick={() => setShowStats(false)}>Fermer</button>
          </div>
        </div>
      )}

      {/* Modal Grimoire de sorts */}
      {showSpellbook && (
        <Spellbook
          skills={playerSkills.available}
          equipped={playerSkills.equipped}
          onEquip={handleEquipSkills}
          onClose={() => setShowSpellbook(false)}
        />
      )}
    </div>
  );
}

export default UI;