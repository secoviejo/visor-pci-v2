const { db, initDb } = require('../database');

async function fixCampusImagePaths() {
    try {
        await initDb();
        console.log('✅ Database initialized');

        // Get all campuses
        const campuses = await db.query('SELECT id, name, image_filename, background_image FROM campuses');

        console.log(`\n📊 Found ${campuses.length} campuses\n`);
        console.log('='.repeat(80));

        for (const campus of campuses) {
            console.log(`\nProcessing: ${campus.name} (ID: ${campus.id})`);
            console.log(`  Current image_filename: ${campus.image_filename || 'NULL'}`);
            console.log(`  Current background_image: ${campus.background_image || 'NULL'}`);

            let needsUpdate = false;
            let newImageFilename = campus.image_filename;
            let newBackgroundImage = campus.background_image;

            // Fix image_filename if it doesn't start with img/
            if (campus.image_filename && !campus.image_filename.startsWith('img/')) {
                // If it's just a filename, prepend img/campuses/
                if (!campus.image_filename.includes('/')) {
                    newImageFilename = `img/campuses/${campus.image_filename}`;
                    needsUpdate = true;
                }
            }

            // Fix background_image if it doesn't start with img/
            if (campus.background_image && !campus.background_image.startsWith('img/')) {
                // If it's just a filename, prepend img/campuses/
                if (!campus.background_image.includes('/')) {
                    newBackgroundImage = `img/campuses/${campus.background_image}`;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                console.log(`  ✏️  Updating to:`);
                console.log(`     image_filename: ${newImageFilename}`);
                console.log(`     background_image: ${newBackgroundImage}`);

                await db.run(
                    'UPDATE campuses SET image_filename = ?, background_image = ? WHERE id = ?',
                    [newImageFilename, newBackgroundImage, campus.id]
                );
                console.log(`  ✅ Updated successfully`);
            } else {
                console.log(`  ℹ️  No update needed`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('\n✅ All campus image paths have been checked and updated if needed');

        // Show final state
        console.log('\n📋 Final state:');
        const updatedCampuses = await db.query('SELECT id, name, image_filename, background_image FROM campuses');
        for (const campus of updatedCampuses) {
            console.log(`\n${campus.name}:`);
            console.log(`  image_filename: ${campus.image_filename || 'NULL'}`);
            console.log(`  background_image: ${campus.background_image || 'NULL'}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

fixCampusImagePaths();
