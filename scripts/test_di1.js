const ModbusRTU = require('modbus-serial');

const ip = '192.168.0.100';
const port = 502;

async function testDI1() {
    const client = new ModbusRTU();

    try {
        console.log('\n🧪 Prueba del Contacto DI1 del SOLAE');
        console.log('=====================================\n');

        await client.connectTCP(ip, { port });
        client.setTimeout(3000);

        console.log(`✅ Conectado a ${ip}:${port}\n`);

        // Leer estado actual
        const response = await client.readDiscreteInputs(0, 2);
        const [di0, di1] = response.data;

        console.log('📊 Estado Actual:');
        console.log(`   DI0: ${di0 ? '🔴 CERRADO' : '⚪ ABIERTO'}`);
        console.log(`   DI1: ${di1 ? '🔴 CERRADO' : '⚪ ABIERTO'}\n`);

        console.log('📋 Instrucciones para la Prueba:');
        console.log('================================\n');
        console.log('1. Asegúrate de que DI1 esté ABIERTO inicialmente');
        console.log('2. CIERRA el contacto DI1 en el SOLAE físico');
        console.log('3. Observa los logs del servidor (deberías ver [Hardware Event])');
        console.log('4. Verifica en el dashboard que aparece una nueva alarma');
        console.log('5. ABRE el contacto DI1 de nuevo');
        console.log('6. Verifica que la alarma se resuelve\n');

        console.log('💡 Tip: Ejecuta "node monitor_solae_realtime.js" en otra terminal');
        console.log('   para ver los cambios en tiempo real\n');

        client.close();

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

testDI1();
