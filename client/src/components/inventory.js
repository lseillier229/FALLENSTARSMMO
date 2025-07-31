// =============================
// client/src/components/inventory.js
// =============================
import React, { useState, useEffect } from 'react';
import './inventory.css';

const RARITY_COLORS = {
    common: '#B0B0B0',
    uncommon: '#1EFF00',
    rare: '#0080FF',
    epic: '#A335EE',
    legendary: '#FF8000',
    unique: '#FF0000'
};

const SLOT_NAMES = {
    weapon: 'Arme',
    helmet: 'Casque',
    chest: 'Plastron',
    boots: 'Bottes',
    ring: 'Anneau',
    amulet: 'Amulette'
};

function Inventory({ socket, onClose }) {
    const [inventoryData, setInventoryData] = useState({
        inventory: [],
        equipment: {},
        stats: {},
        kamas: 0
    });
    const [selectedItem, setSelectedItem] = useState(null);
    const [compareItem, setCompareItem] = useState(null);

    useEffect(() => {
        if (!socket) return;

        socket.emit('getInventory');

        socket.on('inventoryData', (data) => {
            setInventoryData(data);
        });

        socket.on('equipSuccess', () => {
            socket.emit('getInventory');
            setSelectedItem(null);
        });

        socket.on('unequipSuccess', ({ slot }) => {
          setInventoryData(prev => ({
            ...prev,
            equipment: { ...prev.equipment, [slot]: null }
          }));
          socket.emit('getInventory'); 
          setSelectedItem(null);
        });

        return () => {
            socket.off('inventoryData');
            socket.off('equipSuccess');
            socket.off('unequipSuccess');
        };
    }, [socket]);

    const handleEquip = (item) => {
        if (!socket || !item) return;
        socket.emit('equipItem', { itemId: item.item_id, slot: item.type });
    };

    const handleUnequip = (slot) => {
        if (!socket) return;
        socket.emit('unequipItem', { slot });
    };

    const getStatDifference = (stat, item) => {
        if (!compareItem) return 0;
        return (item[stat] || 0) - (compareItem[stat] || 0);
    };

    const renderStatComparison = (label, stat, item) => {
        const value = item[stat] || 0;
        if (value === 0) return null;

        const diff = getStatDifference(stat, item);
        const diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';

        return (
            <div className="stat-line">
                <span className="stat-label">{label}:</span>
                <span className="stat-value">{value}</span>
                {compareItem && diff !== 0 && (
                    <span className={`stat-diff ${diffClass}`}>
                        ({diff > 0 ? '+' : ''}{diff})
                    </span>
                )}
            </div>
        );
    };

    const renderItem = (item, isEquipped = false) => {
        if (!item) return null;

        return (
            <div
                className={`item-slot ${item.rarity}`}
                style={{ borderColor: RARITY_COLORS[item.rarity] }}
                onClick={() => {
                    setSelectedItem(item);
                    if (isEquipped) {
                        setCompareItem(null);
                    } else {
                        setCompareItem(inventoryData.equipment[item.type]);
                    }
                }}
                onMouseEnter={() => {
                    if (!isEquipped && inventoryData.equipment[item.type]) {
                        setCompareItem(inventoryData.equipment[item.type]);
                    }
                }}
                onMouseLeave={() => setCompareItem(null)}
            >
                <div className="item-icon">{item.icon || '⚔️'}</div>
                <div className="item-name">{item.name}</div>
                {item.quantity > 1 && (
                    <div className="item-quantity">{item.quantity}</div>
                )}
            </div>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
                <div className="inventory-header">
                    <h2>🎒 Inventaire</h2>
                    <div className="kamas-display">💰 {inventoryData.kamas} kamas</div>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="inventory-content">
                    {/* Équipement */}
                    <div className="equipment-section">
                        <h3>⚔️ Équipement</h3>
                        <div className="equipment-grid">
                            {Object.entries(SLOT_NAMES).map(([slot, name]) => (
                                <div key={slot} className="equipment-slot">
                                    <div className="slot-label">{name}</div>
                                    {inventoryData.equipment[slot] ? (
                                        renderItem(inventoryData.equipment[slot], true)
                                    ) : (
                                        <div className="empty-equipment-slot">
                                            <span className="slot-placeholder">Vide</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Stats du personnage */}
                        <div className="character-stats">
                            <h4>📊 Statistiques</h4>
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span className="stat-icon">⚔️</span>
                                    <span className="stat-name">Dégâts:</span>
                                    <span className="stat-value">
                                        {inventoryData.stats.damageMin}-{inventoryData.stats.damageMax}
                                    </span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-icon">🛡️</span>
                                    <span className="stat-name">Défense:</span>
                                    <span className="stat-value">{inventoryData.stats.defense}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-icon">⚡</span>
                                    <span className="stat-name">Crit:</span>
                                    <span className="stat-value">{inventoryData.stats.critChance}%</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-icon">💨</span>
                                    <span className="stat-name">Esquive:</span>
                                    <span className="stat-value">{inventoryData.stats.dodgeChance}%</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-icon">💚</span>
                                    <span className="stat-name">Vol de vie:</span>
                                    <span className="stat-value">{inventoryData.stats.lifeSteal}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Inventaire */}
                    <div className="inventory-section">
                        <h3>🎒 Sac</h3>
                        <div className="inventory-grid">
                            {inventoryData.inventory.map((item, index) => (
                                <div key={`inv-${item.item_id}-${index}`}>
                                    {renderItem(item)}
                                </div>
                            ))}
                            {/* Slots vides */}
                            {Array(Math.max(0, 20 - inventoryData.inventory.length)).fill(null).map((_, i) => (
                                <div key={`empty-${i}`} className="empty-slot">
                                    <span className="slot-placeholder">Vide</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Détails de l'item sélectionné */}
                {selectedItem && (
                    <div className="item-details">
                        <h3 style={{ color: RARITY_COLORS[selectedItem.rarity] }}>
                            {selectedItem.name}
                        </h3>
                        <div className="item-rarity">{selectedItem.rarity.toUpperCase()}</div>
                        <div className="item-type">Type: {SLOT_NAMES[selectedItem.type]}</div>
                        <div className="item-level">Niveau requis: {selectedItem.level_required}</div>
                        
                        <div className="item-stats">
                            {renderStatComparison('Dégâts', 'damage_min', selectedItem) && (
                                <div className="stat-line">
                                    <span className="stat-label">Dégâts:</span>
                                    <span className="stat-value">
                                        {selectedItem.damage_min}-{selectedItem.damage_max}
                                    </span>
                                    {compareItem && (
                                        <span className={`stat-diff ${
                                            (selectedItem.damage_max - compareItem.damage_max) > 0 ? 'positive' : 'negative'
                                        }`}>
                                            ({(selectedItem.damage_max - compareItem.damage_max) > 0 ? '+' : ''}
                                            {selectedItem.damage_max - compareItem.damage_max})
                                        </span>
                                    )}
                                </div>
                            )}
                            {renderStatComparison('Défense', 'defense', selectedItem)}
                            {renderStatComparison('Vie', 'hp_bonus', selectedItem)}
                            {renderStatComparison('PA', 'pa_bonus', selectedItem)}
                            {renderStatComparison('PM', 'pm_bonus', selectedItem)}
                            {renderStatComparison('Critique', 'crit_chance', selectedItem)}
                            {renderStatComparison('Esquive', 'dodge_chance', selectedItem)}
                            {renderStatComparison('Vol de vie', 'life_steal', selectedItem)}
                        </div>

                        <div className="item-description">{selectedItem.description}</div>

                        <div className="item-actions">
                            {selectedItem.is_equipped ? (
                                <button 
                                    className="unequip-btn"
                                    onClick={() => handleUnequip(selectedItem.slot)}
                                >
                                    Déséquiper
                                </button>
                            ) : (
                                <button 
                                    className="equip-btn"
                                    onClick={() => handleEquip(selectedItem)}
                                >
                                    Équiper
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Inventory;