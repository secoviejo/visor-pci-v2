const bcrypt = require('bcryptjs');
const db = require('./database');

async function createViewerUser() {
    const username = 'ver';
    const password = 'ver';
    const role = 'viewer';

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

    if (existing) {
        console.log(`❌ User '${username}' already exists. Deleting and recreating...`);
        db.prepare('DELETE FROM users WHERE username = ?').run(username);
    }

    // Insert user
    const stmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    const result = stmt.run(username, hashedPassword, role);

    console.log(`✅ Usuario creado exitosamente:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${role}`);
    console.log(`   ID: ${result.lastInsertRowid}`);
}

createViewerUser().catch(err => console.error('Error:', err));
