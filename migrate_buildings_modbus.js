const db = require('better-sqlite3')('pci.db');

try {
    console.log('Adding modbus_ip column...');
    db.prepare("ALTER TABLE buildings ADD COLUMN modbus_ip TEXT").run();
    console.log('✅ modbus_ip added.');
} catch (e) {
    console.log('ℹ️ modbus_ip likely exits.');
}

try {
    console.log('Adding modbus_port column...');
    db.prepare("ALTER TABLE buildings ADD COLUMN modbus_port INTEGER DEFAULT 502").run();
    console.log('✅ modbus_port added.');
} catch (e) {
    console.log('ℹ️ modbus_port likely exits.');
}

console.log('Migration complete.');
db.close();
