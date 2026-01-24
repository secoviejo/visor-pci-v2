const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');

function initApiRoutes(dependencies) {
    const router = express.Router();
    const { db, authenticateToken, authorizeRole, upload, modbusService, connectivityService } = dependencies;

    const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
    const toIntOrNull = (v) => {
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
    };

    // ============ CAMPUSES ============
    router.get('/campuses/stats', async (req, res) => {
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
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/campuses', async (req, res) => {
        try {
            const campuses = await db.query('SELECT * FROM campuses');
            res.json(campuses);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/campuses/:id', async (req, res) => {
        try {
            const campus = await db.get('SELECT * FROM campuses WHERE id = ?', [req.params.id]);
            if (campus) res.json(campus);
            else res.status(404).json({ error: 'Campus not found' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/campuses/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            const { name, description, offset_x, offset_y, scale } = req.body;
            const sql = `UPDATE campuses SET name = ?, description = ?, offset_x = ?, offset_y = ?, scale = ? WHERE id = ?`;
            await db.run(sql, [name, description, offset_x, offset_y, scale, req.params.id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/campuses/:id/image', authenticateToken, authorizeRole(['admin']), upload.single('background'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            await db.run('UPDATE campuses SET image_filename = ?, background_image = ? WHERE id = ?', [req.file.filename, req.file.filename, req.params.id]);
            res.json({ success: true, filename: req.file.filename });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============ BUILDINGS ============
    router.get('/buildings', async (req, res) => {
        try {
            const { campusId } = req.query;
            let sql = 'SELECT id, name, campus_id, x, y, thumbnail, modbus_ip, modbus_port FROM buildings';
            const params = [];
            if (campusId) { sql += ' WHERE campus_id = ?'; params.push(campusId); }
            const rows = await db.query(sql, params);
            res.json(rows);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/buildings/:id', async (req, res) => {
        try {
            const row = await db.get("SELECT * FROM buildings WHERE id = ?", [req.params.id]);
            if (!row) return res.status(404).json({ error: "Building not found" });
            res.json(row);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/buildings', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            const { name, campus_id, x, y, modbus_ip, modbus_port } = req.body;
            if (!isNonEmptyString(name)) return res.status(400).json({ error: 'Name is required' });
            const sql = "INSERT INTO buildings (name, campus_id, x, y, modbus_ip, modbus_port) VALUES (?, ?, ?, ?, ?, ?)";
            const info = await db.run(sql, [name, campus_id, x, y, modbus_ip, modbus_port]);
            res.json({ id: info.lastInsertRowid });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.put('/buildings/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            const { name, x, y, modbus_ip, modbus_port } = req.body;
            const updates = []; const values = [];
            if (name !== undefined) { updates.push('name = ?'); values.push(name); }
            if (x !== undefined) { updates.push('x = ?'); values.push(x); }
            if (y !== undefined) { updates.push('y = ?'); values.push(y); }
            if (modbus_ip !== undefined) { updates.push('modbus_ip = ?'); values.push(modbus_ip); }
            if (modbus_port !== undefined) { updates.push('modbus_port = ?'); values.push(modbus_port); }
            if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
            values.push(req.params.id);
            await db.run(`UPDATE buildings SET ${updates.join(', ')} WHERE id = ?`, values);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/buildings/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            await db.run("DELETE FROM buildings WHERE id = ?", [req.params.id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ============ FLOORS ============
    router.get('/buildings/:id/floors', async (req, res) => {
        try {
            const rows = await db.query("SELECT * FROM floors WHERE building_id = ?", [req.params.id]);
            res.json(rows);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/floors', authenticateToken, authorizeRole(['admin']), upload.single('plan'), async (req, res) => {
        try {
            const { name, building_id } = req.body;
            if (!isNonEmptyString(name)) return res.status(400).json({ error: 'Name is required' });
            const buildingIdNum = toIntOrNull(building_id);
            if (buildingIdNum === null) return res.status(400).json({ error: 'building_id must be a number' });
            const filename = req.file ? req.file.filename : null;
            if (!filename) return res.status(400).json({ error: "Image required" });
            const sql = "INSERT INTO floors (name, building_id, image_filename) VALUES (?, ?, ?)";
            const info = await db.run(sql, [name, building_id, filename]);
            res.json({ id: info.lastInsertRowid, filename });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/floors/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            await db.run("DELETE FROM floors WHERE id = ?", [req.params.id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ============ DEVICES ============
    router.get('/floors/:id/devices', async (req, res) => {
        try {
            const rows = await db.query("SELECT * FROM devices WHERE floor_id = ?", [req.params.id]);
            const mapped = rows.map(d => ({ ...d, db_id: d.id, id: d.device_id, n: d.number, t: d.type, loc: d.location }));
            res.json(mapped);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/buildings/:id/devices', async (req, res) => {
        try {
            const sql = `SELECT d.*, f.name as floor_name, f.building_id FROM devices d JOIN floors f ON d.floor_id = f.id WHERE f.building_id = ? ORDER BY f.id, d.id`;
            const rows = await db.query(sql, [req.params.id]);
            const mapped = rows.map(d => ({ db_id: d.id, id: d.device_id, n: d.number, t: d.type, x: d.x, y: d.y, loc: d.location, floor_id: d.floor_id, floor_name: d.floor_name, building_id: d.building_id }));
            res.json(mapped);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/devices', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            const { floor_id, device_id, id, number, n, type, t, x, y, location, loc } = req.body;
            const fid = floor_id || req.body.floorId;
            const floorIdNum = toIntOrNull(fid);
            if (floorIdNum === null) return res.status(400).json({ error: 'floor_id is required and must be numeric' });
            const did = device_id || id;
            const num = number || n;
            const tp = type || t;
            const lct = location || loc || '';
            const sql = "INSERT INTO devices (floor_id, device_id, number, type, x, y, location) VALUES (?, ?, ?, ?, ?, ?, ?)";
            const info = await db.run(sql, [floorIdNum, did, num, tp, x || 50, y || 50, lct]);
            res.json({ db_id: info.lastInsertRowid, id: info.lastInsertRowid });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.put('/devices/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            const updates = []; const values = [];
            const b = req.body;
            if (b.device_id !== undefined || b.id !== undefined) { updates.push('device_id = ?'); values.push(b.device_id || b.id); }
            if (b.number !== undefined || b.n !== undefined) { updates.push('number = ?'); values.push(b.number || b.n); }
            if (b.type !== undefined || b.t !== undefined) { updates.push('type = ?'); values.push(b.type || b.t); }
            if (b.location !== undefined || b.loc !== undefined) { updates.push('location = ?'); values.push(b.location || b.loc); }
            if (b.x !== undefined) { updates.push('x = ?'); values.push(b.x); }
            if (b.y !== undefined) { updates.push('y = ?'); values.push(b.y); }
            if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
            values.push(req.params.id);
            await db.run(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`, values);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/devices/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        try {
            await db.run("DELETE FROM devices WHERE id = ?", [req.params.id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ============ CSV UPLOAD ============
    router.post('/upload-csv', authenticateToken, authorizeRole(['admin']), upload.single('csv'), async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No CSV file provided' });
        const results = [];
        const rs = fs.createReadStream(req.file.path).pipe(csv());
        rs.on('data', (data) => results.push(data));
        rs.on('end', async () => {
            try {
                const { floor_id } = req.body;
                const floorIdNum = toIntOrNull(floor_id);
                if (floorIdNum === null) return res.status(400).json({ error: "floor_id required" });
                await db.exec('BEGIN');
                const insertSql = "INSERT INTO devices (floor_id, device_id, number, type, x, y, location) VALUES (?, ?, ?, ?, ?, ?, ?)";
                for (const row of results) {
                    await db.run(insertSql, [floorIdNum, row.id || row.device_id, row.n || row.number, row.t || row.type, row.x || 50, row.y || 50, row.loc || row.location || '']);
                }
                await db.exec('COMMIT');
                fs.unlinkSync(req.file.path);
                res.json({ success: true, count: results.length });
            } catch (err) {
                await db.exec('ROLLBACK');
                res.status(500).json({ error: err.message });
            }
        });
    });

    // ============ CONTROL ============
    router.post('/devices/control', authenticateToken, async (req, res) => {
        try {
            const { action } = req.body;
            if (action === 'activate') { await modbusService.writeOutput(0, true); res.json({ success: true, state: 'ON' }); }
            else if (action === 'deactivate') { await modbusService.writeOutput(0, false); res.json({ success: true, state: 'OFF' }); }
            else res.status(400).json({ error: 'Invalid action' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============ ALERTS ============
    router.get('/alerts/active', async (req, res) => {
        try {
            const { campusId } = req.query;
            let sql = `SELECT a.*, b.name as building_name, b.campus_id FROM alerts a JOIN buildings b ON a.building_id = b.id WHERE a.status = 'ACTIVA' ORDER BY a.started_at DESC`;
            const params = [];
            if (campusId) { sql = sql.replace('WHERE', 'WHERE b.campus_id = ? AND'); params.push(campusId); }
            const rows = await db.query(sql, params);
            res.json(rows);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ============ CONNECTIVITY ============
    router.get('/devices/connectivity', authenticateToken, authorizeRole(['admin', 'operator']), async (req, res) => {
        try {
            const result = await connectivityService.checkAllBuildings(db);
            res.json(result);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

module.exports = initApiRoutes;
