const ModbusRTU = require("modbus-serial");
const EventEmitter = require('events');

class ModbusService extends EventEmitter {
    constructor() {
        super();
        this.clients = new Map(); // Map<buildingId, { client: ModbusRTU, ip: string, port: number, connected: boolean, interval: any, inputs: { di0:bool, di1:bool } }>
        this.pollingInterval = parseInt(process.env.CIE_POLL_MS) || 1000;
    }

    async connectBuilding(buildingId, ip, port = 502) {
        // Disconnect if already exists
        if (this.clients.has(buildingId)) {
            await this.disconnectBuilding(buildingId);
        }

        const clientObj = {
            client: new ModbusRTU(),
            ip: ip,
            port: port,
            connected: false,
            interval: null,
            inputs: { di0: false, di1: false },
            isSimulator: (ip === '127.0.0.1' || ip === 'localhost')
        };

        this.clients.set(buildingId, clientObj);

        try {
            console.log(`[Modbus] Connecting to Building ${buildingId} (${ip}:${port})...`);
            await clientObj.client.connectTCP(ip, { port: port });
            clientObj.client.setID(1);
            clientObj.client.setTimeout(2000);

            clientObj.connected = true;
            console.log(`[Modbus] ✅ Connected to Building ${buildingId} (${ip}).`);

            this.emit('connected', { buildingId });
            this.startPolling(buildingId);
            return { success: true };

        } catch (e) {
            console.warn(`[Modbus] ⚠️ Connection failed to Building ${buildingId} (${ip}): ${e.message}`);
            clientObj.connected = false;
            // Schedule reconnect? For now, we rely on the main server to maybe retry or just let it be fail until config update.
            // Actually, auto-reconnect logic per client is good.
            this.scheduleReconnect(buildingId);
            return { success: false, error: e.message };
        }
    }

    async disconnectBuilding(buildingId) {
        const clientObj = this.clients.get(buildingId);
        if (!clientObj) return;

        console.log(`[Modbus] Disconnecting Building ${buildingId}...`);
        if (clientObj.interval) clearInterval(clientObj.interval);
        if (clientObj.reconnectTimeout) clearTimeout(clientObj.reconnectTimeout);

        try {
            await clientObj.client.close();
        } catch (e) { }

        this.clients.delete(buildingId);
        this.emit('disconnected', { buildingId });
    }

    scheduleReconnect(buildingId) {
        const clientObj = this.clients.get(buildingId);
        if (!clientObj) return;

        if (clientObj.reconnectTimeout) clearTimeout(clientObj.reconnectTimeout);
        clientObj.reconnectTimeout = setTimeout(() => {
            console.log(`[Modbus] Retrying connection for Building ${buildingId}...`);
            this.connectBuilding(buildingId, clientObj.ip, clientObj.port);
        }, 10000);
    }

    startPolling(buildingId) {
        const clientObj = this.clients.get(buildingId);
        if (!clientObj || !clientObj.connected) return;

        if (clientObj.interval) clearInterval(clientObj.interval);

        clientObj.interval = setInterval(async () => {
            if (!clientObj.connected) return;

            try {
                // Read 2 discrete inputs from address 0, FC02
                const response = await clientObj.client.readDiscreteInputs(0, 2);
                const [di0, di1] = response.data;

                if (di0 !== clientObj.inputs.di0) {
                    clientObj.inputs.di0 = di0;
                    this.emit('change', { buildingId, port: 0, distinct: 'di0', value: di0, source: 'REAL' });
                }

                if (di1 !== clientObj.inputs.di1) {
                    clientObj.inputs.di1 = di1;
                    this.emit('change', { buildingId, port: 1, distinct: 'di1', value: di1, source: 'REAL' });
                }

            } catch (e) {
                console.error(`[Modbus] Polling error on Building ${buildingId}: ${e.message}`);
                // If error is strictly connection lost, trigger reconnect
                clientObj.connected = false;
                this.scheduleReconnect(buildingId);
            }
        }, this.pollingInterval);
    }

    // Helper for Admin UI status
    getStatus() {
        // Return array/object of all connections
        const status = {};
        for (const [id, obj] of this.clients) {
            status[id] = {
                ip: obj.ip,
                connected: obj.connected,
                inputs: obj.inputs
            };
        }
        return status;
    }
}

module.exports = new ModbusService();
