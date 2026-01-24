const jwt = require('jsonwebtoken');
const { createApp } = require('../../lib/appFactory');
const SqliteAdapter = require('../../js/db/adapters/sqliteAdapter');
const { initDb } = require('../../database');

const JWT_SECRET = 'test-secret-key';

async function createTestApp(options = {}) {
    const db = new SqliteAdapter({ filename: ':memory:' });
    await initDb(db, 'sqlite');

    const io = { emit: jest.fn() };
    const notificationService = {
        notifyAlarm: jest.fn().mockResolvedValue(),
        refreshConfig: jest.fn().mockResolvedValue(),
        sendEmail: jest.fn().mockResolvedValue({ success: true }),
        sendSMS: jest.fn().mockResolvedValue({ success: true }),
        sendTelegram: jest.fn().mockResolvedValue({ success: true })
    };
    const modbusService = {
        getStatus: jest.fn().mockReturnValue({ connected: false }),
        writeOutput: jest.fn().mockResolvedValue(),
        connectBuilding: jest.fn(),
        disconnect: jest.fn()
    };
    const connectivityService = { checkAllBuildings: jest.fn().mockResolvedValue([]) };

    const app = createApp({
        db,
        jwtSecret: JWT_SECRET,
        io,
        notificationService,
        modbusService,
        connectivityService,
        startHardwareServices: jest.fn().mockResolvedValue(),
        stopHardwareServices: jest.fn().mockResolvedValue(),
        getHardwareStatus: () => options.hardwareEnabled || false,
        enableStatic: false
    });

    return { app, db, io, notificationService, modbusService };
}

function buildAuthHeader(role = 'admin') {
    const token = jwt.sign({ id: 1, username: 'tester', role }, JWT_SECRET, { expiresIn: '1h' });
    return `Bearer ${token}`;
}

module.exports = {
    createTestApp,
    buildAuthHeader,
    JWT_SECRET
};
