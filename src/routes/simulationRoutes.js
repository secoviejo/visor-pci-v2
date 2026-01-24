const express = require('express');

function initSimulationRoutes(dependencies) {
    const router = express.Router();
    const { db, authenticateToken, io, notificationService } = dependencies;

    // ============ RANDOM ALARM ============
    router.post('/alarm', authenticateToken, async (req, res) => {
        try {
            const { campusId } = req.query;
            let device;
            const randomFunc = (process.env.DB_CLIENT === 'mysql') ? 'RAND()' : 'RANDOM()';

            if (campusId) {
                device = await db.get(`
                    SELECT d.device_id, d.type, d.floor_id, f.building_id
                    FROM devices d JOIN floors f ON d.floor_id = f.id
                    JOIN buildings b ON f.building_id = b.id
                    WHERE b.campus_id = ? ORDER BY ${randomFunc} LIMIT 1
                `, [campusId]);
            } else {
                device = await db.get(`SELECT d.device_id, d.type, d.floor_id, f.building_id FROM devices d JOIN floors f ON d.floor_id = f.id ORDER BY ${randomFunc} LIMIT 1`);
            }

            if (!device) return res.status(404).json({ error: 'No devices found' });

            const alertData = {
                elementId: device.device_id, type: 'ALARM', building_id: device.building_id, floor_id: device.floor_id,
                location: 'Ubicación Simulada', description: 'Simulacro de Incendio', status: 'ACTIVA', origin: 'SIMULACIÓN',
                started_at: new Date().toISOString()
            };

            const resAlert = await db.run(`
                INSERT INTO alerts (element_id, type, building_id, floor_id, location, description, status, origin, started_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [alertData.elementId, alertData.type, alertData.building_id, alertData.floor_id, alertData.location, alertData.description, alertData.status, alertData.origin, alertData.started_at]);

            alertData.db_id = resAlert.lastInsertRowid;
            io.emit('pci:alarm:on', alertData);
            notificationService.notifyAlarm({ ...alertData, priority: 'NORMAL' }).catch(e => console.error(e));

            const info = await db.run(`INSERT INTO events (device_id, type, message, value, origin, building_id, floor_id) VALUES (?, 'ALARM', 'Incidencia Simulada', ?, 'SIM', ?, ?)`,
                [device.device_id, JSON.stringify({ simulated: true }), device.building_id, device.floor_id]);

            io.emit('event:new', {
                id: info.lastInsertRowid, device_id: device.device_id, type: 'ALARM', message: 'Incidencia Simulada', timestamp: new Date(), origin: 'SIM', building_id: device.building_id, floor_id: device.floor_id
            });

            res.json({ success: true, device });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============ RESOLVE ALL SIMULATIONS ============
    router.post('/resolve', authenticateToken, async (req, res) => {
        try {
            const now = new Date().toISOString();
            const result = await db.run("UPDATE alerts SET status = 'RESUELTA', ended_at = ? WHERE status = 'ACTIVA' AND (origin = 'SIM' OR origin = 'SIMULACIÓN')", [now]);
            await db.run("UPDATE events SET resolved = 1 WHERE type = 'ALARM' AND (origin = 'SIM' OR origin = 'SIMULACIÓN')");
            io.emit('pci:simulation:resolved');
            res.json({ success: true, resolvedCount: result.changes });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============ BUILDING ALARM ============
    router.post('/building/:id/alarm', authenticateToken, async (req, res) => {
        try {
            const buildingId = req.params.id;
            const floors = await db.query('SELECT id FROM floors WHERE building_id = ?', [buildingId]);
            if (floors.length === 0) return res.json({ success: true, count: 0, message: 'Sin plantas.' });

            const floorIds = floors.map(f => f.id);
            const devices = await db.query(`SELECT * FROM devices WHERE floor_id IN (${floorIds.join(',')})`);
            const targets = devices.filter(d => ['detector', 'pulsador', 'sirena'].includes(d.type.toLowerCase()));
            const now = new Date().toISOString();
            const alertsCreated = [];

            await db.exec('BEGIN');
            try {
                for (const d of targets) {
                    const existing = await db.get("SELECT id FROM alerts WHERE element_id = ? AND status = 'ACTIVA'", [d.device_id]);
                    if (!existing) {
                        const info = await db.run(`INSERT INTO alerts (element_id, type, building_id, floor_id, location, description, status, origin, started_at) VALUES (?, 'ALARM', ?, ?, ?, 'Simulacro General', 'ACTIVA', 'SIMULACIÓN', ?)`, [d.device_id, buildingId, d.floor_id, d.location, now]);
                        await db.run(`INSERT INTO events (device_id, type, message, value, origin, building_id, floor_id) VALUES (?, 'ALARM', 'Simulacro General', ?, 'SIM', ?, ?)`, [d.device_id, JSON.stringify({ b: buildingId, f: d.floor_id }), buildingId, d.floor_id]);
                        alertsCreated.push({ id: info.lastInsertRowid, device_id: d.device_id, floor_id: d.floor_id });
                    }
                }
                await db.exec('COMMIT');
            } catch (e) { await db.exec('ROLLBACK'); throw e; }

            alertsCreated.forEach(evt => {
                io.emit('event:new', { id: evt.id, device_id: evt.device_id, type: 'ALARM', timestamp: new Date(), floor_id: evt.floor_id });
                io.emit('pci:alarm:on', { elementId: evt.device_id, type: 'ALARM', buildingId, floorId: evt.floor_id, origin: 'SIMULACIÓN', started_at: now });
            });

            if (alertsCreated.length > 0) {
                notificationService.notifyAlarm({ element_id: alertsCreated[0].device_id, type: 'ALARM', building_id: buildingId, floor_id: alertsCreated[0].floor_id, origin: 'SIMULACIÓN', started_at: now });
            }
            res.json({ success: true, count: alertsCreated.length });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

module.exports = initSimulationRoutes;
