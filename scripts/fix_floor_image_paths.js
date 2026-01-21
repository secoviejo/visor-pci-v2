/**
 * Script de Corrección de Rutas de Imágenes de Plantas
 * Ejecutar con: node scripts/fix_floor_image_paths.js
 * 
 * Este script normaliza las rutas de image_filename en la tabla floors,
 * extrayendo solo el nombre del archivo y añadiendo el prefijo 'img/'.
 */

const mysql = require('mysql2/promise');

const config = {
    host: 'visor_pci_mysql.unizar.es',
    user: 'visor_pci',
    password: 'sO8s+vKbZ4D2VHLJCwBm',
    database: 'visor_pci_db',
    port: 1980
};

async function fix() {
    console.log('========================================');
    console.log('  CORRECCIÓN DE RUTAS DE PLANOS');
    console.log('========================================\n');

    const connection = await mysql.createConnection(config);
    console.log('✅ Conectado a MySQL\n');

    // 1. Obtener todos los floors con rutas problemáticas
    const [floors] = await connection.execute(
        "SELECT id, image_filename FROM floors WHERE image_filename LIKE '%/%'"
    );

    console.log(`📊 Encontrados ${floors.length} registros con rutas a corregir\n`);

    if (floors.length === 0) {
        console.log('✅ No hay rutas que corregir');
        await connection.end();
        return;
    }

    // 2. Preparar las actualizaciones
    let updated = 0;
    let errors = 0;

    for (const floor of floors) {
        try {
            // Extraer solo el nombre del archivo (basename)
            const parts = floor.image_filename.split('/');
            const basename = parts[parts.length - 1];
            const newPath = `img/${basename}`;

            // Actualizar
            await connection.execute(
                'UPDATE floors SET image_filename = ? WHERE id = ?',
                [newPath, floor.id]
            );

            updated++;
            if (updated % 50 === 0) {
                console.log(`   Procesados ${updated}/${floors.length}...`);
            }
        } catch (err) {
            console.error(`   ❌ Error en floor ID ${floor.id}:`, err.message);
            errors++;
        }
    }

    console.log(`\n✅ Actualizados: ${updated}`);
    if (errors > 0) console.log(`❌ Errores: ${errors}`);

    // 3. Corregir edificios con campus_id inválido
    console.log('\n📊 Corrigiendo edificios con campus_id inválido...');
    const [invalidBuildings] = await connection.execute(
        'UPDATE buildings SET campus_id = 1 WHERE campus_id NOT IN (SELECT id FROM campuses)'
    );
    console.log(`   Edificios corregidos: ${invalidBuildings.affectedRows}`);

    await connection.end();
    console.log('\n✅ Conexión cerrada');
    console.log('\n🎉 ¡Corrección completada!');
}

fix().catch(err => {
    console.error('❌ Error durante la corrección:', err);
    process.exit(1);
});
