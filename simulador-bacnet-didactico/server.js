const express = require('express');
const path = require('path');
const BACnetFirePanel = require('./bacnetServer');

const app = express();
const HTTP_PORT = 3001;

// Crear instancia del panel BACnet
const firePanel = new BACnetFirePanel(40001, 47809);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Array para almacenar mensajes recientes
const messageLog = [];
const MAX_LOG_SIZE = 50;

// Escuchar eventos del panel
firePanel.on('message', (msg) => {
    msg.timestamp = new Date().toLocaleTimeString('es-ES');
    messageLog.unshift(msg);
    if (messageLog.length > MAX_LOG_SIZE) {
        messageLog.pop();
    }
});

firePanel.on('stateChange', (state) => {
    // Estado cambió, los clientes pueden polling o usar SSE
});

// API Endpoints

// Obtener estado actual
app.get('/api/state', (req, res) => {
    res.json(firePanel.getState());
});

// Obtener estadísticas
app.get('/api/stats', (req, res) => {
    res.json(firePanel.getStats());
});

// Obtener log de mensajes
app.get('/api/messages', (req, res) => {
    res.json(messageLog.slice(0, 20)); // Últimos 20 mensajes
});

// Activar alarma de dispositivo
app.post('/api/trigger/:device', (req, res) => {
    const { device } = req.params;
    firePanel.triggerAlarm(device);
    res.json({ success: true, device });
});

// Desactivar alarma de dispositivo
app.post('/api/clear/:device', (req, res) => {
    const { device } = req.params;
    firePanel.clearAlarm(device);
    res.json({ success: true, device });
});

// Resetear panel
app.post('/api/reset', (req, res) => {
    firePanel.resetPanel();
    res.json({ success: true });
});

// Simular Who-Is (para tutorial)
app.post('/api/tutorial/whois', (req, res) => {
    firePanel.client.whoIs();
    res.json({ success: true });
});

// Simular ReadProperty (para tutorial)
app.post('/api/tutorial/read/:object', (req, res) => {
    const { object } = req.params;
    // Esto es solo para el tutorial, normalmente lo haría un cliente externo
    res.json({ success: true, object });
});

// Iniciar servidor HTTP
app.listen(HTTP_PORT, () => {
    console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║  Simulador Didáctico BACnet - Central de Incendios       ║`);
    console.log(`╠═══════════════════════════════════════════════════════════╣`);
    console.log(`║  Interfaz Web:  http://localhost:${HTTP_PORT}                   ║`);
    console.log(`║  Servidor BACnet: 0.0.0.0:47809                           ║`);
    console.log(`║  Device ID: 40001                                         ║`);
    console.log(`╚═══════════════════════════════════════════════════════════╝\n`);
    console.log(`✅ Servidor listo. Abre http://localhost:${HTTP_PORT} en tu navegador.\n`);
});
