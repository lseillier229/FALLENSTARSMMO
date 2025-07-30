// ========================
// COMPONENTS/COMBATUI.JS - Barre de combat style Pokémon
// ========================
import React from 'react';
import './combat.css';

export default function CombatUI({ combat, onUseSkill, onClose }) {
  if (!combat?.active) return null;

  const { player, monster, skills, turn, log } = combat;

  const percent = (num = 0, den = 1) => {
  const d = Math.max(1, den);
  const p = Math.round((num / d) * 100);
  return Math.max(0, Math.min(100, p));
};
  
  return (
    <div className="combat-bar">
      <div className="combat-left">
        <div className="sprite player-sprite" title={player?.classe || 'Player'} />
        <div className="card">
          <div className="row">
            <div className="title">{player?.username}</div>
            <div className="lvl">Lvl {player?.level}</div>
          </div>
          <div className="meter hp">
            <div style={{ width: `${percent(player?.hp || 0, player?.maxHp || 1)}%` }} />
          </div>
          <div className="row mini"><span>HP</span><span>{player?.hp}/{player?.maxHp}</span></div>
          <div className="meter pa">
            <div style={{ width: `${percent(player?.pa || 0, 6)}%` }} />
          </div>
          <div className="row mini"><span>PA</span><span>{player?.pa}</span></div>
        </div>
      </div>

      <div className="combat-middle">
        <div className="skills">
          {skills.map((s) => (
            <button
              key={s.id}
              className="skill-btn"
              disabled={turn !== 'player' || (player?.pa || 0) < (s.pa || 0)}
              onClick={() => onUseSkill(s.id)}
              title={`PA: ${s.pa || 0}`}
            >
              <div className="skill-name">{s.name}</div>
              <div className="skill-sub">PA {s.pa || 0} • {s.power[0]}–{s.power[1]}</div>
            </button>
          ))}
        </div>
        <div className="log">
          {log.slice(-5).map((l, idx) => (
            <div key={idx} className={`log-line ${l.side}`}>{l.text}</div>
          ))}
        </div>
      </div>

      <div className="combat-right">
        <div className={`sprite monster-sprite ${monster?.type || 'mob'}`} title={monster?.type || 'Monstre'} />
        <div className="card">
          <div className="row">
            <div className="title">{monster?.type || 'Monstre'}</div>
            <div className="lvl">Lvl {monster?.level}</div>
          </div>
          <div className="meter hp">
            <div style={{ width: `${percent(monster?.hp || 0, monster?.maxHp || 1)}%` }} />
          </div>
          <div className="row mini"><span>HP</span><span>{monster?.hp}/{monster?.maxHp}</span></div>
        </div>
      </div>

      <button className="combat-close" onClick={onClose}>✖</button>
      <div className={`turn-indicator ${turn}`}>{turn === 'player' ? 'À toi de jouer' : 'Tour du monstre'}</div>
    </div>
  );
}