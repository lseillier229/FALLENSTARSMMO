// ========================
// COMPONENTS/SPELLBOOK.JS - Choix des sorts
// ========================
import React from 'react';
import './spellbook.css';

export default function Spellbook({ skills, equipped, onEquip, onClose }) {
  const [sel, setSel] = React.useState(new Set(equipped || []));
  React.useEffect(() => { setSel(new Set(equipped || [])); }, [equipped]);

  const toggle = (id) => {
    const copy = new Set(sel);
    if (copy.has(id)) copy.delete(id); else copy.add(id);
    if (copy.size > 4) return; // max 4
    setSel(copy);
  };

  const commit = () => onEquip && onEquip(Array.from(sel));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content spellbook" onClick={e => e.stopPropagation()}>
        <h2>📜 Grimoire de sorts</h2>
        <p>Choisis jusqu'à 4 sorts actifs. Certains se débloquent avec le niveau.</p>
        <div className="skills-grid">
          {(skills || []).map(s => (
            <button key={s.id}
              className={`skill-card ${sel.has(s.id) ? 'selected' : ''}`}
              onClick={() => toggle(s.id)}
              title={`PA ${s.pa} • ${s.power[0]}–${s.power[1]} • niv. ${s.level}`}
            >
              <div className="name">{s.name}</div>
              <div className="meta">PA {s.pa} • {s.power[0]}–{s.power[1]} • niv. {s.level}</div>
              {equipped && equipped.includes(s.id) && <div className="pill">Équipé</div>}
            </button>
          ))}
        </div>

        <div className="actions">
          <button onClick={onClose}>Annuler</button>
          <button onClick={commit} className="primary">Équiper ({sel.size}/4)</button>
        </div>
      </div>
    </div>
  );
}
