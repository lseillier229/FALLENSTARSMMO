// =============================
// Nouveau fichier: client/src/components/lootnotification.js
// =============================
import React, { useEffect, useState } from 'react';
import './lootnotification.css';

const RARITY_COLORS = {
    common: '#B0B0B0',
    uncommon: '#1EFF00',
    rare: '#0080FF',
    epic: '#A335EE',
    legendary: '#FF8000',
    unique: '#FF0000'
};

function LootNotification({ loot, onClose }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300);
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    if (!loot || loot.length === 0) return null;

    return (
        <div className={`loot-notification ${visible ? 'visible' : ''}`}>
            <h3>✨ Butin obtenu !</h3>
            <div className="loot-items">
                {loot.map((item, index) => (
                    <div 
                        key={index} 
                        className={`loot-item ${item.rarity || ''}`}
                        style={{ 
                            borderColor: item.rarity ? RARITY_COLORS[item.rarity] : '#ffd700' 
                        }}
                    >
                        {item.type === 'gold' ? (
                            <>💰 {item.amount} kamas</>
                        ) : (
                            <>
                                <span className="loot-icon">{item.icon || '📦'}</span>
                                <span className="loot-name">{item.name}</span>
                                <span className="loot-rarity">({item.rarity})</span>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default LootNotification;