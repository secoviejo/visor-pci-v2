const express = require('express');
const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');

function initAdminRoutes(dependencies) {
    const router = express.Router();
    const { db, authenticateToken, authorizeRole, modbusService, connectivityService } = dependencies;
    let simulatorProcess = null;

    // ============ SIMULATOR ============
    router.get('/simulator/status', authenticateToken, async (req, res) => {
        let isPortBusy = false;
        if (process.platform === 'win32') {
            try {
                const { execSync } = require('child_process');
                const output = execSync('netstat -ano | findstr :502').toString();
                isPortBusy = output.includes('LISTENING');
            } catch (e) { }
        }
        res.json({ running: !!simulatorProcess || isPortBusy, modbus: modbusService.getStatus() });
    });

    router.post('/simulator/start', authenticateToken, async (req, res) => {
        if (simulatorProcess) return res.json({ success: true });
        simulatorProcess = spawn('node', ['scripts/simulator_headless.js']);
        setTimeout(() => { modbusService.connectBuilding(0, '127.0.0.1', 502); }, 2000);
        res.json({ success: true });
    });

    router.post('/simulator/stop', authenticateToken, async (req, res) => {
        if (simulatorProcess) {
            if (process.platform === 'win32') spawn("taskkill", ["/pid", simulatorProcess.pid, '/f', '/t']);
            else simulatorProcess.kill();
            simulatorProcess = null;
        }
        modbusService.disconnect();
        res.json({ success: true });
    });

    // ============ HARDWARE ============
    router.get('/hardware/status', authenticateToken, authorizeRole(['admin']), (req, res) => {
        res.json({ enabled: dependencies.getHardwareStatus() });
    });

    router.post('/hardware/toggle', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            const { enabled } = req.body;
            if (enabled && !dependencies.getHardwareStatus()) await dependencies.startHardwareServices();
            else if (!enabled && dependencies.getHardwareStatus()) await dependencies.stopHardwareServices();
            res.json({ success: true, enabled: dependencies.getHardwareStatus() });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============ CONNECTIVITY ============
    router.get('/connectivity', async (req, res) => {
        try {
            const result = await connectivityService.checkAllBuildings(db);
            res.json(result);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

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
            await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hashedPassword, role || 'viewer']);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============ GATEWAYS ============
    router.get('/gateways', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            const gateways = await db.query('SELECT * FROM gateways');
            res.json(gateways);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/gateways', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            const { name, type, ip_address, port, config } = req.body;
            await db.run('INSERT INTO gateways (name, type, ip_address, port, config) VALUES (?, ?, ?, ?, ?)', [name, type, ip_address, port, JSON.stringify(config || {})]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============ DEBUG ============
    router.get('/debug-screenshot', async (req, res) => {
        try {
            const screenshotService = require('../services/screenshotService');
            if (!screenshotService.isAvailable) return res.send("Screenshot service unavailable");
            const buffer = await screenshotService.captureAlarm(1, 1, 1);
            if (buffer) res.type('image/jpeg').send(buffer);
            else res.status(500).send("Failed to capture");
        } catch (e) { res.status(500).send(e.message); }
    });

    return router;
}

module.exports = initAdminRoutes;
