// ========================
// APP.JS - Composant principal
// ========================
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Game from './components/Game';
import CharacterCreation from './components/CharacterCreation';
import './App.css';

function App() {
    const [user, setUser] = useState(null);
    const [hasCharacter, setHasCharacter] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            // Vérifier la validité du token
            fetch('/api/verify-token', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.valid) {
                    setUser(data.user);
                    setHasCharacter(data.hasCharacter);
                } else {
                    localStorage.removeItem('token');
                }
                setLoading(false);
            })
            .catch(() => {
                localStorage.removeItem('token');
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, []);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <h2>🎮 Chargement de Dofus MMO...</h2>
            </div>
        );
    }

    if (!user) {
        return <Login onLogin={setUser} />;
    }

    if (!hasCharacter) {
        return <CharacterCreation onCharacterCreated={() => setHasCharacter(true)} />;
    }

    return <Game user={user} />;
}

export default App;








