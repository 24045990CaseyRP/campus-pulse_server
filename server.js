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
    "http://localhost:5173",
    "https://campus-pulse-server.onrender.com/"
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
app.use('/', require('./routes/pings')(pool, upload, authenticateToken, sharp));

// --- COMMENTS ROUTES ---
app.use('/', require('./routes/comments')(pool, upload, authenticateToken, sharp));


// Health Check (For Render)
app.get('/', (req, res) => {
    res.send('Campus Pulse API is running!');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
