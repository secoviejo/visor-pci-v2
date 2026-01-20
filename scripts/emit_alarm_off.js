// Script para emitir evento de alarma resuelta via Socket.io
const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('✅ Conectado al servidor Socket.io\n');

    // Emitir evento de alarma resuelta
    const event = {
        elementId: 'CIE-H12-27-0',
        type: 'detector',
        status: 'RESUELTA',
        ended_at: new Date().toISOString()
    };

    console.log('📤 Emitiendo evento pci:alarm:off:', event);
    socket.emit('pci:alarm:off', event);

    setTimeout(() => {
        console.log('\n✅ Evento emitido correctamente\n');
        socket.disconnect();
        process.exit(0);
    }, 1000);
});

socket.on('connect_error', (error) => {
    console.error('❌ Error de conexión:', error.message);
    process.exit(1);
});
