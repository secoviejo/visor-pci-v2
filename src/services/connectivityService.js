const net = require('net');

/**
 * Servicio de verificación de conectividad TCP para dispositivos Modbus.
 * Realiza pruebas de conexión sin requerir permisos de administrador.
 */
class ConnectivityService {
    constructor() {
        this.cache = new Map(); // Cache de resultados recientes
        this.cacheTimeout = 30000; // 30 segundos
    }

    /**
     * Verifica conectividad TCP a un host:puerto específico
     * @param {string} ip - Dirección IP del dispositivo
     * @param {number} port - Puerto (por defecto 502 para Modbus)
     * @param {number} timeout - Timeout en ms
     * @returns {Promise<{success: boolean, latency_ms?: number, error?: string}>}
     */
    async checkTcpConnection(ip, port = 502, timeout = 3000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const socket = new net.Socket();

            const cleanup = () => {
                socket.removeAllListeners();
                socket.destroy();
            };

            socket.setTimeout(timeout);

            socket.on('connect', () => {
                const latency = Date.now() - startTime;
                cleanup();
                resolve({ success: true, latency_ms: latency });
            });

            socket.on('timeout', () => {
                cleanup();
                resolve({ success: false, error: 'timeout' });
            });

            socket.on('error', (err) => {
                cleanup();
                resolve({ success: false, error: err.code || err.message });
            });

            try {
                socket.connect(port, ip);
            } catch (e) {
                cleanup();
                resolve({ success: false, error: e.message });
            }
        });
    }

    /**
     * Verifica la conectividad de todos los edificios con configuración Modbus
     * @param {object} db - Instancia de base de datos
     * @returns {Promise<{total: number, online: number, offline: number, percentage: number, details: Array}>}
     */
    async checkAllBuildings(db) {
        try {
            // Obtener edificios con IP Modbus configurada
            const buildings = await db.query(`
                SELECT id, name, modbus_ip, modbus_port 
                FROM buildings 
                WHERE modbus_ip IS NOT NULL AND modbus_ip != ''
            `);

            if (buildings.length === 0) {
                return {
                    total: 0,
                    online: 0,
                    offline: 0,
                    percentage: 100,
                    details: [],
                    message: 'Sin dispositivos configurados'
                };
            }

            // Verificar cada edificio en paralelo
            const checks = await Promise.all(
                buildings.map(async (b) => {
                    const port = b.modbus_port || 502;
                    const result = await this.checkTcpConnection(b.modbus_ip, port);

                    return {
                        building_id: b.id,
                        name: b.name,
                        ip: b.modbus_ip,
                        port: port,
                        status: result.success ? 'online' : 'offline',
                        latency_ms: result.latency_ms || null,
                        error: result.error || null
                    };
                })
            );

            const online = checks.filter(c => c.status === 'online').length;
            const offline = checks.filter(c => c.status === 'offline').length;
            const percentage = Math.round((online / checks.length) * 100);

            return {
                total: checks.length,
                online,
                offline,
                percentage,
                details: checks,
                lastCheck: new Date().toISOString()
            };

        } catch (e) {
            console.error('[Connectivity] Error checking buildings:', e);
            return {
                total: 0,
                online: 0,
                offline: 0,
                percentage: 0,
                details: [],
                error: e.message
            };
        }
    }

    /**
     * Verifica un edificio específico
     * @param {object} db - Base de datos
     * @param {number} buildingId - ID del edificio
     */
    async checkBuilding(db, buildingId) {
        const building = await db.get(
            'SELECT id, name, modbus_ip, modbus_port FROM buildings WHERE id = ?',
            [buildingId]
        );

        if (!building || !building.modbus_ip) {
            return { success: false, error: 'Edificio no configurado' };
        }

        const result = await this.checkTcpConnection(
            building.modbus_ip,
            building.modbus_port || 502
        );

        return {
            building_id: building.id,
            name: building.name,
            ip: building.modbus_ip,
            ...result
        };
    }
}

module.exports = new ConnectivityService();
