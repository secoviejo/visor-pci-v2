const Database = require('better-sqlite3');
const db = new Database('pci.db');

console.log('--- BUILDINGS ---');
console.log(db.prepare('SELECT * FROM buildings').all());

console.log('\n--- FLOORS ---');
console.log(db.prepare('SELECT id, name, building_id FROM floors').all());

console.log('\n--- DEVICE COUNT PER BUILDING ---');
const stats = db.prepare(`
    SELECT b.id, b.name, COUNT(d.id) as device_count
    FROM buildings b
    LEFT JOIN floors f ON f.building_id = b.id
    LEFT JOIN devices d ON d.floor_id = f.id
    GROUP BY b.id
`).all();
console.log(stats);
