// ========================
// COMPONENTS/COMBATUI.JS - Interface de combat améliorée
// ========================
import React from 'react';
import './combat.css';

export default function CombatUI({ combat, onUseSkill, onFlee, onRest }) {
  if (!combat || !combat.active) return null;

  const { player, monster, skills, turn, log } = combat;

  // Helper pour les pourcentages
  const percent = (num, den) =>
    Math.max(0, Math.min(100, Math.round((num / Math.max(1, den)) * 100)));

  const canPlay = turn === 'player' && player && !player.isDead;
  const skillsList = Array.isArray(skills) ? skills : [];

  const handleUse = (skill) => {
    if (!skill || !canPlay) return;
    if ((player?.pa ?? 0) < (skill.pa ?? 0)) return;
    if (typeof onUseSkill === 'function') onUseSkill(skill.id);
  };

  // Normalise les entrées du log
  const normalizeLog = (entry) => {
    if (typeof entry === 'string') return { side: 'system', text: entry };
    if (entry && typeof entry === 'object') {
      const side = entry.side || 'system';
      const text = typeof entry.text === 'string' ? entry.text : String(entry.text ?? '');
      return { side, text };
    }
    return { side: 'system', text: String(entry ?? '') };
  };

  return (
    <div className="combat-bar">
      {/* Zone des combattants */}
      <div className="fighters">
        <div className="fighter left">
          <div className={`sprite player-sprite ${player?.classe || ''}`} />
          <div className="info">
            <div className="name">{player?.username || 'Joueur'}</div>
            <div className="bars">
              <div className="bar hp">
                <div
                  className="fill"
                  style={{ width: `${percent(player?.hp || 0, player?.maxHp || 1)}%` }}
                />
                <span className="label">
                  HP {player?.hp ?? 0}/{player?.maxHp ?? 0}
                </span>
              </div>
              <div className="bar pa">
                <div className="fill" style={{ width: `${percent(player?.pa ?? 0, 6)}%` }} />
                <span className="label">PA {player?.pa ?? 0}/6</span>
              </div>
            </div>
          </div>
        </div>

        <div className="fighter right">
          <div className={`sprite monster-sprite ${monster?.type || 'mob'}`} />
          <div className="info">
            <div className="name">
              {monster?.type || 'Monstre'} (Niv. {monster?.level ?? '?'})
            </div>
            <div className="bars">
              <div className="bar hp">
                <div
                  className="fill"
                  style={{ width: `${percent(monster?.hp || 0, monster?.maxHp || 1)}%` }}
                />
                <span className="label">
                  HP {monster?.hp ?? 0}/{monster?.maxHp ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sorts disponibles */}
      <div className="skills-row">
        {skillsList.length === 0 && (
          <div className="hint">Aucun sort équipé. Ouvre le grimoire pour en choisir !</div>
        )}

        {skillsList.map((s) => (
          <button
            key={s.id}
            className="skill-btn"
            disabled={!canPlay || (player?.pa ?? 0) < s.pa}
            onClick={() => handleUse(s)}
          >
            <div className="skill-name">{s.name}</div>
            <div className="skill-meta">
              PA: {s.pa} • Dégâts: {Array.isArray(s.power) ? `${s.power[0]}-${s.power[1]}` : s.power}
            </div>
          </button>
        ))}
      </div>

      {/* Actions et indicateur de tour */}
      <div className="actions-row">
        <button className="action" onClick={onFlee} disabled={!canPlay}>
          🏃 Fuir
        </button>
        <div className="turn-indicator">
          {turn === 'player' ? '⚔️ À toi de jouer !' : '🛡️ Tour du monstre...'}
        </div>
        <button
          className="action"
          onClick={onRest}
          disabled={!player || player.inCombat || player.isDead}
        >
          💊 Se soigner
        </button>
      </div>

      {/* Journal de combat */}
      <div className="log">
        {(Array.isArray(log) ? log : [])
          .slice(-10)
          .map((entry, i) => {
            const { side, text } = normalizeLog(entry);
            return (
              <div key={i} className={`log-line ${side}`}>
                {text}
              </div>
            );
          })}
      </div>
    </div>
  );
}