const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');

// Image Upload Dependencies
const multer = require('multer');
const sharp = require('sharp'); // Image processing library

const app = express();
const port = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'campus_pulse_secret_key_123';

// MULTER CONFIG (Memory Storage for BLOBs)
// We store the file in memory so we can access req.file.buffer and save it to the DB
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5MB (before compression)
});

// ALLOWED ORIGINS - Add your frontend URL here when deployed
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173", // Common Vite port
    // "https://your-frontend-app.onrender.com" 
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || true) { // Allowed all for development ease
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// DATABASE CONNECTION
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Enable this for Aiven/Render managed DBs that require SSL
    ssl: { rejectUnauthorized: false }
};

// Optional: Load CA cert if provided (for strict SSL)
if (fs.existsSync('./ca.pem')) {
    dbConfig.ssl.ca = fs.readFileSync('./ca.pem');
}

const pool = mysql.createPool(dbConfig);

// MIDDLEWARE
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};

// --- AUTH ROUTES ---

// Register
app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    // Default role to student if not provided
    const userRole = role || 'student';

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required' });
    }

    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) return res.status(400).json({ message: 'Username taken' });

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.execute(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, userRole]
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error registering user' });
    }
});

// Login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = users[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, username: user.username, role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// --- PING (FEED) ROUTES ---

// Get All Active Pings (The "Feed")
app.get('/pings', async (req, res) => {
    try {
        // Fetch pings with user info
        // We use TO_BASE64 to convert BLOB to string so the frontend can display it like: <img src="data:image/jpeg;base64,...">
        const query = `
            SELECT p.id, p.user_id, p.content, p.category, p.location_name, p.upvotes, p.created_at, 
                   u.username,
                   TO_BASE64(p.image_data) as image_base64,
                   (SELECT COUNT(*) FROM ping_votes WHERE ping_id = p.id AND vote_type = 1) as vote_count,
                   (SELECT COUNT(*) FROM comments WHERE ping_id = p.id) as comment_count
            FROM pings p
            JOIN users u ON p.user_id = u.id
            WHERE p.is_active = TRUE
            ORDER BY p.created_at DESC
            LIMIT 50
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching pings' });
    }
});

// Create a New Ping (With Image Upload & Compression)
app.post('/pings', authenticateToken, upload.single('image'), async (req, res) => {
    const { content, category, location_name } = req.body;
    let imageBuffer = null;

    if (!content) return res.status(400).json({ message: 'Content is required' });

    try {
        // Compress Image if Exists
        if (req.file) {
            imageBuffer = await sharp(req.file.buffer)
                .resize({ width: 800, withoutEnlargement: true }) // Resize to max width 800px
                .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
                .toBuffer();
        }

        const [result] = await pool.execute(
            `INSERT INTO pings (user_id, content, category, location_name, image_data) 
             VALUES (?, ?, ?, ?, ?)`,
            [req.user.id, content, category || 'Other', location_name, imageBuffer]
        );

        res.status(201).json({
            message: 'Ping created!',
            pingId: result.insertId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating ping' });
    }
});

// Vote on a Ping (Upvote)
app.post('/pings/:id/vote', authenticateToken, async (req, res) => {
    const pingId = req.params.id;
    const userId = req.user.id;

    try {
        // Check if already voted
        const [existing] = await pool.query(
            'SELECT id FROM ping_votes WHERE user_id = ? AND ping_id = ?',
            [userId, pingId]
        );

        if (existing.length > 0) {
            // Optional: Toggle vote (remove it)
            await pool.execute('DELETE FROM ping_votes WHERE user_id = ? AND ping_id = ?', [userId, pingId]);
            await pool.execute('UPDATE pings SET upvotes = upvotes - 1 WHERE id = ?', [pingId]);
            return res.json({ message: 'Vote removed', voted: false });
        }

        // Add vote
        await pool.execute(
            'INSERT INTO ping_votes (user_id, ping_id, vote_type) VALUES (?, ?, 1)',
            [userId, pingId]
        );
        await pool.execute('UPDATE pings SET upvotes = upvotes + 1 WHERE id = ?', [pingId]);

        res.json({ message: 'Upvoted!', voted: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error voting' });
    }
});

// Delete a Ping (Author or Admin)
app.delete('/pings/:id', authenticateToken, async (req, res) => {
    const pingId = req.params.id;

    try {
        const [ping] = await pool.query('SELECT user_id FROM pings WHERE id = ?', [pingId]);

        if (ping.length === 0) return res.status(404).json({ message: 'Ping not found' });

        if (req.user.role !== 'admin' && ping[0].user_id !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        await pool.execute('DELETE FROM pings WHERE id = ?', [pingId]);
        res.json({ message: 'Ping deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error deleting ping' });
    }
});

// --- COMMENTS ROUTES ---

// Get Comments for a Ping
app.get('/pings/:id/comments', async (req, res) => {
    const pingId = req.params.id;
    try {
        const query = `
            SELECT c.id, c.content, c.created_at, u.username,
                   TO_BASE64(c.image_data) as image_base64
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.ping_id = ?
            ORDER BY c.created_at ASC
        `;
        const [rows] = await pool.query(query, [pingId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching comments' });
    }
});

// Add a Comment to a Ping (with optional image & Compression)
app.post('/pings/:id/comments', authenticateToken, upload.single('image'), async (req, res) => {
    const pingId = req.params.id;
    const { content } = req.body;
    const userId = req.user.id;
    let imageBuffer = null;

    if (!content) return res.status(400).json({ message: 'Comment content required' });

    try {
        // Compress Image if Exists
        if (req.file) {
            imageBuffer = await sharp(req.file.buffer)
                .resize({ width: 800, withoutEnlargement: true }) // Resize to max width 800px
                .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
                .toBuffer();
        }

        await pool.execute(
            'INSERT INTO comments (user_id, ping_id, content, image_data) VALUES (?, ?, ?, ?)',
            [userId, pingId, content, imageBuffer]
        );
        res.status(201).json({ message: 'Comment added' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error adding comment' });
    }
});


// Health Check (For Render)
app.get('/', (req, res) => {
    res.send('Campus Pulse API is running!');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
