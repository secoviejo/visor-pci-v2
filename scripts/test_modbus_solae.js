// Script de Prueba Modbus - SOLAE
// Uso: node test_modbus_solae.js [IP] [puerto]
// Ejemplo: node test_modbus_solae.js 192.168.1.100 502

const ModbusRTU = require("modbus-serial");

const ip = process.argv[2] || "155.210.147.1";
const port = parseInt(process.argv[3]) || 502;

const client = new ModbusRTU();

async function testConnection() {
    try {
        console.log(`\n=== Prueba de Conexión Modbus ===`);
        console.log(`IP: ${ip}`);
        console.log(`Puerto: ${port}\n`);

        console.log("Conectando...");
        await client.connectTCP(ip, { port: port });
        client.setID(1); // Unit ID
        client.setTimeout(2000); // 2 segundos de timeout

        console.log("✅ Conexión establecida correctamente\n");

        // Leer 2 entradas digitales desde dirección 0 (FC02)
        console.log("Leyendo entradas digitales (FC02, addr 0, count 2)...");
        const response = await client.readDiscreteInputs(0, 2);

        console.log("\n--- Estado de Entradas Digitales ---");
        console.log(`DI0 (Contacto 1): ${response.data[0] ? '🔴 CERRADO (ALARMA)' : '⚪ ABIERTO (NORMAL)'}`);
        console.log(`DI1 (Contacto 2): ${response.data[1] ? '🔴 CERRADO (ALARMA)' : '⚪ ABIERTO (NORMAL)'}`);

        console.log("\n--- Valores Crudos ---");
        console.log(`DI0: ${response.data[0]}`);
        console.log(`DI1: ${response.data[1]}`);

        await client.close();
        console.log("\n✅ Prueba completada exitosamente");

    } catch (e) {
        console.error("\n❌ Error de conexión:");
        console.error(e.message);
        console.error("\nPosibles causas:");
        console.error("1. El SOLAE no está encendido o conectado a la red");
        console.error("2. La IP es incorrecta");
        console.error("3. El puerto Modbus no es 502");
        console.error("4. Hay un firewall bloqueando la conexión");
        process.exit(1);
    }
}

console.log("========================================");
console.log("  Script de Prueba Modbus - SOLAE");
console.log("========================================");

testConnection();
