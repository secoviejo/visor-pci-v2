const express = require('express');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Middleware dependencies
let db, authenticateToken, authorizeRole, modbusService, bacnetService;
let isHardwareEnabled = false;

function initAdminRoutes(dependencies) {
    db = dependencies.db;
    authenticateToken = dependencies.authenticateToken;
    authorizeRole = dependencies.authorizeRole;
    modbusService = dependencies.modbusService;
    bacnetService = dependencies.bacnetService;
    return router;
}

// ============ USERS ============
router.get('/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const users = await db.query('SELECT id, username, role FROM users');
        res.json(users);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const info = await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hashedPassword, role || 'viewer']);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ HARDWARE ============
router.get('/hardware/status', authenticateToken, async (req, res) => {
    res.json({
        enabled: isHardwareEnabled,
        modbus: modbusService ? modbusService.getStatus() : null,
        bacnet: bacnetService ? bacnetService.getStatus() : null
    });
});

router.post('/hardware/toggle', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { enabled } = req.body;
        if (enabled && !isHardwareEnabled) {
            await startHardwareServices();
        } else if (!enabled && isHardwareEnabled) {
            await stopHardwareServices();
        }
        res.json({ success: true, enabled: isHardwareEnabled });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

async function startHardwareServices() {
    console.log('[Hardware] Starting all building connections...');
    if (db) {
        await modbusService.start(db);
        const BACNET_PORT = parseInt(process.env.BACNET_PORT || '47808');
        await bacnetService.start({ port: BACNET_PORT, interface: '0.0.0.0' }, db);
        isHardwareEnabled = true;
    }
}

async function stopHardwareServices() {
    console.log('[Hardware] Stopping all hardware services...');
    await modbusService.stop();
    await bacnetService.stop();
    isHardwareEnabled = false;
}

module.exports = initAdminRoutes;
