const db = require('../database');
const path = require('path');

// La ruta relativa que usaremos en la DB (accedida vía /data/)
const relativePath = 'Campus Río Ebro/CIRCE/thumbnail.png';

try {
    const result = db.prepare("UPDATE buildings SET thumbnail = ? WHERE name = 'CIRCE'").run(relativePath);
    if (result.changes > 0) {
        console.log('✅ Miniatura de CIRCE actualizada en la base de datos.');
    } else {
        console.log('⚠️ No se encontró el edificio CIRCE para actualizar.');
    }
} catch (err) {
    console.error('❌ Error al actualizar la miniatura:', err.message);
} finally {
    process.exit();
}
