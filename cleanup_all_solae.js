// Script completo para resolver TODAS las alarmas y eventos del SOLAE
const Database = require('better-sqlite3');
const db = new Database('./pci.db');

console.log('\n🔍 VERIFICANDO ESTADO COMPLETO DEL SISTEMA\n');
console.log('='.repeat(60));

// 1. Verificar EVENTS
console.log('\n📊 TABLA EVENTS:');
const events = db.prepare(`
    SELECT id, device_id, type, resolved, timestamp, building_id
    FROM events 
    WHERE device_id LIKE 'CIE%' 
    ORDER BY timestamp DESC 
    LIMIT 10
`).all();

console.log(`Total de eventos CIE: ${events.length}\n`);
events.forEach(e => {
    const icon = e.resolved ? '✅' : '🔴';
    console.log(`${icon} ID ${e.id}: ${e.device_id} - ${e.type} - Resuelto: ${e.resolved} - ${e.timestamp}`);
});

// 2. Verificar ALERTS
console.log('\n📊 TABLA ALERTS:');
const alerts = db.prepare(`
    SELECT id, element_id, status, started_at, ended_at, building_id
    FROM alerts 
    WHERE element_id LIKE 'CIE%' 
    ORDER BY started_at DESC 
    LIMIT 10
`).all();

console.log(`Total de alertas CIE: ${alerts.length}\n`);
alerts.forEach(a => {
    const icon = a.status === 'ACTIVA' ? '🔴' : '✅';
    console.log(`${icon} ID ${a.id}: ${a.element_id} - ${a.status} - ${a.started_at}`);
});

// 3. Contar activos
const activeEvents = events.filter(e => !e.resolved).length;
const activeAlerts = alerts.filter(a => a.status === 'ACTIVA').length;

console.log('\n' + '='.repeat(60));
console.log(`\n📊 RESUMEN:`);
console.log(`   Eventos activos: ${activeEvents}`);
console.log(`   Alertas activas: ${activeAlerts}\n`);

// 4. Resolver TODO
if (activeEvents > 0 || activeAlerts > 0) {
    console.log('🔧 RESOLVIENDO TODO...\n');

    // Resolver eventos
    const eventsResult = db.prepare(`
        UPDATE events 
        SET resolved = 1 
        WHERE device_id LIKE 'CIE%' 
        AND resolved = 0
    `).run();
    console.log(`✅ ${eventsResult.changes} evento(s) resuelto(s)`);

    // Resolver alertas
    const now = new Date().toISOString();
    const alertsResult = db.prepare(`
        UPDATE alerts 
        SET status = 'RESUELTA', ended_at = ? 
        WHERE element_id LIKE 'CIE%' 
        AND status = 'ACTIVA'
    `).run(now);
    console.log(`✅ ${alertsResult.changes} alerta(s) resuelta(s)\n`);

    console.log('✅ TODAS LAS ALARMAS DEL SOLAE HAN SIDO RESUELTAS\n');
} else {
    console.log('✅ NO HAY ALARMAS ACTIVAS\n');
}

db.close();
