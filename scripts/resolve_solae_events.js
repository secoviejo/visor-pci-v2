// Script para verificar eventos activos en la tabla events
const Database = require('better-sqlite3');
const db = new Database('./pci.db');

console.log('\n📊 Eventos activos del SOLAE en la tabla events:\n');

const events = db.prepare(`
    SELECT * FROM events 
    WHERE device_id LIKE 'CIE-H12-%' 
    AND resolved = 0 
    ORDER BY timestamp DESC 
    LIMIT 10
`).all();

console.log(`Total de eventos activos: ${events.length}\n`);

events.forEach((event, index) => {
    console.log(`🔴 Evento ${index + 1}:`);
    console.log(`   ID: ${event.id}`);
    console.log(`   Device ID: ${event.device_id}`);
    console.log(`   Tipo: ${event.type}`);
    console.log(`   Mensaje: ${event.message}`);
    console.log(`   Timestamp: ${event.timestamp}`);
    console.log(`   Resuelto: ${event.resolved}`);
    console.log(`   Edificio: ${event.building_id}`);
    console.log('');
});

// Ahora vamos a resolverlos
if (events.length > 0) {
    console.log('\n🔧 Resolviendo eventos...\n');

    const result = db.prepare(`
        UPDATE events 
        SET resolved = 1 
        WHERE device_id LIKE 'CIE-H12-%' 
        AND resolved = 0
    `).run();

    console.log(`✅ ${result.changes} evento(s) resuelto(s)\n`);
}

db.close();
