const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'pci.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('--- Starting Central Icon Migration ---');

try {
    const buildings = db.prepare('SELECT id, name FROM buildings').all();
    console.log(`Found ${buildings.length} buildings.`);

    const insertStmt = db.prepare(`
        INSERT INTO devices (floor_id, device_id, number, type, x, y, location)
        VALUES (@floorId, @deviceId, @number, @type, @x, @y, @location)
    `);

    let addedCount = 0;

    buildings.forEach(building => {
        console.log(`Processing building: ${building.name} (${building.id})`);

        // Find Ground Floor
        const floors = db.prepare('SELECT id, name FROM floors WHERE building_id = ?').all(building.id);

        // Strategy: Look for "PB", "Planta Baja", "Baja", "0", "P0" (case insensitive)
        let groundFloor = floors.find(f => {
            const n = f.name.toLowerCase().trim();
            return n === 'pb' || n === 'planta baja' || n === 'baja' || n === '0' || n === 'p0';
        });

        // Fallback: If no distinct ground floor, use the first one (lowest ID usually)
        if (!groundFloor && floors.length > 0) {
            console.warn(`  No explicit Ground Floor found for ${building.name}. Using first floor: ${floors[0].name}`);
            groundFloor = floors[0];
        }

        if (groundFloor) {
            // Check if central already exists
            const existing = db.prepare("SELECT id FROM devices WHERE floor_id = ? AND type = 'central'").get(groundFloor.id);

            if (!existing) {
                console.log(`  Adding Central to floor: ${groundFloor.name} (${groundFloor.id})`);

                try {
                    const result = insertStmt.run({
                        floorId: groundFloor.id,
                        deviceId: `CIE-${building.id}`,
                        number: 'CIE',
                        type: 'central',
                        x: 10,
                        y: 10,
                        location: `Central - ${building.name}`
                    });
                    console.log(`  -> Incorporated as Device ID ${result.lastInsertRowid}`);
                    addedCount++;
                } catch (err) {
                    console.error(`  Error inserting device: ${err.message}`);
                }
            } else {
                console.log(`  Central already exists on floor ${groundFloor.name}. Skipping.`);
            }
        } else {
            console.error(`  No floors found for building ${building.name}. Skipping.`);
        }
    });

    console.log(`--- Migration Complete. Added ${addedCount} central devices. ---`);

} catch (err) {
    console.error('Migration failed:', err);
} finally {
    db.close();
}
