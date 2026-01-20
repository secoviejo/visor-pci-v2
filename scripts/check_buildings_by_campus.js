require('dotenv').config();
const { db, initDb } = require('../database');

async function checkBuildings() {
    try {
        await initDb();
        console.log('\n=== CHECKING BUILDINGS BY CAMPUS ===\n');

        // Get all campuses
        const campuses = await db.query('SELECT id, name FROM campuses ORDER BY id');

        for (const campus of campuses) {
            const buildings = await db.query(
                'SELECT id, name, campus_id FROM buildings WHERE campus_id = ? ORDER BY name',
                [campus.id]
            );

            console.log(`\n📍 ${campus.name} (ID: ${campus.id})`);
            console.log(`   Total buildings: ${buildings.length}`);

            if (buildings.length > 0) {
                console.log('   Buildings:');
                buildings.slice(0, 5).forEach(b => {
                    console.log(`   - ${b.name} (ID: ${b.id})`);
                });
                if (buildings.length > 5) {
                    console.log(`   ... and ${buildings.length - 5} more`);
                }
            }
        }

        // Check for buildings without campus
        const orphans = await db.query('SELECT id, name, campus_id FROM buildings WHERE campus_id IS NULL OR campus_id = 0');
        if (orphans.length > 0) {
            console.log(`\n⚠️  Buildings without valid campus: ${orphans.length}`);
            orphans.forEach(b => {
                console.log(`   - ${b.name} (ID: ${b.id}, campus_id: ${b.campus_id})`);
            });
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

checkBuildings();
