const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');
const { Server } = require('socket.io');
const { db, initDb } = require('./src/db/database');
const { createApp } = require('./src/lib/appFactory');

// Services
const modbusService = require('./src/services/modbusService');
const bacnetService = require('./src/services/bacnetService');
const connectivityService = require('./src/services/connectivityService');
const notificationService = require('./src/services/notificationService');

// 1. Create a proxy for IO to solve circular dependency
const ioProxy = {
    emit: (...args) => {
        if (global.realIo) global.realIo.emit(...args);
    }
};

const PORT = process.env.PORT || 3000;
let SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
    SECRET_KEY = process.env.NODE_ENV === 'production' ? null : 'dev-temporary-secret';
    if (!SECRET_KEY) {
        console.error('[Server] JWT_SECRET is required in production');
        process.exit(1);
    }
}

let isHardwareEnabled = false;

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

// 2. Setup App
const app = createApp({
    db,
    jwtSecret: SECRET_KEY,
    io: ioProxy,
    notificationService,
    modbusService,
    connectivityService,
    startHardwareServices,
    stopHardwareServices,
    getHardwareStatus: () => isHardwareEnabled
});

// 3. Create Server with App as listener (Safe way)
const server = http.createServer(app);

// 4. Initialize Socket.IO on the server
global.realIo = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

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

                global.realIo.emit('pci:alarm:on', alertData);
                notificationService.notifyAlarm(alertData).catch(e => console.error('[Notify] Error:', e));

                await db.run(
                    `INSERT INTO events (device_id, type, message, value, building_id, floor_id) 
                     VALUES (?, 'ALARM', ?, '1', ?, ?)`,
                    [event.elementId, event.description, event.buildingId, 1]
                );

                global.realIo.emit('event:new', {
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
    });
}

// Startup Sequence
async function start() {
    try {
        setupEventListeners();

        console.log('[Server] Initializing database...');
        await initDb();
        console.log('[Server] Database initialized.');

        await notificationService.init();

        if (process.env.ENABLE_HARDWARE === 'true') {
            await startHardwareServices();
        }

        server.listen(PORT, () => {
            console.log(`🚀 Visor PCI Server ready at http://localhost:${PORT}`);
            console.log(`[Server] Mode: ${process.env.NODE_ENV || 'development'}`);
        });

    } catch (err) {
        console.error('❌ FAILED TO START SERVER:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

start();
