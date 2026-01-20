const db = require('./database');

console.log('--- Corrigiendo Base de Datos y Resolviendo Eventos ---');

try {
    // 1. Add 'origin' column to events table if it doesn't exist
    try {
        db.prepare("ALTER TABLE events ADD COLUMN origin TEXT").run();
        console.log('✅ Columna "origin" añadida a la tabla events.');
    } catch (e) {
        if (e.message.indexOf('duplicate column name') !== -1) {
            console.log('ℹ️ La columna "origin" ya existe en events.');
        } else {
            console.error('Error añadiendo columna:', e.message);
        }
    }

    // 2. Resolve all simulation events
    // We update 'resolved = 1' for all events that look like simulations
    const res = db.prepare("UPDATE events SET resolved = 1 WHERE message LIKE '%Simulada%' OR origin = 'SIM'").run();
    console.log(`✅ Eventos resueltos: ${res.changes}`);

    // 3. Just in case, resolve all active alerts
    const resAlerts = db.prepare("UPDATE alerts SET status = 'RESUELTA', ended_at = ? WHERE status = 'ACTIVA'").run(new Date().toISOString());
    console.log(`✅ Alertas resueltas en tabla alerts: ${resAlerts.changes}`);

} catch (e) {
    console.error('Error General:', e);
}
