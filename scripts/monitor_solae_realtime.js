const ModbusRTU = require('modbus-serial');

const ip = '192.168.0.100';
const port = 502;
let lastDI0 = null;
let lastDI1 = null;

async function monitorSOLAE() {
    const client = new ModbusRTU();

    try {
        await client.connectTCP(ip, { port });
        client.setTimeout(3000);

        console.log('\n🔍 Monitor en Tiempo Real del SOLAE');
        console.log('=====================================');
        console.log(`📡 Conectado a ${ip}:${port}`);
        console.log('⏱️  Polling cada 1 segundo...\n');
        console.log('Presiona Ctrl+C para detener\n');

        setInterval(async () => {
            try {
                const response = await client.readDiscreteInputs(0, 2);
                const [di0, di1] = response.data;

                // Detectar cambios
                if (di0 !== lastDI0 && lastDI0 !== null) {
                    const timestamp = new Date().toLocaleTimeString();
                    if (di0) {
                        console.log(`\n🔴 [${timestamp}] DI0 CERRADO → ALARMA ACTIVADA`);
                    } else {
                        console.log(`\n⚪ [${timestamp}] DI0 ABIERTO → ALARMA RESUELTA`);
                    }
                }

                if (di1 !== lastDI1 && lastDI1 !== null) {
                    const timestamp = new Date().toLocaleTimeString();
                    if (di1) {
                        console.log(`\n🔴 [${timestamp}] DI1 CERRADO → ALARMA ACTIVADA`);
                    } else {
                        console.log(`\n⚪ [${timestamp}] DI1 ABIERTO → ALARMA RESUELTA`);
                    }
                }

                // Actualizar estado
                lastDI0 = di0;
                lastDI1 = di1;

                // Mostrar estado actual (solo si hay cambios o cada 10 segundos)
                const now = Date.now();
                if (!global.lastPrint || now - global.lastPrint > 10000) {
                    console.log(`[${new Date().toLocaleTimeString()}] DI0: ${di0 ? '🔴' : '⚪'}  DI1: ${di1 ? '🔴' : '⚪'}`);
                    global.lastPrint = now;
                }

            } catch (err) {
                console.error(`❌ Error de lectura: ${err.message}`);
            }
        }, 1000);

    } catch (err) {
        console.error('❌ Error de conexión:', err.message);
        process.exit(1);
    }
}

monitorSOLAE();
