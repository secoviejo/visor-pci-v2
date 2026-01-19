const ModbusRTU = require('modbus-serial');

async function checkSOLAEStatus() {
    const client = new ModbusRTU();
    const ip = '192.168.0.100';
    const port = 502;

    try {
        console.log('\n🔍 Verificando estado actual del SOLAE...\n');

        await client.connectTCP(ip, { port });
        client.setTimeout(3000);

        console.log(`✅ Conectado a ${ip}:${port}\n`);

        // Leer entradas digitales
        const response = await client.readDiscreteInputs(0, 2);
        const [di0, di1] = response.data;

        console.log('📊 Estado Actual de las Entradas Digitales:\n');
        console.log(`   DI0 (Contacto 1): ${di0 ? '🔴 CERRADO (ALARMA)' : '⚪ ABIERTO (NORMAL)'}`);
        console.log(`   DI1 (Contacto 2): ${di1 ? '🔴 CERRADO (ALARMA)' : '⚪ ABIERTO (NORMAL)'}`);
        console.log('\n');

        if (di0 || di1) {
            console.log('⚠️  HAY CONTACTOS CERRADOS - El sistema debería mostrar alarmas');
        } else {
            console.log('✅ Todos los contactos están abiertos - No debería haber alarmas');
        }

        client.close();

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

checkSOLAEStatus();
