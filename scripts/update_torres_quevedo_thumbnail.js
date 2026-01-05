const db = require('../database');

const relativePath = 'Campus Río Ebro/ED, TORRES QUEVEDO/thumbnail.png';

try {
    const result = db.prepare("UPDATE buildings SET thumbnail = ? WHERE name = 'ED, TORRES QUEVEDO'").run(relativePath);
    if (result.changes > 0) {
        console.log('✅ Miniatura de ED, TORRES QUEVEDO actualizada en la base de datos.');
    } else {
        console.log('⚠️ No se encontró el edificio ED, TORRES QUEVEDO para actualizar.');
    }
} catch (err) {
    console.error('❌ Error al actualizar la miniatura:', err.message);
} finally {
    process.exit();
}
