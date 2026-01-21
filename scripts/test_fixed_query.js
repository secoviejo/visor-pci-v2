const mysql = require('mysql2/promise');
require('dotenv').config();

async function testQuery() {
    const config = {
        host: process.env.DB_HOST || 'visor_pci_mysql.unizar.es',
        port: parseInt(process.env.DB_PORT) || 1980,
        user: process.env.DB_USER || 'visor_pci',
        password: process.env.DB_PASSWORD || 'sO8s+vKbZ4D2VHLJCwBm',
        database: process.env.DB_NAME || 'visor_pci_db'
    };

    try {
        const connection = await mysql.createConnection(config);

        console.log('Testing FIXED query...');
        const query = `
                SELECT 
                    c.id, c.name, c.description, c.image_filename, c.background_image, 
                    (SELECT COUNT(*) FROM buildings b WHERE b.campus_id = c.id) as building_count,
                    (
                        SELECT COUNT(DISTINCT uid) 
                        FROM (
                            SELECT d.device_id as uid, b2.campus_id
                            FROM devices d
                            JOIN floors f ON d.floor_id = f.id
                            JOIN buildings b2 ON f.building_id = b2.id
                            JOIN events e ON (e.device_id = d.device_id AND e.type = 'ALARM' AND e.resolved = 0)
                            UNION
                            SELECT a.element_id as uid, b3.campus_id
                            FROM alerts a
                            JOIN buildings b3 ON a.building_id = b3.id
                            WHERE a.status = 'ACTIVA'
                        ) AS combined_alarms
                        WHERE combined_alarms.campus_id = c.id
                    ) as alarm_count 
                FROM campuses c
        `;

        const [rows] = await connection.execute(query);
        console.log('Results:', rows.length);
        console.table(rows);

        await connection.end();
    } catch (err) {
        console.error('❌ Query Failed:', err.message);
    }
}

testQuery();
