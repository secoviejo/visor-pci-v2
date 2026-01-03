const Database = require('better-sqlite3');
const db = new Database('./pci.db');

console.log('=== CLEANING OLD ALERTS AND EVENTS ===');

// Delete all alerts
const deletedAlerts = db.prepare("DELETE FROM alerts").run();
console.log(`✅ Deleted ${deletedAlerts.changes} alerts`);

// Delete all events
const deletedEvents = db.prepare("DELETE FROM events").run();
console.log(`✅ Deleted ${deletedEvents.changes} events`);

console.log('\n=== VERIFICATION ===');
const remainingAlerts = db.prepare("SELECT COUNT(*) as count FROM alerts").get();
const remainingEvents = db.prepare("SELECT COUNT(*) as count FROM events").get();

console.log(`Remaining alerts: ${remainingAlerts.count}`);
console.log(`Remaining events: ${remainingEvents.count}`);

console.log('\n✅ Database cleaned successfully!');

db.close();
