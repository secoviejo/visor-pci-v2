// Script para verificar edificios con Modbus configurado
const db = require('./database.js');

const results = db.prepare('SELECT id, name, modbus_ip, modbus_port FROM buildings WHERE modbus_ip IS NOT NULL').all();

console.log('=== Edificios con Modbus Configurado ===');
console.log(JSON.stringify(results, null, 2));
console.log(`\nTotal: ${results.length} edificio(s)`);
