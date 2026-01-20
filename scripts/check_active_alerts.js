const { db, initDb } = require('./database');

async function checkAlerts() {
    await initDb();
    const unresolvedEvents = await db.query("SELECT id, device_id, type, message, resolved FROM events WHERE type = 'ALARM' AND resolved = 0");
    console.log('\n--- EVENTOS ALARMA NO RESUELTOS (Tabla events) ---');
    console.log(JSON.stringify(unresolvedEvents, null, 2));
    console.log('Total Eventos Unresolved:', unresolvedEvents.length);
    process.exit(0);
}

checkAlerts();
