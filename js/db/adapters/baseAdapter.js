class BaseAdapter {
    constructor(config) {
        this.config = config;
    }

    async connect() {
        throw new Error('Method connect() not implemented');
    }

    async query(sql, params) {
        throw new Error('Method query() not implemented');
    }

    async get(sql, params) {
        throw new Error('Method get() not implemented');
    }

    async run(sql, params) {
        throw new Error('Method run() not implemented');
    }

    async exec(sql) {
        throw new Error('Method exec() not implemented');
    }
}

module.exports = BaseAdapter;
