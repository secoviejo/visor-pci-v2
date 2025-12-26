// Real-time Gateway
// Connects to Socket.io and dispatches global window events for the Alerts System

const socket = io();

socket.on('connect', () => {
    console.log('[Realtime] Connected to server via Socket.io');
});

socket.on('disconnect', () => {
    console.log('[Realtime] Disconnected');
});

// Handle Alarm ON
socket.on('pci:alarm:on', (data) => {
    console.log('[Realtime] Received Alarm:', data);

    // Dispatch standard event for Alerts.py
    window.dispatchEvent(new CustomEvent('pci:alarm:on', {
        detail: {
            elementId: data.elementId,
            type: data.type,
            location: data.location,
            description: data.description,
            origin: data.origin, // 'REAL'
            buildingId: data.building_id,
            floorId: data.floor_id
        }
    }));
});

// Handle Alarm OFF
socket.on('pci:alarm:off', (data) => {
    console.log('[Realtime] Received Alarm RESOLVED:', data);

    window.dispatchEvent(new CustomEvent('pci:alarm:off', {
        detail: {
            elementId: data.elementId,
            type: data.type
        }
    }));
});
