const db = require('./database.js');

console.log('🔄 Actualizando IP del SOLAE en la base de datos...\n');

// Verificar IP actual
const current = db.prepare('SELECT id, name, modbus_ip FROM buildings WHERE id = 27').get();
console.log('📊 Configuración actual:');
console.log(`   Edificio: ${current.name} (ID: ${current.id})`);
console.log(`   IP actual: ${current.modbus_ip || 'No configurada'}\n`);

// Actualizar IP
db.prepare('UPDATE buildings SET modbus_ip = ? WHERE id = 27').run('192.168.0.100');

// Verificar actualización
const updated = db.prepare('SELECT id, name, modbus_ip FROM buildings WHERE id = 27').get();
console.log('✅ IP actualizada exitosamente:');
console.log(`   Edificio: ${updated.name} (ID: ${updated.id})`);
console.log(`   Nueva IP: ${updated.modbus_ip}\n`);

console.log('🎯 El servidor ahora se conectará a 192.168.0.100:502');
