const fs = require('fs');
const path = require('path');

const MIGRATION_TABLE = '_migrations';

class MigrationRunner {
    constructor(db) {
        this.db = db;
        // Determine DB type by checking constructor name or properties
        // SQLite adapter usually has 'open' property or we check process.env
        // But let's check the adapter class name or just try to detect
        this.isMysql = (db.constructor.name === 'MysqlAdapter');
    }

    async run() {
        console.log('[Migrations] Starting migration process...');

        // 1. Ensure Migrations Table Exists
        await this.createMigrationTable();

        // 2. Get Applied Migrations
        const applied = await this.getAppliedMigrations();
        const appliedNames = new Set(applied.map(m => m.name));

        // 3. Read Migration Files
        const migrationDir = path.join(__dirname, 'migrations');
        if (!fs.existsSync(migrationDir)) {
            console.log('[Migrations] No migrations directory found.');
            return;
        }

        const files = fs.readdirSync(migrationDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Ensure alphanumeric sort: 001, 002...

        // 4. Apply Pending Migrations
        for (const file of files) {
            if (!appliedNames.has(file)) {
                console.log(`[Migrations] Applying ${file}...`);
                await this.applyMigration(path.join(migrationDir, file), file);
            }
        }

        console.log('[Migrations] All migrations verified.');
    }

    async createMigrationTable() {
        const autoInc = this.isMysql ? 'AUTO_INCREMENT' : 'AUTOINCREMENT';
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
                id INTEGER PRIMARY KEY ${autoInc},
                name TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    async getAppliedMigrations() {
        try {
            return await this.db.query(`SELECT * FROM ${MIGRATION_TABLE} ORDER BY id ASC`);
        } catch (e) {
            return [];
        }
    }

    async applyMigration(filePath, fileName) {
        const sql = fs.readFileSync(filePath, 'utf8');

        // Handle Auto Increment differences
        const autoIncReplacement = this.isMysql ? 'AUTO_INCREMENT' : 'AUTOINCREMENT';
        let finalSql = sql.replace(/__AUTO_INC__/g, autoIncReplacement);

        // Handle INSERT IGNORE differences
        const insertIgnoreReplacement = this.isMysql ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
        finalSql = finalSql.replace(/__INSERT_IGNORE__/g, insertIgnoreReplacement);

        // Split by semicolon to run statements individually if needed.
        // However, many drivers support multiple statements or we should be careful.
        // SQLite exec supports multiple. MySQL depends on config (multipleStatements: true).
        // Let's try splitting to be safe and provide better error reporting per statement.

        const statements = finalSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        try {
            // Transaction start
            if (!this.isMysql) await this.db.exec('BEGIN TRANSACTION');

            for (const statement of statements) {
                await this.db.exec(statement);
            }

            // Record migration
            await this.db.run(`INSERT INTO ${MIGRATION_TABLE} (name) VALUES (?)`, [fileName]);

            if (!this.isMysql) await this.db.exec('COMMIT');
            console.log(`[Migrations] ✅ ${fileName} applied successfully.`);

        } catch (error) {
            if (!this.isMysql) await this.db.exec('ROLLBACK');
            console.error(`[Migrations] ❌ Failed to apply ${fileName}:`, error.message);
            throw error; // Stop migration process
        }
    }
}

module.exports = {
    run: async (db) => {
        const runner = new MigrationRunner(db);
        await runner.run();
    }
};
