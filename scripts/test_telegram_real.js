const { initDb, db } = require('../database');
const notificationService = require('../services/notificationService');

async function test() {
    console.log('--- TEST TELEGRAM ---');
    try {
        await initDb();
        await notificationService.init();

        const recipients = await db.query('SELECT * FROM notification_recipients WHERE notify_telegram = 1');
        console.log(`Found ${recipients.length} recipients for Telegram`);

        if (recipients.length === 0) {
            console.log('No recipients configured with notify_telegram = 1');
            return;
        }

        const testAlarm = {
            id: 1, // Use a real DB ID for building 1, floor 1
            building_id: 1,
            building_name: 'TEST BUILDING',
            floor_id: 1,
            location: 'SALA TEST',
            description: 'ALERTA DE PRUEBA TELEGRAM',
            origin: 'PRUEBA',
            started_at: new Date().toISOString()
        };

        console.log('Sending to all Telegram recipients...');
        const result = await notificationService.notifyAlarm(testAlarm);
        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        process.exit(0);
    }
}

test();
