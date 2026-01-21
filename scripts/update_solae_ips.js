const mysql = require('mysql2/promise');

async function updateModbusIPs() {
    const conn = await mysql.createConnection({
        host: 'visor_pci_mysql.unizar.es',
        user: 'visor_pci',
        password: 'sO8s+vKbZ4D2VHLJCwBm',
        database: 'visor_pci_db',
        port: 1980
    });

    console.log('========================================');
    console.log('  ACTUALIZACIÓN DE IPs MODBUS SOLAE');
    console.log('========================================\n');

    const updates = [
        { id: 72, name: 'EDIFICIO CIRCE - NAVE 4', ip: '155.210.137.1', port: 502 },
        { id: 68, name: 'CEMINEM I', ip: '10.3.66.58', port: 502 },
        { id: 69, name: 'CEMINEM II', ip: '10.3.66.60', port: 502 }
    ];

    for (const building of updates) {
        console.log(`Actualizando ${building.name}...`);
        console.log(`  IP: ${building.ip}`);
        console.log(`  Puerto: ${building.port}`);

        await conn.execute(
            'UPDATE buildings SET modbus_ip = ?, modbus_port = ? WHERE id = ?',
            [building.ip, building.port, building.id]
        );

        console.log('  ✅ Actualizado\n');
    }

    console.log('========================================');
    console.log('Verificando configuración...\n');

    const [buildings] = await conn.execute(`
        SELECT id, name, modbus_ip, modbus_port
        FROM buildings 
        WHERE id IN (68, 69, 72)
        ORDER BY id
    `);

    buildings.forEach(b => {
        console.log(`${b.name}:`);
        console.log(`  Modbus IP: ${b.modbus_ip}`);
        console.log(`  Modbus Port: ${b.modbus_port}\n`);
    });

    await conn.end();
    console.log('✅ Configuración completada');
}

updateModbusIPs().catch(console.error);
