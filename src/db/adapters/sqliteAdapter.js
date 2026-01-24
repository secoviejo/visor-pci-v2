const BaseAdapter = require('./baseAdapter');
const Database = require('better-sqlite3');
const path = require('path');

class SqliteAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.db = null;
        this.fullPath = config.filename || 'pci.db';
    }

    async connect() {
        try {
            this.db = new Database(this.fullPath, { verbose: this.config.verbose });
            console.log(`[SQLite] Connected to ${this.fullPath}`);
            return true;
        } catch (e) {
            console.error('[SQLite] Connection error:', e);
            throw e;
        }
    }

    // SQLite is sync, but we wrap in async to match MySQL interface
    async query(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            return stmt.all(params);
        } catch (e) {
            console.error(`[SQLite] Query Error: ${sql}`, e);
            throw e;
        }
    }

    async get(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            return stmt.get(params);
        } catch (e) {
            console.error(`[SQLite] Get Error: ${sql}`, e);
            throw e;
        }
    }

    async run(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            const info = stmt.run(params);
            return {
                insertId: info.lastInsertRowid,
                lastInsertRowid: info.lastInsertRowid, // Compatibility alias
                changes: info.changes
            };
        } catch (e) {
            console.error(`[SQLite] Run Error: ${sql}`, e);
            throw e;
        }
    }

    async exec(sql) {
        try {
            this.db.exec(sql);
            return true;
        } catch (e) {
            console.error(`[SQLite] Exec Error: ${sql}`, e);
            throw e;
        }
    }

    // Async transaction wrapper for compatibility with MySQL adapter
    async transaction(processingFn) {
        // processingFn should be an async function that performs multiple await db.run/query calls
        // In better-sqlite3, interactions are sync, but we want to enforce the async pattern
        const txn = this.db.transaction((data) => {
            // Since better-sqlite3 transactions must be synchronous, 
            // we have a conflict if we want to use "await" inside the transaction closure.
            // However, since this adapter wraps synchronous calls in async queries, 
            // inside a better-sqlite3 transaction we CANNOT await promises?
            // Actually, better-sqlite3 transactions block the event loop. 
            // If we use async/await inside, it breaks the transaction boundary.

            // CRITICAL FIX: For SQLite adaptation in an async-first world, 
            // we cannot easily wrap async logic in a better-sqlite3 transaction function.
            // We have to manage BEGIN/COMMIT/ROLLBACK manually like other DBs.
            throw new Error("Use manual Begin/Commit for async SQLite flows or refactor to sync if required.");
        });

        // REVISION: We will implement manual transaction control to allow async/await in consumer code.
        try {
            this.db.prepare('BEGIN').run();
            const result = await processingFn(this); // Pass context if needed
            this.db.prepare('COMMIT').run();
            return result;
        } catch (e) {
            this.db.prepare('ROLLBACK').run();
            throw e;
        }
    }
}

module.exports = SqliteAdapter;
