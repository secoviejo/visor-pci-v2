const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const { db, initDb } = require('./database');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Services
const modbusService = require('./js/services/modbusService');
const bacnetService = require('./js/services/bacnetService');
const connectivityService = require('./js/services/connectivityService');
const notificationService = require('./services/notificationService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'visor-pci-default-secret';

let isHardwareEnabled = false;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Static Files
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const upload = multer({ dest: 'uploads/' });

// Auth Middlewares
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token missing' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

const authorizeRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Permission denied' });
    }
    next();
};

// Hardware Control Functions
async function startHardwareServices() {
    console.log('[Hardware] Starting services...');
    if (db) {
        await modbusService.start(db);
        const bacnetPort = parseInt(process.env.BACNET_PORT || '47808');
        await bacnetService.start({ port: bacnetPort, interface: '0.0.0.0' }, db);
        isHardwareEnabled = true;
    }
}

async function stopHardwareServices() {
    console.log('[Hardware] Stopping services...');
    await modbusService.stop();
    await bacnetService.stop();
    isHardwareEnabled = false;
}

// Route Definitions
async function registerRoutes() {
    console.log('[Server] Registering modular routes...');

    // Auth
    app.use('/api/auth', require('./routes/authRoutes')(db, SECRET_KEY));

    // Core API
    app.use('/api', require('./routes/apiRoutes')({
        db, authenticateToken, authorizeRole, upload, io, notificationService, modbusService
    }));

    // Events
    app.use('/api/events', require('./routes/eventRoutes')({ db, authenticateToken, io }));

    // Simulation
    app.use('/api/simulation', require('./routes/simulationRoutes')({ db, authenticateToken, io, notificationService }));

    // Admin
    app.use('/api/admin', require('./routes/adminRoutes')({
        db, authenticateToken, authorizeRole, modbusService, connectivityService,
        startHardwareServices, stopHardwareServices, getHardwareStatus: () => isHardwareEnabled
    }));

    // Notifications
    app.use('/api/notifications', require('./routes/notificationRoutes')({ db, authenticateToken, notificationService }));

    // Status
    app.get('/api/status', (req, res) => {
        res.json({
            environment: process.env.NODE_ENV || 'production',
            hardware_enabled: isHardwareEnabled,
            timestamp: new Date().toISOString()
        });
    });
}

// Event Listeners for Services
function setupEventListeners() {
    modbusService.on('change', async (event) => {
        console.log('[Service] Modbus Change Event:', event);
        if (event.value === true) {
            try {
                const now = new Date().toISOString();
                const info = await db.run(
                    `INSERT INTO alerts (element_id, type, building_id, location, description, status, origin, started_at) 
                     VALUES (?, ?, ?, ?, ?, 'ACTIVA', 'REAL', ?)`,
                    [event.elementId, event.type || 'detector', event.buildingId, event.location, event.description, now]
                );

                const alertData = {
                    id: info.lastInsertRowid,
                    ...event,
                    status: 'ACTIVA',
                    started_at: now
                };

                io.emit('pci:alarm:on', alertData);
                notificationService.notifyAlarm(alertData).catch(e => console.error('[Notify] Error:', e));

                await db.run(
                    `INSERT INTO events (device_id, type, message, value, building_id, floor_id) 
                     VALUES (?, 'ALARM', ?, '1', ?, ?)`,
                    [event.elementId, event.description, event.buildingId, 1]
                );

                io.emit('event:new', {
                    id: info.lastInsertRowid,
                    device_id: event.elementId,
                    type: 'ALARM',
                    message: event.description,
                    timestamp: new Date()
                });
            } catch (err) {
                console.error('[Service] Error handling Modbus event:', err);
            }
        }
    });

    bacnetService.on('alarmChange', async (event) => {
        console.log('[Service] BACnet Change Event:', event);
        // Implement similar logic if needed, but keeping it simple for now
    });
}

// Startup Sequence
async function start() {
    try {
        await registerRoutes();
        setupEventListeners();

        server.listen(PORT, () => {
            console.log(`🚀 Visor PCI Server ready at http://localhost:${PORT}`);
        });

        // Async Init
        console.log('[Server] Initializing database...');
        await initDb();

        await notificationService.init();

        if (process.env.ENABLE_HARDWARE === 'true') {
            await startHardwareServices();
        }

    } catch (err) {
        console.error('❌ FAILED TO START SERVER:', err);
        process.exit(1);
    }
}

start();
