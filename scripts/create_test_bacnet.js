// Script to create TEST_BACNET building
const db = require('../database');

// Check if TEST_BACNET already exists
const existing = db.prepare("SELECT id FROM buildings WHERE name = 'TEST_BACNET'").get();

if (existing) {
    console.log('TEST_BACNET building already exists with ID:', existing.id);
    // Update BACnet config
    db.prepare(`
        UPDATE buildings 
        SET bacnet_ip = '127.0.0.1', bacnet_port = 47809, bacnet_device_id = 40001 
        WHERE id = ?
    `).run(existing.id);
    console.log('Updated BACnet configuration.');
} else {
    const result = db.prepare(`
        INSERT INTO buildings (name, campus_id, bacnet_ip, bacnet_port, bacnet_device_id) 
        VALUES ('TEST_BACNET', 1, '127.0.0.1', 47809, 40001)
    `).run();
    console.log('Created TEST_BACNET building with ID:', result.lastInsertRowid);
}

// List all BACnet buildings
const bacnetBuildings = db.prepare('SELECT id, name, bacnet_ip, bacnet_port, bacnet_device_id FROM buildings WHERE bacnet_ip IS NOT NULL').all();
console.log('Buildings with BACnet config:', bacnetBuildings);

process.exit(0);
