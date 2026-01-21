#!/usr/bin/env node

/**
 * Script para corregir las rutas de las imágenes de los campus
 * Ejecutar en el servidor: node scripts/fix_campus_images_server.js
 */

const { db, initDb } = require('../database');
const fs = require('fs');
const path = require('path');

async function fixCampusImages() {
    try {
        console.log('🔧 Iniciando corrección de rutas de imágenes de campus...\n');

        await initDb();
        console.log('✅ Base de datos inicializada\n');

        // Obtener todos los campus
        const campuses = await db.query('SELECT id, name, image_filename, background_image FROM campuses');

        console.log(`📊 Encontrados ${campuses.length} campus en la base de datos\n`);
        console.log('='.repeat(80));

        let updatedCount = 0;

        for (const campus of campuses) {
            console.log(`\n🏛️  Campus: ${campus.name} (ID: ${campus.id})`);
            console.log(`   Estado actual:`);
            console.log(`     image_filename: ${campus.image_filename || 'NULL'}`);
            console.log(`     background_image: ${campus.background_image || 'NULL'}`);

            let newImageFilename = campus.image_filename;
            let newBackgroundImage = campus.background_image;
            let needsUpdate = false;

            // Corregir image_filename
            if (campus.image_filename) {
                // Si no empieza con 'img/' y no contiene '/', añadir el prefijo
                if (!campus.image_filename.startsWith('img/') && !campus.image_filename.includes('/')) {
                    newImageFilename = `img/campuses/${campus.image_filename}`;
                    needsUpdate = true;
                }
                // Si empieza con '/' o contiene rutas absolutas, corregir
                else if (campus.image_filename.startsWith('/')) {
                    newImageFilename = campus.image_filename.substring(1);
                    if (!newImageFilename.startsWith('img/')) {
                        newImageFilename = `img/campuses/${path.basename(newImageFilename)}`;
                    }
                    needsUpdate = true;
                }
            }

            // Corregir background_image
            if (campus.background_image) {
                // Si no empieza con 'img/' y no contiene '/', añadir el prefijo
                if (!campus.background_image.startsWith('img/') && !campus.background_image.includes('/')) {
                    newBackgroundImage = `img/campuses/${campus.background_image}`;
                    needsUpdate = true;
                }
                // Si empieza con '/' o contiene rutas absolutas, corregir
                else if (campus.background_image.startsWith('/')) {
                    newBackgroundImage = campus.background_image.substring(1);
                    if (!newBackgroundImage.startsWith('img/')) {
                        newBackgroundImage = `img/campuses/${path.basename(newBackgroundImage)}`;
                    }
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                console.log(`   ✏️  Actualizando a:`);
                console.log(`     image_filename: ${newImageFilename}`);
                console.log(`     background_image: ${newBackgroundImage}`);

                // Verificar que los archivos existen
                const imgPath = path.join(__dirname, '..', newImageFilename);
                const bgPath = path.join(__dirname, '..', newBackgroundImage);

                const imgExists = fs.existsSync(imgPath);
                const bgExists = fs.existsSync(bgPath);

                console.log(`   📁 Verificación de archivos:`);
                console.log(`     ${newImageFilename}: ${imgExists ? '✅ Existe' : '❌ No encontrado'}`);
                if (newBackgroundImage && newBackgroundImage !== newImageFilename) {
                    console.log(`     ${newBackgroundImage}: ${bgExists ? '✅ Existe' : '❌ No encontrado'}`);
                }

                // Actualizar en la base de datos
                try {
                    await db.run(
                        'UPDATE campuses SET image_filename = ?, background_image = ? WHERE id = ?',
                        [newImageFilename, newBackgroundImage, campus.id]
                    );
                    console.log(`   ✅ Actualizado en la base de datos`);
                    updatedCount++;
                } catch (error) {
                    console.error(`   ❌ Error al actualizar: ${error.message}`);
                }
            } else {
                console.log(`   ℹ️  No requiere actualización`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log(`\n✅ Proceso completado: ${updatedCount} campus actualizados de ${campuses.length} totales\n`);

        // Mostrar estado final
        console.log('📋 Estado final de todos los campus:\n');
        const updatedCampuses = await db.query('SELECT id, name, image_filename, background_image FROM campuses ORDER BY id');

        for (const campus of updatedCampuses) {
            console.log(`${campus.name}:`);
            console.log(`  image_filename: ${campus.image_filename || 'NULL'}`);
            console.log(`  background_image: ${campus.background_image || 'NULL'}`);

            // Verificar existencia de archivos
            if (campus.image_filename) {
                const imgPath = path.join(__dirname, '..', campus.image_filename);
                const exists = fs.existsSync(imgPath);
                console.log(`  Archivo: ${exists ? '✅' : '❌'}`);
            }
            console.log('');
        }

        console.log('='.repeat(80));
        console.log('\n💡 Recomendaciones:');
        console.log('   1. Reinicia el servidor para que los cambios surtan efecto');
        console.log('   2. Limpia la caché del navegador (Ctrl+Shift+R)');
        console.log('   3. Verifica que las imágenes se cargan correctamente en el dashboard\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error fatal:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar el script
fixCampusImages();
