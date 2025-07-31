// ========================
// BACKEND - server.js
// ========================
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();


// ====== Perlin noise (simple) ======
class Perlin {
    constructor(seed = 1337) {
        this.p = new Uint8Array(512);
        let perm = new Uint8Array(256);
        for (let i = 0; i < 256; i++) perm[i] = i;
        let s = seed >>> 0;
        for (let i = 255; i > 0; i--) {
            s = (s * 1664525 + 1013904223) >>> 0;
            const r = s % (i + 1);
            const tmp = perm[i]; perm[i] = perm[r]; perm[r] = tmp;
        }
        for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
    }
    fade(t){ return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t){ return a + t * (b - a); }
    grad(h, x, y){
        switch(h & 3){
            case 0: return  x + y;
            case 1: return -x + y;
            case 2: return  x - y;
            default:return -x - y;
        }
    }
    noise(x, y){
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = this.fade(x);
        const v = this.fade(y);
        const A  = this.p[X] + Y;
        const B  = this.p[X + 1] + Y;
        const p = this.p;
        const n00 = this.grad(p[A], x, y);
        const n01 = this.grad(p[A + 1], x, y - 1);
        const n10 = this.grad(p[B], x - 1, y);
        const n11 = this.grad(p[B + 1], x - 1, y - 1);
        const nx0 = this.lerp(n00, n10, u);
        const nx1 = this.lerp(n01, n11, u);
        return this.lerp(nx0, nx1, v); // approx in [-1,1]
    }
}
// ====== end Perlin ======



// === Combat/Skills config ===
const SKILLS = {
    iop: [
        { id: 'pression', name: 'Pression', pa: 2, power: [8, 12], level: 1 },
        { id: 'bond', name: 'Bond', pa: 3, power: [14, 20], level: 1 },
        { id: 'intimidation', name: 'Intimidation', pa: 2, power: [10, 14], level: 3 },
        { id: 'compulsion', name: 'Compulsion', pa: 4, power: [22, 30], level: 5 },
        { id: 'epee_divine', name: 'Épée Divine', pa: 5, power: [35, 45], level: 8 },
        { id: 'colere', name: 'Colère de Iop', pa: 6, power: [45, 60], level: 10 },
        { id: 'vitalite', name: 'Vitalité', pa: 2, power: [12, 18], level: 12 },
        { id: 'puissance', name: 'Puissance', pa: 5, power: [40, 55], level: 15 }
    ],
    cra: [
        { id: 'fleche_magique', name: 'Flèche Magique', pa: 2, power: [7, 11], level: 1 },
        { id: 'tir_a_reculons', name: 'Tir à Reculons', pa: 3, power: [12, 18], level: 1 },
        { id: 'fleche_glacee', name: 'Flèche Glacée', pa: 3, power: [15, 21], level: 3 },
        { id: 'tir_puissant', name: 'Tir Puissant', pa: 4, power: [20, 28], level: 5 },
        { id: 'fleche_harcelante', name: 'Flèche Harcelante', pa: 4, power: [24, 32], level: 8 },
        { id: 'fleche_punitive', name: 'Flèche Punitive', pa: 5, power: [32, 42], level: 10 },
        { id: 'oeil_de_taupe', name: 'Œil de Taupe', pa: 3, power: [18, 24], level: 12 },
        { id: 'fleche_destructrice', name: 'Flèche Destructrice', pa: 6, power: [45, 60], level: 15 }
    ],
    eni: [
        { id: 'mot_soignant', name: 'Mot Soignant', pa: 2, power: [-15, -20], level: 1 },
        { id: 'mot_interdit', name: 'Mot Interdit', pa: 3, power: [10, 16], level: 1 },
        { id: 'mot_stimulant', name: 'Mot Stimulant', pa: 2, power: [-18, -24], level: 3 },
        { id: 'mot_drainant', name: 'Mot Drainant', pa: 4, power: [18, 26], level: 5 },
        { id: 'mot_revitalisant', name: 'Mot Revitalisant', pa: 3, power: [-25, -35], level: 8 },
        { id: 'mot_de_reconstitution', name: 'Reconstitution', pa: 4, power: [-35, -45], level: 10 },
        { id: 'mot_vampirique', name: 'Mot Vampirique', pa: 5, power: [22, 30], level: 12 },
        { id: 'mot_de_regeneration', name: 'Régénération', pa: 5, power: [-40, -55], level: 15 }
    ],
    sadi: [
        { id: 'ronce', name: 'Ronce', pa: 2, power: [8, 12], level: 1 },
        { id: 'poison_paralysant', name: 'Poison Paralysant', pa: 3, power: [12, 18], level: 1 },
        { id: 'larme', name: 'La Larme', pa: 3, power: [14, 20], level: 3 },
        { id: 'sacrifice_poupesque', name: 'Sacrifice Poupesque', pa: 4, power: [20, 28], level: 5 },
        { id: 'ronce_aggressive', name: 'Ronce Agressive', pa: 4, power: [24, 32], level: 8 },
        { id: 'puissance_sylvestre', name: 'Puissance Sylvestre', pa: 5, power: [32, 42], level: 10 },
        { id: 'ronce_multiple', name: 'Ronce Multiple', pa: 5, power: [28, 38], level: 12 },
        { id: 'folie_vegetale', name: 'Folie Végétale', pa: 6, power: [45, 60], level: 15 }
    ]
};

const MONSTER_SKILLS = [
    { id: 'morsure', name: 'Morsure', power: [8, 14] },
    { id: 'charge', name: 'Charge', power: [10, 18] }
];
const RARITY_COLORS = {
    common: '#B0B0B0',
    uncommon: '#1EFF00',
    rare: '#0080FF',
    epic: '#A335EE',
    legendary: '#FF8000',
    unique: '#FF0000'
};

const RARITY_MULTIPLIERS = {
    common: 1,
    uncommon: 1.2,
    rare: 1.5,
    epic: 2,
    legendary: 3,
    unique: 5
};
function rand(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }

function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }


const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Configuration base de données
const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dofus_mmo_local',
    user: process.env.DB_USER || 'dofus_user',
    password: process.env.DB_PASSWORD || 'password123',
    port: process.env.DB_PORT || 5432,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this_in_production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========================
// CLASSES & GAME LOGIC
// ========================

class GameWorld {
    constructor() {
        this.width = 1000;
        this.height = 1000;
        this.players = new Map();
        this.monsters = new Map();
        this.npcs = new Map();
        this.items = new Map();
        this.terrain = this.generateTerrain();
        this.initMonsters();
        this.startGameLoop();
    }

    
    generateTerrain() {
        const terrain = Array(this.height).fill().map(() => Array(this.width).fill(0));
        const perlin = new Perlin(2025);
        
        const scale = 48;           // taille des îlots
        const octaves = 4;
        const persistence = 0.5;
        const lacunarity = 2.0;

        const sample = (x, y) => {
            let amp = 1, freq = 1, val = 0, norm = 0;
            for (let o = 0; o < octaves; o++) {
                val += amp * perlin.noise((x / scale) * freq, (y / scale) * freq);
                norm += amp;
                amp *= persistence;
                freq *= lacunarity;
            }
            return val / norm; // ~ [-1,1]
        };

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const n = sample(x, y);

                // biomes par seuils
                let t = 0; // plaine par défaut
                if (n < -0.25) t = 1;       // eau
                else if (n < 0.05) t = 0;   // plaine
                else if (n < 0.25) t = 2;   // forêt
                else if (n < 0.48) t = 6;   // désert
                else t = 3;                 // montagne

                terrain[y][x] = t;
            }
        }

        // épars villages/donjons sur tuiles walkables
        for (let i = 0; i < Math.floor((this.width * this.height) / 8000); i++) {
            const rx = Math.floor(Math.random() * this.width);
            const ry = Math.floor(Math.random() * this.height);
            if (terrain[ry][rx] !== 1 && terrain[ry][rx] !== 3) terrain[ry][rx] = 4; // village
        }
        for (let i = 0; i < Math.floor((this.width * this.height) / 12000); i++) {
            const rx = Math.floor(Math.random() * this.width);
            const ry = Math.floor(Math.random() * this.height);
            if (terrain[ry][rx] !== 1 && terrain[ry][rx] !== 3) terrain[ry][rx] = 5; // donjon
        }

        return terrain;
    }
    

    simpleNoise(x, y) {
        // Implémentation simple du bruit
        return Math.sin(x * 0.3) * Math.cos(y * 0.3) + 
               Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5;
    }
    findSafeSpawn() {
        let x, y;
        do {
            x = Math.floor(Math.random() * this.width);
            y = Math.floor(Math.random() * this.height);
        } while (!this.isWalkable(x, y));
        return { x, y };
    }
    initMonsters() {
        for (let i = 0; i < 2000; i++) {
            const { x, y } = this.findSafeSpawn();
            const monster = new Monster(`monster_${i}`, x, y, Math.floor(Math.random() * 10) + 1);
            this.monsters.set(monster.id, monster);
        }

    }

    startGameLoop() {
        setInterval(() => {
            this.updateMonsters();
            this.regeneratePlayers();
            this.broadcastWorldState();
        }, 1000); // 1 update par seconde
    }

    updateMonsters() {
        this.monsters.forEach(monster => {
            if (Math.random() < 0.1 && !monster.inCombat) { // 10% chance de bouger
                const directions = [[-1,0], [1,0], [0,-1], [0,1]];
                const [dx, dy] = directions[Math.floor(Math.random() * 4)];
                const newX = Math.max(0, Math.min(this.width-1, monster.x + dx));
                const newY = Math.max(0, Math.min(this.height-1, monster.y + dy));
                
                const playerOnTile = Array.from(this.players.values()).some(p => p.x === newX && p.y === newY);
                if (this.isWalkable(newX, newY) && !playerOnTile) {
                    monster.x = newX;
                    monster.y = newY;
                }
            }
        });
    }

    regeneratePlayers() {
        this.players.forEach(player => {
            // Régénération PM
            // if (player.pm < 3) {
            //     player.pm = 3;
            // }
            // Régénération PA
            if (!player.inCombat && player.pa < 6) {
                player.pa = 6;
            }
        });
    }

    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        const terrainType = this.terrain[y][x];
        return terrainType !== 1 && terrainType !== 3; // Pas eau ni montagne
    }


    getChunk(centerX, centerY, w = 64, h = 64) {
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        const x0 = Math.max(0, Math.min(this.width - w, centerX - halfW));
        const y0 = Math.max(0, Math.min(this.height - h, centerY - halfH));
        const tiles = [];
        for (let y = 0; y < h; y++) {
            const row = new Array(w);
            for (let x = 0; x < w; x++) {
                row[x] = this.terrain[y0 + y][x0 + x];
            }
            tiles.push(row);
        }
        return { x0, y0, width: w, height: h, tiles };
    }

    broadcastWorldState() {
        
        const allPlayers = Array.from(this.players.values());
        const allMonsters = Array.from(this.monsters.values());
        const now = Date.now();
        const VIEW = parseInt(process.env.VIEW_RADIUS || '25', 10); // rayon de vision en cases
        
        for (const p of allPlayers) {
            const sock = io.sockets.sockets.get(p.socketId);
            if (!sock) continue;
            
            const localPlayers = allPlayers
                .filter(o => Math.abs(o.x - p.x) <= VIEW && Math.abs(o.y - p.y) <= VIEW)
                .map(o => o.getPublicData());
            
            const localMonsters = allMonsters
                .filter(m => Math.abs(m.x - p.x) <= VIEW && Math.abs(m.y - p.y) <= VIEW)
                .slice(0, 300) // cap de sécurité
                .map(m => m.getPublicData());
            
            sock.emit('worldUpdate', {
                players: localPlayers,
                monsters: localMonsters,
                timestamp: now
            });
        }
    }
}

class Player {
    constructor(userId, username, classe, x = 50, y = 50) {
        this.userId = userId;
        this.username = username;
        this.classe = classe;
        this.x = x;
        this.y = y;
        this.level = 1;
        this.xp = 0;
        this.maxHp = this.getMaxHp();
        this.hp = this.maxHp;
        this.pa = 6;
        this.pm = 3;
        this.kamas = 1000;
        this.skills = (SKILLS[this.classe] || [{ id:'basic', name:'Attaque', pa:2, power:[8,12] }]);
        this.currentTarget = null;
        this.isDead = false;
        this.inventory = new Map();
        this.equipment = {};
        this.inCombat = false;
        this.lastAction = Date.now();
        this.socketId = null;
        this.equippedSkills = [];
    }

    getMaxHp() {
        const baseHp = {
            iop: 150, cra: 120, eni: 100, sadi: 130
        };
        return (baseHp[this.classe] || 100) + (this.level - 1) * 20;
    }
    getEquippedSkills() {
        const allSkills = SKILLS[this.classe] || [];
        if (!this.equippedSkills || this.equippedSkills.length === 0) {
            return allSkills.slice(0, 2); // Par défaut, les 2 premiers
        }
        return allSkills.filter(s => this.equippedSkills.includes(s.id));
    }
    getPublicData() {
        return {
            userId: this.userId,
            username: this.username,
            classe: this.classe,
            x: this.x, y: this.y,
            level: this.level,
            hp: this.hp,
            maxHp: this.maxHp,
            pa: this.pa,
            pm: this.pm,
            inCombat: this.inCombat,
            isDead: this.isDead
        };
    }

    move(dx, dy) {
        if (this.inCombat || this.isDead) return false;
        
        const newX = this.x + dx;
        const newY = this.y + dy;
        
        if (gameWorld.isWalkable(newX, newY)) {
            this.x = newX;
            this.y = newY;
            // this.pm--;
            this.checkForEncounters();
            return true;
        }
        return false;
    }

    checkForEncounters() {
        // Vérifier les monstres à proximité
        gameWorld.monsters.forEach(monster => {
            if (monster.x === this.x && monster.y === this.y && !monster.inCombat) {
                this.startCombat(monster);
            }
        });
    }

    
    startCombat(monster) {
        this.inCombat = true;
        monster.inCombat = true;
        this.pa = 6;
        this.currentTarget = monster.id;
        const sock = io.sockets.sockets.get(this.socketId);
        if (sock) {
            sock.emit('combatStarted', {
                player: { userId: this.userId, username: this.username, level: this.level, hp: this.hp, maxHp: this.maxHp, pa: this.pa, classe: this.classe },
                monster: monster.getPublicData(),
                skills: this.getEquippedSkills(),
                turn: 'player'
            });
        }
    }
    
}

class Monster {
    constructor(id, x, y, level) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.level = level;
        this.maxHp = level * 50;
        this.hp = this.maxHp;
        this.type = this.getRandomType();
        this.inCombat = false;
        this.lastMove = Date.now();
    }

    getRandomType() {
        const types = ['bouftou', 'larve', 'arakne', 'crabe', 'sanglier'];
        return types[Math.floor(Math.random() * types.length)];
    }

    getPublicData() {
        return {
            id: this.id,
            x: this.x, y: this.y,
            level: this.level,
            type: this.type,
            hp: this.hp,
            maxHp: this.maxHp,
            inCombat: this.inCombat,
            isDead: this.isDead
        };
    }
}
class LootSystem {
    constructor() {
        this.itemsCache = new Map();
        this.dropsCache = new Map();
        this.uniqueItemsDropped = new Set(); // Track des uniques déjà droppés
        this.loadItemsData();
    }

    async loadItemsData() {
        try {
            // Charger tous les items
            const itemsResult = await db.query('SELECT * FROM items');
            itemsResult.rows.forEach(item => {
                this.itemsCache.set(item.id, item);
            });

            // Charger toutes les tables de drops
            const dropsResult = await db.query('SELECT * FROM monster_drops');
            dropsResult.rows.forEach(drop => {
                const key = drop.monster_type;
                if (!this.dropsCache.has(key)) {
                    this.dropsCache.set(key, []);
                }
                this.dropsCache.get(key).push(drop);
            });

            // Charger les items uniques déjà droppés
            const uniqueResult = await db.query(`
                SELECT DISTINCT item_id 
                FROM player_inventory pi
                JOIN items i ON pi.item_id = i.id
                WHERE i.is_unique = true
            `);
            uniqueResult.rows.forEach(row => {
                this.uniqueItemsDropped.add(row.item_id);
            });

            console.log(`✅ Système de loot initialisé: ${this.itemsCache.size} items, ${this.dropsCache.size} tables de drops`);
        } catch (error) {
            console.error('❌ Erreur chargement données de loot:', error);
        }
    }

    async generateLoot(monsterType, monsterLevel) {
        const drops = this.dropsCache.get(monsterType) || [];
        const loot = [];

        for (const drop of drops) {
            // Vérifier le niveau du monstre
            if (monsterLevel < drop.monster_level_min || monsterLevel > drop.monster_level_max) {
                continue;
            }

            // Vérifier si l'item est unique et déjà droppé
            const item = this.itemsCache.get(drop.item_id);
            if (item && item.is_unique && this.uniqueItemsDropped.has(drop.item_id)) {
                continue;
            }

            // Roll pour le drop
            const roll = Math.random() * 100;
            if (roll <= drop.drop_chance) {
                loot.push({
                    ...item,
                    quantity: 1
                });

                // Si c'est un unique, le marquer comme droppé
                if (item.is_unique) {
                    this.uniqueItemsDropped.add(drop.item_id);
                }
            }
        }

        // Bonus de drop basé sur le niveau
        if (monsterLevel >= 10 && Math.random() < 0.1) {
            // 10% de chance de drop bonus pour monstres niveau 10+
            const bonusGold = monsterLevel * rand(5, 15);
            loot.push({ type: 'gold', amount: bonusGold });
        }

        return loot;
    }

    getItemById(itemId) {
        return this.itemsCache.get(itemId);
    }
}
// ========================
// ROUTES API
// ========================

// Vérification du token
app.get('/api/verify-token', authenticateToken, async (req, res) => {
    try {
        const hasCharacter = await checkIfHasCharacter(req.user.userId);
        res.json({ 
            valid: true, 
            user: { userId: req.user.userId, username: req.user.username },
            hasCharacter 
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Inscription
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email, discordId } = req.body;
        
        // Validation des entrées
        if (!username || !password || !email) {
            return res.status(400).json({ error: 'Tous les champs sont requis' });
        }

        // Vérifier si l'utilisateur existe
        const existing = await db.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
        
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Utilisateur déjà existant' });
        }

        // Hash du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Créer l'utilisateur
        const result = await db.query(
            'INSERT INTO users (username, password, email, discord_id, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
            [username, hashedPassword, email, discordId || null]
        );

        const token = jwt.sign(
            { userId: result.rows[0].id, username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, userId: result.rows[0].id, username });
    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Connexion
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const result = await db.query(
            'SELECT id, username, password FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Mot de passe incorrect' });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, userId: user.id, username: user.username });
    } catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Créer personnage
app.post('/api/character/create', authenticateToken, async (req, res) => {
    try {
        const { name, classe } = req.body;
        const userId = req.user.userId;

        // Validation
        if (!name || !classe) {
            return res.status(400).json({ error: 'Nom et classe requis' });
        }

        const validClasses = ['iop', 'cra', 'eni', 'sadi'];
        if (!validClasses.includes(classe)) {
            return res.status(400).json({ error: 'Classe invalide' });
        }

        // Vérifier si l'utilisateur a déjà un personnage
        const existing = await db.query(
            'SELECT id FROM characters WHERE user_id = $1',
            [userId]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Personnage déjà existant' });
        }

        const player = new PlayerExtended(userId, name, classe);

        // Créer le personnage
        const result = await db.query(
            'INSERT INTO characters (user_id, name, classe, x, y, level, xp, hp, pa, pm, kamas, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING id',
            [userId, name, classe, player.x, player.y, player.level, player.xp, player.hp, player.pa, player.pm, player.kamas]
        );

        res.json({ characterId: result.rows[0].id, success: true });
    } catch (error) {
        console.error('Erreur création personnage:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
const SLOT_ALIASES = {
  weapon: 'weapon',  arme: 'weapon',
  helmet: 'helmet',  casque: 'helmet',
  chest:  'chest',   plastron: 'chest',
  boots:  'boots',   bottes: 'boots',
  ring:   'ring',    anneau: 'ring',
  amulet: 'amulet',  amulette: 'amulet'
};

function normSlot(s) {
  const k = String(s || '').toLowerCase();
  return SLOT_ALIASES[k] || k;
}
class PlayerExtended extends Player {
    constructor(...args) {
        super(...args);
        this.equipment = {
            weapon: null,
            helmet: null,
            chest: null,
            boots: null,
            ring: null,
            amulet: null
        };
        this.stats = {
            damageMin: 0,
            damageMax: 0,
            defense: 0,
            critChance: 0,
            dodgeChance: 0,
            lifeSteal: 0
        };
        this.inventory = [];
    }

    async loadInventory() {
        try {
            const result = await db.query(`
                SELECT pi.*, i.* 
                FROM player_inventory pi
                JOIN items i ON pi.item_id = i.id
                WHERE pi.character_id = (SELECT id FROM characters WHERE user_id = $1)
                ORDER BY pi.is_equipped DESC, i.rarity DESC
            `, [this.userId]);

            this.inventory = [];
            // Reset equipment to avoid stale items after (un)equip changes
            this.equipment = { weapon: null, helmet: null, chest: null, boots: null, ring: null, amulet: null };
            result.rows.forEach(row => {
                if (row.is_equipped && row.slot) {
                    this.equipment[row.slot] = row;
                } else {
                    this.inventory.push(row);
                }
            });

            this.calculateStats();
        } catch (error) {
            console.error('Erreur chargement inventaire:', error);
        }
    }

    calculateStats() {
        // Reset stats
        this.stats = {
            damageMin: 0,
            damageMax: 0,
            defense: 0,
            critChance: 0,
            dodgeChance: 0,
            lifeSteal: 0
        };

        // Stats de base selon la classe
        const baseStats = {
            iop: { damageMin: 5, damageMax: 10, defense: 5 },
            cra: { damageMin: 7, damageMax: 12, defense: 3 },
            eni: { damageMin: 3, damageMax: 8, defense: 4 },
            sadi: { damageMin: 4, damageMax: 9, defense: 4 }
        };

        const base = baseStats[this.classe] || baseStats.iop;
        this.stats.damageMin = base.damageMin + this.level * 2;
        this.stats.damageMax = base.damageMax + this.level * 3;
        this.stats.defense = base.defense + this.level;

        // Ajouter les stats de l'équipement
        let totalPaBonus = 0;
        let totalPmBonus = 0;
        let totalHpBonus = 0;

        Object.values(this.equipment).forEach(item => {
            if (item) {
                this.stats.damageMin += item.damage_min || 0;
                this.stats.damageMax += item.damage_max || 0;
                this.stats.defense += item.defense || 0;
                this.stats.critChance += item.crit_chance || 0;
                this.stats.dodgeChance += item.dodge_chance || 0;
                this.stats.lifeSteal += item.life_steal || 0;
                totalPaBonus += item.pa_bonus || 0;
                totalPmBonus += item.pm_bonus || 0;
                totalHpBonus += item.hp_bonus || 0;
            }
        });

        // Appliquer les bonus
        this.pa = 6 + totalPaBonus;
        this.pm = 3 + totalPmBonus;
        this.maxHp = this.getMaxHp() + totalHpBonus;
        this.hp = Math.min(this.hp, this.maxHp);
    }

    async equipItem(itemId, slot) {
    try {
        slot = normSlot(slot);
        const invRow = this.inventory.find(i => i.item_id === itemId);
        if (!invRow || normSlot(invRow.type) !== slot) return false;

        const characterId = await this.getCharacterId();

        // S'il y a déjà quelque chose au slot -> on l'enlève proprement
        if (this.equipment[slot]) {
        await this.unequipItem(slot);
        }

        // 1) Décrémenter (ou enlever) la pile non équipée
        const q = invRow.quantity || 1;
        if (q > 1) {
        await db.query(`
            UPDATE player_inventory
            SET quantity = quantity - 1
            WHERE character_id = $1 AND item_id = $2 AND is_equipped = false
        `, [characterId, itemId]);
        } else {
        await db.query(`
            DELETE FROM player_inventory
            WHERE character_id = $1 AND item_id = $2 AND is_equipped = false
        `, [characterId, itemId]);
        }

        // 2) Upsert la pile équipée à 1
        await db.query(`
        INSERT INTO player_inventory (character_id, item_id, quantity, is_equipped, slot)
        VALUES ($1, $2, 1, true, $3)
        ON CONFLICT (character_id, item_id, is_equipped)
        DO UPDATE SET quantity = 1, slot = EXCLUDED.slot
        `, [characterId, itemId, slot]);

        await this.loadInventory();
        return true;
    } catch (e) {
        console.error('Erreur équipement:', e);
        return false;
    }
    }


    async unequipItem(slot) {
    try {
        slot = normSlot(slot);
        if (!this.equipment[slot]) return false;

        const characterId = await this.getCharacterId();
        const itemId = this.equipment[slot].item_id;

        // 1) Supprimer la ligne équipée
        await db.query(`
        DELETE FROM player_inventory
        WHERE character_id = $1 AND item_id = $2 AND is_equipped = true
        `, [characterId, itemId]);

        // 2) Ajouter/incrémenter la pile non équipée
        await db.query(`
        INSERT INTO player_inventory (character_id, item_id, quantity, is_equipped, slot)
        VALUES ($1, $2, 1, false, NULL)
        ON CONFLICT (character_id, item_id, is_equipped)
        DO UPDATE SET quantity = player_inventory.quantity + 1
        `, [characterId, itemId]);

        await this.loadInventory();
        return true;
    } catch (e) {
        console.error('Erreur déséquipement:', e);
        return false;
    }
    }

    async addItemToInventory(itemId, quantity = 1) {
        try {
            const characterId = await this.getCharacterId();
            
            // Vérifier si l'item existe déjà
            const existing = await db.query(`
                SELECT * FROM player_inventory 
                WHERE character_id = $1 AND item_id = $2 AND is_equipped = false
            `, [characterId, itemId]);

            if (existing.rows.length > 0) {
                // Augmenter la quantité
                await db.query(`
                    UPDATE player_inventory 
                    SET quantity = quantity + $1 
                    WHERE id = $2
                `, [quantity, existing.rows[0].id]);
            } else {
                // Ajouter nouvel item
                await db.query(`
                    INSERT INTO player_inventory (character_id, item_id, quantity) 
                    VALUES ($1, $2, $3)
                `, [characterId, itemId, quantity]);
            }

            await this.loadInventory();
            return true;
        } catch (error) {
            console.error('Erreur ajout inventaire:', error);
            return false;
        }
    }

    async getCharacterId() {
        const result = await db.query('SELECT id FROM characters WHERE user_id = $1', [this.userId]);
        return result.rows[0]?.id;
    }

    getPublicData() {
        const base = super.getPublicData();
        return {
            ...base,
            stats: this.stats,
            equipment: Object.keys(this.equipment).reduce((acc, slot) => {
                acc[slot] = this.equipment[slot] ? {
                    name: this.equipment[slot].name,
                    rarity: this.equipment[slot].rarity
                } : null;
                return acc;
            }, {})
        };
    }
}

const lootSystem = new LootSystem();
// Middleware d'authentification
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// ========================
// WEBSOCKET HANDLERS
// ========================

io.on('connection', (socket) => {
    console.log('Nouveau joueur connecté:', socket.id);

    // Authentification du socket
    socket.on('authenticate', async (token) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.userId = decoded.userId;
            socket.username = decoded.username;

            // Charger le personnage
            const character = await loadCharacter(decoded.userId);
            
            if (character) {
                const player = new PlayerExtended(
                    character.user_id,
                    character.name,
                    character.classe,
                    character.x,
                    character.y
                );
                await player.loadInventory();
                player.level = character.level;
                player.xp = character.xp;
                player.hp = character.hp;
                player.kamas = character.kamas;
                player.socketId = socket.id; // refresh socketId
                // Envoie la liste des joueurs en ligne au client (diagnostic & init)
                socket.emit('onlineList', { players: Array.from(gameWorld.players.values()).map(p => p.getPublicData()) });
                player.hp = Math.min(character.hp, player.maxHp);
                gameWorld.players.set(socket.userId, player);
                
                socket.emit('authSuccess', {
                    player: player.getPublicData(),
                    worldData: {
                        width: gameWorld.width,
                        height: gameWorld.height,
                        chunk: gameWorld.getChunk(player.x, player.y, 64, 64)
                    }
                });

                // Notifier les autres joueurs
                socket.broadcast.emit('playerJoined', player.getPublicData());
            }
        } catch (error) {
            console.error('Erreur auth socket:', error);
            socket.emit('authError', 'Token invalide');
        }
    });

    // Mouvement du joueur
    socket.on('move', (direction) => {
        const player = gameWorld.players.get(socket.userId);
        if (!player) return;

        const directions = {
            'up': [0, -1],
            'down': [0, 1],
            'left': [-1, 0],
            'right': [1, 0]
        };

        const [dx, dy] = directions[direction] || [0, 0];
        const moved = player.move(dx, dy);
        
        if (moved) {
            socket.emit('moveSuccess', { 
                x: player.x, 
                y: player.y, 
                pm: player.pm 
            });
            // Sauvegarder position
            saveCharacterPosition(player);
        }
    });

    // Action d'attaque
    socket.on('attack', (targetId) => {
        const player = gameWorld.players.get(socket.userId);
        if (!player || player.pa < 3 || !player.inCombat) return;

        const target = gameWorld.monsters.get(targetId);
        if (!target || !target.inCombat) return;

        const inRange = Math.abs(target.x - player.x) <= 1 && Math.abs(target.y - player.y) <= 1;
        if (!inRange) return;

        const damage = Math.floor(Math.random() * 30) + 10 + player.level * 2;
        target.hp -= damage;
        player.pa -= 3;

        socket.emit('attackResult', {
            damage,
            targetHp: target.hp,
            pa: player.pa
        });

        if (target.hp <= 0) {
            gameWorld.monsters.delete(targetId);

            const xpGain = target.level * 10;
            const kamasGain = target.level * 5;
            player.xp += xpGain;
            player.kamas += kamasGain;

            const xpNeeded = player.level * 100;
            while (player.xp >= player.level * 100) {
                player.xp -= player.level * 100;
                player.level++;
                player.maxHp = player.getMaxHp();
                player.hp = Math.min(player.hp, player.maxHp);
            }


            // Fin de combat
            player.inCombat = false;
            target.inCombat = false;
            saveCharacter(player);

            socket.emit('monsterKilled', {
                xp: player.xp,
                kamas: player.kamas,
                level: player.level,
                xpGain,
                kamasGain
            });

            // Respawn
            setTimeout(() => {
                const newMonster = new Monster(
                    targetId,
                    Math.floor(Math.random() * gameWorld.width),
                    Math.floor(Math.random() * gameWorld.height),
                    target.level
                );
                gameWorld.monsters.set(targetId, newMonster);
            }, 30000);
        }
    });
    socket.on('getInventory', async () => {
        const player = gameWorld.players.get(socket.userId);
        if (!player) return;

        await player.loadInventory();
        
        socket.emit('inventoryData', {
            inventory: player.inventory,
            equipment: player.equipment,
            stats: player.stats,
            kamas: player.kamas
        });
    });
    socket.on('equipItem', async ({ itemId, slot }) => {
        const player = gameWorld.players.get(socket.userId);
        if (!player) return;

        const success = await player.equipItem(itemId, slot);
        if (success) {
            socket.emit('equipSuccess', {
                itemId,
                slot,
                stats: player.stats
            });
            
            // Mettre à jour l'inventaire
            socket.emit('inventoryData', {
                inventory: player.inventory,
                equipment: player.equipment,
                stats: player.stats,
                kamas: player.kamas
            });
        }
    });
    socket.on('unequipItem', async ({ slot }) => {
        const player = gameWorld.players.get(socket.userId);
        if (!player) return;

        const success = await player.unequipItem(slot);
        if (success) {
            socket.emit('unequipSuccess', {
                slot,
                stats: player.stats
            });
            
            // Mettre à jour l'inventaire
            socket.emit('inventoryData', {
                inventory: player.inventory,
                equipment: player.equipment,
                stats: player.stats,
                kamas: player.kamas
            });
        }
    });
    socket.on('getSkills', () => {
        const player = gameWorld.players.get(socket.userId);
        if (!player) return;

        // Tous les sorts de la classe
        const allClassSkills = SKILLS[player.classe] || [];
        
        // IMPORTANT : Filtrer les sorts selon le niveau du joueur
        const availableSkills = allClassSkills.filter(skill => {
            return skill.level <= player.level;
        });
        
        // Si le joueur n'a pas de sorts équipés, lui donner les 2 premiers disponibles
        if (!player.equippedSkills || player.equippedSkills.length === 0) {
            player.equippedSkills = availableSkills.slice(0, 2).map(s => s.id);
        }

        // Nettoyer les sorts équipés pour ne garder que ceux qui sont encore disponibles
        player.equippedSkills = player.equippedSkills.filter(id => 
            availableSkills.some(s => s.id === id)
        );

        
        socket.emit('skillsData', {
            available: availableSkills,
            equipped: player.equippedSkills
        });
    });

    // Équiper des sorts
    socket.on('equipSkills', ({ skills }) => {
        const player = gameWorld.players.get(socket.userId);
        if (!player) return;

        // Validation : max 4 sorts, doivent appartenir à la classe
        const availableSkills = SKILLS[player.classe] || [];
        const validSkills = skills.filter(id => 
            availableSkills.some(s => s.id === id)
        ).slice(0, 4);

        player.equippedSkills = validSkills;

        // Confirmer au client
        socket.emit('skillsData', {
            available: availableSkills,
            equipped: player.equippedSkills
        });

        // Si en combat, mettre à jour les sorts disponibles
        if (player.inCombat && player.currentTarget) {
            const monster = gameWorld.monsters.get(player.currentTarget);
            if (monster) {
                const equippedSkillObjects = availableSkills.filter(s => 
                    player.equippedSkills.includes(s.id)
                );
                
                socket.emit('combatUpdate', {
                    player: { hp: player.hp, pa: player.pa },
                    monster: monster.getPublicData(),
                    skills: equippedSkillObjects,
                    turn: 'player',
                    log: []
                });
            }
        }
    });

    // Fuir le combat
    socket.on('flee', () => {
        const player = gameWorld.players.get(socket.userId);
        if (!player || !player.inCombat) return;

        // 70% de chance de fuir
        if (Math.random() < 0.7) {
            const monster = gameWorld.monsters.get(player.currentTarget);
            if (monster) {
                monster.inCombat = false;
            }
            player.inCombat = false;
            player.currentTarget = null;

            socket.emit('combatEnded', {
                message: 'Tu as réussi à fuir !',
                player: player.getPublicData()
            });
        } else {
            socket.emit('combatUpdate', {
                player: { hp: player.hp, pa: player.pa },
                monster: gameWorld.monsters.get(player.currentTarget)?.getPublicData(),
                turn: 'player',
                log: [{ side: 'system', text: 'Tu n\'as pas réussi à fuir !' }]
            });
        }
    });

    // Chunk request (lazy terrain loading)
    socket.on('requestChunk', ({ centerX, centerY, width, height }) => {
        const w = Math.max(16, Math.min(128, width || 64));
        const h = Math.max(16, Math.min(128, height || 64));
        const chunk = gameWorld.getChunk(Math.floor(centerX || 0), Math.floor(centerY || 0), w, h);
        socket.emit('chunk', { chunk });
    });

    // Chat
    
    // Utilisation d'une compétence (tour par tour)
    socket.on('useSkill', async ({ targetId, skillId }) => {
        const player = gameWorld.players.get(socket.userId);
        if (!player || !player.inCombat) return;

        const target = gameWorld.monsters.get(targetId);
        if (!target || !target.inCombat) return;

        const skill = (player.skills || []).find(s => s.id === skillId) || { id:'basic', name:'Attaque', pa:2, power:[8,12] };
        if ((player.pa || 0) < (skill.pa || 0)) return;

        // Player action
        player.pa -= (skill.pa || 0);
        let dmg = rand(skill.power[0], skill.power[1]) + Math.floor(player.level * 2);
        if (dmg < 0) {
            // heal
            player.hp = Math.min(player.maxHp, player.hp + (Math.abs(dmg)));
        } else {
            target.hp = Math.max(0, target.hp - dmg);
        }

        let logs = [];
        logs.push({ side: 'player', text: dmg < 0 ? `${player.username} se soigne de ${Math.abs(dmg)} PV.` : `${player.username} utilise ${skill.name} et inflige ${dmg} dégâts.` });

        // Check kill
        if (target.hp <= 0) {
            // Rewards
            const xpGain = target.level * 10;
            const kamasGain = target.level * 5;
            player.xp += xpGain;
            player.kamas += kamasGain;

            // Level up (boucle)
            while (player.xp >= player.level * 100) {
                player.xp -= player.level * 100;
                player.level++;
                player.maxHp = player.getMaxHp();
                player.hp = Math.min(player.hp, player.maxHp);
            }
            const loot = await lootSystem.generateLoot(target.type, target.level);
            let lootMessage = '';

            for (const item of loot) {
                if (item.type === 'gold') {
                    player.kamas += item.amount;
                    lootMessage += `💰 ${item.amount} kamas, `;
                } else {
                    await player.addItemToInventory(item.id, item.quantity);
                    const rarityColor = RARITY_COLORS[item.rarity];
                    lootMessage += `📦 ${item.name} (${item.rarity}), `;
                }
            }

            if (lootMessage) {
                lootMessage = 'Loot: ' + lootMessage.slice(0, -2);
            }

            await saveCharacter(player);

            // End combat
            player.inCombat = false;
            target.inCombat = false;
            gameWorld.monsters.delete(targetId);

            io.to(socket.id).emit('combatEnded', {
                message: `Tu as vaincu ${target.type} ! +${xpGain} XP, +${kamasGain} kamas. ${lootMessage}`,
                player: { xp: player.xp, level: player.level, hp: player.hp, maxHp: player.maxHp, kamas: player.kamas },
                loot: loot
            });

            // Respawn monster later
            setTimeout(() => {
                const spawn = gameWorld.findSafeSpawn ? gameWorld.findSafeSpawn() : { x: rand(0, gameWorld.width-1), y: rand(0, gameWorld.height-1) };
                const newMonster = new Monster(targetId, spawn.x, spawn.y, target.level);
                gameWorld.monsters.set(targetId, newMonster);
            }, 30000);
            return;
        }

        // Monster turn (simple AI)
        const mSkill = pick(MONSTER_SKILLS);
        let mDmg = rand(mSkill.power[0], mSkill.power[1]) + Math.floor(target.level * 1.5);
        player.hp = Math.max(0, player.hp - mDmg);

        logs.push({ side: 'monster', text: `${target.type} utilise ${mSkill.name} et inflige ${mDmg} dégâts.` });

        if (player.hp > 0) {
            // Regen PA au prochain tour du joueur
            player.pa = 6;
            io.to(socket.id).emit('combatUpdate', {
                player: { hp: player.hp, pa: player.pa },
                monster: target.getPublicData(),
                turn: 'player',
                log: logs
            });
        } else {
            // Joueur K.O.
            player.inCombat = false;
            target.inCombat = false;
            player.isDead = true;
            await saveCharacter(player);
            io.to(socket.id).emit('playerDied', { respawnIn: 8000 });
            setTimeout(() => { respawnPlayer(player, socket.id); }, 8000);
        }
    });


    socket.on('chat', (message) => {
        const player = gameWorld.players.get(socket.userId);
        if (!player || !message || message.length > 200) return;

        const chatMessage = {
            type: 'player',
            username: player.username,
            text: message,
            timestamp: Date.now()
        };

        io.emit('chatMessage', chatMessage);
    });

    // Se reposer
    socket.on('rest', async () => {
        const player = gameWorld.players.get(socket.userId);
        if (!player || player.inCombat || player.isDead) return;

        player.hp = Math.min(player.hp + 20, player.maxHp);
        socket.emit('restResult', { hp: player.hp, maxHp: player.maxHp });
        await saveCharacter(player);
    });

    // Déconnexion
    socket.on('disconnect', () => {
        if (socket.userId) {
            const player = gameWorld.players.get(socket.userId);
            if (player) {
                saveCharacter(player);
                saveCharacterEquipment(player);
                gameWorld.players.delete(socket.userId);
                io.emit('playerLeft', { userId: socket.userId });
            }
        }
        console.log('Joueur déconnecté:', socket.id);
    });
});

// ========================
// FONCTIONS UTILITAIRES
// ========================

async function checkIfHasCharacter(userId) {
    try {
        const result = await db.query(
            'SELECT id FROM characters WHERE user_id = $1',
            [userId]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Erreur check character:', error);
        return false;
    }
}

async function loadCharacter(userId) {
    try {
        const result = await db.query(
            'SELECT * FROM characters WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Erreur chargement personnage:', error);
        return null;
    }
}

async function saveCharacter(player) {
    try {
        await db.query(
            'UPDATE characters SET x = $1, y = $2, level = $3, xp = $4, hp = $5, kamas = $6, updated_at = NOW() WHERE user_id = $7',
            [player.x, player.y, player.level, player.xp, player.hp, player.kamas, player.userId]
        );
    } catch (error) {
        console.error('Erreur sauvegarde personnage:', error);
    }
}
async function saveCharacterEquipment(player) {
  try {
    const equipmentColumns = [];
    const equipmentValues = [];
    let paramIndex = 1;

    Object.entries(player.equipment).forEach(([slot, item]) => {
      equipmentColumns.push(`equipped_${slot} = $${paramIndex}`);
      equipmentValues.push(item ? item.item_id : null);
      paramIndex++;
    });

    equipmentValues.push(player.userId);

    if (equipmentColumns.length > 0) {
      await db.query(`
        UPDATE characters
        SET ${equipmentColumns.join(', ')}
        WHERE user_id = $${paramIndex}
      `, equipmentValues);
    }
  } catch (error) {
    console.error('Erreur sauvegarde équipement:', error);
  }
}

async function saveCharacterPosition(player) {
    try {
        await db.query(
            'UPDATE characters SET x = $1, y = $2, updated_at = NOW() WHERE user_id = $3',
            [player.x, player.y, player.userId]
        );
    } catch (error) {
        console.error('Erreur sauvegarde position:', error);
    }
}

async function respawnPlayer(player, socketId) {
    const spawn = gameWorld.findSafeSpawn ? gameWorld.findSafeSpawn() : { x: 50, y: 50 };
    player.x = spawn.x;
    player.y = spawn.y;
    player.hp = player.maxHp;
    player.pa = 6;
    player.inCombat = false;
    player.isDead = false;
    await saveCharacter(player);
    if (socketId) {
        io.to(socketId).emit('respawn', { player: player.getPublicData() });
    }
}

// ========================
// INITIALISATION
// ========================

const gameWorld = new GameWorld();

// Test de connexion à la base de données
db.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Erreur connexion base de données:', err);
    } else {
        console.log('✅ Base de données connectée');
    }
});

// Démarrage du serveur
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Serveur Dofus MMO démarré sur le port ${PORT}`);
    console.log('🌍 Monde de jeu initialisé');
    console.log(`📊 ${gameWorld.monsters.size} monstres créés`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt du serveur...');
    
    // Sauvegarder tous les joueurs
    for (const player of gameWorld.players.values()) {
        await saveCharacter(player);
    }
    
    await db.end();
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
});