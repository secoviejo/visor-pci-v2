const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'pci.db');
const db = new Database(dbPath);

function addColumn(table, column, type) {
    try {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
        console.log(`Added column ${column} to ${table}`);
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log(`Column ${column} already exists in ${table}`);
        } else {
            console.error(`Error adding column ${column} to ${table}:`, err.message);
        }
    }
}

console.log("Updating database schema for Telegram...");

// Add telegram_bot_token to notification_config
addColumn('notification_config', 'telegram_bot_token', 'TEXT');

// Add telegram_chat_id to notification_recipients
addColumn('notification_recipients', 'telegram_chat_id', 'TEXT');

// Add notify_telegram to notification_recipients
addColumn('notification_recipients', 'notify_telegram', 'BOOLEAN DEFAULT 0');

console.log("Database update complete.");
db.close();
