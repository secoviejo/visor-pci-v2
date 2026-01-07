const Database = require('better-sqlite3');
const db = new Database('pci.db');

console.log('[Update] Actualizando eventos CIE con building_id y floor_id...');

// Obtener todos los eventos CIE sin building_id
const events = db.prepare(`
    SELECT id, device_id 
    FROM events 
    WHERE device_id LIKE 'CIE-%' AND building_id IS NULL
`).all();

console.log(`[Update] Encontrados ${events.length} eventos CIE sin building_id`);

let updated = 0;

events.forEach(event => {
    // Extraer building_id del device_id: CIE-H12-{buildingId}-{port}
    const match = event.device_id.match(/CIE-H12-(\d+)-(\d+)/);

    if (match) {
        const buildingId = parseInt(match[1]);
        const port = parseInt(match[2]);

        // Actualizar el evento con building_id y floor_id (default 1)
        const stmt = db.prepare(`
            UPDATE events 
            SET building_id = ?, floor_id = 1 
            WHERE id = ?
        `);

        stmt.run(buildingId, event.id);
        updated++;

        console.log(`[Update] Evento ${event.id}: ${event.device_id} -> Building ${buildingId}`);
    }
});

console.log(`[Update] ✅ Actualizados ${updated} eventos`);
db.close();
