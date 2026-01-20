require('dotenv').config();
const { db, initDb } = require('../database');

async function test() {
    try {
        await initDb();
        console.log('Testing MySQL-compatible query...');
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
        console.log('Stats length:', stats.length);
        console.log('Sample Stat:', stats[0]);
    } catch (e) {
        console.error('Error executing query:', e);
    } finally {
        process.exit();
    }
}

test();
