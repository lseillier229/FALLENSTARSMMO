// ========================
// COMPONENTS/UI.JS - Interface utilisateur
// ========================
import React, { useState } from 'react';
import './ui.css';
import Spellbook from './spellbook';

function UI({ gameState, socket, onTargetSelect }) {
  const [chatInput, setChatInput] = useState('');
  const [showInventory, setShowInventory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSpellbook, setShowSpellbook] = useState(false);

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
      case 'rest': socket.emit('rest'); break;
      case 'flee': socket.emit('flee'); break;
      default: break;
    }
  };

  return (
    <div className="ui-overlay">
      {/* Panel d'actions */}
      <div className="action-panel">
        <h3>⚡ Actions</h3>
        <button onClick={() => handleAction('rest')} className="action-btn">😴 Se reposer</button>
        <button onClick={() => handleAction('flee')} className="action-btn">🏃 Fuir</button>
        <button onClick={() => setShowInventory(!showInventory)} className="action-btn">🎒 Inventaire</button>
        <button onClick={() => setShowStats(!showStats)} className="action-btn">📊 Statistiques</button>
        <button onClick={() => setShowSpellbook(true)} className="action-btn">🧪 Sorts</button>
      </div>

      {/* Chat */}
      <div className="chat-panel">
        <div className="chat-messages">
          {gameState.chatMessages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.type}`}>
              <span className="timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
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
          />
          <button type="submit" className="chat-send">💬</button>
        </form>
      </div>

      {/* Panel joueurs */}
      <div className="players-panel">
        <h3>👥 Joueurs ({gameState.players.length})</h3>
        {gameState.players.map((player) => (
          <div key={player.userId} className="player-item">
            <span className={`player-status ${player.inCombat ? 'combat' : 'normal'}`}>
              {player.inCombat ? '⚔️' : '🟢'}
            </span>
            <span className="player-name">{player.username}</span>
            <span className="player-level">Lvl {player.level}</span>
          </div>
        ))}
      </div>

      {/* Inventaire */}
      {showInventory && (
        <div className="modal-overlay" onClick={() => setShowInventory(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>🎒 Inventaire</h2>
            <div className="inventory-grid">
              <div className="empty-slot">Vide</div>
              <div className="empty-slot">Vide</div>
              <div className="empty-slot">Vide</div>
            </div>
            <button onClick={() => setShowInventory(false)}>Fermer</button>
          </div>
        </div>
      )}

      {/* Stats */}
      {showStats && gameState.player && (
        <div className="modal-overlay" onClick={() => setShowStats(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>📊 Statistiques de {gameState.player.username}</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Niveau:</span>
                <span className="stat-value">{gameState.player.level}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Expérience:</span>
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
                <span className="stat-label">Points de Vie:</span>
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
                <span className="stat-label">Kamas:</span>
                <span className="stat-value">{gameState.player.kamas || 0}</span>
              </div>
            </div>
            <button onClick={() => setShowStats(false)}>Fermer</button>
          </div>
        </div>
      )}

      {/* Grimoire de sorts */}
      {showSpellbook && (
        <Spellbook
          skills={(gameState.skills && gameState.skills.available) || []}
          equipped={(gameState.skills && gameState.skills.equipped) || []}
          onEquip={(ids) => {
            if (socket) socket.emit('equipSkills', { skills: ids });
            setShowSpellbook(false);
          }}
          onClose={() => setShowSpellbook(false)}
        />
      )}
    </div>
  );
}

export default UI;
