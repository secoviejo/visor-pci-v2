const db = require('./database');
const unresolvedEvents = db.prepare("SELECT id, device_id, type, message, resolved FROM events WHERE type = 'ALARM' AND resolved = 0").all();
console.log('\n--- EVENTOS ALARMA NO RESUELTOS (Tabla events) ---');
console.log(JSON.stringify(unresolvedEvents, null, 2));
console.log('Total Eventos Unresolved:', unresolvedEvents.length);
