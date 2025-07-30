// ========================
// COMPONENTS/CHARACTERCREATION.JS
// ========================
import React, { useState } from 'react';
import './charactercreation.css';

const CLASSES = {
    iop: { name: 'Iop', emoji: '⚔️', description: 'Guerrier puissant, spécialisé dans les combats au corps à corps' },
    cra: { name: 'Cra', emoji: '🏹', description: 'Archer agile, expert des attaques à distance' },
    eni: { name: 'Eniripsa', emoji: '💊', description: 'Soigneur sage, maître des sorts de guérison' },
    sadi: { name: 'Sadida', emoji: '🌱', description: 'Invocateur nature, contrôle les éléments végétaux' }
};

function CharacterCreation({ onCharacterCreated }) {
    const [characterData, setCharacterData] = useState({
        name: '',
        classe: 'iop'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/character/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(characterData)
            });

            const data = await response.json();

            if (response.ok) {
                onCharacterCreated();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Erreur de création du personnage');
        }
        
        setLoading(false);
    };

    return (
        <div className="character-creation">
            <div className="creation-card">
                <h1>⭐ Créer ton Héros</h1>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nom du personnage</label>
                        <input
                            type="text"
                            value={characterData.name}
                            onChange={(e) => setCharacterData({...characterData, name: e.target.value})}
                            placeholder="Choisis un nom épique..."
                            maxLength={20}
                            required
                        />
                    </div>

                    <div className="class-selection">
                        <label>Choisis ta classe</label>
                        <div className="classes-grid">
                            {Object.entries(CLASSES).map(([key, classe]) => (
                                <div
                                    key={key}
                                    className={`class-card ${characterData.classe === key ? 'selected' : ''}`}
                                    onClick={() => setCharacterData({...characterData, classe: key})}
                                >
                                    <div className="class-emoji">{classe.emoji}</div>
                                    <h3>{classe.name}</h3>
                                    <p>{classe.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" disabled={loading} className="create-btn">
                        {loading ? '⏳ Création...' : '🚀 Créer mon héros !'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default CharacterCreation;