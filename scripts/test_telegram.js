const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const notificationService = require('../services/notificationService');
const { db, initDb } = require('../database');

async function test() {
    try {
        await initDb();
        console.log('DB Initialized');

        await notificationService.init();
        console.log('Notification Service Initialized');

        // Fetch a real recipient
        const recipients = await db.query("SELECT * FROM notification_recipients WHERE enabled = 1");
        const recipient = recipients.find(r => r.telegram_chat_id);

        if (!recipient) {
            console.error('No recipient with Telegram Chat ID found');
            return;
        }

        console.log('Testing with recipient:', recipient.name, '(', recipient.telegram_chat_id, ')');

        const testAlarm = {
            id: 'test-alarm-' + Date.now(),
            element_id: '1627485277',
            type: 'detector',
            building_id: 1,
            floor_id: 1,
            location: 'UBICACIÓN DE PRUEBA',
            description: 'ESTO ES UNA PRUEBA DE CAPTURA DE PANTALLA',
            origin: 'SIMULACIÓN',
            started_at: new Date().toISOString()
        };

        console.log('Sending Test Notification...');
        const result = await notificationService.sendTelegram(recipient, testAlarm, 999);
        console.log('Result:', result);

    } catch (error) {
        console.error('Test failed:', error);
    }
}

test();
