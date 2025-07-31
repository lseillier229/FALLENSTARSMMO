-- =============================
-- SQL SCHEMA - Nouvelles tables
-- =============================
DROP TABLE IF EXISTS monster_drops CASCADE;
DROP TABLE IF EXISTS player_inventory CASCADE;
DROP TABLE IF EXISTS items CASCADE;

-- Table des types d'objets avec leurs stats possibles
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('weapon', 'helmet', 'chest', 'boots', 'ring', 'amulet')),
    rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'unique')),
    level_required INTEGER DEFAULT 1,
    -- Stats de base
    damage_min INTEGER DEFAULT 0,
    damage_max INTEGER DEFAULT 0,
    defense INTEGER DEFAULT 0,
    hp_bonus INTEGER DEFAULT 0,
    pa_bonus INTEGER DEFAULT 0,
    pm_bonus INTEGER DEFAULT 0,
    -- Stats avancées
    crit_chance DECIMAL(4,2) DEFAULT 0,
    dodge_chance DECIMAL(4,2) DEFAULT 0,
    life_steal DECIMAL(4,2) DEFAULT 0,
    -- Métadonnées
    icon VARCHAR(50),
    description TEXT,
    is_unique BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table de l'inventaire des joueurs
CREATE TABLE IF NOT EXISTS player_inventory (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity INTEGER DEFAULT 1,
    is_equipped BOOLEAN DEFAULT FALSE,
    slot VARCHAR(20),
    obtained_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(character_id, item_id, is_equipped)
);

-- Table des drops de monstres
CREATE TABLE IF NOT EXISTS monster_drops (
    id SERIAL PRIMARY KEY,
    monster_type VARCHAR(50) NOT NULL,
    monster_level_min INTEGER DEFAULT 1,
    monster_level_max INTEGER DEFAULT 100,
    item_id INTEGER NOT NULL REFERENCES items(id),
    drop_chance DECIMAL(5,2) NOT NULL, -- en pourcentage
    UNIQUE(monster_type, item_id)
);

-- Ajouter les colonnes manquantes aux characters si elles n'existent pas
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipped_weapon INTEGER REFERENCES items(id);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipped_helmet INTEGER REFERENCES items(id);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipped_chest INTEGER REFERENCES items(id);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipped_boots INTEGER REFERENCES items(id);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipped_ring INTEGER REFERENCES items(id);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipped_amulet INTEGER REFERENCES items(id);

-- =============================
-- SEED DATA - Objets du jeu
-- =============================

-- Armes communes
INSERT INTO items (code, name, type, rarity, level_required, damage_min, damage_max, description) VALUES
('sword_rusty', 'Épée rouillée', 'weapon', 'common', 1, 5, 8, 'Une vieille épée qui a connu des jours meilleurs.'),
('staff_apprentice', 'Bâton d''apprenti', 'weapon', 'common', 1, 4, 7, 'Un simple bâton en bois pour les débutants.'),
('bow_training', 'Arc d''entraînement', 'weapon', 'common', 1, 6, 9, 'Un arc basique pour s''exercer au tir.'),
('dagger_simple', 'Dague simple', 'weapon', 'common', 1, 4, 6, 'Une petite lame facile à manier.');

-- Armes peu communes
INSERT INTO items (code, name, type, rarity, level_required, damage_min, damage_max, pa_bonus, description) VALUES
('sword_iron', 'Épée de fer', 'weapon', 'uncommon', 5, 10, 15, 0, 'Une épée forgée dans du bon fer.'),
('staff_elemental', 'Bâton élémentaire', 'weapon', 'uncommon', 5, 8, 14, 1, 'Un bâton imprégné d''énergie magique.'),
('bow_hunter', 'Arc du chasseur', 'weapon', 'uncommon', 5, 12, 18, 0, 'L''arc préféré des chasseurs expérimentés.');

-- Armes rares
INSERT INTO items (code, name, type, rarity, level_required, damage_min, damage_max, crit_chance, description) VALUES
('sword_silver', 'Épée d''argent', 'weapon', 'rare', 10, 18, 25, 5.0, 'Une lame forgée dans l''argent pur.'),
('staff_arcane', 'Bâton arcanique', 'weapon', 'rare', 10, 15, 22, 0, 'Un bâton pulsant d''énergie arcanique.'),
('bow_elven', 'Arc elfique', 'weapon', 'rare', 10, 20, 28, 7.5, 'Un arc finement ouvragé par les elfes.');

-- Armes épiques
INSERT INTO items (code, name, type, rarity, level_required, damage_min, damage_max, pa_bonus, crit_chance, description) VALUES
('sword_flame', 'Lame ardente', 'weapon', 'epic', 15, 30, 40, 1, 10.0, 'Une épée enflammée qui brûle ses ennemis.'),
('staff_cosmic', 'Bâton cosmique', 'weapon', 'epic', 15, 25, 35, 2, 5.0, 'Un bâton contenant l''essence des étoiles.');

-- Armes légendaires
INSERT INTO items (code, name, type, rarity, level_required, damage_min, damage_max, pa_bonus, life_steal, description) VALUES
('sword_excalibur', 'Excalibur', 'weapon', 'legendary', 20, 45, 60, 2, 10.0, 'La légendaire épée du roi Arthur.'),
('staff_merlin', 'Bâton de Merlin', 'weapon', 'legendary', 20, 40, 55, 3, 0, 'Le bâton du plus grand mage de tous les temps.');

-- Objets uniques (1 seul dans tout le serveur)
INSERT INTO items (code, name, type, rarity, level_required, damage_min, damage_max, pa_bonus, pm_bonus, hp_bonus, crit_chance, life_steal, is_unique, description) VALUES
('sword_fallen_star', 'Étoile Déchue', 'weapon', 'unique', 25, 60, 80, 3, 1, 50, 15.0, 15.0, TRUE, 'Forgée à partir d''une étoile tombée du ciel, cette épée n''a pas d''égale.'),
('crown_eternal', 'Couronne Éternelle', 'helmet', 'unique', 25, 0, 0, 2, 2, 100, 0, 0, TRUE, 'La couronne des anciens rois, conférant sagesse et pouvoir.'),
('heart_world', 'Cœur du Monde', 'amulet', 'unique', 30, 0, 0, 4, 3, 200, 20.0, 20.0, TRUE, 'Un artefact contenant l''essence même du monde.');

-- Casques
INSERT INTO items (code, name, type, rarity, level_required, defense, hp_bonus, description) VALUES
('helmet_leather', 'Casque en cuir', 'helmet', 'common', 1, 5, 10, 'Protection basique en cuir.'),
('helmet_iron', 'Casque de fer', 'helmet', 'uncommon', 5, 10, 20, 'Un solide casque en fer.'),
('helmet_mage', 'Capuche du mage', 'helmet', 'rare', 10, 8, 15, 'Une capuche mystique qui protège l''esprit.'),
('helmet_dragon', 'Heaume draconique', 'helmet', 'epic', 15, 20, 50, 'Forgé dans les écailles de dragon.');

-- Plastrons
INSERT INTO items (code, name, type, rarity, level_required, defense, hp_bonus, description) VALUES
('chest_cloth', 'Tunique en tissu', 'chest', 'common', 1, 8, 15, 'Une simple tunique.'),
('chest_chainmail', 'Cotte de mailles', 'chest', 'uncommon', 5, 15, 30, 'Des anneaux de métal entrelacés.'),
('chest_plate', 'Plastron d''acier', 'chest', 'rare', 10, 25, 50, 'Une armure lourde mais efficace.'),
('chest_mythril', 'Plastron de mithril', 'chest', 'epic', 15, 35, 80, 'Léger comme une plume, dur comme le diamant.');

-- Bottes
INSERT INTO items (code, name, type, rarity, level_required, defense, pm_bonus, dodge_chance, description) VALUES
('boots_leather', 'Bottes en cuir', 'boots', 'common', 1, 3, 0, 2.0, 'Des bottes confortables.'),
('boots_swift', 'Bottes de célérité', 'boots', 'uncommon', 5, 5, 1, 5.0, 'Ces bottes augmentent votre vitesse.'),
('boots_shadow', 'Bottes d''ombre', 'boots', 'rare', 10, 8, 1, 10.0, 'Vous vous déplacez comme une ombre.'),
('boots_hermes', 'Sandales d''Hermès', 'boots', 'legendary', 20, 15, 3, 20.0, 'Les sandales ailées du messager des dieux.');

-- Anneaux
INSERT INTO items (code, name, type, rarity, level_required, hp_bonus, pa_bonus, crit_chance, description) VALUES
('ring_copper', 'Anneau de cuivre', 'ring', 'common', 1, 5, 0, 0, 'Un simple anneau de cuivre.'),
('ring_silver', 'Anneau d''argent', 'ring', 'uncommon', 5, 10, 0, 3.0, 'Un anneau finement ouvragé.'),
('ring_power', 'Anneau de pouvoir', 'ring', 'rare', 10, 20, 1, 5.0, 'Cet anneau pulse d''énergie.'),
('ring_ancient', 'Anneau des anciens', 'ring', 'epic', 15, 40, 2, 10.0, 'Un anneau datant de l''ère des titans.');

-- Amulettes
INSERT INTO items (code, name, type, rarity, level_required, hp_bonus, life_steal, description) VALUES
('amulet_wooden', 'Amulette en bois', 'amulet', 'common', 1, 8, 0, 'Une amulette sculptée dans du bois sacré.'),
('amulet_crystal', 'Amulette de cristal', 'amulet', 'uncommon', 5, 15, 3.0, 'Un cristal qui brille d''une lueur intérieure.'),
('amulet_vampire', 'Amulette vampirique', 'amulet', 'rare', 10, 25, 8.0, 'Cette amulette draine la vie de vos ennemis.'),
('amulet_phoenix', 'Amulette du phénix', 'amulet', 'legendary', 20, 100, 15.0, 'Bénie par le phénix immortel.');

-- =============================
-- SEED DATA - Tables de drops
-- =============================

-- Drops communs pour monstres faibles
INSERT INTO monster_drops (monster_type, monster_level_min, monster_level_max, item_id, drop_chance) VALUES
('larve', 1, 5, (SELECT id FROM items WHERE code = 'sword_rusty'), 5.0),
('larve', 1, 5, (SELECT id FROM items WHERE code = 'helmet_leather'), 3.0),
('larve', 1, 5, (SELECT id FROM items WHERE code = 'boots_leather'), 3.0),
('larve', 1, 5, (SELECT id FROM items WHERE code = 'ring_copper'), 2.0);

INSERT INTO monster_drops (monster_type, monster_level_min, monster_level_max, item_id, drop_chance) VALUES
('bouftou', 1, 8, (SELECT id FROM items WHERE code = 'staff_apprentice'), 4.0),
('bouftou', 1, 8, (SELECT id FROM items WHERE code = 'chest_cloth'), 3.0),
('bouftou', 1, 8, (SELECT id FROM items WHERE code = 'amulet_wooden'), 2.0),
('bouftou', 5, 10, (SELECT id FROM items WHERE code = 'sword_iron'), 1.5);

INSERT INTO monster_drops (monster_type, monster_level_min, monster_level_max, item_id, drop_chance) VALUES
('arakne', 5, 15, (SELECT id FROM items WHERE code = 'bow_hunter'), 3.0),
('arakne', 5, 15, (SELECT id FROM items WHERE code = 'helmet_iron'), 2.0),
('arakne', 5, 15, (SELECT id FROM items WHERE code = 'boots_swift'), 1.5),
('arakne', 10, 20, (SELECT id FROM items WHERE code = 'ring_silver'), 1.0);

INSERT INTO monster_drops (monster_type, monster_level_min, monster_level_max, item_id, drop_chance) VALUES
('crabe', 5, 15, (SELECT id FROM items WHERE code = 'chest_chainmail'), 2.5),
('crabe', 5, 15, (SELECT id FROM items WHERE code = 'helmet_iron'), 2.0),
('crabe', 10, 20, (SELECT id FROM items WHERE code = 'sword_silver'), 0.8),
('crabe', 10, 20, (SELECT id FROM items WHERE code = 'amulet_crystal'), 0.5);

INSERT INTO monster_drops (monster_type, monster_level_min, monster_level_max, item_id, drop_chance) VALUES
('sanglier', 10, 25, (SELECT id FROM items WHERE code = 'chest_plate'), 1.5),
('sanglier', 10, 25, (SELECT id FROM items WHERE code = 'helmet_mage'), 1.0),
('sanglier', 15, 30, (SELECT id FROM items WHERE code = 'sword_flame'), 0.3),
('sanglier', 15, 30, (SELECT id FROM items WHERE code = 'ring_power'), 0.5),
('sanglier', 20, 40, (SELECT id FROM items WHERE code = 'boots_hermes'), 0.1);

-- Drops très rares pour objets uniques (0.01% = 1/10000)
INSERT INTO monster_drops (monster_type, monster_level_min, monster_level_max, item_id, drop_chance) VALUES
('sanglier', 25, 100, (SELECT id FROM items WHERE code = 'sword_fallen_star'), 0.01),
('crabe', 25, 100, (SELECT id FROM items WHERE code = 'crown_eternal'), 0.01),
('arakne', 30, 100, (SELECT id FROM items WHERE code = 'heart_world'), 0.01);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_player_inventory_character ON player_inventory(character_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_equipped ON player_inventory(character_id, is_equipped);
CREATE INDEX IF NOT EXISTS idx_monster_drops_type ON monster_drops(monster_type, monster_level_min, monster_level_max);