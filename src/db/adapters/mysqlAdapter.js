const BaseAdapter = require('./baseAdapter');
const mysql = require('mysql2/promise');

class MysqlAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.pool = null;
    }

    async connect() {
        try {
            this.pool = mysql.createPool({
                host: this.config.host,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                port: this.config.port || 3306,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                // Ensure dates are strings or JS dates manageable
                dateStrings: true
            });

            // Test connection
            const connection = await this.pool.getConnection();
            connection.release();
            console.log(`[MySQL] Connected to ${this.config.database} @ ${this.config.host}`);
            return true;
        } catch (e) {
            console.error('[MySQL] Connection error:', e);
            throw e;
        }
    }

    async query(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (e) {
            console.error(`[MySQL] Query Error: ${sql}`, e);
            throw e;
        }
    }

    async get(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows && rows.length > 0 ? rows[0] : undefined;
        } catch (e) {
            console.error(`[MySQL] Get Error: ${sql}`, e);
            throw e;
        }
    }

    async run(sql, params = []) {
        try {
            const [result] = await this.pool.execute(sql, params);
            return {
                insertId: result.insertId,
                lastInsertRowid: result.insertId, // Compatibility alias
                changes: result.affectedRows
            };
        } catch (e) {
            console.error(`[MySQL] Run Error: ${sql}`, e);
            throw e;
        }
    }

    async exec(sql) {
        try {
            // mysql2 execute handles simple queries too
            // For multiple statements (if allowed), query might be better
            await this.pool.query(sql);
            return true;
        } catch (e) {
            console.error(`[MySQL] Exec Error: ${sql}`, e);
            throw e;
        }
    }

    // Transaction support for MySQL
    async transaction(callback) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            // We need to pass a context that uses THIS connection
            // This is tricky if the app code expects a "transaction function" like better-sqlite3
            // For now, simpler approach: we might not support complex transactions in the adapter wrapper easily 
            // without changing calling code significantly.
            // ALTERNATIVE: Pass 'connection' to methods?

            // For MVP compatibility, we might throw or implement a basic version if we can refactor usage.
            // The usage in server.js is: const importTx = db.transaction(() => { ... });
            // SQLite returns a function that executes synchronously.
            // MySQL cannot replicate that exact sync behavior.
            // WE MUST REFACTOR server.js transaction usage to be async.

            await callback(connection);
            await connection.commit();
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
    }
}

module.exports = MysqlAdapter;
