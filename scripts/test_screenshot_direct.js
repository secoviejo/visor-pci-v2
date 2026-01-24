const screenshotService = require('../services/screenshotService');

async function test() {
    process.env.PORT = '3000';
    try {
        console.log("Testing screenshot for Floor 1, Device '1627485277'...");
        const buffer = await screenshotService.captureAlarm(1, '1627485277', 1);
        if (buffer) {
            console.log(`Success! Captured ${buffer.length} bytes`);
        } else {
            console.log('Failed! Result is null');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await screenshotService.close();
        process.exit(0);
    }
}

test();
