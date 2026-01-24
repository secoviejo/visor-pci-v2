const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');

function createApp(options = {}) {
    const {
        db,
        jwtSecret,
        io,
        notificationService,
        modbusService,
        connectivityService,
        startHardwareServices,
        stopHardwareServices,
        getHardwareStatus,
        upload,
        enableStatic = true
    } = options;

    if (!db) {
        throw new Error('[App] Database adapter is required');
    }

    if (!jwtSecret) {
        throw new Error('[App] JWT secret is required');
    }

    const app = express();
    const socket = io || { emit: () => {} };

    const safeNotificationService = notificationService || {
        notifyAlarm: async () => {},
        refreshConfig: async () => {},
        sendEmail: async () => ({ success: true }),
        sendSMS: async () => ({ success: true }),
        sendTelegram: async () => ({ success: true })
    };

    const safeModbusService = modbusService || {
        getStatus: () => ({ connected: false }),
        writeOutput: async () => {},
        connectBuilding: () => {},
        disconnect: () => {}
    };

    const safeConnectivityService = connectivityService || {
        checkAllBuildings: async () => []
    };

    const safeStartHardware = startHardwareServices || (async () => {});
    const safeStopHardware = stopHardwareServices || (async () => {});
    const safeHardwareStatus = getHardwareStatus || (() => false);
    const uploadInstance = upload || multer({ dest: 'uploads/' });

    app.use(cors());
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

    if (enableStatic) {
        app.use('/css', express.static(path.join(__dirname, '..', 'css')));
        app.use('/js', express.static(path.join(__dirname, '..', 'js')));
        app.use('/img', express.static(path.join(__dirname, '..', 'public', 'img')));
        app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
        app.use(express.static(path.join(__dirname, '..', 'public')));
        app.use(express.static(path.join(__dirname, '..')));
    }

    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Token missing' });

        jwt.verify(token, jwtSecret, (err, user) => {
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

    app.use('/api/auth', require('../routes/authRoutes')(db, jwtSecret));
    app.use('/api', require('../routes/apiRoutes')({
        db,
        authenticateToken,
        authorizeRole,
        upload: uploadInstance,
        io: socket,
        notificationService: safeNotificationService,
        modbusService: safeModbusService
    }));
    app.use('/api/events', require('../routes/eventRoutes')({ db, authenticateToken, io: socket }));
    app.use('/api/simulation', require('../routes/simulationRoutes')({
        db,
        authenticateToken,
        io: socket,
        notificationService: safeNotificationService
    }));
    app.use('/api/admin', require('../routes/adminRoutes')({
        db,
        authenticateToken,
        authorizeRole,
        modbusService: safeModbusService,
        connectivityService: safeConnectivityService,
        startHardwareServices: safeStartHardware,
        stopHardwareServices: safeStopHardware,
        getHardwareStatus: safeHardwareStatus
    }));
    app.use('/api/notifications', require('../routes/notificationRoutes')({
        db,
        authenticateToken,
        notificationService: safeNotificationService
    }));

    app.get('/api/status', (req, res) => {
        res.json({
            environment: process.env.NODE_ENV || 'production',
            hardware_enabled: safeHardwareStatus(),
            timestamp: new Date().toISOString()
        });
    });

    return app;
}

module.exports = {
    createApp
};
