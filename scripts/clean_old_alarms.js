const Database = require('better-sqlite3');
const db = new Database('./pci.db');

console.log('\n🧹 Limpiando alarmas antiguas del sistema...\n');

// 1. Contar alarmas actuales
const activeAlerts = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE status = ?').get('ACTIVA');
const resolvedAlerts = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE status = ?').get('RESUELTA');

console.log('📊 Estado actual:');
console.log(`   Alarmas activas: ${activeAlerts.count}`);
console.log(`   Alarmas resueltas: ${resolvedAlerts.count}`);
console.log(`   Total: ${activeAlerts.count + resolvedAlerts.count}\n`);

// 2. Mostrar alarmas activas
const activeList = db.prepare('SELECT id, element_id, location, started_at FROM alerts WHERE status = ?').all('ACTIVA');
if (activeList.length > 0) {
    console.log('🔴 Alarmas activas:');
    activeList.forEach(a => {
        console.log(`   - ${a.element_id} | ${a.location} | ${a.started_at}`);
    });
    console.log('');
}

// 3. Resolver todas las alarmas activas
console.log('✅ Resolviendo todas las alarmas activas...\n');

const now = new Date().toISOString();
const result = db.prepare(`
    UPDATE alerts 
    SET status = 'RESUELTA', ended_at = ? 
    WHERE status = 'ACTIVA'
`).run(now);

console.log(`✅ ${result.changes} alarmas marcadas como resueltas\n`);

// 4. Limpiar eventos no resueltos
const eventsResult = db.prepare('UPDATE events SET resolved = 1 WHERE resolved = 0').run();
console.log(`✅ ${eventsResult.changes} eventos marcados como resueltos\n`);

// 5. Mostrar estado final
const finalActive = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE status = ?').get('ACTIVA');
const finalResolved = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE status = ?').get('RESUELTA');

console.log('📊 Estado final:');
console.log(`   Alarmas activas: ${finalActive.count}`);
console.log(`   Alarmas resueltas: ${finalResolved.count}`);
console.log(`   Total: ${finalActive.count + finalResolved.count}\n`);

console.log('🎯 Sistema limpio y listo para nuevas pruebas!\n');

db.close();
