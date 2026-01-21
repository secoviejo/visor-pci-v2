# Avances del Proyecto - Visor PCI (21 de Enero 2026)

Hoy hemos realizado una transición crítica del sistema a un entorno de producción real en el servidor de la Universidad de Zaragoza.

## 🚀 Hitos Conseguidos

### 1. Migración Exitosa a MySQL
- Se ha pasado de una base de datos local SQLite a la base de datos **MySQL de producción** de la Universidad (`visor_pci_mysql.unizar.es`).
- Implementación de un **Adaptador de Base de Datos** (`database.js`) que permite conmutar entre SQLite y MySQL de forma transparente.
- Refactorización de todos los endpoints de la API en `server.js` para usar `async/await` y prevenir bloqueos.

### 2. Estabilidad del Servidor (Anti-502)
- Se ha implementado un mecanismo de **Arranque Seguro**: El servidor abre el puerto web inmediatamente antes de intentar conectar a la base de datos o hardware. Esto evita los errores "502 Bad Gateway" en Nginx si hay latencia en la conexión.

### 3. Visualización y UX Premium
- **Modo Oscuro Forzado**: Se han inyectado estilos críticos directamente en `app.html` para asegurar que el diseño premium (fondo oscuro, botones estilizados) se cargue correctamente incluso cuando el servidor de la universidad bloquea archivos CSS externos.
- **Explorador Lateral**: Nueva funcionalidad en el visor que permite buscar dispositivos por ID, ubicación o tipo y localizarlos en el plano.
- **Hotspots Visibles**: Se ha solucionado el problema de invisibilidad de los detectores en producción mediante inyección de CSS inline y rutas absolutas.

### 4. Integración y Notificaciones
- Actualización del servicio de notificaciones con soporte para:
    - **Email (SMTP/Gmail)**.
    - **SMS (Twilio)**.
    - **Telegram**.
- Mejoras en la integración Modbus/BACnet para el monitoreo real de centrales.
- **Centralización de Simulación**: Se ha movido la herramienta de "Simulación de Incidencias" al Panel de Administración como una nueva pestaña integrada, eliminando el acceso directo del dashboard para una gestión más segura y organizada.

### 5. Robustez en el Frontend
- Implementación de **rutas absolutas** para todos los assets para evitar problemas de resolución de rutas tras el proxy de la universidad.
- Unificación de claves de datos de dispositivos (soporte para claves cortas y largas) para evitar errores de visualización.

---
**Estado Actual:** El sistema está operativo y cargando datos reales en `http://visor_pci.unizar.es/`.
