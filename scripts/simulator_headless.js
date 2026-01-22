/**
 * Simulador Modbus Headless (Sin Terminal)
 * 
 * Esta versión del simulador funciona en entornos sin TTY (como Render.com)
 * y es controlable vía API HTTP integrada.
 */
const ModbusRTU = require("modbus-serial");
const http = require("http");

// Estado interno
const inputs = {
    0: false, // DI0 (Zona 1)
    1: false  // DI1 (Zona 2)
};

const coils = {
    0: false // DO0 (Sirena)
};

// Vector de funciones Modbus
const vector = {
    getDiscreteInput: (addr) => inputs[addr] || false,
    getCoil: (addr) => coils[addr] || false,
    setCoil: (addr, value) => {
        console.log(`[SIM] Coil ${addr} -> ${value ? 'ON' : 'OFF'}`);
        coils[addr] = value;
        return true;
    },
    getInputRegister: () => 0,
    getHoldingRegister: () => 0
};

// Puerto Modbus
const MODBUS_PORT = parseInt(process.env.SIM_MODBUS_PORT) || 502;
const API_PORT = parseInt(process.env.SIM_API_PORT) || 8503;

let serverTCP = null;

// Iniciar servidor Modbus
function startModbus() {
    try {
        serverTCP = new ModbusRTU.ServerTCP(vector, {
            host: "0.0.0.0",
            port: MODBUS_PORT,
            unitID: 1
        });
        console.log(`✅ [Modbus] Simulador activo en puerto ${MODBUS_PORT}`);
        return true;
    } catch (e) {
        console.error(`❌ [Modbus] Error iniciando: ${e.message}`);
        if (e.code === 'EACCES') {
            console.log('   Puerto 502 requiere permisos de administrador.');
        }
        if (e.code === 'EADDRINUSE') {
            console.log('   Puerto ya en uso por otro proceso.');
        }
        return false;
    }
}

// API HTTP de control
const apiServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

    // GET /status
    if (req.method === 'GET' && req.url === '/status') {
        return res.end(JSON.stringify({
            running: !!serverTCP,
            inputs,
            coils,
            modbus_port: MODBUS_PORT
        }));
    }

    // POST /toggle/0 o /toggle/1
    if (req.method === 'POST' && req.url.startsWith('/toggle/')) {
        const addr = parseInt(req.url.split('/')[2]);
        if (addr === 0 || addr === 1) {
            inputs[addr] = !inputs[addr];
            console.log(`[SIM API] DI${addr} toggled to ${inputs[addr]}`);
            return res.end(JSON.stringify({ success: true, inputs }));
        }
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid address' }));
    }

    // POST /set/0?value=true
    if (req.method === 'POST' && req.url.startsWith('/set/')) {
        const url = new URL(req.url, `http://localhost:${API_PORT}`);
        const addr = parseInt(url.pathname.split('/')[2]);
        const value = url.searchParams.get('value') === 'true';

        if (addr === 0 || addr === 1) {
            inputs[addr] = value;
            console.log(`[SIM API] DI${addr} set to ${value}`);
            return res.end(JSON.stringify({ success: true, inputs }));
        }
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid address' }));
    }

    // POST /shutdown
    if (req.method === 'POST' && req.url === '/shutdown') {
        console.log('[SIM API] Shutdown requested');
        res.end(JSON.stringify({ success: true }));
        setTimeout(() => process.exit(0), 500);
        return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
});

// Iniciar todo
console.log('='.repeat(50));
console.log('  SIMULADOR MODBUS HEADLESS v1.0');
console.log('='.repeat(50));

const modbusOK = startModbus();

apiServer.listen(API_PORT, () => {
    console.log(`✅ [API] Control en http://localhost:${API_PORT}`);
    console.log('');
    console.log('Endpoints disponibles:');
    console.log(`  GET  /status        - Estado actual`);
    console.log(`  POST /toggle/0      - Alternar DI0`);
    console.log(`  POST /toggle/1      - Alternar DI1`);
    console.log(`  POST /set/0?value=true - Establecer DI0`);
    console.log(`  POST /shutdown      - Apagar simulador`);
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[SIM] Cerrando...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[SIM] Terminando...');
    process.exit(0);
});

// Mantener proceso vivo
setInterval(() => {
    // Heartbeat silencioso
}, 60000);
