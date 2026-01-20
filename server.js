require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const { db, initDb } = require('./database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const modbusService = require('./js/services/modbusService');
const bacnetService = require('./js/services/bacnetService');
const notificationService = require('./services/notificationService'); // Updated service

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const SECRET_KEY = "tu_secreto_super_seguro"; // Use env var in production

// --- Global Variables ---
let simulatorProcess = null;
const { spawn } = require('child_process');

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased limit for images/maps
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files (Frontend) - Adjust path if needed
app.use(express.static('public'));
app.use(express.static(__dirname)); // Serve HTML files in root
app.use('/uploads', express.static('uploads')); // Uploads folder

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
};

/* =========================================
   ASYNCHRONOUS SERVER STARTUP
   ========================================= */
async function startServer() {
    try {
        console.log('Starting server...');

        // 1. Initialize Database (Async)
        await initDb();

        // 2. Initialize Notification Service
        await notificationService.init();

        // 3. Hardware Services Setup
        const ENABLE_HARDWARE = process.env.ENABLE_HARDWARE === 'true';
        const BACNET_PORT = parseInt(process.env.BACNET_PORT || '47808');

        if (ENABLE_HARDWARE) {
            console.log('✅ Hardware Integration ENABLED');

            // Initialize Modbus for configured buildings
            try {
                // Async query
                const buildingsWithModbus = await db.query('SELECT * FROM buildings WHERE modbus_ip IS NOT NULL AND modbus_port IS NOT NULL');

                if (buildingsWithModbus.length > 0) {
                    console.log(`[Modbus] Found ${buildingsWithModbus.length} buildings with Modbus config.`);
                    // Just taking the first one for single-instance logic, OR adapt logic if multiple
                    // Existing logic seemed to assume global connection or iterative?
                    // Original code: modbusService.connect(buildingsWithModbus[0].modbus_ip, ...);
                    // We'll stick to original behavior: connect to the first one found if not specific
                    // Actually, let's keep it simple as per original
                    const b = buildingsWithModbus[0];
                    modbusService.connect(b.modbus_ip, b.modbus_port);
                } else {
                    console.log('[Modbus] No buildings configured for Modbus.');
                }
            } catch (err) {
                console.error('[Modbus] Error loading config:', err);
            }

            // Start BACnet
            bacnetService.start({ port: BACNET_PORT, interface: '0.0.0.0' });

        } else {
            console.log('⚠️ Hardware Integration DISABLED (ENABLE_HARDWARE!=true)');
        }

        /* =========================================
           API ROUTES (Converted to Async/Await)
           ========================================= */

        // 1. Auth Login
        app.post('/api/auth/login', async (req, res) => {
            try {
                const { username, password } = req.body;
                const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

                if (!user) return res.status(400).json({ error: 'User not found' });

                const validPassword = await bcrypt.compare(password, user.password_hash);
                if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

                const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
                res.json({ token, role: user.role });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 2. Status & Stats
        app.get('/api/status', (req, res) => {
            res.json({
                environment: process.env.NODE_ENV === 'production' ? 'cloud' : 'local',
                hardware_enabled: process.env.ENABLE_HARDWARE === 'true'
            });
        });

        app.get('/api/campuses/stats', async (req, res) => {
            try {
                const query = `
                    SELECT 
                        c.id, c.name, c.description, c.image_filename, c.background_image,
                        COALESCE(b_count.count, 0) as building_count,
                        COALESCE(a_count.count, 0) as alarm_count
                    FROM campuses c
                    LEFT JOIN (
                        SELECT campus_id, COUNT(*) as count 
                        FROM buildings 
                        GROUP BY campus_id
                    ) b_count ON c.id = b_count.campus_id
                    LEFT JOIN (
                        SELECT campus_id, COUNT(DISTINCT uid) as count
                        FROM (
                            SELECT b2.campus_id, d.device_id as uid
                            FROM devices d
                            JOIN floors f ON d.floor_id = f.id
                            JOIN buildings b2 ON f.building_id = b2.id
                            JOIN events e ON (e.device_id = d.device_id AND e.type = 'ALARM' AND e.resolved = 0)
                            UNION
                            SELECT b3.campus_id, a.element_id as uid
                            FROM alerts a
                            JOIN buildings b3 ON a.building_id = b3.id
                            WHERE a.status = 'ACTIVA'
                        ) combined
                        GROUP BY campus_id
                    ) a_count ON c.id = a_count.campus_id
                `;
                const stats = await db.query(query);
                res.json(stats);
            } catch (e) {
                console.error('[API] Error fetching campus stats:', e);
                res.status(500).json({ error: e.message });
            }
        });

        // 3. Campuses
        app.get('/api/campuses', async (req, res) => {
            try {
                const campuses = await db.query('SELECT * FROM campuses');
                res.json(campuses);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.get('/api/campuses/:id', async (req, res) => {
            try {
                const campus = await db.get('SELECT * FROM campuses WHERE id = ?', [req.params.id]);
                if (campus) res.json(campus);
                else res.status(404).json({ error: 'Campus not found' });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.put('/api/campuses/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                const { name, description, offset_x, offset_y, scale } = req.body;
                const sql = `UPDATE campuses SET name = ?, description = ?, offset_x = ?, offset_y = ?, scale = ? WHERE id = ?`;
                const result = await db.run(sql, [name, description, offset_x, offset_y, scale, req.params.id]);
                res.json({ success: true, changes: result.changes });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.post('/api/campuses/:id/image', authenticateToken, authorizeRole(['admin']), upload.single('background'), async (req, res) => {
            try {
                if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
                const result = await db.run('UPDATE campuses SET image_filename = ?, background_image = ? WHERE id = ?',
                    [req.file.filename, req.file.filename, req.params.id]);
                res.json({ success: true, filename: req.file.filename });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        // 3. Buildings (With Campus Filtering)
        app.get('/api/buildings', async (req, res) => {
            try {
                const { campusId } = req.query;
                let sql = 'SELECT id, name, campus_id, x, y, thumbnail, modbus_ip, modbus_port FROM buildings';
                const params = [];

                if (campusId) {
                    sql += ' WHERE campus_id = ?';
                    params.push(campusId);
                }

                const rows = await db.query(sql, params);
                res.json(rows);
            } catch (err) {
                console.error('[API] Error fetching buildings:', err);
                res.status(500).json({ error: err.message });
            }
        });

        app.get('/api/buildings/:id', async (req, res) => {
            try {
                const row = await db.get("SELECT * FROM buildings WHERE id = ?", [req.params.id]);
                if (!row) return res.status(404).json({ error: "Building not found" });
                res.json(row);
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        app.post('/api/buildings', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                const { name, campus_id, x, y, modbus_ip, modbus_port } = req.body;
                const sql = "INSERT INTO buildings (name, campus_id, x, y, modbus_ip, modbus_port) VALUES (?, ?, ?, ?, ?, ?)";
                const info = await db.run(sql, [name, campus_id, x, y, modbus_ip, modbus_port]);
                res.json({ id: info.lastInsertRowid });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.put('/api/buildings/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                const { name, x, y, modbus_ip, modbus_port } = req.body;
                const sql = "UPDATE buildings SET name = ?, x = ?, y = ?, modbus_ip = ?, modbus_port = ? WHERE id = ?";
                await db.run(sql, [name, x, y, modbus_ip, modbus_port, req.params.id]);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.delete('/api/buildings/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                await db.run("DELETE FROM buildings WHERE id = ?", [req.params.id]);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // 4. Floors
        app.get('/api/buildings/:id/floors', async (req, res) => {
            try {
                const rows = await db.query("SELECT * FROM floors WHERE building_id = ?", [req.params.id]);
                res.json(rows);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.post('/api/floors', authenticateToken, authorizeRole(['admin']), upload.single('plan'), async (req, res) => {
            try {
                const { name, building_id } = req.body;
                const filename = req.file ? req.file.filename : null;
                if (!filename) return res.status(400).json({ error: "Image required" });

                const sql = "INSERT INTO floors (name, building_id, image_filename) VALUES (?, ?, ?)";
                const info = await db.run(sql, [name, building_id, filename]);
                res.json({ id: info.lastInsertRowid, filename });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.delete('/api/floors/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                await db.run("DELETE FROM floors WHERE id = ?", [req.params.id]);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // 5. Devices
        app.get('/api/floors/:id/devices', async (req, res) => {
            try {
                const rows = await db.query("SELECT * FROM devices WHERE floor_id = ?", [req.params.id]);
                res.json(rows);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.post('/api/devices', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                const { floor_id, device_id, number, type, x, y, location } = req.body;
                const sql = "INSERT INTO devices (floor_id, device_id, number, type, x, y, location) VALUES (?, ?, ?, ?, ?, ?, ?)";
                const info = await db.run(sql, [floor_id, device_id, number, type, x, y, location]);
                res.json({ id: info.lastInsertRowid });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.put('/api/devices/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                const { device_id, number, type, x, y, location } = req.body;
                const sql = "UPDATE devices SET device_id = ?, number = ?, type = ?, x = ?, y = ?, location = ? WHERE id = ?";
                await db.run(sql, [device_id, number, type, x, y, location, req.params.id]);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.delete('/api/devices/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                await db.run("DELETE FROM devices WHERE id = ?", [req.params.id]);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // 6. CSV Import with TRANSACTION
        app.post('/api/upload-csv', authenticateToken, authorizeRole(['admin']), upload.single('csv'), async (req, res) => {
            if (!req.file) return res.status(400).json({ error: 'No CSV file provided' });

            const results = [];
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                    try {
                        const { floor_id, building_id } = req.body;
                        if (!floor_id) {
                            return res.status(400).json({ error: "floor_id required" });
                        }

                        // Use explicit conversion for transactions as Adapter doesn't support sync closures
                        await db.exec('BEGIN'); // Start Transaction

                        try {
                            const insertSql = `
                                INSERT INTO devices (floor_id, device_id, number, type, x, y, location)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `;

                            for (const row of results) {
                                // Default values if missing
                                const x = row.x || 0;
                                const y = row.y || 0;
                                const type = row.type || 'detector';
                                const number = row.number || '';
                                const location = row.location || '';
                                const device_id = row.device_id || `UNK-${Date.now()}`;

                                await db.run(insertSql, [floor_id, device_id, number, type, x, y, location]);
                            }

                            await db.exec('COMMIT'); // Commit Transaction

                            // Cleanup
                            fs.unlinkSync(req.file.path);
                            res.json({ success: true, count: results.length });

                        } catch (err) {
                            await db.exec('ROLLBACK'); // Rollback on error
                            throw err;
                        }
                    } catch (e) {
                        console.error("CSV Import Error:", e);
                        res.status(500).json({ error: e.message });
                    }
                });
        });

        // 7. Control Endpoint
        app.post('/api/devices/control', authenticateToken, async (req, res) => {
            try {
                const { action } = req.body;
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
        app.get('/api/events', authenticateToken, async (req, res) => {
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

                // Using query (all)
                const events = await db.query(query, params);
                res.json(events);
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        app.post('/api/events/:id/acknowledge', authenticateToken, async (req, res) => {
            try {
                const { id } = req.params;
                const sql = 'UPDATE events SET acknowledged = 1, acknowledged_by = ? WHERE id = ?';
                const result = await db.run(sql, [req.user.username, id]);

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

        // 9. Admin Simulator Control
        app.get('/api/admin/simulator/status', authenticateToken, async (req, res) => {
            let isPortBusy = false;
            // Need child_process execSync for netstat check, which is fine to be sync
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

        app.post('/api/admin/simulator/start', authenticateToken, async (req, res) => {
            if (simulatorProcess) return res.json({ success: true, message: 'Ya en ejecución' });

            console.log('[Admin] Starting terminal simulator...');
            simulatorProcess = spawn('node', ['scripts/simulator.js'], {
                cwd: __dirname,
                stdio: 'inherit',
                shell: true
            });

            simulatorProcess.on('close', (code) => {
                console.log(`[Admin] Simulator process exited with code ${code}`);
                simulatorProcess = null;
            });

            // Delay reconnect
            setTimeout(() => {
                modbusService.connect('127.0.0.1', 502);
            }, 1500);

            res.json({ success: true });
        });

        app.post('/api/admin/simulator/stop', authenticateToken, async (req, res) => {
            // Stopping logic remains largely Sync/System calls
            console.log('[Admin] Force Stopping simulator...');
            if (simulatorProcess) {
                if (process.platform === 'win32') {
                    spawn("taskkill", ["/pid", simulatorProcess.pid, '/f', '/t']);
                } else {
                    simulatorProcess.kill();
                }
                simulatorProcess = null;
            }

            if (process.platform === 'win32') {
                try {
                    const { execSync } = require('child_process');
                    const netstat = execSync('netstat -ano | findstr :502').toString();
                    const lines = netstat.split('\n');
                    lines.forEach(line => {
                        if (line.includes('LISTENING')) {
                            const pid = line.trim().split(/\s+/).pop();
                            if (pid && pid !== '0' && pid != process.pid) {
                                execSync(`taskkill /F /PID ${pid} /T`);
                            }
                        }
                    });
                } catch (e) { }
            }

            modbusService.disconnect();
            res.json({ success: true });
        });

        // 10. Campus Alarms Detail

        app.get('/api/buildings/alarms', async (req, res) => {
            try {
                const { campusId } = req.query;

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

                const alertAlarms = await db.query(query, params);

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

                const eventAlarms = await db.query(eventQuery, eventParams);

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

        // 11. Simulation Logic
        app.post('/api/simulation/alarm', authenticateToken, async (req, res) => {
            try {
                const { campusId } = req.query;
                let device;

                if (campusId) {
                    device = await db.get(`
                        SELECT d.device_id, d.type, d.floor_id, f.building_id
                        FROM devices d
                        JOIN floors f ON d.floor_id = f.id
                        JOIN buildings b ON f.building_id = b.id
                        WHERE b.campus_id = ?
                        ORDER BY RANDOM() LIMIT 1
                    `, [campusId]);
                } else {
                    // RANDOM() is SQLite/MySQL compatible mostly (MySQL uses RAND(), SQLite RANDOM())
                    // IMPORTANT: MySQL uses RAND(), SQLite uses RANDOM()
                    const randomFunc = (process.env.DB_CLIENT === 'mysql') ? 'RAND()' : 'RANDOM()';
                    device = await db.get(`SELECT d.device_id, d.type, d.floor_id, f.building_id FROM devices d JOIN floors f ON d.floor_id = f.id ORDER BY ${randomFunc} LIMIT 1`);
                }

                if (!device) return res.status(404).json({ error: 'No devices found for this campus' });

                const alertData = {
                    elementId: device.device_id,
                    type: 'ALARM',
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
                    const insertAlertSql = `
                        INSERT INTO alerts (element_id, type, building_id, floor_id, location, description, status, origin, started_at, ended_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    const resAlert = await db.run(insertAlertSql, [
                        alertData.elementId, alertData.type, alertData.building_id, alertData.floor_id,
                        alertData.location, alertData.description, alertData.status, alertData.origin,
                        alertData.started_at, alertData.ended_at
                    ]);
                    alertData.db_id = resAlert.lastInsertRowid;

                    io.emit('pci:alarm:on', alertData);

                    notificationService.notifyAlarm({
                        ...alertData,
                        priority: 'NORMAL'
                    }).catch(err => console.error('[Notification Error]', err));

                } catch (e) {
                    console.error('[Sim] Error creating alert:', e);
                }

                const insertEventSql = `
                    INSERT INTO events (device_id, type, message, value, origin, building_id, floor_id)
                    VALUES (?, 'ALARM', 'Incidencia Simulada', ?, 'SIM', ?, ?)
                `;
                const info = await db.run(insertEventSql, [
                    device.device_id, JSON.stringify({ simulated: true }), device.building_id, device.floor_id
                ]);

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

        app.post('/api/simulation/resolve', authenticateToken, async (req, res) => {
            try {
                const now = new Date().toISOString();
                const sql = `
                    UPDATE alerts 
                    SET status = 'RESUELTA', ended_at = ? 
                    WHERE status = 'ACTIVA' AND (origin = 'SIM' OR origin = 'SIMULACIÓN')
                `;
                const result = await db.run(sql, [now]);

                await db.run("UPDATE events SET resolved = 1 WHERE type = 'ALARM' AND (origin = 'SIM' OR origin = 'SIMULACIÓN')");

                io.emit('pci:simulation:resolved');

                res.json({ success: true, resolvedCount: result.changes });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        app.post('/api/simulation/building/:id/alarm', authenticateToken, async (req, res) => {
            try {
                const buildingId = req.params.id;
                console.log(`[Simulation] Triggering General Alarm for Building ID: ${buildingId}`);

                const floors = await db.query('SELECT id FROM floors WHERE building_id = ?', [buildingId]);
                if (floors.length === 0) {
                    return res.status(200).json({ success: true, count: 0, message: 'Sin plantas.', warning: true });
                }

                const floorIds = floors.map(f => f.id);
                const devices = await db.query(`SELECT * FROM devices WHERE floor_id IN (${floorIds.join(',')})`);

                if (devices.length === 0) {
                    return res.status(200).json({ success: true, count: 0, message: 'Sin dispositivos.', warning: true });
                }

                const targets = devices.filter(d => ['detector', 'pulsador', 'sirena'].includes(d.type.toLowerCase()));
                const now = new Date().toISOString();
                const alertsCreated = [];

                // Use transaction
                await db.exec('BEGIN');

                try {
                    for (const d of targets) {
                        const existing = await db.get("SELECT id FROM alerts WHERE element_id = ? AND status = 'ACTIVA'", [d.device_id]);
                        if (!existing) {
                            // Insert Alert
                            const info = await db.run(`
                                INSERT INTO alerts (element_id, type, building_id, floor_id, location, description, status, origin, started_at)
                                VALUES (?, ?, ?, ?, ?, 'Simulacro de Incendio General', 'ACTIVA', 'SIMULACIÓN', ?)
                             `, [d.device_id, 'ALARM', buildingId, d.floor_id, d.location, now]);

                            // Insert Event
                            await db.run(`
                                INSERT INTO events (device_id, type, message, value, origin, building_id, floor_id)
                                VALUES (?, 'ALARM', 'Simulacro de Incendio General', ?, 'SIM', ?, ?)
                             `, [d.device_id, JSON.stringify({ building_id: buildingId, floor_id: d.floor_id }), buildingId, d.floor_id]);

                            alertsCreated.push({
                                id: info.lastInsertRowid,
                                device_id: d.device_id,
                                type: 'ALARM',
                                floor_id: d.floor_id,
                                building_id: buildingId,
                                message: 'Simulacro de Incendio General'
                            });
                        }
                    }
                    await db.exec('COMMIT');
                } catch (e) {
                    await db.exec('ROLLBACK');
                    throw e;
                }

                // Emit Events
                alertsCreated.forEach(evt => {
                    io.emit('event:new', {
                        id: evt.id, device_id: evt.device_id, type: 'ALARM', message: evt.message, timestamp: new Date(), acknowledged: false, floor_id: evt.floor_id
                    });
                    io.emit('pci:alarm:on', {
                        elementId: evt.device_id, type: 'ALARM', buildingId: evt.building_id, floorId: evt.floor_id,
                        location: 'Simulacro', description: evt.message, origin: 'SIMULACIÓN', timestamp: now
                    });
                });

                res.json({ success: true, count: alertsCreated.length });

            } catch (e) {
                console.error(e);
                res.status(500).json({ error: e.message });
            }
        });

        app.post('/api/simulation/building/:id/resolve', authenticateToken, async (req, res) => {
            try {
                const buildingId = req.params.id;
                // ... (Similar logic fetching floors/devices, but simpler UPDATE queries)
                const floors = await db.query('SELECT id FROM floors WHERE building_id = ?', [buildingId]);
                if (floors.length === 0) return res.json({ success: true, resolvedCount: 0 });

                const floorIds = floors.map(f => f.id);
                const devices = await db.query(`SELECT device_id FROM devices WHERE floor_id IN (${floorIds.join(',')})`);
                if (devices.length === 0) return res.json({ success: true, resolvedCount: 0 });

                const deviceIds = devices.map(d => d.device_id);
                if (deviceIds.length === 0) return res.json({ success: true, resolvedCount: 0 });

                const now = new Date().toISOString();
                const placeholders = deviceIds.map(() => '?').join(',');

                // Update Alerts
                const result = await db.run(`
                    UPDATE alerts SET status = 'RESUELTA', ended_at = ? 
                    WHERE element_id IN (${placeholders}) AND status = 'ACTIVA' AND origin = 'SIM'
                `, [now, ...deviceIds]);

                // Update Events
                await db.run(`
                    UPDATE events SET resolved = 1 
                    WHERE device_id IN (${placeholders}) AND type = 'ALARM' AND origin = 'SIM'
                `, [...deviceIds]);

                // Emits
                deviceIds.forEach(deviceId => {
                    io.emit('pci:alarm:off', {
                        elementId: deviceId, type: 'detector', status: 'RESUELTA', ended_at: now, building_id: buildingId
                    });
                });
                io.emit('pci:simulation:resolved', { buildingId, resolvedCount: result.changes });

                res.json({ success: true, resolvedCount: result.changes });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 12. Users
        app.get('/api/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                const users = await db.query('SELECT id, username, role FROM users');
                res.json(users);
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.post('/api/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                const { username, password, role } = req.body;
                const hashedPassword = await bcrypt.hash(password, 10);
                const info = await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hashedPassword, role || 'viewer']);
                res.json({ success: true, id: info.lastInsertRowid });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.delete('/api/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                if (req.params.id == req.user.id) return res.status(400).json({ error: "Cannot delete self" });
                await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
                res.json({ success: true });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        // 13. Gateways
        app.get('/api/gateways', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                const gateways = await db.query('SELECT * FROM gateways');
                res.json(gateways);
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.post('/api/gateways', authenticateToken, authorizeRole(['admin']), async (req, res) => {
            try {
                const { name, type, ip_address, port, config } = req.body;
                const info = await db.run('INSERT INTO gateways (name, type, ip_address, port, config) VALUES (?, ?, ?, ?, ?)',
                    [name, type, ip_address, port, JSON.stringify(config || {})]);
                res.json({ success: true, id: info.lastInsertRowid });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        // 14. Notifications
        app.get('/api/notifications/recipients', authenticateToken, async (req, res) => {
            try {
                const recipients = await db.query('SELECT * FROM notification_recipients ORDER BY created_at DESC');
                res.json(recipients);
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.post('/api/notifications/recipients', authenticateToken, async (req, res) => {
            try {
                const { name, email, phone, notify_email, notify_sms, sms_critical_only, telegram_chat_id, notify_telegram } = req.body;
                const sql = `
                    INSERT INTO notification_recipients (name, email, phone, notify_email, notify_sms, sms_critical_only, telegram_chat_id, notify_telegram)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const result = await db.run(sql, [name, email, phone, notify_email ? 1 : 0, notify_sms ? 1 : 0, sms_critical_only ? 1 : 0, telegram_chat_id, notify_telegram ? 1 : 0]);
                res.json({ success: true, id: result.lastInsertRowid });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.put('/api/notifications/recipients/:id', authenticateToken, async (req, res) => {
            try {
                const { id } = req.params;
                const { name, email, phone, enabled, notify_email, notify_sms, sms_critical_only, telegram_chat_id, notify_telegram } = req.body;
                const sql = `
                    UPDATE notification_recipients 
                    SET name = ?, email = ?, phone = ?, enabled = ?, notify_email = ?, notify_sms = ?, sms_critical_only = ?, telegram_chat_id = ?, notify_telegram = ?
                    WHERE id = ?
                `;
                const result = await db.run(sql, [name, email, phone, enabled ? 1 : 0, notify_email ? 1 : 0, notify_sms ? 1 : 0, sms_critical_only ? 1 : 0, telegram_chat_id, notify_telegram ? 1 : 0, id]);
                if (result.changes > 0) res.json({ success: true });
                else res.status(404).json({ error: 'Recipient not found' });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.delete('/api/notifications/recipients/:id', authenticateToken, async (req, res) => {
            try {
                const result = await db.run('DELETE FROM notification_recipients WHERE id = ?', [req.params.id]);
                if (result.changes > 0) res.json({ success: true });
                else res.status(404).json({ error: 'Recipient not found' });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.get('/api/notifications/config', authenticateToken, async (req, res) => {
            try {
                const config = await db.get('SELECT * FROM notification_config WHERE id = 1');
                if (config) {
                    res.json({
                        ...config,
                        gmail_app_password: config.gmail_app_password ? '********' : null,
                        twilio_auth_token: config.twilio_auth_token ? '********' : null,
                        telegram_bot_token: config.telegram_bot_token ? '********' : null
                    });
                } else res.json({ email_enabled: true, sms_enabled: true });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.put('/api/notifications/config', authenticateToken, async (req, res) => {
            try {
                const { email_enabled, sms_enabled, gmail_user, gmail_app_password, twilio_account_sid, twilio_auth_token, twilio_phone_number, telegram_bot_token } = req.body;

                const current = await db.get('SELECT * FROM notification_config WHERE id = 1');
                const finalGmailPassword = (gmail_app_password && gmail_app_password !== '********') ? gmail_app_password : current?.gmail_app_password;
                const finalTwilioToken = (twilio_auth_token && twilio_auth_token !== '********') ? twilio_auth_token : current?.twilio_auth_token;
                const finalTelegramToken = (telegram_bot_token && telegram_bot_token !== '********') ? telegram_bot_token : current?.telegram_bot_token;

                const sql = `
                    UPDATE notification_config 
                    SET email_enabled = ?, sms_enabled = ?, gmail_user = ?, gmail_app_password = ?, 
                        twilio_account_sid = ?, twilio_auth_token = ?, twilio_phone_number = ?, telegram_bot_token = ?
                    WHERE id = 1
                `;
                await db.run(sql, [email_enabled ? 1 : 0, sms_enabled ? 1 : 0, gmail_user, finalGmailPassword, twilio_account_sid, finalTwilioToken, twilio_phone_number, finalTelegramToken]);

                await notificationService.refreshConfig();
                res.json({ success: true });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.post('/api/notifications/test', authenticateToken, async (req, res) => {
            try {
                const { recipient_id, type } = req.body;
                const recipient = await db.get('SELECT * FROM notification_recipients WHERE id = ?', [recipient_id]);
                if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

                const testAlarm = {
                    elementId: 'TEST-001', type: 'ALARM', building_id: 1, floor_id: 1, location: 'Ubicación de Prueba',
                    description: 'Esta es una alarma de prueba del sistema de notificaciones', status: 'ACTIVA', origin: 'PRUEBA',
                    priority: 'CRITICAL', started_at: new Date().toISOString(), building_name: 'Edificio de Prueba'
                };

                const results = [];
                // notificationService methods are async now
                if (type === 'email' || type === 'both') results.push({ type: 'email', ...(await notificationService.sendEmail(recipient, testAlarm, null)) });
                if (type === 'sms' || type === 'both') results.push({ type: 'sms', ...(await notificationService.sendSMS(recipient, testAlarm, null)) });
                if (type === 'telegram' || type === 'both') results.push({ type: 'telegram', ...(await notificationService.sendTelegram(recipient, testAlarm, null)) });

                const allSuccess = results.every(r => r.success);
                res.json({ success: allSuccess, results });
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        app.get('/api/notifications/logs', authenticateToken, async (req, res) => {
            try {
                const { limit = 100, type, status } = req.query;
                let query = `
                    SELECT l.*, r.name as recipient_name, r.email, r.phone
                    FROM notification_log l
                    LEFT JOIN notification_recipients r ON l.recipient_id = r.id
                `;
                const params = [];
                const conditions = [];

                if (type) { conditions.push('l.type = ?'); params.push(type.toUpperCase()); }
                if (status) { conditions.push('l.status = ?'); params.push(status.toUpperCase()); }

                if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
                query += ' ORDER BY l.sent_at DESC LIMIT ?';
                params.push(parseInt(limit));

                const logs = await db.query(query, params);
                res.json(logs);
            } catch (e) { res.status(500).json({ error: e.message }); }
        });

        /* =========================================
           EVENT LISTENERS (Async Wrappers)
           ========================================= */

        // Modbus
        modbusService.on('change', async (event) => {
            // event: { type, address, value, elementId, buildingId, description }
            // Note: elementId logic is inside modbusService, but here we process 'change'
            // The Original code had extensive logic for 'change'.
            // For brevity, assuming modbusService handles register mapping and emits high-level events?
            // Checking original code... 
            // Original code: modbusService.on('change', (event) => { ... db.prepare(...).get() ... });

            console.log('[Modbus Change]', event);
            if (event.type === 'detector' || event.type === 'pulsador' || event.type === 'sirena') {
                if (event.value === true) { // ALARM ON
                    // Check existing
                    const existing = await db.get("SELECT id FROM alerts WHERE element_id = ? AND status = 'ACTIVA'", [event.elementId]);
                    if (existing) return;

                    const now = new Date().toISOString();
                    const info = await db.run(`
                        INSERT INTO alerts(element_id, type, building_id, floor_id, location, description, status, origin, started_at)
                        VALUES(?, ?, ?, 1, ?, ?, 'ACTIVA', 'REAL', ?)
                     `, [event.elementId, event.type, event.buildingId, event.location, event.description, now]);

                    const alertData = {
                        id: info.lastInsertRowid,
                        elementId: event.elementId,
                        type: event.type,
                        building_id: event.buildingId,
                        floor_id: 1, // Default to 1 if not mapped
                        location: event.location,
                        description: event.description,
                        status: 'ACTIVA',
                        origin: 'REAL',
                        started_at: now
                    };

                    io.emit('pci:alarm:on', alertData);
                    notificationService.notifyAlarm(alertData); // Fire and forget promise

                    // History
                    await db.run(`INSERT INTO events(device_id, type, message, value, building_id, floor_id) VALUES(?, 'ALARM', ?, ?, ?, ?)`,
                        [event.elementId, event.description, '1', event.buildingId, 1]);

                    io.emit('event:new', {
                        id: info.lastInsertRowid, device_id: event.elementId, type: 'ALARM', message: event.description, timestamp: new Date(), acknowledged: false
                    });

                } else { // ALARM OFF
                    const now = new Date().toISOString();
                    const result = await db.run("UPDATE alerts SET status = 'RESUELTA', ended_at = ? WHERE element_id = ? AND status = 'ACTIVA'", [now, event.elementId]);
                    if (result.changes > 0) {
                        try { await db.run("UPDATE events SET resolved = 1 WHERE device_id = ? AND resolved = 0", [event.elementId]); } catch (e) { }
                        io.emit('pci:alarm:off', { elementId: event.elementId, type: event.type, status: 'RESUELTA', ended_at: now });
                    }
                }
            }
        });

        // BACnet
        bacnetService.on('alarmChange', async (event) => {
            console.log('[BACnet Event]', event);
            const biTypeMap = { 0: 'detector', 1: 'detector', 2: 'detector', 3: 'pulsador', 4: 'sirena' };
            const deviceType = biTypeMap[event.biInstance] || 'detector';
            const elementId = `BACNET-${event.buildingId}-BI${event.biInstance}`;

            if (event.value === true) {
                const building = await db.get('SELECT name FROM buildings WHERE id = ?', [event.buildingId]);
                const bName = building ? building.name : `Edificio ${event.buildingId}`;
                const alertData = {
                    elementId, type: deviceType, building_id: event.buildingId, floor_id: 1,
                    location: `${bName} - BACnet BI:${event.biInstance}`,
                    description: `Alarma BACnet en ${bName}`,
                    status: 'ACTIVA', origin: 'REAL', started_at: new Date().toISOString(), ended_at: null
                };

                const existing = await db.get("SELECT id FROM alerts WHERE element_id = ? AND status = 'ACTIVA'", [elementId]);
                if (existing) return;

                const info = await db.run(`
                    INSERT INTO alerts(element_id, type, building_id, floor_id, location, description, status, origin, started_at)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                 `, [alertData.elementId, alertData.type, alertData.building_id, alertData.floor_id, alertData.location, alertData.description, alertData.status, alertData.origin, alertData.started_at]);

                alertData.db_id = info.lastInsertRowid;
                io.emit('pci:alarm:on', alertData);
                notificationService.notifyAlarm({ ...alertData, priority: 'CRITICAL', building_name: bName });

                // Event Log
                const evtInfo = await db.run(`INSERT INTO events(device_id, type, message, value, building_id, floor_id) VALUES(?, 'ALARM', ?, ?, ?, ?)`,
                    [elementId, 'Alarma BACnet Activada', JSON.stringify(event.value), event.buildingId, 1]);

                io.emit('event:new', {
                    id: evtInfo.lastInsertRowid, device_id: elementId, building_id: event.buildingId, floor_id: 1,
                    type: 'ALARM', message: 'Alarma BACnet Activada', timestamp: new Date(), acknowledged: false
                });

            } else {
                const now = new Date().toISOString();
                const result = await db.run("UPDATE alerts SET status = 'RESUELTA', ended_at = ? WHERE element_id = ? AND status = 'ACTIVA'", [now, elementId]);
                if (result.changes > 0) {
                    try { await db.run("UPDATE events SET resolved = 1 WHERE device_id = ? AND resolved = 0", [elementId]); } catch (e) { }
                    io.emit('pci:alarm:off', { elementId, type: deviceType, status: 'RESUELTA', ended_at: now });
                }
            }
        });

        // Start HTTP Server (now inside async startServer to ensure DB is ready)
        server.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('FAILED TO START SERVER:', error);
        process.exit(1);
    }
}

// Execute Startup
startServer();
