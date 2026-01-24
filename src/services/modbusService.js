const ModbusRTU = require("modbus-serial");
const EventEmitter = require('events');

class ModbusService extends EventEmitter {
    constructor() {
        super();
        this.clients = new Map(); // Map<buildingId, { client: ModbusRTU, ip: string, port: number, connected: boolean, interval: any, inputs: { di0:bool, di1:bool } }>
        this.pollingInterval = parseInt(process.env.CIE_POLL_MS) || 1000;
    }

    async connectBuilding(buildingId, ip, port = 502, config = null) {
        // Disconnect if already exists
        if (this.clients.has(buildingId)) {
            await this.disconnectBuilding(buildingId);
        }

        // Parse config
        let parsedConfig = { pollingInterval: this.pollingInterval, readMappings: [] };
        if (config) {
            try {
                const parsed = typeof config === 'string' ? JSON.parse(config) : config;
                if (parsed.pollingInterval) parsedConfig.pollingInterval = parsed.pollingInterval;
                if (parsed.readMappings) parsedConfig.readMappings = parsed.readMappings;
            } catch (e) {
                console.error(`[Modbus] Invalid config JSON for Building ${buildingId}`, e);
            }
        }

        // Default if no mappings (fallback to old behavior for safety)
        if (parsedConfig.readMappings.length === 0) {
            parsedConfig.readMappings.push({ type: 'DiscreteInputs', address: 0, count: 2, names: ['di0', 'di1'] });
        }

        const clientObj = {
            client: new ModbusRTU(),
            ip: ip,
            port: port,
            connected: false,
            interval: null,
            inputs: {}, // Dynamic inputs
            config: parsedConfig,
            isSimulator: (ip === '127.0.0.1' || ip === 'localhost')
        };

        // Init input state
        parsedConfig.readMappings.forEach(mapping => {
            if (mapping.names) {
                mapping.names.forEach(name => clientObj.inputs[name] = null);
            }
        });

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
            this.connectBuilding(buildingId, clientObj.ip, clientObj.port, clientObj.config);
        }, 10000);
    }

    startPolling(buildingId) {
        const clientObj = this.clients.get(buildingId);
        if (!clientObj || !clientObj.connected) {
            return;
        }

        if (clientObj.interval) clearInterval(clientObj.interval);

        const interval = clientObj.config.pollingInterval || 1000;
        console.log(`[Modbus] Starting polling for Building ${buildingId} (interval: ${interval}ms)`);

        clientObj.interval = setInterval(async () => {
            if (!clientObj.connected) return;

            try {
                // Iterate over read mappings
                for (const mapping of clientObj.config.readMappings) {
                    let data = [];

                    if (mapping.type === 'DiscreteInputs') {
                        const response = await clientObj.client.readDiscreteInputs(mapping.address, mapping.count);
                        data = response.data;
                    } else if (mapping.type === 'Coils') {
                        const response = await clientObj.client.readCoils(mapping.address, mapping.count);
                        data = response.data;
                    } else if (mapping.type === 'InputRegisters') {
                        const response = await clientObj.client.readInputRegisters(mapping.address, mapping.count);
                        data = response.data;
                    } else if (mapping.type === 'HoldingRegisters') {
                        const response = await clientObj.client.readHoldingRegisters(mapping.address, mapping.count);
                        data = response.data;
                    }

                    // Process Data
                    if (mapping.names && data.length === mapping.names.length) {
                        data.forEach((val, index) => {
                            const name = mapping.names[index];
                            const oldVal = clientObj.inputs[name];

                            if (oldVal !== val && oldVal !== undefined && oldVal !== null) {
                                console.log(`[Modbus] ${name} changed: ${oldVal} → ${val}`);
                                this.emit('change', {
                                    buildingId,
                                    port: mapping.address + index,
                                    distinct: name,
                                    value: val,
                                    source: 'REAL',
                                    description: `Alarm ${name}` // Basic description
                                });
                            }

                            // Initialize logic trigger (first read)
                            if (oldVal === null && val === true) {
                                // Option: trigger event on startup for active alarms? 
                                // For now just sync state.
                            }

                            clientObj.inputs[name] = val;
                        });
                    }
                }

                // Debug log occasionally
                if (!this.pollCount) this.pollCount = {};
                if (!this.pollCount[buildingId]) this.pollCount[buildingId] = 0;
                this.pollCount[buildingId]++;
                if (this.pollCount[buildingId] % 20 === 0) {
                    // console.log(`[Modbus] Poll #${this.pollCount[buildingId]} Building ${buildingId} OK`);
                }

            } catch (e) {
                console.error(`[Modbus] Polling error on Building ${buildingId}: ${e.message}`);
                clientObj.connected = false;
                this.scheduleReconnect(buildingId);
            }
        }, interval);
    }

    // Global connector for all buildings in DB
    async start(db) {
        console.log('[Modbus] Starting all building connections...');
        try {
            const buildings = await db.query('SELECT id, modbus_ip, modbus_port, modbus_config FROM buildings WHERE modbus_ip IS NOT NULL AND modbus_port IS NOT NULL');
            console.log(`[Modbus] Found ${buildings.length} buildings with Modbus config.`);
            for (const b of buildings) {
                this.connectBuilding(b.id, b.modbus_ip, b.modbus_port || 502, b.modbus_config);
            }
        } catch (e) {
            console.error('[Modbus] Error during global start:', e.message);
        }
    }

    async stop() {
        console.log('[Modbus] Stopping all connections...');
        const ids = Array.from(this.clients.keys());
        for (const id of ids) {
            await this.disconnectBuilding(id);
        }
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
