const sqlite3 = require('better-sqlite3');
const { db: mysqlDb } = require('../database'); // This imports the MySQL adapter if configured, but we need manual control
const SqliteAdapter = require('../js/db/adapters/sqliteAdapter');
const MysqlAdapter = require('../js/db/adapters/mysqlAdapter');
const path = require('path');
const fs = require('fs');

// Remote MySQL Config
const MYSQL_CONFIG = {
    host: 'visor_pci_mysql.unizar.es',
    port: 1980,
    user: 'visor_pci',
    password: 'sO8s+vKbZ4D2VHLJCwBm',
    database: 'visor_pci_db'
};

// Local SQLite Path
const SQLITE_PATH = path.join(__dirname, '../pci.db');

async function migrate() {
    console.log('🚀 Starting Data Migration: SQLite -> Remote MySQL');

    if (!fs.existsSync(SQLITE_PATH)) {
        console.error('❌ SQLite database file not found at:', SQLITE_PATH);
        process.exit(1);
    }

    // 1. Initialize Adapters
    const localDb = new SqliteAdapter({ filename: SQLITE_PATH, verbose: null });
    const remoteDb = new MysqlAdapter(MYSQL_CONFIG);

    try {
        await localDb.connect();
        await remoteDb.connect();
        console.log('✅ Connected to both databases.');

        // 2. Initialize Schema on Remote (Create Tables)
        console.log('📦 Initializing Schema on Remote MySQL...');
        // We override the internal db client of database.js specifically for this script context if needed,
        // but here we just reuse the logic. ideally we import initDb but initDb uses the singleton `db`.
        // Let's manually run the DDLs that we know from database.js but adapted for MySQL if needed
        // OR better: we utilize the `initDb` logic by temporarily pointing the singleton to our remoteDb.
        // Actually, let's just use the remoteDb adapter to run the DDLs directly.

        // Disable Foreign Key Checks temporarily for bulk load
        await remoteDb.run('SET FOREIGN_KEY_CHECKS = 0');

        // Truncate tables (clear old data)
        const tables = ['events', 'alerts', 'devices', 'floors', 'buildings', 'campuses', 'users', 'notification_recipients', 'notification_log', 'notification_config', 'gateways'];
        for (const table of tables) {
            try {
                await remoteDb.run(`TRUNCATE TABLE ${table}`); // Reset auto_increment too
                console.log(`   - Cleared table: ${table}`);
            } catch (e) {
                // Ignore if table doesn't exist yet
            }
        }

        // Re-enable for schema creation (although not strictly needed if we just insert)
        // actually we need to create tables first if they don't exist.
        // Let's trust `server.js` or `database.js` has `initDb`.
        // Let's require the init logic. BUT `initDb` uses the `db` singleton.
        // Quick hack: We will instantiate the schema manually here or assume user ran `initDb` against MySQL?
        // Let's run the CREATE statements manually here to be safe and self-contained.

        await createSchema(remoteDb);

        // 3. Migrate Data
        console.log('🚚 Migrating Data...');

        // Order matters for Foreign Keys: Campuses -> Buildings -> Floors -> Devices

        await migrateTable(localDb, remoteDb, 'campuses', ['id', 'name', 'description', 'image_filename', 'background_image', 'offset_x', 'offset_y', 'scale']);
        await migrateTable(localDb, remoteDb, 'buildings', ['id', 'name', 'campus_id', 'x', 'y', 'modbus_ip', 'modbus_port']);
        await migrateTable(localDb, remoteDb, 'floors', ['id', 'name', 'image_filename', 'width', 'height', 'building_id']);
        await migrateTable(localDb, remoteDb, 'devices', ['id', 'floor_id', 'device_id', 'number', 'type', 'x', 'y', 'location']);
        await migrateTable(localDb, remoteDb, 'users', ['id', 'username', 'password_hash', 'role']);
        await migrateTable(localDb, remoteDb, 'gateways', ['id', 'name', 'type', 'ip_address', 'port', 'config']);
        await migrateTable(localDb, remoteDb, 'notification_config', ['id', 'email_enabled', 'sms_enabled', 'gmail_user', 'gmail_app_password', 'twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number', 'telegram_bot_token']);
        await migrateTable(localDb, remoteDb, 'notification_recipients', ['id', 'name', 'email', 'phone', 'enabled', 'notify_email', 'notify_sms', 'sms_critical_only', 'telegram_chat_id', 'notify_telegram']);

        // Enable checks
        await remoteDb.run('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✨ Migration Completed Successfully!');
        process.exit(0);

    } catch (e) {
        console.error('❌ Migration Failed:', e);
        process.exit(1);
    }
}

async function migrateTable(source, dest, tableName, columns) {
    console.log(`   > Migrating ${tableName}...`);
    const rows = await source.query(`SELECT * FROM ${tableName}`);

    if (rows.length === 0) {
        console.log(`     (No data in ${tableName})`);
        return;
    }

    const colNames = columns.join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders})`;

    let count = 0;
    for (const row of rows) {
        // Map row data to array matching columns
        const values = columns.map(c => row[c]);
        try {
            await dest.run(sql, values);
            count++;
        } catch (e) {
            console.error(`     Error inserting row ${row.id}:`, e.message);
        }
    }
    console.log(`     Parsed ${count}/${rows.length} rows.`);
}

async function createSchema(db) {
    // Copied from database.js but adapted if needed. 
    // Since we cleared tables, we assume they might exist or not.
    // 'IF NOT EXISTS' handles it.

    const AUTO_INC = 'AUTO_INCREMENT'; // We know we are on MySQL

    await db.exec(`CREATE TABLE IF NOT EXISTS campuses (id INTEGER PRIMARY KEY ${AUTO_INC}, name TEXT NOT NULL, description TEXT, image_filename TEXT, background_image TEXT, offset_x REAL DEFAULT 0, offset_y REAL DEFAULT 0, scale REAL DEFAULT 0.8)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS buildings (id INTEGER PRIMARY KEY ${AUTO_INC}, name TEXT NOT NULL, campus_id INTEGER DEFAULT 1, x REAL, y REAL, thumbnail TEXT, bacnet_ip TEXT, bacnet_port INTEGER, bacnet_device_id INTEGER, modbus_ip TEXT, modbus_port INTEGER, FOREIGN KEY(campus_id) REFERENCES campuses(id))`);
    await db.exec(`CREATE TABLE IF NOT EXISTS floors (id INTEGER PRIMARY KEY ${AUTO_INC}, name TEXT NOT NULL, image_filename TEXT NOT NULL, width INTEGER DEFAULT 0, height INTEGER DEFAULT 0, building_id INTEGER DEFAULT 1, FOREIGN KEY(building_id) REFERENCES buildings(id))`);
    await db.exec(`CREATE TABLE IF NOT EXISTS devices (id INTEGER PRIMARY KEY ${AUTO_INC}, floor_id INTEGER, device_id TEXT, number TEXT, type TEXT, x REAL, y REAL, location TEXT, FOREIGN KEY(floor_id) REFERENCES floors(id))`);
    await db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY ${AUTO_INC}, username VARCHAR(255) UNIQUE, password_hash TEXT, role TEXT DEFAULT 'viewer')`);
    await db.exec(`CREATE TABLE IF NOT EXISTS gateways (id INTEGER PRIMARY KEY ${AUTO_INC}, name TEXT NOT NULL, type TEXT NOT NULL, ip_address TEXT, port INTEGER, config TEXT)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY ${AUTO_INC}, device_id TEXT, type TEXT NOT NULL, message TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, acknowledged BOOLEAN DEFAULT 0, acknowledged_by TEXT, resolved BOOLEAN DEFAULT 0, building_id INTEGER, floor_id INTEGER, value TEXT, origin TEXT)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS notification_recipients (id INTEGER PRIMARY KEY ${AUTO_INC}, name TEXT NOT NULL, email TEXT, phone TEXT, enabled BOOLEAN DEFAULT 1, notify_email BOOLEAN DEFAULT 1, notify_sms BOOLEAN DEFAULT 0, notify_telegram BOOLEAN DEFAULT 0, telegram_chat_id TEXT, sms_critical_only BOOLEAN DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY ${AUTO_INC}, element_id TEXT, type TEXT, building_id INTEGER, floor_id INTEGER, location TEXT, description TEXT, status TEXT, origin TEXT, started_at TEXT, ended_at TEXT)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS notification_log (id INTEGER PRIMARY KEY ${AUTO_INC}, alarm_id INTEGER, recipient_id INTEGER, type TEXT, status TEXT, error_message TEXT, sent_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(recipient_id) REFERENCES notification_recipients(id))`);

    // Config table special case
    await db.exec(`CREATE TABLE IF NOT EXISTS notification_config (id INTEGER PRIMARY KEY DEFAULT 1, email_enabled BOOLEAN DEFAULT 1, sms_enabled BOOLEAN DEFAULT 1, gmail_user TEXT, gmail_app_password TEXT, twilio_account_sid TEXT, twilio_auth_token TEXT, twilio_phone_number TEXT, telegram_bot_token TEXT, CHECK (id = 1))`);
}

migrate();
