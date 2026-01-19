const ModbusRTU = require('modbus-serial');

async function testModbusConnection(ip, port = 502) {
    const client = new ModbusRTU();

    try {
        console.log(`\n🔍 Probando conexión Modbus a ${ip}:${port}...`);

        // Intentar conectar con timeout
        await client.connectTCP(ip, { port });
        client.setTimeout(3000);

        console.log(`✅ Conexión TCP establecida con ${ip}:${port}`);

        // Intentar leer registros típicos de SOLAE
        // SOLAE suele tener información en los primeros registros
        try {
            const data = await client.readHoldingRegisters(0, 10);
            console.log(`✅ Lectura Modbus exitosa!`);
            console.log(`📊 Primeros 10 registros:`, data.data);
            console.log(`\n🎯 DISPOSITIVO ENCONTRADO: ${ip} es muy probablemente tu SOLAE`);
        } catch (readErr) {
            console.log(`⚠️  Conexión TCP OK, pero error al leer registros:`, readErr.message);
            console.log(`   Puede ser un dispositivo Modbus pero no configurado como SOLAE`);
        }

        client.close();
        return true;

    } catch (err) {
        console.log(`❌ No se pudo conectar a ${ip}:${port}`);
        console.log(`   Error: ${err.message}`);
        return false;
    }
}

async function scanNetwork() {
    console.log('🔍 Escaneando red 192.168.0.x en busca del SOLAE...\n');

    // Primero probar la IP que vimos en ARP
    const knownIP = '192.168.0.123';
    const found = await testModbusConnection(knownIP);

    if (!found) {
        console.log('\n🔍 IP conocida no responde. Escaneando rango común de IPs...');

        // Probar IPs comunes para dispositivos industriales
        const commonIPs = [
            '192.168.0.100', '192.168.0.101', '192.168.0.102',
            '192.168.0.10', '192.168.0.20', '192.168.0.50',
            '192.168.0.200', '192.168.0.201'
        ];

        for (const ip of commonIPs) {
            await testModbusConnection(ip);
        }
    }
}

scanNetwork().then(() => {
    console.log('\n✅ Escaneo completado');
    process.exit(0);
}).catch(err => {
    console.error('❌ Error en escaneo:', err);
    process.exit(1);
});
