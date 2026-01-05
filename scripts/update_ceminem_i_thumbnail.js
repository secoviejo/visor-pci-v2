const db = require('../database');

const relativePath = 'Campus Río Ebro/CEMINEM I/thumbnail.png';

try {
    const result = db.prepare("UPDATE buildings SET thumbnail = ? WHERE name = 'CEMINEM I'").run(relativePath);
    if (result.changes > 0) {
        console.log('✅ Miniatura de CEMINEM I actualizada en la base de datos.');
    } else {
        console.log('⚠️ No se encontró el edificio CEMINEM I para actualizar.');
    }
} catch (err) {
    console.error('❌ Error al actualizar la miniatura:', err.message);
} finally {
    process.exit();
}
