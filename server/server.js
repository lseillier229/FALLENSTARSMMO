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
const Redis = require('redis');
const Discord = require('discord.js');

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
    host: 'localhost',
    database: 'dofus_mmo',
    user: 'dofus_user',
    password: 'your_password',
    port: 5432,
});

const redis = Redis.createClient();
const JWT_SECRET = 'your_super_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration Discord Bot
const discordBot = new Discord.Client({ 
    intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages] 
});

// ========================
// CLASSES & GAME LOGIC
// ========================

class GameWorld {
    constructor() {
        this.width = 100;
        this.height = 100;
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
        
        // Génération procédurale avancée
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const noise = this.perlinNoise(x * 0.1, y * 0.1);
                
                if (noise < -0.3) terrain[y][x] = 1; // Eau
                else if (noise < -0.1) terrain[y][x] = 0; // Plaine
                else if (noise < 0.2) terrain[y][x] = 2; // Forêt
                else if (noise < 0.4) terrain[y][x] = 6; // Désert
                else terrain[y][x] = 3; // Montagne
                
                // Structures spéciales
                if (Math.random() < 0.001) terrain[y][x] = 4; // Village
                if (Math.random() < 0.0005) terrain[y][x] = 5; // Donjon
            }
        }
        return terrain;
    }

    perlinNoise(x, y) {
        // Implémentation simple du bruit de Perlin
        return Math.sin(x * 0.3) * Math.cos(y * 0.3) + 
               Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5;
    }

    initMonsters() {
        for (let i = 0; i < 500; i++) {
            const monster = new Monster(
                `monster_${i}`,
                Math.floor(Math.random() * this.width),
                Math.floor(Math.random() * this.height),
                Math.floor(Math.random() * 10) + 1
            );
            this.monsters.set(monster.id, monster);
        }
    }

    startGameLoop() {
        setInterval(() => {
            this.updateMonsters();
            this.updateCombats();
            this.broadcastWorldState();
        }, 1000); // 1 FPS pour les updates serveur
    }

    updateMonsters() {
        this.monsters.forEach(monster => {
            if (Math.random() < 0.1) { // 10% chance de bouger
                const directions = [[-1,0], [1,0], [0,-1], [0,1]];
                const [dx, dy] = directions[Math.floor(Math.random() * 4)];
                const newX = Math.max(0, Math.min(this.width-1, monster.x + dx));
                const newY = Math.max(0, Math.min(this.height-1, monster.y + dy));
                
                if (this.isWalkable(newX, newY)) {
                    monster.x = newX;
                    monster.y = newY;
                }
            }
        });
    }

    isWalkable(x, y) {
        const terrainType = this.terrain[y][x];
        return terrainType !== 1 && terrainType !== 3; // Pas eau ni montagne
    }

    broadcastWorldState() {
        const worldData = {
            players: Array.from(this.players.values()).map(p => p.getPublicData()),
            monsters: Array.from(this.monsters.values()).map(m => m.getPublicData()),
            timestamp: Date.now()
        };
        io.emit('worldUpdate', worldData);
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
        this.hp = this.getMaxHp();
        this.pa = 6;
        this.pm = 3;
        this.kamas = 1000;
        this.inventory = new Map();
        this.equipment = {};
        this.inCombat = false;
        this.lastAction = Date.now();
        this.socketId = null;
    }

    getMaxHp() {
        const baseHp = {
            iop: 150, cra: 120, eni: 100, sadi: 130
        };
        return (baseHp[this.classe] || 100) + (this.level - 1) * 20;
    }

    getPublicData() {
        return {
            userId: this.userId,
            username: this.username,
            classe: this.classe,
            x: this.x, y: this.y,
            level: this.level,
            hp: this.hp,
            maxHp: this.getMaxHp(),
            inCombat: this.inCombat
        };
    }

    move(dx, dy) {
        if (this.pm <= 0 || this.inCombat) return false;
        
        const newX = Math.max(0, Math.min(gameWorld.width-1, this.x + dx));
        const newY = Math.max(0, Math.min(gameWorld.height-1, this.y + dy));
        
        if (gameWorld.isWalkable(newX, newY)) {
            this.x = newX;
            this.y = newY;
            this.pm--;
            this.checkForEncounters();
            return true;
        }
        return false;
    }

    checkForEncounters() {
        // Vérifier les monstres à proximité
        gameWorld.monsters.forEach(monster => {
            if (monster.x === this.x && monster.y === this.y) {
                this.startCombat(monster);
            }
        });
    }

    startCombat(monster) {
        this.inCombat = true;
        monster.inCombat = true;
        // Logique de combat...
    }
}

class Monster {
    constructor(id, x, y, level) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.level = level;
        this.hp = level * 50;
        this.maxHp = this.hp;
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
            inCombat: this.inCombat
        };
    }
}

// ========================
// ROUTES API
// ========================

// Inscription
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email, discordId } = req.body;
        
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
            'INSERT INTO users (username, password, email, discord_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [username, hashedPassword, email, discordId]
        );

        const token = jwt.sign(
            { userId: result.rows[0].id, username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, userId: result.rows[0].id });
    } catch (error) {
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
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Créer personnage
app.post('/api/character/create', authenticateToken, async (req, res) => {
    try {
        const { name, classe } = req.body;
        const userId = req.user.userId;

        // Vérifier si l'utilisateur a déjà un personnage
        const existing = await db.query(
            'SELECT id FROM characters WHERE user_id = $1',
            [userId]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Personnage déjà existant' });
        }

        // Créer le personnage
        const result = await db.query(
            'INSERT INTO characters (user_id, name, classe, x, y, level, xp, hp, pa, pm, kamas) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
            [userId, name, classe, 50, 50, 1, 0, 150, 6, 3, 1000]
        );

        res.json({ characterId: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

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
                const player = new Player(
                    character.user_id,
                    character.name,
                    character.classe,
                    character.x,
                    character.y
                );
                player.level = character.level;
                player.xp = character.xp;
                player.hp = character.hp;
                player.kamas = character.kamas;
                player.socketId = socket.id;

                gameWorld.players.set(socket.userId, player);
                
                socket.emit('authSuccess', {
                    player: player.getPublicData(),
                    worldData: {
                        terrain: gameWorld.terrain,
                        width: gameWorld.width,
                        height: gameWorld.height
                    }
                });
            }
        } catch (error) {
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
            socket.emit('moveSuccess', { x: player.x, y: player.y, pm: player.pm });
            // Sauvegarder en BDD
            saveCharacter(player);
        }
    });

    // Action d'attaque
    socket.on('attack', (targetId) => {
        const player = gameWorld.players.get(socket.userId);
        if (!player || player.pa < 3) return;

        const target = gameWorld.monsters.get(targetId);
        if (target && Math.abs(target.x - player.x) <= 1 && Math.abs(target.y - player.y) <= 1) {
            // Logique d'attaque
            const damage = Math.floor(Math.random() * 30) + 10;
            target.hp -= damage;
            player.pa -= 3;

            socket.emit('attackResult', { damage, targetHp: target.hp });

            if (target.hp <= 0) {
                gameWorld.monsters.delete(targetId);
                player.xp += target.level * 10;
                player.kamas += target.level * 5;
                socket.emit('monsterKilled', { xp: player.xp, kamas: player.kamas });
            }
        }
    });

    // Déconnexion
    socket.on('disconnect', () => {
        if (socket.userId) {
            const player = gameWorld.players.get(socket.userId);
            if (player) {
                saveCharacter(player);
                gameWorld.players.delete(socket.userId);
            }
        }
        console.log('Joueur déconnecté:', socket.id);
    });
});

// ========================
// FONCTIONS UTILITAIRES
// ========================

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
            'UPDATE characters SET x = $1, y = $2, level = $3, xp = $4, hp = $5, kamas = $6 WHERE user_id = $7',
            [player.x, player.y, player.level, player.xp, player.hp, player.kamas, player.userId]
        );
    } catch (error) {
        console.error('Erreur sauvegarde personnage:', error);
    }
}

// ========================
// DISCORD BOT INTÉGRATION
// ========================

discordBot.on('ready', () => {
    console.log('Discord bot connecté!');
});

discordBot.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content.startsWith('!stats')) {
        // Récupérer les stats du joueur depuis la BDD
        const stats = await getPlayerStats(message.author.id);
        if (stats) {
            const embed = new Discord.EmbedBuilder()
                .setTitle(`📊 Stats de ${stats.name}`)
                .addFields(
                    { name: 'Niveau', value: stats.level.toString(), inline: true },
                    { name: 'XP', value: stats.xp.toString(), inline: true },
                    { name: 'Kamas', value: stats.kamas.toString(), inline: true }
                )
                .setColor(0x00ff00);
            
            await message.reply({ embeds: [embed] });
        } else {
            await message.reply('Tu n\'as pas encore de personnage! Va sur le site pour en créer un.');
        }
    }
});

async function getPlayerStats(discordId) {
    try {
        const result = await db.query(`
            SELECT c.* FROM characters c 
            JOIN users u ON c.user_id = u.id 
            WHERE u.discord_id = $1
        `, [discordId]);
        return result.rows[0] || null;
    } catch (error) {
        return null;
    }
}

// ========================
// INITIALISATION
// ========================

const gameWorld = new GameWorld();

// Démarrage du serveur
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Serveur Dofus MMO démarré sur le port ${PORT}`);
    console.log('🌍 Monde de jeu initialisé');
    console.log('🤖 Connexion Discord bot...');
    
    // Démarrer le bot Discord
    discordBot.login('TON_DISCORD_TOKEN');
});

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
    console.log('🛑 Arrêt du serveur...');
    
    // Sauvegarder tous les joueurs
    for (const player of gameWorld.players.values()) {
        await saveCharacter(player);
    }
    
    await db.end();
    await redis.quit();
    process.exit(0);
});