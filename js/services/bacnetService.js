const bacnet = require('@widesky/node-bacstack');
const EventEmitter = require('events');

class BacnetService extends EventEmitter {
    constructor() {
        super();
        // Use environment variables or defaults
        // Port 47808 is standard. If running parallel with YABE locally, use 47809.
        this.localPort = parseInt(process.env.BACNET_PORT) || 47809;
        this.client = new bacnet({ port: this.localPort, apduTimeout: 6000, interface: '0.0.0.0' });

        this.devices = new Map(); // Store discovered devices

        this.client.on('iAm', (device) => {
            if (!this.devices.has(device.deviceId)) {
                this.devices.set(device.deviceId, device);
                this.emit('deviceFound', device);
                console.log(`[BACnet] Device found: ${device.deviceId} at ${device.address}`);
            }
        });

        this.client.on('error', (err) => {
            console.error('[BACnet] Client error:', err);
        });
    }

    discover() {
        console.log('[BACnet] Sending Who-Is...');
        this.client.whoIs();

        // Repeat every 10 seconds to ensure detection
        if (this.discoveryInterval) clearInterval(this.discoveryInterval);
        this.discoveryInterval = setInterval(() => {
            // console.log('[BACnet] Re-sending Who-Is...'); // Optional: uncomment for debug
            this.client.whoIs();
        }, 10000);
    }

    readAnalogInput(deviceIp, instance, callback) {
        // Correctly handle IP with port if needed
        this.client.readProperty(deviceIp, { type: 0, instance: instance }, 85, (err, value) => {
            if (err) {
                console.error(`[BACnet] Error reading AI:${instance} from ${deviceIp}:`, err.message || err);
                if (callback) callback(err, null);
            } else {
                const val = (value && value.values && value.values[0]) ? value.values[0].value : null;
                if (callback) callback(null, val);
            }
        });
    }
}

module.exports = new BacnetService();
