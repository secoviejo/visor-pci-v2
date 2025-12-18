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
        this.intervalHandle = null;

        // Internal state to track changes
        this.inputs = {
            di0: false,
            di1: false
        };
    }

    async connect() {
        try {
            console.log(`[Modbus] Connecting to ${this.host}:${this.port}...`);
            await this.client.connectTCP(this.host, { port: this.port });
            this.client.setID(1); // Standard Unit ID
            this.client.setTimeout(2000);

            this.isConnected = true;
            console.log('[Modbus] Connected.');
            this.emit('connected');

            this.startPolling();
        } catch (e) {
            this.isConnected = false;
            console.error(`[Modbus] Connection failed: ${e.message}`);
            this.emit('error', e);
            this.scheduleReconnect();
        }
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
                // Read discrete inputs. Address 0 for DI0, Address 1 for DI1?
                // CIE-H12 usually maps inputs to 0, 1, etc.
                // We read 2 bits starting at address 0.
                const data = await this.client.readDiscreteInputs(0, 2);
                const [di0, di1] = data.data;

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
