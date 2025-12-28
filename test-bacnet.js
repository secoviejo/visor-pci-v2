const bacnet = require('@widesky/node-bacstack');

// Crear cliente BACnet
// Usamos puerto 47809 para la escucha del cliente para no chocar con YABE (47808)
const client = new bacnet({ port: 47809, apduTimeout: 6000, interface: '0.0.0.0' });

console.log("Iniciando cliente BACnet (Discovery Mode)...");

// Escuchar evento 'iAm' (respuesta de dispositivos)
client.on('iAm', (device) => {
    // device.address suele ser "IP" o "IP:Port"

    // Construimos la dirección correcta
    let targetAddress = device.address;

    // Si el dispositivo viene con puerto, lo usamos.
    if (device.port && device.port !== 47808) {
        if (!targetAddress.includes(':')) {
            targetAddress = `${targetAddress}:${device.port}`;
        }
    }

    console.log(`\n✅ Dispositivo encontrado:`);
    console.log(`  > Device ID: ${device.deviceId}`);
    console.log(`  > Address Raw: ${device.address}`);
    console.log(`  > Port Raw: ${device.port}`);
    console.log(`  > Target Address Computed: ${targetAddress}`);

    if (device.deviceId === 114712) {
        console.log(`\nIntentando leer ANALOG_INPUT:0 de ${targetAddress}...`);

        client.readProperty(targetAddress, { type: 0, instance: 0 }, 85, (err, value) => {
            if (err) {
                console.error("❌ Error leyendo propiedad:", err.message || err);
            } else {
                console.log("✅ Valor leído (ANALOG_INPUT:0):");
                if (value && value.values && value.values[0]) {
                    console.log("  > Value:", value.values[0].value);
                } else {
                    console.log("  > Raw Value:", value);
                }
            }
        });
    }
});

// Enviar Who-Is Unicast a la IP conocida
console.log("Enviando Who-Is a 192.168.1.100...");
client.whoIs({ address: '192.168.1.100' });

setInterval(() => {
    console.log("Re-enviando Who-Is...");
    client.whoIs({ address: '192.168.1.100' });
}, 3000);

// Manejo de errores
client.on('error', (err) => {
    console.error('Error en cliente BACnet:', err);
});
