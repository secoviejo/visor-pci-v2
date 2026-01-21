const mysql = require('mysql2/promise');

async function checkCirceFloors() {
    const conn = await mysql.createConnection({
        host: 'visor_pci_mysql.unizar.es',
        user: 'visor_pci',
        password: 'sO8s+vKbZ4D2VHLJCwBm',
        database: 'visor_pci_db',
        port: 1980
    });

    const [floors] = await conn.execute(`
        SELECT f.id, f.name, f.image_filename, b.name as building 
        FROM floors f 
        JOIN buildings b ON f.building_id = b.id 
        WHERE b.name LIKE '%CIRCE%'
        LIMIT 5
    `);

    console.log('Plantas de CIRCE:');
    floors.forEach(f => {
        console.log(`  ID ${f.id}: ${f.name} -> ${f.image_filename}`);
    });

    await conn.end();
}

checkCirceFloors().catch(console.error);
