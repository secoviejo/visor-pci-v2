const bacnet = require('node-bacnet');
const EventEmitter = require('events');

class BACnetFirePanel extends EventEmitter {
    constructor(deviceId = 40001, port = 47809) {
        super();

        this.deviceId = deviceId;
        this.port = port;
        this.client = new bacnet({ port: this.port, apduTimeout: 6000 });

        // Estado de la central
        this.state = {
            // Objetos globales
            panelState: 1, // 1=Normal, 2=Alarma, 3=Avería
            activeAlarmsCount: 0,
            cmdReset: 0,

            // Dispositivos (Binary Inputs)
            det01Alarm: 0,
            det02Alarm: 0,
            det03Alarm: 0,
            mcp01Alarm: 0,
            sirenActive: 0
        };

        // Contadores de mensajes
        this.stats = {
            whoIs: 0,
            iAm: 0,
            readProperty: 0,
            writeProperty: 0,
            covNotifications: 0
        };

        // Suscripciones COV
        this.covSubscriptions = new Map();

        this.setupBACnetHandlers();
    }

    setupBACnetHandlers() {
        // Manejar Who-Is
        this.client.on('whoIs', (data) => {
            this.stats.whoIs++;
            this.emit('message', {
                type: 'request',
                service: 'Who-Is',
                from: data.address,
                humanText: 'Cliente pregunta: ¿Quién hay en la red?'
            });

            // Responder con I-Am
            this.client.iAmResponse(
                this.deviceId,
                bacnet.enum.Segmentation.SEGMENTATION_NONE,
                999 // Vendor ID
            );

            this.stats.iAm++;
            this.emit('message', {
                type: 'response',
                service: 'I-Am',
                humanText: `Dispositivo responde: Soy el Dispositivo ${this.deviceId}`
            });
        });

        // Manejar ReadProperty
        this.client.on('readProperty', (data) => {
            this.stats.readProperty++;

            const objType = data.request.objectId.type;
            const objInstance = data.request.objectId.instance;
            const propId = data.request.property.id;

            let value = null;
            let objectName = '';

            // Mapear objeto a valor
            if (objType === bacnet.enum.ObjectType.MULTI_STATE_VALUE && objInstance === 0) {
                objectName = 'ESTADO_PANEL';
                value = this.state.panelState;
            } else if (objType === bacnet.enum.ObjectType.ANALOG_VALUE && objInstance === 0) {
                objectName = 'CONTADOR_ALARMAS';
                value = this.state.activeAlarmsCount;
            } else if (objType === bacnet.enum.ObjectType.BINARY_VALUE && objInstance === 0) {
                objectName = 'CMD_RESET';
                value = this.state.cmdReset;
            } else if (objType === bacnet.enum.ObjectType.BINARY_INPUT) {
                const deviceMap = ['det01Alarm', 'det02Alarm', 'det03Alarm', 'mcp01Alarm', 'sirenActive'];
                const nameMap = ['ALARMA_DET_01', 'ALARMA_DET_02', 'ALARMA_DET_03', 'ALARMA_PULS_01', 'SIRENA_ACTIVA'];
                if (objInstance < deviceMap.length) {
                    objectName = nameMap[objInstance];
                    value = this.state[deviceMap[objInstance]];
                }
            }

            this.emit('message', {
                type: 'request',
                service: 'ReadProperty',
                from: data.address,
                humanText: `Cliente lee: ${objectName}`
            });

            if (value !== null && propId === bacnet.enum.PropertyIdentifier.PRESENT_VALUE) {
                // Responder con el valor
                this.client.readPropertyResponse(
                    data.address,
                    data.invoke,
                    data.request.objectId,
                    data.request.property,
                    [{ type: bacnet.enum.ApplicationTag.UNSIGNED_INTEGER, value: value }]
                );

                this.emit('message', {
                    type: 'response',
                    service: 'ReadProperty',
                    humanText: `Dispositivo: ${objectName} = ${value}`
                });
            }
        });

        // Manejar WriteProperty
        this.client.on('writeProperty', (data) => {
            this.stats.writeProperty++;

            const objType = data.request.objectId.type;
            const objInstance = data.request.objectId.instance;
            const value = data.request.values[0].value;

            this.emit('message', {
                type: 'request',
                service: 'WriteProperty',
                from: data.address,
                humanText: `Cliente escribe: CMD_RESET = ${value}`
            });

            // Solo permitir escritura en CMD_RESET
            if (objType === bacnet.enum.ObjectType.BINARY_VALUE && objInstance === 0) {
                if (value === 1) {
                    this.resetPanel();
                }

                // Confirmar escritura
                this.client.simpleAckResponse(data.address, bacnet.enum.BacnetConfirmedService.WRITE_PROPERTY, data.invoke);

                this.emit('message', {
                    type: 'response',
                    service: 'WriteProperty',
                    humanText: 'Escritura confirmada - Panel reseteado'
                });
            }
        });

        // Manejar suscripciones COV
        this.client.on('subscribeCOV', (data) => {
            const key = `${data.address}:${data.request.objectId.type}:${data.request.objectId.instance}`;
            this.covSubscriptions.set(key, {
                address: data.address,
                objectId: data.request.objectId,
                subscriptionId: data.request.subscriptionProcessId
            });

            this.emit('message', {
                type: 'cov',
                service: 'SubscribeCOV',
                humanText: 'Suscripción COV activada para ESTADO_PANEL'
            });

            // Confirmar suscripción
            this.client.simpleAckResponse(data.address, bacnet.enum.BacnetConfirmedService.SUBSCRIBE_COV, data.invoke);
        });

        console.log(`[BACnet] Servidor iniciado en puerto ${this.port}`);
        console.log(`[BACnet] Device ID: ${this.deviceId}`);

        // Enviar I-Am periódicamente para que los clientes nos descubran
        setInterval(() => {
            this.client.iAmResponse(
                this.deviceId,
                bacnet.enum.Segmentation.SEGMENTATION_NONE,
                999 // Vendor ID
            );
            console.log('[BACnet] Enviando I-Am broadcast...');
        }, 30000); // Cada 30 segundos

        // Enviar un I-Am inicial inmediatamente
        setTimeout(() => {
            this.client.iAmResponse(
                this.deviceId,
                bacnet.enum.Segmentation.SEGMENTATION_NONE,
                999
            );
            console.log('[BACnet] I-Am inicial enviado');
        }, 2000);
    }

    // Métodos para cambiar estado
    triggerAlarm(deviceName) {
        const deviceMap = {
            'det01': 'det01Alarm',
            'det02': 'det02Alarm',
            'det03': 'det03Alarm',
            'mcp01': 'mcp01Alarm'
        };

        if (deviceMap[deviceName]) {
            this.state[deviceMap[deviceName]] = 1;
            this.updatePanelState();
            this.emit('stateChange', this.state);
        }
    }

    clearAlarm(deviceName) {
        const deviceMap = {
            'det01': 'det01Alarm',
            'det02': 'det02Alarm',
            'det03': 'det03Alarm',
            'mcp01': 'mcp01Alarm'
        };

        if (deviceMap[deviceName]) {
            this.state[deviceMap[deviceName]] = 0;
            this.updatePanelState();
            this.emit('stateChange', this.state);
        }
    }

    updatePanelState() {
        // Contar alarmas activas
        this.state.activeAlarmsCount =
            this.state.det01Alarm +
            this.state.det02Alarm +
            this.state.det03Alarm +
            this.state.mcp01Alarm;

        // Actualizar estado del panel
        if (this.state.activeAlarmsCount > 0) {
            this.state.panelState = 2; // Alarma
            this.state.sirenActive = 1;
        } else {
            this.state.panelState = 1; // Normal
            this.state.sirenActive = 0;
        }

        // Enviar notificaciones COV si hay suscripciones
        this.sendCOVNotifications();
    }

    sendCOVNotifications() {
        this.covSubscriptions.forEach((sub) => {
            if (sub.objectId.type === bacnet.enum.ObjectType.MULTI_STATE_VALUE &&
                sub.objectId.instance === 0) {

                this.stats.covNotifications++;

                const stateText = ['', 'Normal', 'Alarma', 'Avería'][this.state.panelState];
                this.emit('message', {
                    type: 'cov',
                    service: 'COV Notification',
                    humanText: `Notificación COV: ESTADO_PANEL = ${stateText} (${this.state.panelState})`
                });

                // Enviar notificación COV
                this.client.covNotifyRequest(
                    sub.address,
                    sub.subscriptionId,
                    { type: this.deviceId, instance: 0 },
                    sub.objectId,
                    60, // lifetime
                    [{ property: { id: bacnet.enum.PropertyIdentifier.PRESENT_VALUE }, value: [{ type: bacnet.enum.ApplicationTag.UNSIGNED_INTEGER, value: this.state.panelState }] }]
                );
            }
        });
    }

    resetPanel() {
        this.state.det01Alarm = 0;
        this.state.det02Alarm = 0;
        this.state.det03Alarm = 0;
        this.state.mcp01Alarm = 0;
        this.state.panelState = 1;
        this.state.sirenActive = 0;
        this.state.activeAlarmsCount = 0;
        this.state.cmdReset = 0; // Auto-reset

        this.emit('stateChange', this.state);
        this.sendCOVNotifications();
    }

    getState() {
        return { ...this.state };
    }

    getStats() {
        return { ...this.stats };
    }
}

module.exports = BACnetFirePanel;
