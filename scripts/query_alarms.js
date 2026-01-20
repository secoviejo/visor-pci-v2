const db = require('better-sqlite3')('pci.db');

console.log('=== TABLE SCHEMA ===');
const schema = db.prepare("PRAGMA table_info(alerts)").all();
console.log(schema);

console.log('\n=== ALERTS TABLE (ACTIVA) ===');
const alertsCount = db.prepare("SELECT COUNT(*) as count, origin FROM alerts WHERE status = 'ACTIVA' GROUP BY origin").all();
console.log(alertsCount);

console.log('\n=== EVENTS TABLE (UNRESOLVED ALARMS) ===');
const eventsCount = db.prepare("SELECT COUNT(*) as count, origin FROM events WHERE type = 'ALARM' AND resolved = 0 GROUP BY origin").all();
console.log(eventsCount);

console.log('\n=== DETAILED ALERTS (ACTIVA) ===');
const alerts = db.prepare("SELECT id, element_id, building_id, origin, started_at FROM alerts WHERE status = 'ACTIVA' ORDER BY started_at DESC").all();
alerts.forEach(a => console.log(`ID: ${a.id}, Element: ${a.element_id}, Building: ${a.building_id}, Origin: ${a.origin}`));

console.log('\n=== DETAILED EVENTS (UNRESOLVED ALARMS) ===');
const events = db.prepare("SELECT id, device_id, origin FROM events WHERE type = 'ALARM' AND resolved = 0 ORDER BY timestamp DESC LIMIT 10").all();
events.forEach(e => console.log(`ID: ${e.id}, Device: ${e.device_id}, Origin: ${e.origin}`));

db.close();
