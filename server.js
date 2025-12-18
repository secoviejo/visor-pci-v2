const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

// Multer Config for Uploads
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './') // Save in root for simplicity
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'floor_' + uniqueSuffix + ext)
    }
})
const upload = multer({ storage: storage });

// Auth Config
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const SECRET_KEY = 'super_secret_key_change_me'; // In prod use ENV

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files (HTML, CSS, JS, Images) from root (for now) and specific folders
app.use(express.static('.'));
app.use(express.static('public'));

// Middleware for Authentication
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.warn('Authentication failed: No token provided');
        return res.sendStatus(401);
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.warn('Authentication failed: Invalid or expired token');
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}

// --- REST API ROUTES ---

// 0. Auth Routes
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);

    if (!user) return res.status(400).json({ error: 'User not found' });

    if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(403).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ username: user.username, id: user.id }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, username: user.username });
});

app.post('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// 1. Get All Buildings (Public)
app.get('/api/buildings', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM buildings');
        const buildings = stmt.all();
        res.json(buildings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1.1 Create Building (Protected)
app.post('/api/buildings', authenticateToken, (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const stmt = db.prepare('INSERT INTO buildings (name) VALUES (?)');
        const result = stmt.run(name);
        res.json({ success: true, id: result.lastInsertRowid, name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1.2 Get Floors (Filtered by Building)
app.get('/api/floors', (req, res) => {
    try {
        const { buildingId } = req.query;
        let query = 'SELECT * FROM floors';
        const params = [];

        if (buildingId) {
            query += ' WHERE building_id = ?';
            params.push(buildingId);
        }

        const stmt = db.prepare(query);
        const floors = stmt.all(...params);
        res.json(floors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1.5 Add New Floor (Protected) - Modified to include building_id
app.post('/api/floors', authenticateToken, upload.single('image'), (req, res) => {
    try {
        const { name, buildingId } = req.body;
        const filename = req.file ? req.file.filename : null;

        if (!filename || !name) {
            return res.status(400).json({ error: 'Name and Image are required' });
        }

        // Default to building 1 if not provided (safe fallback)
        const bId = buildingId || 1;

        const stmt = db.prepare('INSERT INTO floors (name, image_filename, building_id) VALUES (?, ?, ?)');
        const result = stmt.run(name, filename, bId);

        res.json({ success: true, id: result.lastInsertRowid, filename });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Get Devices by Floor
app.get('/api/floors/:floorId/devices', (req, res) => {
    try {
        const { floorId } = req.params;
        const stmt = db.prepare('SELECT * FROM devices WHERE floor_id = ?');
        const devices = stmt.all(floorId);
        // Map to format expected by frontend (optional, but cleaner to match DB columns)
        // Frontend originally expected: { n, id, t, x, y, loc }
        // DB has: { id, device_id, number, type, x, y, location }
        const mapped = devices.map(d => ({
            id: d.device_id, // External ID
            db_id: d.id,     // Internal DB ID
            n: d.number,
            t: d.type,
            x: d.x,
            y: d.y,
            loc: d.location
        }));
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Update Device (Protected)
app.put('/api/devices/:dbId', authenticateToken, (req, res) => {
    console.log(`PUT /api/devices/${req.params.dbId} requested by ${req.user.username}`);
    try {
        const { dbId } = req.params;
        const { x, y, n, loc, id, t } = req.body;
        console.log('Update Body:', req.body);

        // Build query dynamically based on provided fields
        const fields = [];
        const values = [];

        if (x !== undefined) { fields.push('x = ?'); values.push(x); }
        if (y !== undefined) { fields.push('y = ?'); values.push(y); }
        if (n !== undefined) { fields.push('number = ?'); values.push(n); }
        if (loc !== undefined) { fields.push('location = ?'); values.push(loc); }
        if (id !== undefined) { fields.push('device_id = ?'); values.push(id); }
        if (t !== undefined) { fields.push('type = ?'); values.push(t); }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(dbId); // For WHERE clause

        const sql = `UPDATE devices SET ${fields.join(', ')} WHERE id = ?`;
        const stmt = db.prepare(sql);
        const result = stmt.run(...values);

        if (result.changes > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Device not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Create New Device (Protected)
app.post('/api/devices', authenticateToken, (req, res) => {
    try {
        const { floorId, n, t, x, y, loc, id } = req.body;
        // Generate a random ID if not provided (like the original app did with timestamps)
        const deviceId = id || Date.now().toString();

        const stmt = db.prepare(`
            INSERT INTO devices (floor_id, device_id, number, type, x, y, location)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(floorId, deviceId, n, t, x, y, loc);

        res.json({
            success: true,
            db_id: result.lastInsertRowid,
            id: deviceId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Delete Device (Protected)
app.delete('/api/devices/:dbId', authenticateToken, (req, res) => {
    try {
        const { dbId } = req.params;
        const stmt = db.prepare('DELETE FROM devices WHERE id = ?');
        const result = stmt.run(dbId);

        if (result.changes > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Device not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
