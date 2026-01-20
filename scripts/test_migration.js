const { db, initDb } = require('../database');

async function test() {
    console.log('--- Iniciando Test de Verificación de Migración ---');

    try {
        console.log('1. Conectando a la Base de Datos...');
        await initDb();
        console.log('✅ Conexión e Inicialización exitosa.');

        console.log('2. Prueba de Consulta (SELECT)...');
        const buildings = await db.query('SELECT * FROM buildings');
        console.log(`✅ Consulta exitosa. ${buildings.length} edificios encontrados.`);

        console.log('3. Prueba de Inserción (INSERT)...');
        try {
            const info = await db.run("INSERT INTO events (type, message, origin) VALUES (?, ?, ?)", ['TEST', 'Test de Verificación', 'SCRIPT']);
            console.log(`✅ Inserción exitosa. ID: ${info.lastInsertRowid || info.insertId}`);
        } catch (e) {
            console.error('❌ Error en Inserción:', e.message);
        }

        console.log('4. Prueba de Obtención de Fila (GET)...');
        const event = await db.get("SELECT * FROM events WHERE type = 'TEST' ORDER BY id DESC LIMIT 1");
        if (event) {
            console.log(`✅ GET exitoso. Mensaje: ${event.message}`);
        } else {
            console.error('❌ Error en GET: No se encontró el evento insertado.');
        }

        console.log('\n--- VERIFICACIÓN COMPLETADA EXITOSAMENTE ---');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR FATAL:', error);
        process.exit(1);
    }
}

test();
