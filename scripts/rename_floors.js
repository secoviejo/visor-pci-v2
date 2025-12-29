const db = require('../database');

console.log('--- Iniciando Normalización de Nombres de Plantas ---');

try {
    // 1. Rename 'Planta 1 - General' -> 'planta 1'
    let info = db.prepare("UPDATE floors SET name = 'planta 1' WHERE name = 'Planta 1 - General'").run();
    if (info.changes > 0) console.log(`✅ Renombrado 'Planta 1 - General' a 'planta 1'`);
    else console.log(`ℹ️ 'Planta 1 - General' no encontrado o ya renombrado.`);

    // 2. Rename 'PLANTA BAJA' -> 'planta baja'
    info = db.prepare("UPDATE floors SET name = 'planta baja' WHERE name = 'PLANTA BAJA'").run();
    if (info.changes > 0) console.log(`✅ Renombrado 'PLANTA BAJA' a 'planta baja'`);
    else console.log(`ℹ️ 'PLANTA BAJA' no encontrado o ya renombrado.`);

} catch (e) {
    console.error('Error:', e);
}
