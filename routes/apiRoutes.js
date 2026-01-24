const express = require('express');

function initApiRoutes(dependencies) {
    const router = express.Router();
    const { db, authenticateToken, authorizeRole, upload } = dependencies;

    // ============ CAMPUSES ============
    router.get('/campuses', async (req, res) => {
        try {
            const campuses = await db.query('SELECT * FROM campuses');
            res.json(campuses);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/campuses/:id', async (req, res) => {
        try {
            const campus = await db.get('SELECT * FROM campuses WHERE id = ?', [req.params.id]);
            if (campus) res.json(campus);
            else res.status(404).json({ error: 'Campus not found' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============ BUILDINGS ============
    router.get('/buildings', async (req, res) => {
        try {
            const { campusId } = req.query;
            let sql = 'SELECT id, name, campus_id, x, y, thumbnail, modbus_ip, modbus_port FROM buildings';
            const params = [];

            if (campusId) {
                sql += ' WHERE campus_id = ?';
                params.push(campusId);
            }

            const rows = await db.query(sql, params);
            res.json(rows);
        } catch (err) {
            console.error('[API] Error fetching buildings:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/buildings/:id', async (req, res) => {
        try {
            const row = await db.get("SELECT * FROM buildings WHERE id = ?", [req.params.id]);
            if (!row) return res.status(404).json({ error: "Building not found" });
            res.json(row);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ============ FLOORS ============
    router.get('/buildings/:id/floors', async (req, res) => {
        try {
            const rows = await db.query("SELECT * FROM floors WHERE building_id = ?", [req.params.id]);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ============ DEVICES ============
    router.get('/floors/:id/devices', async (req, res) => {
        try {
            const rows = await db.query("SELECT * FROM devices WHERE floor_id = ?", [req.params.id]);
            const mapped = rows.map(d => ({
                ...d,
                db_id: d.id,
                id: d.device_id,
                number: d.number,
                type: d.type,
                location: d.location,
                n: d.number,
                t: d.type,
                loc: d.location,
                x: d.x,
                y: d.y,
                floor_id: d.floor_id
            }));
            res.json(mapped);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ============ ALERTS ============
    router.get('/alerts/active', async (req, res) => {
        try {
            const { campusId } = req.query;
            let sql = `
                SELECT a.*, b.name as building_name, b.campus_id 
                FROM alerts a 
                JOIN buildings b ON a.building_id = b.id 
                WHERE a.status = 'ACTIVA'
            `;
            const params = [];
            if (campusId) {
                sql += ' AND b.campus_id = ?';
                params.push(campusId);
            }
            const rows = await db.query(sql, params);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = initApiRoutes;
