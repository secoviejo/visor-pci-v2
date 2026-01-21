const { db, initDb } = require('../database');
const fs = require('fs');
const path = require('path');

async function checkCampusImages() {
    try {
        await initDb();
        console.log('✅ Database initialized');

        const campuses = await db.query('SELECT id, name, image_filename, background_image FROM campuses');

        console.log('\n📊 Campus Images Status:\n');
        console.log('='.repeat(80));

        for (const campus of campuses) {
            console.log(`\nCampus: ${campus.name} (ID: ${campus.id})`);
            console.log(`  image_filename: ${campus.image_filename || 'NULL'}`);
            console.log(`  background_image: ${campus.background_image || 'NULL'}`);

            // Check if files exist
            if (campus.image_filename) {
                const fullPath = path.join(__dirname, '..', campus.image_filename);
                const exists = fs.existsSync(fullPath);
                console.log(`  File exists: ${exists ? '✅' : '❌'} (${fullPath})`);
            }

            if (campus.background_image && campus.background_image !== campus.image_filename) {
                const fullPath = path.join(__dirname, '..', campus.background_image);
                const exists = fs.existsSync(fullPath);
                console.log(`  BG File exists: ${exists ? '✅' : '❌'} (${fullPath})`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('\n📁 Available images in img/campuses/:');
        const imgDir = path.join(__dirname, '..', 'img', 'campuses');
        if (fs.existsSync(imgDir)) {
            const files = fs.readdirSync(imgDir);
            files.forEach(file => console.log(`  - ${file}`));
        } else {
            console.log('  ❌ Directory does not exist!');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkCampusImages();
