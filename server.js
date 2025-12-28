const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const modbusService = require('./js/services/modbusService');
const bacnetService = require('./js/services/bacnetService'); // [NEW] BACnet Integration

// Start Modbus Connection
modbusService.connect();

// Listen for hardware events (Modbus)
modbusService.on('change', (event) => {
    console.log('[Hardware Modbus]', event);
    // Logic handles in socket section
});

// Start BACnet Discovery
try {
    bacnetService.discover();
    console.log('[BACnet] Discovery started on port ' + bacnetService.localPort);
} catch (e) {
    console.warn('[BACnet] Startup error:', e.message);
}

// Listen for BACnet devices
bacnetService.on('deviceFound', (device) => {
    // Just log for now. In future could map to Rooms/Zones.
    console.log(`[BACnet] New Device: ${device.deviceId} (${device.address})`);
});

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
const JWT_SECRET = 'super_secret_key_change_me'; // In prod use ENV

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

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn('Authentication failed: Invalid or expired token');
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// --- REST API ROUTES ---

// 0. Auth Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role || 'viewer' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ token, username: user.username, role: user.role || 'viewer' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Middleware for Role Checking
const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) return res.sendStatus(401);
        if (!roles.includes(req.user.role)) return res.sendStatus(403);
        next();
    };
};

app.post('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// 1. Get All Buildings (Public) - Filter by Campus
app.get('/api/buildings', (req, res) => {
    try {
        const { campusId } = req.query;
        let query = 'SELECT * FROM buildings';
        const params = [];

        if (campusId) {
            query += ' WHERE campus_id = ?';
            params.push(campusId);
        }

        const stmt = db.prepare(query);
        const buildings = stmt.all(...params);
        res.json(buildings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1.1 Create Building (Protected)
app.post('/api/buildings', authenticateToken, (req, res) => {
    try {
        const { name, campusId } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const cId = campusId || 1; // Default to Campus 1

        const stmt = db.prepare('INSERT INTO buildings (name, campus_id) VALUES (?, ?)');
        const result = stmt.run(name, cId);
        res.json({ success: true, id: result.lastInsertRowid, name, campus_id: cId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1.0 Get All Campuses (Public)
app.get('/api/campuses', (req, res) => {
    try {
        // If table doesn't exist yet (migration timing), return empty or mock
        // But database.js should have created it.
        const stmt = db.prepare('SELECT * FROM campuses');
        const campuses = stmt.all();
        res.json(campuses);
    } catch (error) {
        // Fallback if table missing (dev safety)
        if (error.message.includes('no such table')) {
            return res.json([
                { id: 1, name: 'Campus San Francisco (Mock)', image_filename: 'campus_sf.jpg' },
                { id: 2, name: 'Campus Río Ebro (Mock)', image_filename: 'campus_rio_ebro.jpg' }
            ]);
        }
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

// 6. Alerts Schema
const createAlertsTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        element_id TEXT,
        type TEXT,
        building_id INTEGER,
        floor_id INTEGER,
        location TEXT,
        description TEXT,
        status TEXT, -- ACTIVA, RESUELTA
        origin TEXT, -- REAL, SIMULACIÓN
        started_at TEXT,
        ended_at TEXT
    )
`);
createAlertsTable.run();

// --- Socket.io & Modbus Integration ---
const http = require('http');
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('[Socket] Client connected');
    socket.on('disconnect', () => {
        console.log('[Socket] Client disconnected');
    });
});

// Broadcast Modbus Events
modbusService.on('change', (event) => {
    console.log('[Hardware Event]', event);

    // Only process "ON" events (value=true) as alarms for now
    // Logic: DI0 = 1 -> ALARM
    if (event.value === true) {
        const alertData = {
            elementId: `CIE-${event.port}`, // Virtual ID
            type: 'detector', // Default assumption
            building_id: 1, // Default
            floor_id: 1, // Default (needs config map later)
            location: event.distinct === 'di0' ? 'Zona 1 (Hardware)' : 'Zona 2 (Hardware)',
            description: 'Alarma de Fuego (Sensor Real)',
            status: 'ACTIVA',
            origin: 'REAL',
            started_at: new Date().toISOString(),
            ended_at: null
        };

        // Persist
        try {
            const stmt = db.prepare(`
                INSERT INTO alerts (element_id, type, building_id, floor_id, location, description, status, origin, started_at, ended_at)
                VALUES (@elementId, @type, @building_id, @floor_id, @location, @description, @status, @origin, @started_at, @ended_at)
            `);
            const result = stmt.run(alertData);
            alertData.db_id = result.lastInsertRowid;

            // Broadcast
            io.emit('pci:alarm:on', alertData);
            console.log('[Socket] Emitted pci:alarm:on');
        } catch (e) {
            console.error('Error saving alert:', e);
        }

        // --- NEW EVENT LOGGING (ON) ---
        // Priority Logic: Detector = ALARM, Pulsador = ALARM, System = INFO
        let eventType = 'ALARM';

        try {
            const stmt = db.prepare(`
                INSERT INTO events (device_id, type, message, value)
                VALUES (?, ?, 'Dispositivo Activado', ?)
            `);
            const info = stmt.run(elementId, eventType, JSON.stringify(event.value));

            // Emit Event Update
            io.emit('event:new', {
                id: info.lastInsertRowid,
                device_id: elementId,
                type: eventType,
                message: 'Dispositivo Activado',
                timestamp: new Date(),
                acknowledged: false
            });
        } catch (e) { console.error("Error logging event:", e); }

    } else {
        // Handle "OFF" -> Resolve Alert
        const elementId = `CIE-${event.port}`;
        console.log(`[Hardware Event] Resolving alert for ${elementId}`);

        try {
            // Find the last active alert for this element and resolve it
            const stmt = db.prepare(`
                UPDATE alerts 
                SET status = 'RESUELTA', ended_at = ? 
                WHERE element_id = ? AND status = 'ACTIVA'
            `);
            const now = new Date().toISOString();
            const result = stmt.run(now, elementId);

            if (result.changes > 0) {
                // Broadcast deactivation
                io.emit('pci:alarm:off', {
                    elementId,
                    type: 'detector', // Match frontend expectation
                    status: 'RESUELTA',
                    ended_at: now
                });
                console.log(`[Socket] Emitted pci:alarm:off for ${elementId}`);
            }
        } catch (e) {
            console.error('Error resolving alert:', e);
        }
    }
});


// 7. Control Endpoint (DO0 Siren)
app.post('/api/devices/control', authenticateToken, async (req, res) => {
    try {
        const { action } = req.body;
        // action: 'activate' | 'deactivate'

        console.log(`[Control] Request: ${action} by ${req.user.username}`);

        if (action === 'activate') {
            await modbusService.writeOutput(0, true);
            res.json({ success: true, state: 'ON' });
        } else if (action === 'deactivate') {
            await modbusService.writeOutput(0, false);
            res.json({ success: true, state: 'OFF' });
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
    } catch (e) {
        console.error(`[Control] Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// 8. Events API
app.get('/api/events', authenticateToken, (req, res) => {
    try {
        const { limit = 50, offset = 0, type, resolved } = req.query;
        let query = 'SELECT * FROM events';
        const params = [];
        const conditions = [];

        if (type) {
            conditions.push('type = ?');
            params.push(type);
        }
        if (resolved !== undefined) {
            conditions.push('resolved = ?');
            params.push(resolved === 'true' ? 1 : 0);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const events = db.prepare(query).all(...params);
        res.json(events);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/events/:id/acknowledge', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('UPDATE events SET acknowledged = 1, acknowledged_by = ? WHERE id = ?');
        const result = stmt.run(req.user.username, id);

        if (result.changes > 0) {
            io.emit('event:ack', { id, user: req.user.username });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Evento no encontrado' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// 9. Simulation & Status API (Phase 5)
app.get('/api/campuses/stats', (req, res) => {
    try {
        // Count active ALARM events per campus
        // We link events -> devices -> floors -> buildings -> campuses
        // Note: events.device_id relates to devices.device_id (which is external ID)
        // AND devices.device_id is stored in 'devices' table.
        // But server.js uses 'elementId' for event insertion. elementId for hardware is 'CIE-XX'.
        // For this query to work, we need to hope events.device_id matches devices.device_id OR devices.id
        // Since we are simulating, we will ensure the inserted event uses a valid device_id from DB.

        const query = `
            SELECT c.id, c.name, COUNT(e.id) as alarm_count 
            FROM campuses c 
            LEFT JOIN buildings b ON b.campus_id = c.id 
            LEFT JOIN floors f ON f.building_id = b.id 
            LEFT JOIN devices d ON d.floor_id = f.id 
            LEFT JOIN events e ON (e.device_id = d.device_id AND e.type = 'ALARM' AND e.resolved = 0)
            GROUP BY c.id
        `;
        const stats = db.prepare(query).all();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/simulation/alarm', authenticateToken, (req, res) => {
    try {
        // 1. Pick a random device
        const device = db.prepare("SELECT device_id, type FROM devices ORDER BY RANDOM() LIMIT 1").get();

        if (!device) return res.status(404).json({ error: 'No devices found to simulate' });

        // 2. Insert ALARM event
        const stmt = db.prepare(`
            INSERT INTO events (device_id, type, message, value)
            VALUES (?, 'ALARM', 'Incidencia Simulada', ?)
        `);
        const info = stmt.run(device.device_id, JSON.stringify({ simulated: true }));

        // 3. Emit event
        io.emit('event:new', {
            id: info.lastInsertRowid,
            device_id: device.device_id,
            type: 'ALARM',
            message: 'Incidencia Simulada',
            timestamp: new Date(),
            acknowledged: false
        });

        res.json({ success: true, device });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 10. Admin API (Phase 6)

// USERS
app.get('/api/users', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const users = db.prepare('SELECT id, username, role FROM users').all();
        res.json(users);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
        const info = stmt.run(username, hashedPassword, role || 'viewer');
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        if (req.params.id == req.user.id) return res.status(400).json({ error: "Cannot delete self" });
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GATEWAYS
app.get('/api/gateways', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const gateways = db.prepare('SELECT * FROM gateways').all();
        res.json(gateways);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gateways', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const { name, type, ip_address, port, config } = req.body;
        const stmt = db.prepare('INSERT INTO gateways (name, type, ip_address, port, config) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(name, type, ip_address, port, JSON.stringify(config || {}));
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
