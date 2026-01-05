const db = require('../database');
try {
    db.prepare("UPDATE buildings SET x = 75, y = 15 WHERE name = 'CEMINEM I'").run();
    db.prepare("UPDATE buildings SET x = 80, y = 15 WHERE name = 'CEMINEM II'").run();
    console.log('✅ CEMINEM I y II recolocados en la parte superior derecha para evitar solapamiento con el cuadro de info.');
} catch (err) {
    console.error('❌ Error al mover edificios:', err.message);
} finally {
    process.exit();
}
