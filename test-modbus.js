const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();

// Configuración del simulador Modbus Slave (según la imagen)
const HOST = "127.0.0.1";
const PORT = 502;
const UNIT_ID = 1;

async function testConnection() {
    try {
        console.log(`Intentando conectar a ${HOST}:${PORT}...`);

        // 1. Conectar via TCP
        await client.connectTCP(HOST, { port: PORT });
        client.setID(UNIT_ID);

        console.log("✅ Conectado correctamente.");

        // 2. Leer Holding Registers (Función 03)
        // Leemos desde la dirección 0, un total de 10 registros
        console.log("Leyendo registros 0-9...");
        const data = await client.readHoldingRegisters(0, 10);

        console.log("Valores recibidos:");
        data.data.forEach((val, i) => {
            console.log(`  Registro ${i}: ${val}`);
        });

        // Cerrar conexión
        client.close();
        console.log("\nPrueba finalizada con éxito.");
        process.exit(0);

    } catch (e) {
        console.error("❌ Error en la conexión:");
        console.error(e.message);

        if (e.code === 'ECONNREFUSED') {
            console.log("\n⚠️  Asegúrate de que el 'Modbus Slave' esté abierto y configurado en el puerto 502.");
        }

        process.exit(1);
    }
}

testConnection();
