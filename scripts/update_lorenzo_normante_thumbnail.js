const db = require('../database');

const relativePath = 'Campus Río Ebro/LORENZO NORMANTE/thumbnail.png';

try {
    const result = db.prepare("UPDATE buildings SET thumbnail = ? WHERE name = 'LORENZO NORMANTE'").run(relativePath);
    if (result.changes > 0) {
        console.log('✅ Miniatura de LORENZO NORMANTE actualizada en la base de datos.');
    } else {
        console.log('⚠️ No se encontró el edificio LORENZO NORMANTE para actualizar.');
    }
} catch (err) {
    console.error('❌ Error al actualizar la miniatura:', err.message);
} finally {
    process.exit();
}
