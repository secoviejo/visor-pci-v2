// Script para resolver manualmente las alarmas activas del SOLAE
const Database = require('better-sqlite3');
const db = new Database('./pci.db');

console.log('\n🔧 Resolviendo alarmas activas del SOLAE...\n');

// Buscar alarmas activas del SOLAE
const activeAlarms = db.prepare(`
    SELECT * FROM alerts 
    WHERE element_id LIKE 'CIE-H12-%' 
    AND status = 'ACTIVA'
`).all();

console.log(`📊 Alarmas activas encontradas: ${activeAlarms.length}\n`);

if (activeAlarms.length === 0) {
    console.log('✅ No hay alarmas activas del SOLAE para resolver\n');
    process.exit(0);
}

// Mostrar alarmas
activeAlarms.forEach(alarm => {
    console.log(`   🔴 ${alarm.element_id} - ${alarm.description}`);
    console.log(`      Iniciada: ${alarm.started_at}`);
    console.log(`      Edificio: ${alarm.building_id}`);
    console.log('');
});

// Resolver todas las alarmas
const now = new Date().toISOString();
const result = db.prepare(`
    UPDATE alerts 
    SET status = 'RESUELTA', ended_at = ? 
    WHERE element_id LIKE 'CIE-H12-%' 
    AND status = 'ACTIVA'
`).run(now);

console.log(`✅ ${result.changes} alarma(s) resuelta(s)\n`);

// Mostrar estado final
const remainingAlarms = db.prepare(`
    SELECT COUNT(*) as count FROM alerts 
    WHERE element_id LIKE 'CIE-H12-%' 
    AND status = 'ACTIVA'
`).get();

console.log(`📊 Alarmas activas restantes: ${remainingAlarms.count}\n`);

db.close();
