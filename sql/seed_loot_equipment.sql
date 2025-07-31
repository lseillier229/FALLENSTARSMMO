-- =============================================
-- Seed data for rarities, templates and loot tables
-- =============================================

-- Rarities
INSERT INTO item_rarities (code, name, weight, stat_multiplier, color) VALUES
('common','Commun',        600, 1.00, '#B0B0B0'),
('uncommon','Peu commun',  280, 1.10, '#3FBF3F'),
('rare','Rare',            100, 1.25, '#3F7FBF'),
('epic','Épique',           18, 1.45, '#7F3FBF'),
('legendary','Légendaire',   5, 1.70, '#BF8F3F'),
('mythic','Mythique',        1, 1.95, '#E03FBF')
ON CONFLICT (code) DO NOTHING;

-- Item templates (base stats kept simple for now)
INSERT INTO item_templates (name, slot, level_req, base_stats, world_unique) VALUES
('Épée simple',      'weapon', 1,  '{"attack": 6}', FALSE),
('Arc court',        'weapon', 1,  '{"attack": 5, "pm": 1}', FALSE),
('Bâton de novice',  'weapon', 1,  '{"attack": 4, "pa": 1}', FALSE),
('Heaume en cuir',   'helmet', 1,  '{"hp": 12}', FALSE),
('Plastron usé',     'chest',  1,  '{"hp": 18}', FALSE),
('Bottes légères',   'boots',  1,  '{"pm": 1}', FALSE),
('Anneau terne',     'ring',   1,  '{"hp": 6, "attack": 1}', FALSE),
('Amulette fendue',  'amulet', 1,  '{"pa": 1}', FALSE),
('L’Étoile Déchue',  'weapon', 10, '{"attack": 25, "hp": 30, "pa": 1}', TRUE)  -- World-unique
ON CONFLICT DO NOTHING;

-- Simple loot tables per monster type
INSERT INTO loot_tables (monster_type, min_level, max_level) VALUES
('gobelin', 1, 10),
('loup', 1, 10),
('chef_gobelin', 5, 20)
ON CONFLICT DO NOTHING;

-- Link items to tables with rarities and weights
WITH r AS (
  SELECT id, code FROM item_rarities
),
t AS (
  SELECT id, name FROM item_templates
),
lt AS (
  SELECT id, monster_type FROM loot_tables
)
INSERT INTO loot_table_entries (loot_table_id, template_id, rarity_id, weight)
SELECT lt.id, t.id, r.id,
       CASE r.code
         WHEN 'common' THEN 800
         WHEN 'uncommon' THEN 180
         WHEN 'rare' THEN 18
         WHEN 'epic' THEN 3
         WHEN 'legendary' THEN 1
         WHEN 'mythic' THEN 0
       END AS weight
FROM lt
JOIN t ON t.name IN ('Épée simple','Arc court','Bâton de novice','Heaume en cuir','Plastron usé','Bottes légères','Anneau terne','Amulette fendue')
JOIN r ON r.code IN ('common','uncommon','rare','epic','legendary')
ON CONFLICT DO NOTHING;
