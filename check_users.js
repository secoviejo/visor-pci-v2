const Database = require('better-sqlite3');
const db = new Database('./pci.db');

const users = db.prepare('SELECT id, username, role FROM users').all();
console.log('Usuarios en la base de datos:');
console.table(users);

db.close();
