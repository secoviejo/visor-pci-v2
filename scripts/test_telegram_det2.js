const { initDb, db } = require('../database');
const notificationService = require('../services/notificationService');

async function test() {
    console.log('--- TEST TELEGRAM DETECTOR 2 ---');
    try {
        await initDb();
        await notificationService.init();

        const recipients = await db.query('SELECT * FROM notification_recipients WHERE notify_telegram = 1');

        const testAlarm = {
            id: 2,
            building_id: 1,
            building_name: 'CIRCE',
            floor_id: 1,
            location: 'Altillo Sur (Fondo Izq)',
            description: 'Activación Manual desde Simulador UI (TEST)',
            origin: 'SIMULACIÓN',
            started_at: new Date().toISOString()
        };

        console.log('Sending to Telegram for Detector 2...');
        const result = await notificationService.notifyAlarm(testAlarm);
        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        process.exit(0);
    }
}

test();
