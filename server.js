const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const modbusService = require('./js/services/modbusService');
const bacnetService = require('./js/services/bacnetService'); // [NEW] BACnet Integration
const fs = require('fs'); // Added for file deletion

const { spawn } = require('child_process');
let simulatorProcess = null;

// Start Modbus Connection (Hardware only by default)


// Listen for hardware events// --- Initialize Modbus Connections ---
const buildingsWithModbus = db.prepare('SELECT id, modbus_ip, modbus_port FROM buildings WHERE modbus_ip IS NOT NULL').all();
buildingsWithModbus.forEach(b => {
    if (b.modbus_ip && b.modbus_ip.trim() !== '') {
        const port = b.modbus_port || 502;
        modbusService.connectBuilding(b.id, b.modbus_ip, port);
    }
});

// [BACnet] Start Discovery
try {
    bacnetService.discover();
    console.log('[BACnet] Discovery started on port 47809');
} catch (err) {
    console.error('[BACnet] Failed to start:', err.message);
}

// Listen for BACnet devices
bacnetService.on('deviceFound', (device) => {
    // Just log for now. In future could map to Rooms/Zones.
    console.log(`[BACnet] New Device: ${device.deviceId} (${device.address})`);
});

const app = express();
const PORT = process.env.PORT || 3000;

// Multer Config for Uploads
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure directory exists
        const dir = './uploads/temp';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
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
app.use(express.static('.'));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads')); // Explicitly serve uploads
app.use('/data', express.static('datos_edificios')); // [NEW] Serve structured data

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

// 1.1.1 Update Building Modbus Config
app.put('/api/buildings/:id/modbus', (req, res) => {
    const { id } = req.params;
    const { ip, port } = req.body;

    try {
        const stmt = db.prepare('UPDATE buildings SET modbus_ip = ?, modbus_port = ? WHERE id = ?');
        stmt.run(ip, port, id);

        // Reconnect logic
        if (ip && ip.trim() !== '') {
            modbusService.connectBuilding(parseInt(id), ip, parseInt(port) || 502);
        } else {
            modbusService.disconnectBuilding(parseInt(id));
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1.1.1 Update Building (Protected)
app.put('/api/buildings/:id', authenticateToken, (req, res) => {
    console.log(`[Building Update] ID: ${req.params.id}, Body:`, req.body);
    try {
        const { id } = req.params;
        const { name, campus_id, x, y } = req.body;

        const updates = [];
        const params = [];
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (campus_id !== undefined) { updates.push('campus_id = ?'); params.push(campus_id); }
        if (x !== undefined) { updates.push('x = ?'); params.push(x); }
        if (y !== undefined) { updates.push('y = ?'); params.push(y); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(id);
        const sql = `UPDATE buildings SET ${updates.join(', ')} WHERE id = ?`;
        console.log(`[SQL] ${sql} | Params:`, params);

        const stmt = db.prepare(sql);
        const result = stmt.run(...params);

        if (result.changes > 0) {
            console.log(`[Building Update] ✅ Success for ID ${id}`);
            res.json({ success: true });
        } else {
            console.warn(`[Building Update] ⚠️ No changes made for ID ${id} (not found?)`);
            res.status(404).json({ error: 'Building not found' });
        }
    } catch (error) {
        console.error(`[Building Update] ❌ Error: ${error.message}`);
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

// 1.0.1 Update Campus (Protected) - For scale/view adjustments
app.patch('/api/campuses/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const { id } = req.params;
        const { offset_x, offset_y, scale, name, description } = req.body;
        const fields = [];
        const values = [];

        if (offset_x !== undefined) { fields.push('offset_x = ?'); values.push(offset_x); }
        if (offset_y !== undefined) { fields.push('offset_y = ?'); values.push(offset_y); }
        if (scale !== undefined) { fields.push('scale = ?'); values.push(scale); }
        if (name !== undefined) { fields.push('name = ?'); values.push(name); }
        if (description !== undefined) { fields.push('description = ?'); values.push(description); }

        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

        values.push(id);
        const sql = `UPDATE campuses SET ${fields.join(', ')} WHERE id = ?`;
        const result = db.prepare(sql).run(...values);

        if (result.changes > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Campus not found' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
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

        const bId = buildingId || 1;

        // [NEW] Get Building & Campus Info for Folder Structure
        const building = db.prepare('SELECT b.name as bName, c.name as cName FROM buildings b JOIN campuses c ON b.campus_id = c.id WHERE b.id = ?').get(bId);

        if (!building) return res.status(404).json({ error: 'Building not found' });

        // Safe folder names (remove illegal chars for Windows)
        const safeName = (str) => str.replace(/[<>:"/\\|?*]/g, '').trim();
        const campusFolder = safeName(building.cName);
        const buildingFolder = safeName(building.bName);

        // Define Target Directory: datos_edificios/Campus/Building/planos
        const targetDir = path.join(__dirname, 'datos_edificios', campusFolder, buildingFolder, 'planos');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Move file
        const sourcePath = req.file.path;
        const targetPath = path.join(targetDir, filename);
        fs.renameSync(sourcePath, targetPath);

        // Store RELATIVE path in DB (e.g. "Campus X/Building Y/planos/file.jpg")
        // Use forward slashes for consistency
        const relativePath = path.join(campusFolder, buildingFolder, 'planos', filename).replace(/\\/g, '/');

        const stmt = db.prepare('INSERT INTO floors (name, image_filename, building_id) VALUES (?, ?, ?)');
        const result = stmt.run(name, relativePath, bId);

        res.json({ success: true, id: result.lastInsertRowid, filename: relativePath });
    } catch (error) {
        console.error('Error uploading floor:', error);
        res.status(500).json({ error: error.message });
    }
});

// [NEW] Upload Building Configuration (CSV)
const Papa = require('papaparse');

app.post('/api/buildings/:id/config', authenticateToken, upload.single('file'), (req, res) => {
    try {
        const { id } = req.params;
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'CSV file is required' });

        // 1. Get Building Info
        const building = db.prepare('SELECT b.name as bName, c.name as cName FROM buildings b JOIN campuses c ON b.campus_id = c.id WHERE b.id = ?').get(id);
        if (!building) return res.status(404).json({ error: 'Building not found' });

        // 2. Safe Paths
        const safeName = (str) => str.replace(/[<>:"/\\|?*]/g, '').trim();
        const campusFolder = safeName(building.cName);
        const buildingFolder = safeName(building.bName);
        const targetDir = path.join(__dirname, 'datos_edificios', campusFolder, buildingFolder);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 3. Move/Save File as 'dispositivos.csv' (forcing name as per request)
        const targetPath = path.join(targetDir, 'dispositivos.csv');
        // If uploaded file is temp, move/overwrite
        fs.renameSync(file.path, targetPath);

        // 4. Parse CSV Content
        const csvContent = fs.readFileSync(targetPath, 'utf8');
        const parsed = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        if (parsed.errors.length > 0) {
            console.warn('CSV Parse Warnings:', parsed.errors);
        }

        const rows = parsed.data;
        console.log(`[CSV Import] Parsed ${rows.length} rows for Building ${id}`);

        // 5. Process and Insert Devices
        // Strategy: Delete all devices for this building first to avoid duplicates/mess (Full Sync)

        // Transaction for safety
        const importTx = db.transaction(() => {
            // A. Find all floors for this building to clean up devices
            const floors = db.prepare('SELECT id, image_filename FROM floors WHERE building_id = ?').all(id);
            const floorIds = floors.map(f => f.id);

            if (floorIds.length > 0) {
                const deleteStmt = db.prepare(`DELETE FROM devices WHERE floor_id IN (${floorIds.join(',')})`);
                deleteStmt.run();
                console.log(`[CSV Import] Cleared existing devices for floors: ${floorIds.join(',')}`);
            }

            // B. Map filenames to floor IDs for quick lookup
            // image_filename in DB might be "Campus/Build/planos/file.jpg" or "file.jpg"
            // We match by basename
            const floorMap = new Map();
            floors.forEach(f => {
                const base = path.basename(f.image_filename);
                floorMap.set(base, f.id);
            });

            // C. Insert new devices
            const insertStmt = db.prepare(`
                INSERT INTO devices (floor_id, device_id, number, type, x, y, location)
                VALUES (@floorId, @deviceId, @number, @type, @x, @y, @location)
            `);

            let insertedCount = 0;
            let skippedCount = 0;

            rows.forEach(row => {
                // Expected columns: planta, tipo, numero, ubicacion, x, y
                // map to DB: floorId, device_id, number, type, x, y, loc

                const floorFilename = row.planta;
                const floorId = floorMap.get(floorFilename);

                if (floorId) {
                    insertStmt.run({
                        floorId: floorId,
                        deviceId: row.numero ? String(row.numero) : `GEN-${Date.now()}-${Math.random()}`, // Fallback ID
                        number: row.numero ? String(row.numero) : '',
                        type: row.tipo ? row.tipo.toLowerCase() : 'detector',
                        x: row.x || 0,
                        y: row.y || 0,
                        location: row.ubicacion || ''
                    });
                    insertedCount++;
                } else {
                    console.warn(`[CSV Import] Skipped row: Floor '${floorFilename}' not found in building.`);
                    skippedCount++;
                }
            });

            return { insertedCount, skippedCount };
        });

        const result = importTx();
        res.json({ success: true, ...result });

    } catch (e) {
        console.error('CSV Import Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// [NEW] DELETE Floor Endpoint
app.delete('/api/floors/:id', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.sendStatus(403);
        const floor = db.prepare('SELECT * FROM floors WHERE id = ?').get(req.params.id);
        if (!floor) return res.status(404).send('Floor not found');

        // Delete from DB first
        db.prepare('DELETE FROM floors WHERE id = ?').run(req.params.id);

        // Delete file
        // Check if it's a new path (in datos_edificios) or legacy (in uploads or root)
        let filePath;
        // Naive check: if it has a slash, it's likely a path.
        if (floor.image_filename.includes('/') || floor.image_filename.includes('\\')) {
            filePath = path.join(__dirname, 'datos_edificios', floor.image_filename);
        } else {
            // Legacy check
            filePath = path.join(__dirname, 'uploads', floor.image_filename);
            if (!fs.existsSync(filePath)) {
                filePath = path.join(__dirname, floor.image_filename); // Root fallback
            }
        }

        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.warn('Failed to delete file:', filePath, err.message);
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
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

// 2.1 Get Devices by Building (NEW)
app.get('/api/buildings/:id/devices', (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT d.*, f.name as floor_name 
            FROM devices d 
            JOIN floors f ON d.floor_id = f.id 
            WHERE f.building_id = ?
        `;
        const devices = db.prepare(query).all(id);

        const mapped = devices.map(d => ({
            id: d.device_id,
            db_id: d.id,
            n: d.number,
            t: d.type,
            x: d.x,
            y: d.y,
            loc: d.location,
            floor_name: d.floor_name,
            floor_id: d.floor_id
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
        // Fetch building name for better description
        const building = db.prepare('SELECT name FROM buildings WHERE id = ?').get(event.buildingId);
        const bName = building ? building.name : `Edificio ${event.buildingId}`;

        const alertData = {
            elementId: `CIE-H12-${event.buildingId}-${event.port}`, // Unique ID per building/port
            type: 'detector',
            building_id: event.buildingId,
            floor_id: 1, // Default to floor 1 if unknown mapping
            location: `${bName} - Entrada Digital ${event.port} (SOLAE)`,
            description: `Alarma de Fuego en ${bName}`,
            status: 'ACTIVA',
            origin: 'REAL',
            started_at: new Date().toISOString(),
            ended_at: null
        };

        // Check if alarm already exists for this element_id
        const existingAlarm = db.prepare(`
            SELECT id FROM alerts 
            WHERE element_id = ? AND status = 'ACTIVA'
        `).get(alertData.elementId);

        if (existingAlarm) {
            console.log(`[Modbus] Alarm already active for ${alertData.elementId}, skipping duplicate`);
            return; // Don't create duplicate
        }

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
                INSERT INTO events (device_id, type, message, value, building_id, floor_id)
                VALUES (?, ?, 'Dispositivo Activado', ?, ?, ?)
            `);
            const info = stmt.run(alertData.elementId, eventType, JSON.stringify(event.value), alertData.building_id, alertData.floor_id);

            // Emit Event Update
            io.emit('event:new', {
                id: info.lastInsertRowid,
                device_id: alertData.elementId,
                building_id: alertData.building_id,
                floor_id: alertData.floor_id,
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
        const { limit = 50, offset = 0, type, resolved, campusId } = req.query;

        let query = `
            SELECT e.*, 
                   COALESCE(d.number, '') as device_number, 
                   COALESCE(d.type, e.type) as device_type, 
                   COALESCE(d.location, '') as device_location, 
                   COALESCE(e_f.name, d_f.name) as floor_name, 
                   COALESCE(e_b.name, d_b.name) as building_name, 
                   COALESCE(e.building_id, d_b.id) as building_id, 
                   COALESCE(e_b.campus_id, d_b.campus_id) as campus_id
            FROM events e
            LEFT JOIN devices d ON e.device_id = d.device_id
            LEFT JOIN floors d_f ON d.floor_id = d_f.id
            LEFT JOIN buildings d_b ON d_f.building_id = d_b.id
            LEFT JOIN buildings e_b ON e.building_id = e_b.id
            LEFT JOIN floors e_f ON e.floor_id = e_f.id
        `;

        const params = [];
        const conditions = [];

        if (type) {
            conditions.push('e.type = ?');
            params.push(type);
        }
        if (resolved !== undefined) {
            conditions.push('e.resolved = ?');
            params.push(resolved === 'true' ? 1 : 0);
        }
        if (campusId) {
            conditions.push('COALESCE(e_b.campus_id, d_b.campus_id) = ?');
            params.push(parseInt(campusId));
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY e.timestamp DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

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


// 10. Admin Simulator Control
app.get('/api/admin/simulator/status', authenticateToken, (req, res) => {
    let isPortBusy = false;
    if (process.platform === 'win32') {
        try {
            const { execSync } = require('child_process');
            const output = execSync('netstat -ano | findstr :502').toString();
            isPortBusy = output.includes('LISTENING');
        } catch (e) {
            isPortBusy = false;
        }
    }

    res.json({
        running: !!simulatorProcess || isPortBusy,
        modbus: modbusService.getStatus()
    });
});

app.post('/api/admin/simulator/start', authenticateToken, (req, res) => {
    if (simulatorProcess) return res.json({ success: true, message: 'Ya en ejecución' });

    console.log('[Admin] Starting terminal simulator...');
    // Use 'node' to run the simulator script. 'shell: true' for windows compatibility.
    simulatorProcess = spawn('node', ['scripts/simulator.js'], {
        cwd: __dirname,
        stdio: 'inherit', // Show output in the same terminal
        shell: true
    });

    simulatorProcess.on('close', (code) => {
        console.log(`[Admin] Simulator process exited with code ${code}`);
        simulatorProcess = null;
    });

    // Automatically connect Modbus service to local simulator
    setTimeout(() => {
        modbusService.connect('127.0.0.1', 502);
    }, 1500);

    res.json({ success: true });
});

app.post('/api/admin/simulator/stop', authenticateToken, (req, res) => {
    console.log('[Admin] Force Stopping simulator...');

    // 1. Kill spawned process if exists
    if (simulatorProcess) {
        if (process.platform === 'win32') {
            spawn("taskkill", ["/pid", simulatorProcess.pid, '/f', '/t']);
        } else {
            simulatorProcess.kill();
        }
        simulatorProcess = null;
    }

    // 2. Aggressive kill by port (Windows only) for manual terminals
    if (process.platform === 'win32') {
        try {
            const { execSync } = require('child_process');
            const netstat = execSync('netstat -ano | findstr :502').toString();
            const lines = netstat.split('\n');
            lines.forEach(line => {
                if (line.includes('LISTENING')) {
                    const pid = line.trim().split(/\s+/).pop();
                    if (pid && pid !== '0' && pid != process.pid) {
                        console.log(`[Admin] Killing process on port 502 with PID: ${pid}`);
                        execSync(`taskkill /F /PID ${pid} /T`);
                    }
                }
            });
        } catch (e) {
            // Ignore errors if no process found
        }
    }

    modbusService.disconnect();
    res.json({ success: true });
});
app.get('/api/campuses/stats', (req, res) => {
    try {
        // Count active ALARM events per campus
        // UPDATED: Now includes both:
        // 1. Device-linked alarms from 'events' table
        // 2. Building-linked Modbus alarms from 'alerts' table

        const query = `
            SELECT c.id, c.name, c.description, c.image_filename, c.background_image, 
                   (
                       SELECT COUNT(DISTINCT uid) FROM (
                           SELECT d.device_id as uid
                           FROM devices d
                           JOIN floors f ON d.floor_id = f.id
                           JOIN buildings b2 ON f.building_id = b2.id
                           JOIN events e ON (e.device_id = d.device_id AND e.type = 'ALARM' AND e.resolved = 0)
                           WHERE b2.campus_id = c.id
                           UNION
                           SELECT a.element_id as uid
                           FROM alerts a
                           JOIN buildings b3 ON a.building_id = b3.id
                           WHERE a.status = 'ACTIVA' AND b3.campus_id = c.id
                       )
                   ) as alarm_count 
            FROM campuses c
        `;
        const stats = db.prepare(query).all();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// NEW: Get active alarms per building for campus view markers
app.get('/api/buildings/alarms', (req, res) => {
    try {
        const { campusId } = req.query;

        // Get all active alarms from alerts table (Modbus alarms)
        let query = `
            SELECT DISTINCT a.building_id, b.name as building_name, b.id
            FROM alerts a
            JOIN buildings b ON a.building_id = b.id
            WHERE a.status = 'ACTIVA'
        `;

        const params = [];
        if (campusId) {
            query += ' AND b.campus_id = ?';
            params.push(parseInt(campusId));
        }

        const alertAlarms = db.prepare(query).all(...params);

        // Get all active alarms from events table (device alarms)
        let eventQuery = `
            SELECT DISTINCT b.id as building_id, b.name as building_name, b.id
            FROM events e
            JOIN devices d ON e.device_id = d.device_id
            JOIN floors f ON d.floor_id = f.id
            JOIN buildings b ON f.building_id = b.id
            WHERE e.type = 'ALARM' AND e.resolved = 0
        `;

        const eventParams = [];
        if (campusId) {
            eventQuery += ' AND b.campus_id = ?';
            eventParams.push(parseInt(campusId));
        }

        const eventAlarms = db.prepare(eventQuery).all(...eventParams);

        // Merge and deduplicate by building_id
        const allAlarms = [...alertAlarms, ...eventAlarms];
        const uniqueAlarms = allAlarms.reduce((acc, alarm) => {
            if (!acc.find(a => a.building_id === alarm.building_id)) {
                acc.push(alarm);
            }
            return acc;
        }, []);

        res.json(uniqueAlarms);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/simulation/alarm', authenticateToken, (req, res) => {
    try {
        const { campusId } = req.query;
        let device;

        if (campusId) {
            device = db.prepare(`
                SELECT d.device_id, d.type, d.floor_id, f.building_id
                FROM devices d
                JOIN floors f ON d.floor_id = f.id
                JOIN buildings b ON f.building_id = b.id
                WHERE b.campus_id = ?
                ORDER BY RANDOM() LIMIT 1
            `).get(campusId);
        } else {
            device = db.prepare("SELECT d.device_id, d.type, d.floor_id, f.building_id FROM devices d JOIN floors f ON d.floor_id = f.id ORDER BY RANDOM() LIMIT 1").get();
        }

        if (!device) return res.status(404).json({ error: 'No devices found for this campus' });

        // 2. Insert ALERT (Active)
        const alertData = {
            elementId: device.device_id,
            type: device.type || 'detector',
            building_id: device.building_id,
            floor_id: device.floor_id,
            location: 'Ubicación Simulada',
            description: 'Simulacro de Incendio',
            status: 'ACTIVA',
            origin: 'SIMULACIÓN',
            started_at: new Date().toISOString(),
            ended_at: null
        };

        try {
            const stmtAlert = db.prepare(`
                INSERT INTO alerts (element_id, type, building_id, floor_id, location, description, status, origin, started_at, ended_at)
                VALUES (@elementId, @type, @building_id, @floor_id, @location, @description, @status, @origin, @started_at, @ended_at)
            `);
            const resAlert = stmtAlert.run(alertData);
            alertData.db_id = resAlert.lastInsertRowid;

            // Emit Alarm (Popup)
            io.emit('pci:alarm:on', alertData);
        } catch (e) {
            console.error('[Sim] Error creating alert:', e);
        }

        // 3. Insert EVENT (History)
        const stmt = db.prepare(`
            INSERT INTO events (device_id, type, message, value, origin, building_id, floor_id)
            VALUES (?, 'ALARM', 'Incidencia Simulada', ?, 'SIM', ?, ?)
        `);
        const info = stmt.run(device.device_id, JSON.stringify({ simulated: true }), device.building_id, device.floor_id);

        // 4. Emit Event (Log)
        io.emit('event:new', {
            id: info.lastInsertRowid,
            device_id: device.device_id,
            type: 'ALARM',
            message: 'Incidencia Simulada',
            timestamp: new Date(),
            origin: 'SIM',
            acknowledged: false,
            building_id: device.building_id,
            floor_id: device.floor_id
        });

        res.json({ success: true, device });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/simulation/resolve', authenticateToken, (req, res) => {
    try {
        // Resolve all active simulation alerts
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            UPDATE alerts 
            SET status = 'RESUELTA', ended_at = ? 
            WHERE status = 'ACTIVA' AND origin = 'SIMULACIÓN'
        `);
        const result = stmt.run(now);

        // Also mark events as resolved if they are ALARM and SIM
        db.prepare(`UPDATE events SET resolved = 1 WHERE type = 'ALARM' AND origin = 'SIM'`).run();

        // Broadcast to all clients to stop blinking/highlighting
        io.emit('pci:simulation:resolved');

        // We also emit pci:alarm:off for specifically known elementIds if needed, 
        // but simulation:resolved is a global "clear everything simulated" signal.

        console.log(`[Sim] Resolved ${result.changes} active alerts.`);
        res.json({ success: true, resolvedCount: result.changes });
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
app.get('/api/buildings', (req, res) => {
    try {
        const rows = db.prepare('SELECT id, name, campus_id, x, y, modbus_ip, modbus_port FROM buildings').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

// [NEW] Simulation Endpoints
app.post('/api/simulation/building/:id/alarm', authenticateToken, (req, res) => {
    try {
        const buildingId = req.params.id;
        console.log(`[Simulation] Triggering General Alarm for Building ID: ${buildingId}`);

        // 1. Get all floors and devices for this building
        const floors = db.prepare('SELECT id FROM floors WHERE building_id = ?').all(buildingId);

        if (floors.length === 0) {
            console.log(`[Simulation] No floors found for building ${buildingId}`);
            return res.status(200).json({
                success: true,
                count: 0,
                message: 'Este edificio no tiene plantas configuradas aún. Es una prueba visual.',
                warning: true
            });
        }

        const floorIds = floors.map(f => f.id);
        const devices = db.prepare(`SELECT * FROM devices WHERE floor_id IN (${floorIds.join(',')})`).all();

        if (devices.length === 0) {
            console.log(`[Simulation] No devices found for building ${buildingId}`);
            return res.status(200).json({
                success: true,
                count: 0,
                message: 'Este edificio no tiene dispositivos configurados aún. Es una prueba visual.',
                warning: true
            });
        }

        // 2. Create Alerts (Limit to avoid flooding if building is huge, or do all?)
        // Let's do all 'detectors' and 'pulsadors' primarily.
        const targets = devices.filter(d => ['detector', 'pulsador', 'sirena'].includes(d.type.toLowerCase()));

        if (targets.length === 0) {
            console.log(`[Simulation] No compatible devices for building ${buildingId}`);
            return res.status(200).json({
                success: true,
                count: 0,
                message: 'Este edificio no tiene dispositivos compatibles para alarma (detectores/pulsadores).',
                warning: true
            });
        }

        const now = new Date().toISOString();
        const alertsCreated = [];

        const insertAlert = db.prepare(`
            INSERT INTO alerts (element_id, type, building_id, floor_id, location, description, status, origin, started_at)
            VALUES (?, ?, ?, ?, ?, ?, 'ACTIVA', 'SIMULACIÓN', ?)
        `);

        const insertEvent = db.prepare(`
            INSERT INTO events (device_id, type, message, value, origin, building_id, floor_id)
            VALUES (?, 'ALARM', ?, ?, 'SIM', ?, ?)
        `);

        // Transaction for speed
        db.transaction(() => {
            targets.forEach(d => {
                // Check if already active? (Optional, but good practice)
                const existing = db.prepare("SELECT id FROM alerts WHERE element_id = ? AND status = 'ACTIVA'").get(d.device_id);
                if (!existing) {
                    // Insert into alerts table
                    const info = insertAlert.run(
                        d.device_id,
                        d.type,
                        buildingId,
                        d.floor_id,
                        d.location,
                        'Simulacro de Incendio General',
                        now
                    );

                    // Also insert into events table for dashboard/campus view
                    insertEvent.run(
                        d.device_id,
                        'Simulacro de Incendio General',
                        JSON.stringify({ building_id: buildingId, floor_id: d.floor_id, location: d.location }),
                        buildingId,
                        d.floor_id
                    );

                    alertsCreated.push({
                        id: info.lastInsertRowid,
                        device_id: d.device_id,
                        type: 'ALARM', // Event type for frontend
                        floor_id: d.floor_id,
                        building_id: buildingId,
                        message: 'Simulacro de Incendio General'
                    });
                }
            });
        })();

        // 3. Emit Socket Events
        alertsCreated.forEach(evt => {
            io.emit('event:new', {
                id: evt.id, // Alert ID as Event ID roughly
                device_id: evt.device_id,
                type: 'ALARM',
                message: 'Simulacro General',
                timestamp: new Date(),
                acknowledged: false,
                floor_id: evt.floor_id
            });

            // Also emit pci:alarm:on for map red circles
            io.emit('pci:alarm:on', {
                elementId: evt.device_id,
                type: 'detector', // Simplification
                location: 'Simulacro',
                timestamp: now
            });
        });

        res.json({ success: true, count: alertsCreated.length });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// [NEW] Stop Simulation for Specific Building
app.post('/api/simulation/building/:id/resolve', authenticateToken, (req, res) => {
    try {
        const buildingId = req.params.id;
        console.log(`[Simulation] Stopping simulation for Building ID: ${buildingId}`);

        // 1. Get all floors for this building
        const floors = db.prepare('SELECT id FROM floors WHERE building_id = ?').all(buildingId);

        if (floors.length === 0) {
            console.log(`[Simulation] No floors found for building ${buildingId}`);
            return res.json({
                success: true,
                resolvedCount: 0,
                message: 'Este edificio no tiene plantas configuradas.'
            });
        }

        const floorIds = floors.map(f => f.id);

        // 2. Get all devices for these floors
        const devices = db.prepare(`SELECT device_id FROM devices WHERE floor_id IN (${floorIds.join(',')})`).all();

        if (devices.length === 0) {
            console.log(`[Simulation] No devices found for building ${buildingId}`);
            return res.json({
                success: true,
                resolvedCount: 0,
                message: 'Este edificio no tiene dispositivos configurados.'
            });
        }

        const deviceIds = devices.map(d => d.device_id);

        // 3. Resolve alerts for these devices (only SIMULACIÓN origin)
        const now = new Date().toISOString();
        const placeholders = deviceIds.map(() => '?').join(',');

        const stmt = db.prepare(`
            UPDATE alerts 
            SET status = 'RESUELTA', ended_at = ? 
            WHERE element_id IN (${placeholders}) 
            AND status = 'ACTIVA' 
            AND origin = 'SIMULACIÓN'
        `);

        const result = stmt.run(now, ...deviceIds);

        // 4. Also mark events as resolved
        const eventStmt = db.prepare(`
            UPDATE events 
            SET resolved = 1 
            WHERE device_id IN (${placeholders}) 
            AND type = 'ALARM' 
            AND origin = 'SIMULACIÓN'
        `);
        eventStmt.run(...deviceIds);

        // 5. Emit socket events for each resolved device
        deviceIds.forEach(deviceId => {
            io.emit('pci:alarm:off', {
                elementId: deviceId,
                type: 'detector',
                status: 'RESUELTA',
                ended_at: now,
                building_id: buildingId
            });
        });

        console.log(`[Simulation] Resolved ${result.changes} alerts for building ${buildingId}`);
        res.json({ success: true, resolvedCount: result.changes });

    } catch (e) {
        console.error('[Simulation] Error stopping building simulation:', e);
        res.status(500).json({ error: e.message });
    }
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
