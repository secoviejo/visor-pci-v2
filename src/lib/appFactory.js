const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
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
    const socket = io || { emit: () => { } };

    const safeNotificationService = notificationService || {
        notifyAlarm: async () => { },
        refreshConfig: async () => { },
        sendEmail: async () => ({ success: true }),
        sendSMS: async () => ({ success: true }),
        sendTelegram: async () => ({ success: true })
    };

    const safeModbusService = modbusService || {
        getStatus: () => ({ connected: false }),
        writeOutput: async () => { },
        connectBuilding: () => { },
        disconnect: () => { }
    };

    const safeConnectivityService = connectivityService || {
        checkAllBuildings: async () => []
    };

    const safeStartHardware = startHardwareServices || (async () => { });
    const safeStopHardware = stopHardwareServices || (async () => { });
    const safeHardwareStatus = getHardwareStatus || (() => false);

    // Upload config
    const uploadsRoot = path.join(__dirname, '../../uploads');
    const maxUploadBytes = parseInt(process.env.UPLOAD_MAX_BYTES || `${10 * 1024 * 1024}`, 10); // default 10MB
    const storage = multer.diskStorage({
        destination: (_, __, cb) => cb(null, uploadsRoot),
        filename: (_, file, cb) => {
            const ext = path.extname(file.originalname) || '';
            const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'file';
            cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${base}${ext}`);
        }
    });
    const fileFilter = (_, file, cb) => {
        if (file.mimetype.startsWith('image/')) return cb(null, true);
        if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') return cb(null, true);
        return cb(new Error('Archivo no permitido'));
    };
    const uploadInstance = upload || multer({ storage, fileFilter, limits: { fileSize: maxUploadBytes } });

    // CORS configuration
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

    const corsOptions = allowedOrigins.length === 0 ? { origin: '*' } : {
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true
    };

    app.use(cors(corsOptions));
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

    // Rate limiting for APIs
    const apiLimiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
        limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        standardHeaders: true,
        legacyHeaders: false
    });
    app.use('/api', apiLimiter);

    if (enableStatic) {
        // Serve only explicit public assets and uploads to avoid exposing secrets
        const publicRoot = path.join(__dirname, '../../public');
        const uploadsRoot = path.join(__dirname, '../../uploads');

        app.use('/css', express.static(path.join(publicRoot, 'css')));
        app.use('/js', express.static(path.join(publicRoot, 'js')));
        app.use('/img', express.static(path.join(publicRoot, 'img')));
        app.use('/uploads', express.static(uploadsRoot));
        app.use(express.static(publicRoot));
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
        modbusService: safeModbusService,
        connectivityService: safeConnectivityService
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

    app.get('/healthz', async (req, res) => {
        try {
            await db.get('SELECT 1');
            res.json({ status: 'ok', db: 'up', hardware_enabled: safeHardwareStatus(), timestamp: new Date().toISOString() });
        } catch (e) {
            res.status(503).json({ status: 'degraded', db: 'down', error: e.message });
        }
    });

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
