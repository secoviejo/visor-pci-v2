# Avances 14/01/2026 - Resolución de Comunicación BACnet

Hoy se ha logrado estabilizar completamente la comunicación entre el Visor PCI y el Simulador Didáctico BACnet en entorno local.

## Logros Principales

### 1. Resolución de Errores de Conexión (UDP/IP)
- **Corrección de Puertos:** Se configuró el cliente BACnet del Visor para usar el puerto `47810`, evitando el conflicto con el puerto estándar `47809` que utiliza el servidor del simulador.
- **Vinculación Local:** Se forzó la conexión a `127.0.0.1` en lugar de `0.0.0.0` para asegurar que el tráfico UDP no se pierda por configuraciones de red o firewalls de Windows.

### 2. Estabilización del Servicio de Polling
- **Normalización de Datos:** Se actualizó `bacnetService.js` para manejar correctamente tanto valores booleanos (`true/false`) como numéricos (`1/0`) al leer el estado de alarmas (Binary Inputs). Esto resolvió fallos de interpretación de estado entre diferentes librerías.
- **Entorno Robusto:** Se implementó `ENABLE_HARDWARE=true` y `BACNET_PORT=47810` en el archivo `.env`, permitiendo que el sistema inicie sesión con todas las capacidades de hardware activas por defecto.

### 3. Verificación de Flujo de Alarmas
- **Activación:** Se comprobó que al activar un detector en el simulador (`http://localhost:3001`), el Visor PCI detecta el cambio en tiempo real (menos de 3 segundos).
- **Registro:** Las alarmas se insertan correctamente en la base de datos `pci.db`, asociadas al edificio `TEST_BACNET`.
- **Notificaciones:** Se validó el disparo del motor de notificaciones (Email/Telegram) al producirse eventos de hardware reales detectados vía BACnet.
- **Resolución Automática:** Al desactivar la alarma en el origen (simulador), el Visor actualiza el estado de la alerta a `RESUELTA` y libera el sistema.

## Estado del Proyecto
- **Simulador:** Operativo.
- **Visor PCI:** Comunicando sin timeouts.
- **Hardware Integrado:** Modbus y BACnet funcionando simultáneamente en LOCAL.

**Próximos Pasos:**
- Pruebas de carga con múltiples dispositivos simulados.
- Refuerzo de la interfaz de usuario para mostrar detalles específicos de objetos BACnet (descripciones de objetos).
