const ModbusRTU = require("modbus-serial");
const EventEmitter = require('events');

class ModbusService extends EventEmitter {
    constructor() {
        super();
        this.client = new ModbusRTU();
        this.host = process.env.CIE_HOST || '192.168.0.200';
        this.port = parseInt(process.env.CIE_PORT) || 502;
        this.pollingInterval = parseInt(process.env.CIE_POLL_MS) || 500;

        this.isConnected = false;
        this.isLocalSimulator = false;
        this.intervalHandle = null;
        this.reconnectTimeout = null;

        this.inputs = {
            di0: false,
            di1: false
        };
    }

    async connect(targetHost = null, targetPort = null) {
        // Clear any pending reconnects
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        const host = targetHost || this.host;
        const port = targetPort || this.port;

        try {
            console.log(`[Modbus] Connecting to ${host}:${port}...`);
            await this.client.connectTCP(host, { port: port });
            console.log(`[Modbus] ✅ Connected to ${host}.`);

            this.isLocalSimulator = (host === '127.0.0.1' || host === 'localhost');
            this.finalizeConnection();
            return { success: true };
        } catch (e) {
            console.warn(`[Modbus] ⚠️ Connection failed to ${host}: ${e.message}`);
            this.isConnected = false;
            this.scheduleReconnect(host, port);
            return { success: false, error: e.message };
        }
    }

    async disconnect() {
        console.log('[Modbus] Disconnecting...');
        this.isConnected = false;
        if (this.intervalHandle) clearInterval(this.intervalHandle);
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        try {
            await this.client.close();
        } catch (e) { }
        this.emit('disconnected');
    }

    finalizeConnection() {
        this.client.setID(1);
        this.client.setTimeout(2000);
        this.isConnected = true;
        this.emit('connected');
        this.startPolling();
    }

    scheduleReconnect(host, port) {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connect(host, port), 5000);
    }

    startPolling() {
        if (this.intervalHandle) clearInterval(this.intervalHandle);

        this.intervalHandle = setInterval(async () => {
            if (!this.isConnected) return;

            try {
                let data;
                if (this.isLocalSimulator) {
                    // For the simulator, we might use Holding Registers as a test
                    // But our simulator.js uses getDiscreteInput.
                    // Actually, simulator.js code:
                    // getDiscreteInput: function (addr, unitID) { return inputs[addr] || false; }
                    // So we should use readDiscreteInputs.
                    const response = await this.client.readDiscreteInputs(0, 2);
                    data = response.data;
                } else {
                    const response = await this.client.readDiscreteInputs(0, 2);
                    data = response.data;
                }

                const [di0, di1] = data;

                if (di0 !== this.inputs.di0) {
                    this.inputs.di0 = di0;
                    this.emit('change', { port: 0, distinct: 'di0', value: di0, source: this.isLocalSimulator ? 'SIM' : 'REAL' });
                }

                if (di1 !== this.inputs.di1) {
                    this.inputs.di1 = di1;
                    this.emit('change', { port: 1, distinct: 'di1', value: di1, source: this.isLocalSimulator ? 'SIM' : 'REAL' });
                }

            } catch (e) {
                console.error(`[Modbus] Polling error: ${e.message}`);
                this.isConnected = false;
                this.emit('disconnected');
                this.scheduleReconnect();
            }
        }, this.pollingInterval);
    }

    getStatus() {
        return {
            connected: this.isConnected,
            isSimulator: this.isLocalSimulator,
            host: this.host,
            inputs: this.inputs
        };
    }

    async writeOutput(port, value) {
        if (!this.isConnected) throw new Error('Not connected');
        // Address 0 usually for DO0
        await this.client.writeCoil(port, value);
    }
}

module.exports = new ModbusService();
