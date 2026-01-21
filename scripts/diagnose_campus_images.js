#!/usr/bin/env node

/**
 * Script de diagnóstico para verificar el estado de las imágenes de campus
 * NO realiza cambios, solo reporta el estado actual
 * Ejecutar: node scripts/diagnose_campus_images.js
 */

const { db, initDb } = require('../database');
const fs = require('fs');
const path = require('path');

async function diagnoseCampusImages() {
    try {
        console.log('🔍 Diagnóstico de Imágenes de Campus\n');
        console.log('='.repeat(80));

        await initDb();
        console.log('✅ Conexión a base de datos establecida\n');

        // Obtener información de la base de datos
        const campuses = await db.query('SELECT id, name, image_filename, background_image FROM campuses ORDER BY id');

        console.log(`📊 Total de campus en la base de datos: ${campuses.length}\n`);

        // Verificar directorio de imágenes
        const imgDir = path.join(__dirname, '..', 'img', 'campuses');
        const imgDirExists = fs.existsSync(imgDir);

        console.log('📁 Directorio de imágenes:');
        console.log(`   Ruta: ${imgDir}`);
        console.log(`   Existe: ${imgDirExists ? '✅ Sí' : '❌ No'}\n`);

        let availableImages = [];
        if (imgDirExists) {
            availableImages = fs.readdirSync(imgDir);
            console.log(`   Archivos disponibles: ${availableImages.length}`);
            console.log('   Listado:');
            availableImages.forEach(file => {
                const filePath = path.join(imgDir, file);
                const stats = fs.statSync(filePath);
                const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`     - ${file} (${sizeMB} MB)`);
            });
            console.log('');
        }

        console.log('='.repeat(80));
        console.log('\n🏛️  Análisis de Campus:\n');

        let problemsFound = 0;
        let okCount = 0;

        for (const campus of campuses) {
            console.log(`Campus: ${campus.name} (ID: ${campus.id})`);
            console.log(`${'─'.repeat(80)}`);

            let hasProblems = false;

            // Analizar image_filename
            if (campus.image_filename) {
                console.log(`  image_filename: "${campus.image_filename}"`);

                // Verificar si tiene el prefijo correcto
                if (!campus.image_filename.startsWith('img/')) {
                    console.log(`    ⚠️  PROBLEMA: No empieza con 'img/'`);
                    console.log(`    💡 Debería ser: img/campuses/${campus.image_filename}`);
                    hasProblems = true;
                }

                // Verificar si el archivo existe
                const imgPath = path.join(__dirname, '..', campus.image_filename);
                const imgExists = fs.existsSync(imgPath);
                console.log(`    Archivo existe: ${imgExists ? '✅ Sí' : '❌ No'}`);
                if (!imgExists) {
                    console.log(`    📍 Ruta buscada: ${imgPath}`);
                    hasProblems = true;

                    // Sugerir archivos similares
                    const filename = path.basename(campus.image_filename);
                    const similar = availableImages.filter(f =>
                        f.toLowerCase().includes(campus.name.toLowerCase().split(' ')[1] || campus.name.toLowerCase())
                    );
                    if (similar.length > 0) {
                        console.log(`    💡 Archivos similares encontrados:`);
                        similar.forEach(f => console.log(`       - img/campuses/${f}`));
                    }
                }
            } else {
                console.log(`  image_filename: NULL`);
                console.log(`    ⚠️  PROBLEMA: No hay imagen asignada`);
                hasProblems = true;
            }

            // Analizar background_image
            if (campus.background_image) {
                console.log(`  background_image: "${campus.background_image}"`);

                if (!campus.background_image.startsWith('img/')) {
                    console.log(`    ⚠️  PROBLEMA: No empieza con 'img/'`);
                    console.log(`    💡 Debería ser: img/campuses/${campus.background_image}`);
                    hasProblems = true;
                }

                const bgPath = path.join(__dirname, '..', campus.background_image);
                const bgExists = fs.existsSync(bgPath);
                console.log(`    Archivo existe: ${bgExists ? '✅ Sí' : '❌ No'}`);
                if (!bgExists) {
                    console.log(`    📍 Ruta buscada: ${bgPath}`);
                    hasProblems = true;
                }
            } else {
                console.log(`  background_image: NULL`);
            }

            if (hasProblems) {
                console.log(`  ❌ Estado: REQUIERE CORRECCIÓN`);
                problemsFound++;
            } else {
                console.log(`  ✅ Estado: OK`);
                okCount++;
            }

            console.log('');
        }

        console.log('='.repeat(80));
        console.log('\n📈 Resumen del Diagnóstico:\n');
        console.log(`  Total de campus: ${campuses.length}`);
        console.log(`  Campus OK: ${okCount} ✅`);
        console.log(`  Campus con problemas: ${problemsFound} ❌`);
        console.log(`  Imágenes disponibles: ${availableImages.length}`);

        console.log('\n' + '='.repeat(80));

        if (problemsFound > 0) {
            console.log('\n⚠️  SE ENCONTRARON PROBLEMAS\n');
            console.log('Para corregir automáticamente, ejecuta:');
            console.log('  node scripts/fix_campus_images_server.js\n');
        } else {
            console.log('\n✅ NO SE ENCONTRARON PROBLEMAS\n');
            console.log('Todas las rutas de imágenes están correctas.');
            console.log('Si las imágenes no se muestran en el navegador:');
            console.log('  1. Verifica que el servidor esté corriendo');
            console.log('  2. Limpia la caché del navegador (Ctrl+Shift+R)');
            console.log('  3. Verifica la consola del navegador (F12) para errores\n');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error durante el diagnóstico:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar diagnóstico
diagnoseCampusImages();
