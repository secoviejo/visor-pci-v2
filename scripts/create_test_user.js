const db = require('better-sqlite3')('pci.db');
const bcrypt = require('bcryptjs');

const username = 'admin_test';
const password = 'admin';
const role = 'admin';

const hashedPassword = bcrypt.hashSync(password, 10);

try {
    const stmt = db.prepare('INSERT OR REPLACE INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    stmt.run(username, hashedPassword, role);
    console.log(`User ${username} created/updated successfully.`);
} catch (error) {
    console.error('Error creating user:', error);
}
