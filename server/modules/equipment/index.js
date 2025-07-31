
// =============================================
// server/modules/equipment/index.js (hotfix)
// =============================================
const { randomUUID } = require('crypto');

function weightedPick(entries) {
  const total = entries.reduce((acc, e) => acc + (e.weight || 0), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const e of entries) {
    r -= (e.weight || 0);
    if (r <= 0) return e;
  }
  return entries[entries.length - 1] || null;
}

function mergeStats(base = {}, bonus = {}) {
  const out = { ...base };
  for (const [k, v] of Object.entries(bonus || {})) {
    out[k] = (out[k] || 0) + Number(v || 0);
  }
  return out;
}
function scaleStats(stats = {}, mult = 1.0) {
  const out = {};
  for (const [k, v] of Object.entries(stats)) out[k] = Math.round(Number(v) * mult);
  return out;
}

async function ensureSchema(db) {
  await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await db.query(`CREATE TABLE IF NOT EXISTS item_rarities (
    id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, weight INTEGER NOT NULL, stat_multiplier NUMERIC NOT NULL, color TEXT
  );`);
  await db.query(`CREATE TABLE IF NOT EXISTS item_templates (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, slot TEXT NOT NULL CHECK (slot IN ('weapon','helmet','chest','boots','ring','amulet')),
    level_req INTEGER NOT NULL DEFAULT 1, base_stats JSONB NOT NULL DEFAULT '{}'::jsonb, world_unique BOOLEAN NOT NULL DEFAULT FALSE
  );`);
  await db.query(`CREATE TABLE IF NOT EXISTS item_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id INTEGER NOT NULL REFERENCES item_templates(id) ON DELETE CASCADE,
    owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    rarity_id INTEGER NOT NULL REFERENCES item_rarities(id),
    rolled_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    equipped_slot TEXT,
    is_world_unique BOOLEAN NOT NULL DEFAULT FALSE
  );`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_world_unique_instance
    ON item_instances(template_id) WHERE is_world_unique = TRUE;`);
  await db.query(`CREATE TABLE IF NOT EXISTS player_equipment (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    weapon UUID REFERENCES item_instances(id),
    helmet UUID REFERENCES item_instances(id),
    chest  UUID REFERENCES item_instances(id),
    boots  UUID REFERENCES item_instances(id),
    ring   UUID REFERENCES item_instances(id),
    amulet UUID REFERENCES item_instances(id),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );`);
  await db.query(`CREATE TABLE IF NOT EXISTS loot_tables (
    id SERIAL PRIMARY KEY, monster_type TEXT NOT NULL, min_level INTEGER NOT NULL DEFAULT 1, max_level INTEGER NOT NULL DEFAULT 999
  );`);
  await db.query(`CREATE TABLE IF NOT EXISTS loot_table_entries (
    id SERIAL PRIMARY KEY, loot_table_id INTEGER NOT NULL REFERENCES loot_tables(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES item_templates(id) ON DELETE CASCADE,
    rarity_id INTEGER NOT NULL REFERENCES item_rarities(id),
    weight INTEGER NOT NULL DEFAULT 1
  );`);
  await db.query(`CREATE OR REPLACE VIEW v_item_full AS
    SELECT i.id AS instance_id, t.id AS template_id, t.name, t.slot, t.level_req,
           r.code AS rarity, r.name AS rarity_name, r.color AS rarity_color,
           t.world_unique, i.is_world_unique, i.rolled_stats, t.base_stats
    FROM item_instances i
    JOIN item_templates t ON i.template_id = t.id
    JOIN item_rarities r ON i.rarity_id = r.id;`);
}

async function seedBasic(db) {
  const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM item_rarities`);
  if (rows[0].n > 0) return;
  await db.query(`INSERT INTO item_rarities (code,name,weight,stat_multiplier,color) VALUES
   ('common','Commun',600,1.00,'#B0B0B0'),
   ('uncommon','Peu commun',280,1.10,'#3FBF3F'),
   ('rare','Rare',100,1.25,'#3F7FBF'),
   ('epic','Épique',18,1.45,'#7F3FBF'),
   ('legendary','Légendaire',5,1.70,'#BF8F3F'),
   ('mythic','Mythique',1,1.95,'#E03FBF') ON CONFLICT DO NOTHING;`);
  await db.query(`INSERT INTO item_templates (name,slot,level_req,base_stats,world_unique) VALUES
   ('Épée simple','weapon',1,'{"attack":6}',FALSE),
   ('Arc court','weapon',1,'{"attack":5,"pm":1}',FALSE),
   ('Bâton de novice','weapon',1,'{"attack":4,"pa":1}',FALSE),
   ('Heaume en cuir','helmet',1,'{"hp":12}',FALSE),
   ('Plastron usé','chest',1,'{"hp":18}',FALSE),
   ('Bottes légères','boots',1,'{"pm":1}',FALSE),
   ('Anneau terne','ring',1,'{"hp":6,"attack":1}',FALSE),
   ('Amulette fendue','amulet',1,'{"pa":1}',FALSE),
   ('L’Étoile Déchue','weapon',10,'{"attack":25,"hp":30,"pa":1}',TRUE)
   ON CONFLICT DO NOTHING;`);
}

async function rollDrop(db, monsterType, monsterLevel) {
  const lt = await db.query(
    `SELECT lt.id FROM loot_tables lt
     WHERE lt.monster_type = $1 AND $2 BETWEEN lt.min_level AND lt.max_level`,
    [monsterType, monsterLevel]
  );
  if (lt.rows.length === 0) return null;
  const lootTableId = lt.rows[0].id;

  const rows = await db.query(
    `SELECT lte.template_id, lte.rarity_id, lte.weight,
            it.world_unique, it.base_stats, ir.stat_multiplier, it.slot
     FROM loot_table_entries lte
     JOIN item_templates it ON it.id = lte.template_id
     JOIN item_rarities ir ON ir.id = lte.rarity_id
     WHERE lte.loot_table_id = $1`,
    [lootTableId]
  );
  if (rows.rows.length === 0) return null;

  const pick = weightedPick(rows.rows.map(r => ({
    template_id: r.template_id, rarity_id: r.rarity_id, weight: r.weight,
    world_unique: r.world_unique, base_stats: r.base_stats, stat_multiplier: Number(r.stat_multiplier)
  })));
  if (!pick) return null;

  if (pick.world_unique) {
    const exists = await db.query(`SELECT 1 FROM item_instances WHERE template_id=$1 AND is_world_unique=TRUE LIMIT 1`, [pick.template_id]);
    if (exists.rows.length > 0) return null;
  }
  const rolled = scaleStats(pick.base_stats || {}, pick.stat_multiplier || 1.0);
  return { template_id: pick.template_id, rarity_id: pick.rarity_id, rolled_stats: rolled, is_world_unique: !!pick.world_unique };
}

async function grantItem(db, userId, drop) {
  const ins = await db.query(
    `INSERT INTO item_instances (template_id, owner_user_id, rarity_id, rolled_stats, is_world_unique)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [drop.template_id, userId, drop.rarity_id, drop.rolled_stats, drop.is_world_unique]
  );
  return ins.rows[0].id;
}

async function fetchInventory(db, userId) {
  const inv = await db.query(
    `SELECT v.* FROM v_item_full v
     JOIN item_instances i ON i.id = v.instance_id
     WHERE i.owner_user_id = $1 ORDER BY v.slot, v.rarity DESC`,
    [userId]
  );
  const eq = await db.query(`SELECT * FROM player_equipment WHERE user_id = $1`, [userId]);
  return { items: inv.rows, equipment: eq.rows[0] || null };
}

function applyEquipmentStatsToPlayer(player, equipmentItems) {
  let sum = {};
  for (const it of equipmentItems) {
    sum = mergeStats(sum, it.base_stats || {});
    sum = mergeStats(sum, it.rolled_stats || {});
  }
  const baseMaxHp = player.getMaxHp ? player.getMaxHp() : player.maxHp || 100;
  player.maxHp = baseMaxHp + (sum.hp || 0);
  if (player.hp > player.maxHp) player.hp = player.maxHp;
  player.pa = 6 + (sum.pa || 0);
  player.pm = 3 + (sum.pm || 0);
  player.attackBonus = (sum.attack || 0);
}

async function equipItem(db, gameWorld, userId, instanceId) {
  const { rows } = await db.query(`SELECT v.*, it.slot
                                   FROM v_item_full v
                                   JOIN item_templates it ON it.id = v.template_id
                                   WHERE v.instance_id = $1 AND EXISTS (
                                     SELECT 1 FROM item_instances i WHERE i.id = v.instance_id AND i.owner_user_id = $2
                                   )`, [instanceId, userId]);
  if (rows.length === 0) throw new Error('Item introuvable');
  const item = rows[0];
  const slot = item.slot;

  await db.query(`INSERT INTO player_equipment (user_id, ${slot})
                  VALUES ($1, $2)
                  ON CONFLICT (user_id) DO UPDATE SET ${slot} = EXCLUDED.${slot}, updated_at = NOW()`, [userId, instanceId]);
  await db.query(`UPDATE item_instances SET equipped_slot = $1 WHERE id = $2`, [slot, instanceId]);

  const player = gameWorld.players.get(userId);
  if (player) {
    const full = await fetchInventory(db, userId);
    const equippedIds = Object.values(full.equipment || {}).filter(v => typeof v === 'string');
    const equippedItems = full.items.filter(it => equippedIds.includes(it.instance_id));
    applyEquipmentStatsToPlayer(player, equippedItems);
  }
  return true;
}

async function unequipItem(db, gameWorld, userId, slot) {
  const current = await db.query(`SELECT ${slot} FROM player_equipment WHERE user_id = $1`, [userId]);
  if (current.rows.length === 0 || !current.rows[0][slot]) return true;
  const instId = current.rows[0][slot];
  await db.query(`UPDATE player_equipment SET ${slot} = NULL, updated_at = NOW() WHERE user_id = $1`, [userId]);
  await db.query(`UPDATE item_instances SET equipped_slot = NULL WHERE id = $1`, [instId]);

  const player = gameWorld.players.get(userId);
  if (player) {
    const full = await fetchInventory(db, userId);
    const equippedIds = Object.values(full.equipment || {}).filter(v => typeof v === 'string');
    const equippedItems = full.items.filter(it => equippedIds.includes(it.instance_id));
    applyEquipmentStatsToPlayer(player, equippedItems);
  }
  return true;
}

function getSocketUser(socket) {
  return socket.user || (socket.userId ? { userId: socket.userId, username: socket.username } : null);
}

function registerSockets(io, db, gameWorld) {
  io.on('connection', (socket) => {
    socket.on('inventory:get', async () => {
      try {
        const user = getSocketUser(socket);
        if (!user) return;
        const full = await fetchInventory(db, user.userId);
        socket.emit('inventory:data', full);
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('item:equip', async ({ instanceId }) => {
      try {
        const user = getSocketUser(socket);
        if (!user) return;
        await equipItem(db, gameWorld, user.userId, instanceId);
        const full = await fetchInventory(db, user.userId);
        socket.emit('inventory:data', full);
      } catch (e) {
        socket.emit('error', { message: e.message || 'Erreur equip' });
      }
    });

    socket.on('item:unequip', async ({ slot }) => {
      try {
        const user = getSocketUser(socket);
        if (!user) return;
        await unequipItem(db, gameWorld, user.userId, slot);
        const full = await fetchInventory(db, user.userId);
        socket.emit('inventory:data', full);
      } catch (e) {
        socket.emit('error', { message: e.message || 'Erreur unequip' });
      }
    });
  });
}

async function awardDrops(db, gameWorld, killerUserId, monsterType, monsterLevel) {
  const drop = await rollDrop(db, monsterType, monsterLevel);
  if (!drop) return null;
  const instId = await grantItem(db, killerUserId, drop);
  return { instanceId: instId, drop };
}

async function install({ app, io, db, gameWorld }) {
  await ensureSchema(db);
  await seedBasic(db);
  registerSockets(io, db, gameWorld);
  return {
    fetchInventory: (userId) => fetchInventory(db, userId),
    equipItem: (userId, instanceId) => equipItem(db, gameWorld, userId, instanceId),
    unequipItem: (userId, slot) => unequipItem(db, gameWorld, userId, slot),
    awardDrops: (killerUserId, monsterType, monsterLevel) => awardDrops(db, gameWorld, killerUserId, monsterType, monsterLevel),
  };
}

module.exports = { install };
