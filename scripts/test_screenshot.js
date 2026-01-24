const screenshotService = require('../services/screenshotService');
const { db, initDb } = require('../database');
const fs = require('fs');

async function test() {
    try {
        await initDb();
        console.log('DB Initialized');

        // Fetch a real device to test
        const device = await db.get("SELECT * FROM devices LIMIT 1");
        if (!device) {
            console.error('No devices found in DB to test');
            return;
        }

        console.log('Testing with device:', device);
        const floorId = device.floor_id;
        const buildingId = (await db.get("SELECT building_id FROM floors WHERE id = ?", [floorId])).building_id;

        console.log(`Generating screenshot for Building ${buildingId}, Floor ${floorId}, Device ${device.device_id}...`);

        const buffer = await screenshotService.captureAlarm(floorId, device.device_id, buildingId);

        if (buffer) {
            fs.writeFileSync('test_alarm_screenshot.jpg', buffer);
            console.log('✅ Screenshot saved to test_alarm_screenshot.jpg');
        } else {
            console.error('❌ Failed to capture screenshot');
        }

        await screenshotService.close();

    } catch (error) {
        console.error('Test failed:', error);
    }
}

test();
