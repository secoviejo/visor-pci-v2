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

const server = http.createServer();
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'visor-pci-default-secret';

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

const app = createApp({
    db,
    jwtSecret: SECRET_KEY,
    io,
    notificationService,
    modbusService,
    connectivityService,
    startHardwareServices,
    stopHardwareServices,
    getHardwareStatus: () => isHardwareEnabled
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
        setupEventListeners();

        server.on('request', app);
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
