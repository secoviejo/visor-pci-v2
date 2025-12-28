const ModbusRTU = require("modbus-serial");
const EventEmitter = require('events');

class ModbusService extends EventEmitter {
    constructor() {
        super();
        this.client = new ModbusRTU();
        this.host = process.env.CIE_HOST || '192.168.0.200'; // Default IP, override with ENV
        this.port = parseInt(process.env.CIE_PORT) || 502;
        this.pollingInterval = parseInt(process.env.CIE_POLL_MS) || 500;

        this.isConnected = false;
        this.isLocalSimulator = false;
        this.intervalHandle = null;

        // Internal state to track changes
        this.inputs = {
            di0: false,
            di1: false
        };
    }

    async connect() {
        // 1. Try Hardware (or Configured Host)
        try {
            console.log(`[Modbus] Connecting to HARDWARE at ${this.host}:${this.port}...`);
            await this.client.connectTCP(this.host, { port: this.port });
            console.log('[Modbus] ✅ Connected to HARDWARE.');
            this.isLocalSimulator = false;
            this.finalizeConnection();
            return;
        } catch (e) {
            console.warn(`[Modbus] ⚠️ Hardware connection failed: ${e.message}`);
        }

        // 2. Try Simulator (Fallback)
        try {
            const simHost = '127.0.0.1';
            console.log(`[Modbus] Attempting fallback to SIMULATOR at ${simHost}:${this.port}...`);
            await this.client.connectTCP(simHost, { port: this.port });
            console.log('[Modbus] ✅ Connected to SIMULATOR (Modbus Slave).');
            this.isLocalSimulator = true;
            this.finalizeConnection();
        } catch (e) {
            this.isConnected = false;
            console.error(`[Modbus] ❌ All connection attempts failed.`);
            // this.emit('error', e); // Removed to avoid crashing server if no listener
            this.scheduleReconnect();
        }
    }

    finalizeConnection() {
        this.client.setID(1);
        this.client.setTimeout(2000);
        this.isConnected = true;
        this.emit('connected');
        this.startPolling();
    }

    scheduleReconnect() {
        if (this.intervalHandle) clearInterval(this.intervalHandle);
        setTimeout(() => this.connect(), 5000); // Retry every 5s
    }

    startPolling() {
        if (this.intervalHandle) clearInterval(this.intervalHandle);

        this.intervalHandle = setInterval(async () => {
            if (!this.isConnected) return;

            try {
                // Read data based on connection type
                let data;
                if (this.isLocalSimulator) {
                    // Modbus Slave usually uses Holding Registers for tests
                    const response = await this.client.readHoldingRegisters(0, 2);
                    data = response.data.map(v => v > 0); // Convert to boolean
                } else {
                    // CIE-H12 hardware uses Discrete Inputs
                    const response = await this.client.readDiscreteInputs(0, 2);
                    data = response.data;
                }

                const [di0, di1] = data;

                // Check for changes
                if (di0 !== this.inputs.di0) {
                    this.inputs.di0 = di0;
                    this.emit('change', { port: 0, distinct: 'di0', value: di0, source: 'REAL' });
                }

                if (di1 !== this.inputs.di1) {
                    this.inputs.di1 = di1;
                    this.emit('change', { port: 1, distinct: 'di1', value: di1, source: 'REAL' });
                }

            } catch (e) {
                console.error(`[Modbus] Polling error: ${e.message}`);
                this.client.close();
                this.isConnected = false;
                this.emit('disconnected');
                this.scheduleReconnect();
            }
        }, this.pollingInterval);
    }

    async writeOutput(port, value) {
        if (!this.isConnected) throw new Error('Not connected');
        // Address 0 usually for DO0
        await this.client.writeCoil(port, value);
    }
}

module.exports = new ModbusService();
