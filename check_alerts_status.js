// Script para verificar el estado de las alarmas en la base de datos
const Database = require('better-sqlite3');
const db = new Database('./pci.db');

console.log('\n📊 Estado de las alarmas del SOLAE:\n');

// Buscar todas las alarmas del SOLAE
const alerts = db.prepare(`
    SELECT * FROM alerts 
    WHERE element_id LIKE 'CIE-H12-%' 
    ORDER BY started_at DESC 
    LIMIT 10
`).all();

console.log(`Total de alarmas encontradas: ${alerts.length}\n`);

alerts.forEach((alert, index) => {
    const icon = alert.status === 'ACTIVA' ? '🔴' : '✅';
    console.log(`${icon} Alarma ${index + 1}:`);
    console.log(`   ID: ${alert.id}`);
    console.log(`   Element ID: ${alert.element_id}`);
    console.log(`   Estado: ${alert.status}`);
    console.log(`   Iniciada: ${alert.started_at}`);
    console.log(`   Finalizada: ${alert.ended_at || 'N/A'}`);
    console.log(`   Edificio: ${alert.building_id}`);
    console.log('');
});

// Contar alarmas activas
const activeCount = db.prepare(`
    SELECT COUNT(*) as count FROM alerts 
    WHERE element_id LIKE 'CIE-H12-%' 
    AND status = 'ACTIVA'
`).get();

console.log(`\n📊 Resumen: ${activeCount.count} alarma(s) activa(s)\n`);

db.close();
