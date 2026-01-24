const path = require('path');

// Configuration
const DEFAULT_DB_CLIENT = process.env.DB_CLIENT || 'mysql';
// Provide fallback to root pci.db if not specified
const SQLITE_FILENAME = process.env.DB_FILENAME || path.join(__dirname, '../../pci.db');

let db;
let mysqlError = null;

function createDb(client = DEFAULT_DB_CLIENT, config = {}) {
    if (client === 'mysql') {
        try {
            // Adapters are now in current directory/adapters or similar
            // We moved js/db/* to src/db/. So adapters should be in src/db/adapters
            const MysqlAdapter = require('./adapters/mysqlAdapter');
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

    const SqliteAdapter = require('./adapters/sqliteAdapter');
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

    await database.connect();

    // Run Migrations
    const migrationRunner = require('./migrationRunner');
    await migrationRunner.run(database);

    console.log('[Database] Schema initialized via migrations.');

    // Seeding (Optional: Check if empty)
    await seedData(database);
}

async function seedData(database = db) {
    // Basic Admin Seed
    try {
        const bcrypt = require('bcryptjs');
        // Check if admin exists
        const admindUser = await database.get("SELECT * FROM users WHERE username = 'admin'");
        if (!admindUser) {
            console.log('Seeding admin user...');
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
