const fs = require('fs');
const path = require('path');
const db = require('../database');
const Papa = require('papaparse'); // We'll need to make sure this is installed or use a simple parser

// Configuration
const BASE_DATA_DIR = path.join(__dirname, '../datos_edificios');
const DEST_IMG_DIR = path.join(__dirname, '../public/img/buildings');

// Ensure destination directory exists
if (!fs.existsSync(DEST_IMG_DIR)) {
    fs.mkdirSync(DEST_IMG_DIR, { recursive: true });
}

console.log('--- INICIANDO IMPORTACIÓN DE DATOS ---');

// 1. Scan Campuses (Directories in BASE_DATA_DIR)
const campuses = fs.readdirSync(BASE_DATA_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

if (campuses.length === 0) {
    console.log('No se encontraron carpetas de Campus en datos_edificios.');
    process.exit(0);
}

campuses.forEach(campusName => {
    console.log(`\nProcesando Campus: ${campusName}`);

    // Get or Create Campus in DB
    let campus = db.prepare('SELECT * FROM campuses WHERE name = ?').get(campusName);
    if (!campus) {
        const info = db.prepare('INSERT INTO campuses (name) VALUES (?)').run(campusName);
        campus = { id: info.lastInsertRowid, name: campusName };
        console.log(`  [NUEVO] Campus creado: ID ${campus.id}`);
    } else {
        console.log(`  [EXISTE] Campus encontrado: ID ${campus.id}`);
    }

    // 2. Scan Buildings (Subdirectories in Campus)
    const campusDir = path.join(BASE_DATA_DIR, campusName);
    const buildings = fs.readdirSync(campusDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    buildings.forEach(buildingName => {
        console.log(`  > Procesando Edificio: ${buildingName}`);

        // Get or Create Building in DB
        let building = db.prepare('SELECT * FROM buildings WHERE name = ? AND campus_id = ?').get(buildingName, campus.id);
        if (!building) {
            const info = db.prepare('INSERT INTO buildings (name, campus_id) VALUES (?, ?)').run(buildingName, campus.id);
            building = { id: info.lastInsertRowid, name: buildingName };
            console.log(`    [NUEVO] Edificio creado: ID ${building.id}`);
        } else {
            console.log(`    [EXISTE] Edificio encontrado: ID ${building.id}`);
        }

        // 3. Process Floors (Images in 'planos' folder)
        const planosDir = path.join(campusDir, buildingName, 'planos');
        const dispositivosFile = path.join(campusDir, buildingName, 'dispositivos.csv');

        let floorMap = {}; // Map filename -> floor_id for devices

        if (fs.existsSync(planosDir)) {
            const planos = fs.readdirSync(planosDir).filter(file => /\.(png|jpg|jpeg|svg)$/i.test(file));

            planos.forEach(planoFile => {
                // Copy image to public dir
                const srcPath = path.join(planosDir, planoFile);
                // Create unique filename to avoid collisions if multiple buildings have "planta1.png"
                // Format: campusId_buildingId_originalName
                const destFilename = `${campus.id}_${building.id}_${planoFile}`;
                const destPath = path.join(DEST_IMG_DIR, destFilename);

                fs.copyFileSync(srcPath, destPath);

                // Insert/Update Floor in DB
                // Use the filename (without ext) as the 'name' of the floor, converting underscores to spaces
                const floorName = path.parse(planoFile).name.replace(/_/g, ' ');

                let floor = db.prepare('SELECT * FROM floors WHERE building_id = ? AND name = ?').get(building.id, floorName);
                if (!floor) {
                    const info = db.prepare('INSERT INTO floors (name, image_filename, building_id) VALUES (?, ?, ?)').run(floorName, destFilename, building.id);
                    floor = { id: info.lastInsertRowid };
                    console.log(`      [NUEVO] Plano importado: ${floorName} (${destFilename})`);
                } else {
                    // Update image if it changed
                    db.prepare('UPDATE floors SET image_filename = ? WHERE id = ?').run(destFilename, floor.id);
                    console.log(`      [ACTUALIZADO] Plano: ${floorName}`);
                }

                floorMap[planoFile] = floor.id;
            });
        } else {
            console.warn(`    [AVISO] No se encontró carpeta 'planos' en ${buildingName}`);
        }

        // 4. Process Devices (CSV)
        if (fs.existsSync(dispositivosFile)) {
            console.log(`    > Importando dispositivos...`);
            const csvContent = fs.readFileSync(dispositivosFile, 'utf8');

            // Simple parsing assuming standard CSV format from our template
            // Splitting by lines and commas. Handling basic cleanliness.
            const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase()); // planta,tipo,numero,ubicacion,x,y

            // Simple index mapping
            const idxPlano = headers.indexOf('planta');
            const idxTipo = headers.indexOf('tipo');
            const idxNum = headers.indexOf('numero');
            const idxUbi = headers.indexOf('ubicacion');
            const idxX = headers.indexOf('x');
            const idxY = headers.indexOf('y');

            if (idxPlano === -1 || idxTipo === -1) {
                console.error('      [ERROR] El CSV no tiene las columnas requeridas (planta, tipo).');
            } else {
                let devicesCount = 0;
                // Start from line 1 (skip header)
                for (let i = 1; i < lines.length; i++) {
                    const row = lines[i].split(',').map(c => c.trim());
                    if (row.length < headers.length) continue;

                    const planoName = row[idxPlano];
                    const floorId = floorMap[planoName];

                    if (!floorId) {
                        console.warn(`      [ERROR] Línea ${i + 1}: No se encontró el plano '${planoName}' listado en el CSV. Asegúrate de que el nombre del archivo coincida exactamente.`);
                        continue;
                    }

                    const type = row[idxTipo];
                    const number = idxNum > -1 ? row[idxNum].replace(/^"|"$/g, '') : '';
                    const location = idxUbi > -1 ? row[idxUbi].replace(/^"|"$/g, '') : '';
                    const x = idxX > -1 ? (parseFloat(row[idxX]) || 50) : 50;
                    const y = idxY > -1 ? (parseFloat(row[idxY]) || 50) : 50;

                    // Check if device exists (by number + floor, or location? Number + Floor seems safest unique constraint ideally)
                    // For now, let's look up by number on this floor.
                    let existing = null;
                    if (number) {
                        existing = db.prepare('SELECT * FROM devices WHERE floor_id = ? AND number = ?').get(floorId, number);
                    }

                    if (existing) {
                        // Update
                        db.prepare('UPDATE devices SET type = ?, location = ?, x = ?, y = ? WHERE id = ?')
                            .run(type, location, x, y, existing.id);
                    } else {
                        // Insert
                        // Generate a pseudo external ID if needed
                        const deviceId = `IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                        db.prepare('INSERT INTO devices (floor_id, device_id, number, type, location, x, y) VALUES (?, ?, ?, ?, ?, ?, ?)')
                            .run(floorId, deviceId, number, type, location, x, y);
                    }
                    devicesCount++;
                }
                console.log(`      [INFO] Procesados ${devicesCount} dispositivos.`);
            }

        }
    });
});

console.log('\n--- IMPORTACIÓN COMPLETADA ---');
