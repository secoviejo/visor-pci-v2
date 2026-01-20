const mysql = require('mysql2/promise');

async function testConnection() {
    const config = {
        host: 'visor_pci_mysql.unizar.es',
        port: 1980,
        user: 'visor_pci',
        password: 'sO8s+vKbZ4D2VHLJCwBm',
        database: 'visor_pci_db',
        connectTimeout: 10000
    };

    console.log(`[MySQL] Connecting to ${config.host}:${config.port} as ${config.user}...`);

    try {
        const connection = await mysql.createConnection(config);
        console.log('✅ Connected successfully!');

        const [rows] = await connection.execute('SELECT 1 + 1 AS result');
        console.log('✅ Validation Query result:', rows[0].result);

        await connection.end();
        console.log('✅ Connection closed.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}

testConnection();
