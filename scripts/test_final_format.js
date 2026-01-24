const { initDb, db } = require('../database');
const notificationService = require('../services/notificationService');

async function test() {
    console.log('--- TEST FORMATO DETALLADO TELEGRAM ---');
    try {
        await initDb();
        await notificationService.init();

        const recipients = await db.query('SELECT * FROM notification_recipients WHERE notify_telegram = 1');
        console.log(`Enviando a ${recipients.length} destinatario(s) real(es)...`);

        const testAlarm = {
            id: 40,
            element_id: '40',
            type: 'detector',
            building_id: 1,
            building_name: 'CIRCE',
            floor_id: 1,
            location: 'Altillo Sur (Fondo Der)',
            description: 'Activación Manual desde Simulador UI (PRUEBA FINAL)',
            origin: 'SIMULACIÓN',
            started_at: new Date().toISOString()
        };

        const result = await notificationService.notifyAlarm(testAlarm);
        console.log('Resultado:', JSON.stringify(result, null, 2));

    } catch (err) {
        console.error('Test fallido:', err);
    } finally {
        process.exit(0);
    }
}

test();
