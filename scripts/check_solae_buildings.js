const mysql = require('mysql2/promise');

async function checkBuildings() {
    const conn = await mysql.createConnection({
        host: 'visor_pci_mysql.unizar.es',
        user: 'visor_pci',
        password: 'sO8s+vKbZ4D2VHLJCwBm',
        database: 'visor_pci_db',
        port: 1980
    });

    console.log('Buscando edificios NAVE 4, CEMINEM 1 y CEMINEM 2...\n');

    const [buildings] = await conn.execute(`
        SELECT id, name, modbus_ip, modbus_port, campus_id
        FROM buildings 
        WHERE name LIKE '%NAVE%' OR name LIKE '%CEMINEM%'
        ORDER BY name
    `);

    if (buildings.length > 0) {
        console.log('Edificios encontrados:');
        buildings.forEach(b => {
            console.log(`  ID ${b.id}: ${b.name}`);
            console.log(`    Modbus IP: ${b.modbus_ip || 'NO CONFIGURADA'}`);
            console.log(`    Modbus Port: ${b.modbus_port || 'NO CONFIGURADO'}`);
            console.log(`    Campus ID: ${b.campus_id}`);
            console.log('');
        });
    } else {
        console.log('No se encontraron edificios con esos nombres.');
    }

    await conn.end();
}

checkBuildings().catch(console.error);
