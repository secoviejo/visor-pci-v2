const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'pci.db');
const db = new Database(dbPath);

console.log("Checking notification_config:");
try {
    const configCols = db.pragma('table_info(notification_config)');
    console.log(configCols);
} catch (e) { console.error(e); }

console.log("\nChecking notification_recipients:");
try {
    const recipientCols = db.pragma('table_info(notification_recipients)');
    console.log(recipientCols);
} catch (e) { console.error(e); }

db.close();
