// ========================
// COMPONENTS/LOGIN.JS
// ========================
import React, { useState } from 'react';
import './Login.css';

function Login({ onLogin }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: '',
        discordId: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const endpoint = isRegistering ? '/api/register' : '/api/login';
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                onLogin(data);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Erreur de connexion au serveur');
        }
        
        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>🎮 Dofus MMO</h1>
                    <p>Connecte-toi pour commencer l'aventure</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label>Nom d'utilisateur</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Mot de passe</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            required
                        />
                    </div>

                    {isRegistering && (
                        <>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Discord ID (optionnel)</label>
                                <input
                                    type="text"
                                    value={formData.discordId}
                                    onChange={(e) => setFormData({...formData, discordId: e.target.value})}
                                    placeholder="Pour lier ton compte Discord"
                                />
                            </div>
                        </>
                    )}

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" disabled={loading} className="submit-btn">
                        {loading ? '⏳ Chargement...' : (isRegistering ? '📝 S\'inscrire' : '🚪 Se connecter')}
                    </button>
                </form>

                <div className="toggle-form">
                    <button 
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="toggle-btn"
                    >
                        {isRegistering ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Login;