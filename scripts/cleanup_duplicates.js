const db = require('../database');

console.log('--- Limpiando Duplicados (Comillas) ---');

try {
    // 1. Delete devices where number starts with "
    const result = db.prepare(`DELETE FROM devices WHERE number LIKE '"%'`).run();
    console.log(`✅ Eliminados ${result.changes} dispositivos con comillas.`);

    // 2. Check remaining count
    const count = db.prepare('SELECT count(*) as c FROM devices').get();
    console.log(`ℹ️ Total dispositivos actuales: ${count.c}`);

} catch (e) {
    console.error('Error:', e);
}
