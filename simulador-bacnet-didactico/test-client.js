const bacnet = require('node-bacnet');

// Crear cliente BACnet
const client = new bacnet({ port: 47810, apduTimeout: 6000 });

console.log('Cliente BACnet iniciado en puerto 47810');
console.log('Intentando conectar con el simulador en 127.0.0.1:47809...\n');

// Dirección del simulador
const simulatorAddress = '127.0.0.1:47809';
const deviceId = 40001;

// Esperar un momento para que el cliente se inicialice
setTimeout(() => {
    console.log('=== Leyendo objetos del simulador ===\n');

    // Leer ESTADO_PANEL (Multi-State-Value:0)
    client.readProperty(
        simulatorAddress,
        { type: 19, instance: 0 }, // Multi-State-Value:0
        85, // Present-Value
        (err, value) => {
            if (err) {
                console.log('❌ Error leyendo ESTADO_PANEL:', err.message);
            } else {
                const estados = ['', 'Normal', 'Alarma', 'Avería'];
                console.log('✅ ESTADO_PANEL:', estados[value.values[0].value] || value.values[0].value);
            }
        }
    );

    // Leer CONTADOR_ALARMAS (Analog-Value:0)
    setTimeout(() => {
        client.readProperty(
            simulatorAddress,
            { type: 2, instance: 0 }, // Analog-Value:0
            85, // Present-Value
            (err, value) => {
                if (err) {
                    console.log('❌ Error leyendo CONTADOR_ALARMAS:', err.message);
                } else {
                    console.log('✅ CONTADOR_ALARMAS:', value.values[0].value);
                }
            }
        );
    }, 500);

    // Leer ALARMA_DET_01 (Binary-Input:0)
    setTimeout(() => {
        client.readProperty(
            simulatorAddress,
            { type: 3, instance: 0 }, // Binary-Input:0
            85, // Present-Value
            (err, value) => {
                if (err) {
                    console.log('❌ Error leyendo ALARMA_DET_01:', err.message);
                } else {
                    console.log('✅ ALARMA_DET_01:', value.values[0].value === 1 ? 'ACTIVA' : 'INACTIVA');
                }
            }
        );
    }, 1000);

    // Leer ALARMA_DET_02 (Binary-Input:1)
    setTimeout(() => {
        client.readProperty(
            simulatorAddress,
            { type: 3, instance: 1 }, // Binary-Input:1
            85, // Present-Value
            (err, value) => {
                if (err) {
                    console.log('❌ Error leyendo ALARMA_DET_02:', err.message);
                } else {
                    console.log('✅ ALARMA_DET_02:', value.values[0].value === 1 ? 'ACTIVA' : 'INACTIVA');
                }
            }
        );
    }, 1500);

    // Cerrar después de todas las lecturas
    setTimeout(() => {
        console.log('\n=== Prueba completada ===');
        process.exit(0);
    }, 3000);

}, 1000);
