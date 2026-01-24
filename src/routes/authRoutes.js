const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware de autenticación (se pasa como dependencia)
let db, SECRET_KEY;

function initAuthRoutes(database, jwtSecret) {
    db = database;
    SECRET_KEY = jwtSecret;
    return router;
}

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.sendStatus(401);

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const newToken = jwt.sign({ id: decoded.id, username: decoded.username, role: decoded.role }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token: newToken });
    } catch (err) {
        res.sendStatus(403);
    }
});

module.exports = initAuthRoutes;
