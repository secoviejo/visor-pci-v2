/**
 * Script de Auditoría Post-Migración MySQL
 * Ejecutar con: node scripts/audit_mysql_data.js
 * 
 * Este script conecta a la base de datos MySQL de producción y genera un reporte
 * de todos los problemas encontrados en las tablas principales.
 */

const mysql = require('mysql2/promise');

const config = {
    host: 'visor_pci_mysql.unizar.es',
    user: 'visor_pci',
    password: 'sO8s+vKbZ4D2VHLJCwBm',
    database: 'visor_pci_db',
    port: 1980
};

async function audit() {
    console.log('========================================');
    console.log('  AUDITORÍA POST-MIGRACIÓN MYSQL');
    console.log('========================================\n');

    const connection = await mysql.createConnection(config);
    console.log('✅ Conectado a MySQL\n');

    const issues = [];

    // ==================== FLOORS ====================
    console.log('📁 AUDITORÍA DE TABLA: floors');
    console.log('─────────────────────────────────────');

    const [floors] = await connection.execute('SELECT id, name, image_filename, building_id FROM floors');
    console.log(`   Total de plantas: ${floors.length}`);

    const floorsWithBadPaths = floors.filter(f =>
        f.image_filename && (
            f.image_filename.includes('docs/') ||
            f.image_filename.includes('datos_edificios') ||
            f.image_filename.includes('Campus ') ||
            f.image_filename.includes('\\\\') ||
            !f.image_filename.startsWith('img/') && !f.image_filename.match(/^[a-zA-Z0-9_.-]+$/)
        )
    );

    if (floorsWithBadPaths.length > 0) {
        console.log(`   ❌ Plantas con rutas problemáticas: ${floorsWithBadPaths.length}`);
        floorsWithBadPaths.slice(0, 5).forEach(f => {
            console.log(`      - ID ${f.id}: ${f.image_filename}`);
        });
        if (floorsWithBadPaths.length > 5) console.log(`      ... y ${floorsWithBadPaths.length - 5} más`);
        issues.push({ table: 'floors', issue: 'bad_paths', count: floorsWithBadPaths.length, samples: floorsWithBadPaths.slice(0, 10) });
    } else {
        console.log('   ✅ Todas las rutas de imágenes parecen correctas');
    }

    const floorsWithNullImage = floors.filter(f => !f.image_filename);
    if (floorsWithNullImage.length > 0) {
        console.log(`   ⚠️ Plantas sin imagen: ${floorsWithNullImage.length}`);
        issues.push({ table: 'floors', issue: 'null_image', count: floorsWithNullImage.length });
    }

    // ==================== DEVICES ====================
    console.log('\n📁 AUDITORÍA DE TABLA: devices');
    console.log('─────────────────────────────────────');

    const [devices] = await connection.execute('SELECT id, floor_id, device_id, number, type FROM devices');
    console.log(`   Total de dispositivos: ${devices.length}`);

    const devicesWithNullFloor = devices.filter(d => !d.floor_id);
    if (devicesWithNullFloor.length > 0) {
        console.log(`   ❌ Dispositivos sin floor_id: ${devicesWithNullFloor.length}`);
        issues.push({ table: 'devices', issue: 'null_floor_id', count: devicesWithNullFloor.length });
    } else {
        console.log('   ✅ Todos los dispositivos tienen floor_id');
    }

    // Verificar floor_ids válidos
    const validFloorIds = new Set(floors.map(f => f.id));
    const devicesWithInvalidFloor = devices.filter(d => d.floor_id && !validFloorIds.has(d.floor_id));
    if (devicesWithInvalidFloor.length > 0) {
        console.log(`   ❌ Dispositivos con floor_id inválido: ${devicesWithInvalidFloor.length}`);
        issues.push({ table: 'devices', issue: 'invalid_floor_id', count: devicesWithInvalidFloor.length });
    }

    // ==================== CAMPUSES ====================
    console.log('\n📁 AUDITORÍA DE TABLA: campuses');
    console.log('─────────────────────────────────────');

    const [campuses] = await connection.execute('SELECT id, name, image_filename, background_image FROM campuses');
    console.log(`   Total de campus: ${campuses.length}`);

    const campusesWithBadPaths = campuses.filter(c =>
        (c.image_filename && !c.image_filename.startsWith('img/campuses/')) ||
        (c.background_image && !c.background_image.startsWith('img/campuses/'))
    );

    if (campusesWithBadPaths.length > 0) {
        console.log(`   ❌ Campus con rutas sin prefijo correcto: ${campusesWithBadPaths.length}`);
        campusesWithBadPaths.forEach(c => {
            console.log(`      - ${c.name}: img=${c.image_filename}, bg=${c.background_image}`);
        });
        issues.push({ table: 'campuses', issue: 'bad_paths', count: campusesWithBadPaths.length, samples: campusesWithBadPaths });
    } else {
        console.log('   ✅ Todas las rutas de imágenes tienen el prefijo correcto');
    }

    // ==================== BUILDINGS ====================
    console.log('\n📁 AUDITORÍA DE TABLA: buildings');
    console.log('─────────────────────────────────────');

    const [buildings] = await connection.execute('SELECT id, name, campus_id, thumbnail FROM buildings');
    console.log(`   Total de edificios: ${buildings.length}`);

    const validCampusIds = new Set(campuses.map(c => c.id));
    const buildingsWithInvalidCampus = buildings.filter(b => b.campus_id && !validCampusIds.has(b.campus_id));
    if (buildingsWithInvalidCampus.length > 0) {
        console.log(`   ❌ Edificios con campus_id inválido: ${buildingsWithInvalidCampus.length}`);
        issues.push({ table: 'buildings', issue: 'invalid_campus_id', count: buildingsWithInvalidCampus.length });
    } else {
        console.log('   ✅ Todos los edificios tienen campus_id válido');
    }

    const buildingsWithNullCampus = buildings.filter(b => !b.campus_id);
    if (buildingsWithNullCampus.length > 0) {
        console.log(`   ⚠️ Edificios sin campus_id: ${buildingsWithNullCampus.length}`);
        issues.push({ table: 'buildings', issue: 'null_campus_id', count: buildingsWithNullCampus.length });
    }

    // ==================== RESUMEN ====================
    console.log('\n========================================');
    console.log('  RESUMEN DE PROBLEMAS');
    console.log('========================================');

    if (issues.length === 0) {
        console.log('🎉 No se encontraron problemas críticos!');
    } else {
        console.log(`Se encontraron ${issues.length} tipos de problemas:\n`);
        issues.forEach((issue, i) => {
            console.log(`${i + 1}. [${issue.table}] ${issue.issue}: ${issue.count} registros`);
        });
    }

    // Guardar reporte JSON
    const fs = require('fs');
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            floors: floors.length,
            devices: devices.length,
            campuses: campuses.length,
            buildings: buildings.length
        },
        issues: issues
    };

    fs.writeFileSync('audit_report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Reporte guardado en: audit_report.json');

    await connection.end();
    console.log('\n✅ Conexión cerrada');
}

audit().catch(err => {
    console.error('❌ Error durante la auditoría:', err);
    process.exit(1);
});
