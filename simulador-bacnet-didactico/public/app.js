// API Base URL
const API_URL = '';

// Estado global
let currentState = {};
let tutorialMode = false;

// Información de objetos BACnet
const objectInfo = {
    panelState: {
        title: 'ESTADO_PANEL (MSV)',
        description: 'Un Multi-State Value representa un estado con múltiples valores posibles.',
        details: 'En este caso: 1=Normal, 2=Alarma, 3=Avería. Es el estado global de la central de incendios.'
    },
    activeAlarms: {
        title: 'CONTADOR_ALARMAS (AV)',
        description: 'Un Analog Value representa un valor numérico.',
        details: 'Cuenta cuántas alarmas están activas en este momento (0-5).'
    },
    cmdReset: {
        title: 'CMD_RESET (BV)',
        description: 'Un Binary Value es un valor escribible on/off.',
        details: 'Escribir 1 resetea toda la central. Automáticamente vuelve a 0.'
    },
    det01: {
        title: 'ALARMA_DET_01 (BI)',
        description: 'Un Binary Input representa un sensor on/off.',
        details: 'Estado del Detector de Humo Zona 1. 0=Normal, 1=Alarma.'
    },
    det02: {
        title: 'ALARMA_DET_02 (BI)',
        description: 'Un Binary Input representa un sensor on/off.',
        details: 'Estado del Detector de Humo Zona 2. 0=Normal, 1=Alarma.'
    },
    det03: {
        title: 'ALARMA_DET_03 (BI)',
        description: 'Un Binary Input representa un sensor on/off.',
        details: 'Estado del Detector de Humo Zona 3. 0=Normal, 1=Alarma.'
    },
    mcp01: {
        title: 'ALARMA_PULS_01 (BI)',
        description: 'Un Binary Input representa un sensor on/off.',
        details: 'Estado del Pulsador Manual 1. 0=Normal, 1=Alarma.'
    },
    siren: {
        title: 'SIRENA_ACTIVA (BI)',
        description: 'Un Binary Input representa un sensor on/off.',
        details: 'Estado de la sirena. 0=Apagada, 1=Encendida. Se activa automáticamente cuando hay alarmas.'
    }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    startPolling();
});

// Event Listeners
function setupEventListeners() {
    // Botones de activar alarma
    document.querySelectorAll('.trigger-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const device = btn.dataset.device;
            const isActive = btn.classList.contains('active');

            if (isActive) {
                clearAlarm(device);
            } else {
                triggerAlarm(device);
            }
        });
    });

    // Botón reset
    document.getElementById('reset-btn').addEventListener('click', resetPanel);

    // Botones de info
    document.querySelectorAll('.info-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const objectId = btn.dataset.info;
            showObjectInfo(objectId);
        });
    });

    // Tutorial toggle
    document.getElementById('tutorial-toggle').addEventListener('click', toggleTutorial);

    // Modal close
    document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('tutorial-modal').style.display = 'none';
    });
}

// API Calls
async function triggerAlarm(device) {
    try {
        const response = await fetch(`${API_URL}/api/trigger/${device}`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            addMessage('info', `Alarma activada: ${device.toUpperCase()}`);
        }
    } catch (error) {
        console.error('Error triggering alarm:', error);
    }
}

async function clearAlarm(device) {
    try {
        const response = await fetch(`${API_URL}/api/clear/${device}`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            addMessage('info', `Alarma desactivada: ${device.toUpperCase()}`);
        }
    } catch (error) {
        console.error('Error clearing alarm:', error);
    }
}

async function resetPanel() {
    try {
        const response = await fetch(`${API_URL}/api/reset`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            addMessage('info', 'Panel reseteado');
        }
    } catch (error) {
        console.error('Error resetting panel:', error);
    }
}

async function fetchState() {
    try {
        const response = await fetch(`${API_URL}/api/state`);
        const state = await response.json();
        updateUI(state);
        currentState = state;
    } catch (error) {
        console.error('Error fetching state:', error);
    }
}

async function fetchStats() {
    try {
        const response = await fetch(`${API_URL}/api/stats`);
        const stats = await response.json();
        updateStats(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

async function fetchMessages() {
    try {
        const response = await fetch(`${API_URL}/api/messages`);
        const messages = await response.json();
        updateMessageLog(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
    }
}

// UI Updates
function updateUI(state) {
    // Estado global
    const statusCircle = document.querySelector('.status-circle');
    const stateText = ['', 'NORMAL', 'ALARMA', 'AVERÍA'][state.panelState];
    const stateClass = ['', 'normal', 'alarm', 'trouble'][state.panelState];

    statusCircle.textContent = stateText;
    statusCircle.className = `status-circle ${stateClass}`;

    // Contador de alarmas
    document.getElementById('alarm-count').textContent = state.activeAlarmsCount;

    // Dispositivos
    updateDeviceCard('det01', state.det01Alarm);
    updateDeviceCard('det02', state.det02Alarm);
    updateDeviceCard('det03', state.det03Alarm);
    updateDeviceCard('mcp01', state.mcp01Alarm);

    // Sirena
    const sirenCard = document.querySelector('.device-card.sirena');
    const sirenStatus = document.getElementById('siren-status');
    if (state.sirenActive) {
        sirenCard.classList.add('active');
        sirenStatus.textContent = 'Encendida 🔊';
    } else {
        sirenCard.classList.remove('active');
        sirenStatus.textContent = 'Apagada';
    }

    // Árbol de objetos
    updateObjectValue('panelState', stateText, state.panelState !== 1);
    updateObjectValue('activeAlarms', state.activeAlarmsCount, state.activeAlarmsCount > 0);
    updateObjectValue('cmdReset', state.cmdReset, false);
    updateObjectValue('det01', state.det01Alarm, state.det01Alarm === 1);
    updateObjectValue('det02', state.det02Alarm, state.det02Alarm === 1);
    updateObjectValue('det03', state.det03Alarm, state.det03Alarm === 1);
    updateObjectValue('mcp01', state.mcp01Alarm, state.mcp01Alarm === 1);
    updateObjectValue('siren', state.sirenActive, state.sirenActive === 1);
}

function updateDeviceCard(device, isActive) {
    const btn = document.querySelector(`[data-device="${device}"]`);
    const card = btn.closest('.device-card');

    if (isActive) {
        btn.classList.add('active');
        btn.textContent = 'Desactivar';
        card.classList.add('active');
    } else {
        btn.classList.remove('active');
        btn.textContent = 'Activar Alarma';
        card.classList.remove('active');
    }
}

function updateObjectValue(objectId, value, isAlarm) {
    const element = document.getElementById(`obj-${objectId}`);
    if (element) {
        element.textContent = value;
        if (isAlarm) {
            element.classList.add('alarm');
        } else {
            element.classList.remove('alarm');
        }
    }
}

function updateStats(stats) {
    document.getElementById('stat-whois').textContent = stats.whoIs;
    document.getElementById('stat-iam').textContent = stats.iAm;
    document.getElementById('stat-read').textContent = stats.readProperty;
    document.getElementById('stat-write').textContent = stats.writeProperty;
    document.getElementById('stat-cov').textContent = stats.covNotifications;
}

function updateMessageLog(messages) {
    const logContainer = document.getElementById('message-log');

    if (messages.length === 0) return;

    logContainer.innerHTML = messages.map(msg => `
        <div class="log-entry ${msg.type}">
            <span class="log-time">${msg.timestamp}</span>
            <span class="log-text">${msg.humanText}</span>
        </div>
    `).join('');
}

function addMessage(type, text) {
    const logContainer = document.getElementById('message-log');
    const time = new Date().toLocaleTimeString('es-ES');

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-text">${text}</span>
    `;

    logContainer.insertBefore(entry, logContainer.firstChild);

    // Limitar a 20 mensajes
    while (logContainer.children.length > 20) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

// Object Info
function showObjectInfo(objectId) {
    const info = objectInfo[objectId];
    if (!info) return;

    const detailsDiv = document.getElementById('object-details');
    const titleDiv = document.getElementById('detail-title');
    const contentDiv = document.getElementById('detail-content');

    titleDiv.textContent = info.title;
    contentDiv.innerHTML = `
        <p style="margin-bottom: 0.75rem;"><strong>¿Qué es?</strong><br>${info.description}</p>
        <p><strong>Detalles:</strong><br>${info.details}</p>
    `;

    detailsDiv.style.display = 'block';

    // Highlight selected object
    document.querySelectorAll('.object-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelector(`[data-object="${objectId}"]`).classList.add('selected');
}

// Tutorial
function toggleTutorial() {
    const modal = document.getElementById('tutorial-modal');
    const content = document.getElementById('tutorial-content');

    content.innerHTML = `
        <div style="max-width: 500px;">
            <h3>📘 Paso 1: Descubrimiento BACnet</h3>
            <p><strong>¿Qué vas a hacer?</strong><br>
            Simular que un cliente BACnet pregunta "¿quién hay en la red?"</p>
            
            <p><strong>¿Qué deberías ver?</strong><br>
            - Mensaje: "Cliente pregunta: ¿Quién hay en la red?"<br>
            - Respuesta: "Dispositivo responde: Soy el Dispositivo 40001"<br>
            - Contadores Who-Is e I-Am incrementan</p>
            
            <p><strong>¿Qué significa en BACnet?</strong><br>
            Who-Is es un broadcast UDP que pregunta por dispositivos en la red.
            I-Am es la respuesta con Device ID, IP y puerto.</p>
            
            <hr style="margin: 1.5rem 0;">
            
            <h3>📘 Paso 2: Leer Estado del Panel</h3>
            <p><strong>¿Qué vas a hacer?</strong><br>
            Leer el valor actual de ESTADO_PANEL</p>
            
            <p><strong>¿Qué significa en BACnet?</strong><br>
            ReadProperty es el servicio básico para leer cualquier propiedad de cualquier objeto BACnet.</p>
            
            <hr style="margin: 1.5rem 0;">
            
            <h3>📘 Paso 3: Simular Alarma</h3>
            <p><strong>Acción:</strong><br>
            Haz clic en "Activar Alarma" en DETECTOR 01</p>
            
            <p><strong>¿Qué deberías ver?</strong><br>
            - ALARMA_DET_01 cambia a 1<br>
            - ESTADO_PANEL cambia a 2 (Alarma)<br>
            - SIRENA_ACTIVA cambia a 1<br>
            - Estado global se pone ROJO</p>
            
            <hr style="margin: 1.5rem 0;">
            
            <h3>📘 Paso 4: Resetear Panel</h3>
            <p><strong>Acción:</strong><br>
            Haz clic en "RESETEAR PANEL"</p>
            
            <p><strong>¿Qué significa en BACnet?</strong><br>
            Esto simula un WriteProperty a CMD_RESET. Algunos objetos tienen lógica interna (como este reset automático).</p>
            
            <hr style="margin: 1.5rem 0;">
            
            <p style="background: #DBEAFE; padding: 1rem; border-radius: 6px;">
            <strong>💡 Consejo:</strong> Usa un cliente BACnet externo (como YABE o el CBMS BACnet Simulator que tienes instalado) para ver la comunicación real. El simulador responde en el puerto 47808.
            </p>
        </div>
    `;

    modal.style.display = 'flex';
}

// Polling
function startPolling() {
    // Actualizar estado cada segundo
    setInterval(fetchState, 1000);

    // Actualizar estadísticas cada 2 segundos
    setInterval(fetchStats, 2000);

    // Actualizar mensajes cada 1.5 segundos
    setInterval(fetchMessages, 1500);

    // Primera carga inmediata
    fetchState();
    fetchStats();
    fetchMessages();
}
