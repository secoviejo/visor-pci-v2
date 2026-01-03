const Database = require('better-sqlite3');
const db = new Database('pci.db');

console.log('=== ANÁLISIS DE EDIFICIOS CON DISPOSITIVOS ===\n');

const buildingsWithDevices = db.prepare(`
    SELECT 
        b.id, 
        b.name, 
        COUNT(DISTINCT f.id) as floor_count,
        COUNT(d.id) as device_count
    FROM buildings b
    LEFT JOIN floors f ON f.building_id = b.id
    LEFT JOIN devices d ON d.floor_id = f.id
    WHERE EXISTS (
        SELECT 1 FROM floors WHERE building_id = b.id
    )
    GROUP BY b.id
    HAVING device_count > 0
    ORDER BY device_count DESC
`).all();

console.log('Edificios con dispositivos:');
console.table(buildingsWithDevices);

console.log('\n=== DETALLES EDIFICIO CIRCE (ID 82) ===');
const circe = db.prepare(`
    SELECT f.id, f.name, COUNT(d.id) as devices
    FROM floors f
    LEFT JOIN devices d ON d.floor_id = f.id
    WHERE f.building_id = 82
    GROUP BY f.id
`).all();
console.table(circe);

db.close();
