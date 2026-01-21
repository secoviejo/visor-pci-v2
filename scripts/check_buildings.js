const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkBuildings() {
    const config = {
        host: process.env.DB_HOST || 'visor_pci_mysql.unizar.es',
        port: parseInt(process.env.DB_PORT) || 1980,
        user: process.env.DB_USER || 'visor_pci',
        password: process.env.DB_PASSWORD || 'sO8s+vKbZ4D2VHLJCwBm',
        database: process.env.DB_NAME || 'visor_pci_db'
    };

    try {
        const connection = await mysql.createConnection(config);
        const [rows] = await connection.execute('SELECT id, name, thumbnail FROM buildings WHERE thumbnail IS NOT NULL LIMIT 10');
        console.table(rows);
        await connection.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkBuildings();
