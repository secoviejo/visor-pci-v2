const mysql = require('mysql2/promise');

async function checkDeviceStructure() {
    const conn = await mysql.createConnection({
        host: 'visor_pci_mysql.unizar.es',
        user: 'visor_pci',
        password: 'sO8s+vKbZ4D2VHLJCwBm',
        database: 'visor_pci_db',
        port: 1980
    });

    console.log('Estructura de la tabla devices:');
    const [columns] = await conn.execute('DESCRIBE devices');
    columns.forEach(col => console.log(`  ${col.Field} (${col.Type})`));

    console.log('\nPrimer dispositivo:');
    const [rows] = await conn.execute('SELECT * FROM devices LIMIT 1');
    if (rows.length > 0) {
        console.log(JSON.stringify(rows[0], null, 2));
    }

    await conn.end();
}

checkDeviceStructure().catch(console.error);
