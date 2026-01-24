const express = require('express');

function initEventRoutes(dependencies) {
    const router = express.Router();
    const { db, authenticateToken, io } = dependencies;

    // ============ EVENTS API ============
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const { limit = 50, offset = 0, type, resolved, campusId } = req.query;

            let query = `
                SELECT e.*,
                    COALESCE(d.number, '') as device_number,
                    COALESCE(d.type, e.type) as device_type,
                    COALESCE(d.location, '') as device_location,
                    COALESCE(e_f.name, d_f.name) as floor_name,
                    COALESCE(e_b.name, d_b.name) as building_name,
                    COALESCE(e.building_id, d_b.id) as building_id,
                    COALESCE(e_b.campus_id, d_b.campus_id) as campus_id
                FROM events e
                LEFT JOIN devices d ON e.device_id = d.device_id
                LEFT JOIN floors d_f ON d.floor_id = d_f.id
                LEFT JOIN buildings d_b ON d_f.building_id = d_b.id
                LEFT JOIN buildings e_b ON e.building_id = e_b.id
                LEFT JOIN floors e_f ON e.floor_id = e_f.id
            `;

            const params = [];
            const conditions = [];

            if (type) { conditions.push('e.type = ?'); params.push(type); }
            if (resolved !== undefined) { conditions.push('e.resolved = ?'); params.push(resolved === 'true' ? 1 : 0); }
            if (campusId) { conditions.push('COALESCE(e_b.campus_id, d_b.campus_id) = ?'); params.push(parseInt(campusId)); }

            if (conditions.length > 0) { query += ' WHERE ' + conditions.join(' AND '); }

            query += ' ORDER BY e.timestamp DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const events = await db.query(query, params);
            res.json(events);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/:id/acknowledge', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const sql = 'UPDATE events SET acknowledged = 1, acknowledged_by = ? WHERE id = ?';
            const result = await db.run(sql, [req.user.username, id]);

            if (result.changes > 0) {
                io.emit('event:ack', { id, user: req.user.username });
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Evento no encontrado' });
            }
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

module.exports = initEventRoutes;
