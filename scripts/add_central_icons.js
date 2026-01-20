const { db, initDb } = require('./database');
const path = require('path');

async function runMigration() {
    console.log('--- Starting Central Icon Migration (Async) ---');

    try {
        await initDb(); // Ensure connected

        const buildings = await db.query('SELECT id, name FROM buildings');
        console.log(`Found ${buildings.length} buildings.`);

        let addedCount = 0;

        for (const building of buildings) {
            console.log(`Processing building: ${building.name} (${building.id})`);

            // Find Ground Floor
            const floors = await db.query('SELECT id, name FROM floors WHERE building_id = ?', [building.id]);

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
                const existing = await db.get("SELECT id FROM devices WHERE floor_id = ? AND type = 'central'", [groundFloor.id]);

                if (!existing) {
                    console.log(`  Adding Central to floor: ${groundFloor.name} (${groundFloor.id})`);

                    try {
                        const result = await db.run(`
                            INSERT INTO devices (floor_id, device_id, number, type, x, y, location)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [
                            groundFloor.id,
                            `CIE-${building.id}`,
                            'CIE',
                            'central',
                            10,
                            10,
                            `Central - ${building.name}`
                        ]);

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
        }

        console.log(`--- Migration Complete. Added ${addedCount} central devices. ---`);

    } catch (err) {
        console.error('Migration failed:', err);
    }
}

runMigration().then(() => {
    // Note: In typical Node scripts we might need to process.exit() 
    // but if it's part of a larger app or pool, we might just let it finish.
    // However, for standalone scripts, process.exit(0) is cleaner.
    process.exit(0);
});
