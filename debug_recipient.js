const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'pci.db');
const db = new Database(dbPath);

const email = 'secoviejo@gmail.com';

try {
    const row = db.prepare("SELECT * FROM notification_recipients WHERE email = ?").get(email);
    if (row) {
        console.log("Recipient Details:");
        console.log(row);
    } else {
        console.log("Recipient not found.");
    }
} catch (error) {
    console.error("Error:", error);
}

