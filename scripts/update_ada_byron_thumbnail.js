const db = require('../database');

const relativePath = 'Campus Río Ebro/ADA BYRON/thumbnail.png';

try {
    const result = db.prepare("UPDATE buildings SET thumbnail = ? WHERE name = 'ADA BYRON'").run(relativePath);
    if (result.changes > 0) {
        console.log('✅ Miniatura de ADA BYRON actualizada en la base de datos.');
    } else {
        console.log('⚠️ No se encontró el edificio ADA BYRON para actualizar.');
    }
} catch (err) {
    console.error('❌ Error al actualizar la miniatura:', err.message);
} finally {
    process.exit();
}
