const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
    const config = {
        host: process.env.DB_HOST || 'visor_pci_mysql.unizar.es',
        port: parseInt(process.env.DB_PORT) || 1980,
        user: process.env.DB_USER || 'visor_pci',
        password: process.env.DB_PASSWORD || 'sO8s+vKbZ4D2VHLJCwBm',
        database: process.env.DB_NAME || 'visor_pci_db'
    };

    console.log(`Checking MySQL: ${config.host}`);

    try {
        const connection = await mysql.createConnection(config);

        console.log('\n--- CAMPUSES ---');
        const [campuses] = await connection.execute('SELECT id, name, image_filename, background_image FROM campuses');
        console.table(campuses);

        console.log('\n--- BUILDINGS WITH THUMBNAILS ---');
        const [buildings] = await connection.execute('SELECT id, name, thumbnail FROM buildings WHERE thumbnail IS NOT NULL LIMIT 10');
        console.table(buildings);

        const [count] = await connection.execute('SELECT COUNT(*) as total FROM buildings WHERE thumbnail IS NOT NULL');
        console.log('Total buildings with thumbnails:', count[0].total);

        await connection.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkDatabase();
