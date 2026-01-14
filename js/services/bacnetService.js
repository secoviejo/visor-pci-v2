const bacnet = require('@widesky/node-bacstack');
const EventEmitter = require('events');

class BacnetService extends EventEmitter {
    constructor() {
        super();
        // Use environment variables or defaults
        // Port 47808 is standard. Use 47810 as client port to avoid conflict with simulator on 47809.
        this.localPort = parseInt(process.env.BACNET_PORT) || 47810;
        this.client = new bacnet({ port: this.localPort, apduTimeout: 6000, interface: '127.0.0.1' });

        this.devices = new Map(); // Store discovered devices
        this.buildingStates = new Map(); // Store alarm states per building { buildingId: { biInstance: boolean } }
        this.pollingIntervals = new Map(); // Store polling intervals per building

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

    // Read Binary Input (BI) - Used for alarm states
    // Type 3 = Binary Input, Property 85 = Present Value
    readBinaryInput(deviceAddress, instance, callback) {
        this.client.readProperty(deviceAddress, { type: 3, instance: instance }, 85, (err, value) => {
            if (err) {
                console.error(`[BACnet] Error reading BI:${instance} from ${deviceAddress}:`, err.message || err);
                if (callback) callback(err, null);
            } else {
                // BACnet Binary values: 0 = inactive (false), 1 = active (true)
                // Some devices return boolean true/false, others return 0/1
                const rawVal = (value && value.values && value.values[0]) ? value.values[0].value : null;
                const val = (rawVal === 1 || rawVal === true);
                if (callback) callback(null, val);
            }
        });
    }

    // Start polling a building's BACnet device for alarm states
    // biInstances: array of Binary Input instance numbers to poll (e.g., [0, 1, 2, 3, 4])
    startBuildingPolling(buildingId, deviceAddress, biInstances, intervalMs = 3000) {
        if (this.pollingIntervals.has(buildingId)) {
            clearInterval(this.pollingIntervals.get(buildingId));
        }

        // Initialize state
        if (!this.buildingStates.has(buildingId)) {
            this.buildingStates.set(buildingId, {});
        }

        console.log(`[BACnet] Starting polling for Building ${buildingId} at ${deviceAddress} (BIs: ${biInstances.join(',')})`);

        const pollFn = () => {
            const currentStates = this.buildingStates.get(buildingId);

            biInstances.forEach((bi) => {
                this.readBinaryInput(deviceAddress, bi, (err, value) => {
                    if (err) return;

                    const previousValue = currentStates[bi];
                    const newValue = value;

                    // Detect state change
                    if (previousValue !== newValue) {
                        currentStates[bi] = newValue;
                        this.buildingStates.set(buildingId, currentStates);

                        console.log(`[BACnet] Building ${buildingId} BI:${bi} changed: ${previousValue} -> ${newValue}`);

                        // Emit change event
                        this.emit('alarmChange', {
                            buildingId,
                            biInstance: bi,
                            value: newValue,
                            source: 'BACNET'
                        });
                    }
                });
            });
        };

        // Initial poll
        pollFn();

        // Set interval
        const interval = setInterval(pollFn, intervalMs);
        this.pollingIntervals.set(buildingId, interval);
    }

    stopBuildingPolling(buildingId) {
        if (this.pollingIntervals.has(buildingId)) {
            clearInterval(this.pollingIntervals.get(buildingId));
            this.pollingIntervals.delete(buildingId);
            console.log(`[BACnet] Stopped polling for Building ${buildingId}`);
        }
    }

    // Get current alarm states for a building
    getBuildingAlarmStates(buildingId) {
        return this.buildingStates.get(buildingId) || {};
    }
}

module.exports = new BacnetService();
