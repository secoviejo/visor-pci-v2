const path = require('path');

// Configuration
const DEFAULT_DB_CLIENT = process.env.DB_CLIENT || 'mysql';
const SQLITE_FILENAME = process.env.DB_FILENAME || path.join(__dirname, 'pci.db');

let db;
let mysqlError = null;

function createDb(client = DEFAULT_DB_CLIENT, config = {}) {
    if (client === 'mysql') {
        try {
            const MysqlAdapter = require('./js/db/adapters/mysqlAdapter');
            return new MysqlAdapter({
                host: config.host || process.env.DB_HOST || 'visor_pci_mysql.unizar.es',
                user: config.user || process.env.DB_USER || 'visor_pci',
                password: config.password || process.env.DB_PASSWORD,
                database: config.database || process.env.DB_NAME || 'visor_pci_db',
                port: parseInt(config.port || process.env.DB_PORT || '1980')
            });
        } catch (e) {
            console.error('[Database] CRITICAL: mysql2 dependency is missing!', e.message);
            mysqlError = e.message;
            return null;
        }
    }

    const SqliteAdapter = require('./js/db/adapters/sqliteAdapter');
    return new SqliteAdapter({
        filename: config.filename || SQLITE_FILENAME,
        verbose: config.verbose
    });
}

db = createDb();

// Initialize Schema
async function initDb(database = db, client = DEFAULT_DB_CLIENT) {
    console.log(`[Database] Initializing schema for ${client}...`);

    if (!database) {
        throw new Error('[Database] No database adapter available');
    }

    const isMysql = client === 'mysql';
    const AUTO_INC = isMysql ? 'AUTO_INCREMENT' : 'AUTOINCREMENT';

    await database.connect();

    // Buildings table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS buildings (
            id INTEGER PRIMARY KEY ${AUTO_INC},
            name TEXT NOT NULL,
            campus_id INTEGER DEFAULT 1,
            x REAL,
            y REAL,
            thumbnail TEXT,
            bacnet_ip TEXT,
            bacnet_port INTEGER,
            bacnet_device_id INTEGER,
            modbus_ip TEXT,
            modbus_port INTEGER,
            FOREIGN KEY(campus_id) REFERENCES campuses(id)
        )
    `);

    // Campuses table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS campuses (
            id INTEGER PRIMARY KEY ${AUTO_INC},
            name TEXT NOT NULL,
            description TEXT,
            image_filename TEXT,
            background_image TEXT,
            offset_x REAL DEFAULT 0,
            offset_y REAL DEFAULT 0,
            scale REAL DEFAULT 0.8
        )
    `);

    // Bootstrapping Default Campus (ID 1)
    const defaultCampus = await database.get('SELECT id FROM campuses WHERE id = 1');
    if (!defaultCampus) {
        console.log('Bootstrapping default campus (ID 1)...');
        await database.run("INSERT INTO campuses (id, name, description, image_filename, background_image) VALUES (1, 'Campus Default', 'Temp', 'placeholder.jpg', 'placeholder.jpg')");
    }

    // Floors table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS floors (
            id INTEGER PRIMARY KEY ${AUTO_INC},
            name TEXT NOT NULL,
            image_filename TEXT NOT NULL,
            width INTEGER DEFAULT 0,
            height INTEGER DEFAULT 0,
            building_id INTEGER DEFAULT 1,
            FOREIGN KEY(building_id) REFERENCES buildings(id)
        )
    `);

    // Devices table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY ${AUTO_INC},
            floor_id INTEGER,
            device_id TEXT, 
            number TEXT,    
            type TEXT,      
            x REAL,
            y REAL,
            location TEXT,
            FOREIGN KEY(floor_id) REFERENCES floors(id)
        )
    `);

    // Users table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY ${AUTO_INC},
            username VARCHAR(255) UNIQUE, 
            password_hash TEXT,
            role TEXT DEFAULT 'viewer'
        )
    `);
    // Note: MySQL requires VARCHAR for UNIQUE keys usually, simplified here.
    // Ideally we alter table if exists to ensure compatibility, but for now we assume fresh or compatible.

    // Gateways table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS gateways (
            id INTEGER PRIMARY KEY ${AUTO_INC},
            name TEXT NOT NULL,
            type TEXT NOT NULL, 
            ip_address TEXT,
            port INTEGER,
            config TEXT
        )
    `);

    // Events History table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY ${AUTO_INC},
            device_id TEXT, 
            type TEXT NOT NULL, 
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            acknowledged BOOLEAN DEFAULT 0,
            acknowledged_by TEXT,
            resolved BOOLEAN DEFAULT 0,
            building_id INTEGER,
            floor_id INTEGER,
            value TEXT,
            origin TEXT
        )
    `);

    // Notification Recipients table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS notification_recipients (
            id INTEGER PRIMARY KEY ${AUTO_INC},
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            enabled BOOLEAN DEFAULT 1,
            notify_email BOOLEAN DEFAULT 1,
            notify_sms BOOLEAN DEFAULT 0,
            notify_telegram BOOLEAN DEFAULT 0,
            telegram_chat_id TEXT,
            sms_critical_only BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Alerts Table (Active Alarms)
    await database.exec(`
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY ${AUTO_INC},
            element_id TEXT,
            type TEXT,
            building_id INTEGER,
            floor_id INTEGER,
            location TEXT,
            description TEXT,
            status TEXT, 
            origin TEXT, 
            started_at TEXT,
            ended_at TEXT
        )
    `);

    // Notification Configuration table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS notification_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            email_enabled BOOLEAN DEFAULT 1,
            sms_enabled BOOLEAN DEFAULT 1,
            gmail_user TEXT,
            gmail_app_password TEXT,
            twilio_account_sid TEXT,
            twilio_auth_token TEXT,
            twilio_phone_number TEXT,
            telegram_bot_token TEXT,
            CHECK (id = 1)
        )
    `);

    // Init Config Row
    const configExists = await database.get('SELECT id FROM notification_config WHERE id = 1');
    if (!configExists) {
        await database.run("INSERT INTO notification_config (id, email_enabled, sms_enabled) VALUES (1, 1, 1)");
    }

    // Notification Log table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS notification_log (
            id INTEGER PRIMARY KEY ${AUTO_INC},
            alarm_id INTEGER,
            recipient_id INTEGER,
            type TEXT, 
            status TEXT, 
            error_message TEXT,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(recipient_id) REFERENCES notification_recipients(id)
        )
    `);

    console.log('[Database] Schema initialized.');

    // Seeding (Optional: Check if empty)
    await seedData(database);
}

async function seedData(database = db) {
    // Basic Admin Seed
    try {
        const bcrypt = require('bcryptjs');
        const admindUser = await database.get("SELECT * FROM users WHERE username = 'admin'");
        if (!admindUser) {
            const hash = await bcrypt.hash('admin123', 10);
            await database.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['admin', hash, 'admin']);
            console.log('✅ Admin user reset: admin / admin123');
        }
    } catch (e) {
        console.warn('⚠️ Could not seed admin user:', e.message);
    }
}

// NOTE: We don't auto-execute initDb() anymore because it's async.
// The consumer (server.js) must call initDb().

module.exports = {
    db,
    initDb,
    createDb
};
