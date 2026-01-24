# Informe de Análisis en Profundidad: Visor PCI

**Fecha:** 24 de Enero de 2026
**Versión del Software:** 1.0.0
**Tecnologías Principales:** Node.js, Express, SQLite/MySQL, Socket.io, Modbus/BACnet.

---

## 1. Resumen Ejecutivo
El software "Visor PCI" es una aplicación robusta de monitorización y gestión de alarmas para sistemas de Protección Contra Incendios (PCI). Cuenta con una arquitectura monolítica basada en Node.js que integra servicios de hardware (Modbus, BACnet) con una interfaz web en tiempo real.

El sistema es funcional y cubre los requisitos básicos de monitorización, gestión de usuarios y notificaciones. Sin embargo, la estructura actual del código presenta deuda técnica que podría dificultar la escalabilidad y el mantenimiento a largo plazo.

---

## 2. Análisis de Arquitectura

### 2.1. Estructura de Directorios
**Estado Actual:**
- La estructura es híbrida y algo confusa.
- Archivos HTML en la raíz (`/`).
- Lógica de backend mezclada en carpetas que parecen de frontend (`js/services` vs `services/`).
- `js/` contiene tanto scripts de cliente (`api.js`, `app.js`) como adaptadores de base de datos (`js/db`).

**Impacto:**
Dificulta la distinción entre código que se ejecuta en el servidor y código que se envía al navegador. Aumenta la carga cognitiva para nuevos desarrolladores.

### 2.2. Capa de Datos (Database)
**Estado Actual:**
- Abstracción personalizada (`database.js`) que soporta SQLite y MySQL.
- Creación de esquema mediante sentencias `CREATE TABLE IF NOT EXISTS` en strings dentro del código.
- No existe un sistema de gestión de migraciones (versionado de base de datos).

**Impacto:**
Cambiar el esquema de la base de datos (añadir columnas, tablas) en producción será riesgoso y manual. No hay historial de cambios en la DB.

### 2.3. Servicios de Hardware (Modbus/BACnet)
**Estado Actual:**
- **Modbus (`modbusService.js`):** La lógica de lectura es rígida (`readDiscreteInputs(0, 2)`). Asume que todos los edificios tienen la misma configuración de registros.
- **Conexión:** La lógica de reconexión y gestión de clientes está bien implementada con mapas de clientes.

**Impacto:**
Si se añaden dispositivos de diferentes fabricantes o modelos que usan registros diferentes, habrá que modificar el código fuente (`modbusService.js`), lo cual viola el principio de "Abierto/Cerrado" (Open/Closed Principle).

### 2.4. Lógica de Negocio
**Estado Actual:**
- Parte de la lógica de negocio (reacción a eventos de Modbus) reside directamente en `server.js` (`modbusService.on('change', ...)`).
- La gestión de notificaciones está mejor modularizada en `notificationService.js`.

**Impacto:**
`server.js` se convierte en una "clase dios" que sabe demasiado. Dificulta los tests unitarios de la lógica de alarmas.

---

## 3. Calidad del Código (Code Quality)

- **Legibilidad:** El código es legible, usa nombres de variables descriptivos y Async/Await moderno.
- **Seguridad:**
    - Uso correcto de variables de entorno (`.env`) para secretos.
    - Autenticación JWT implementada.
    - Inyección SQL mitigada mediante el uso de "prepared statements" (`?`) en las consultas.
- **Frontend:**
    - `app.js` y `api.js` son archivos muy grandes. Indican una arquitectura de frontend monolítica (probablemente jQuery o Vanilla JS sin bundler moderno). Esto hace que el mantenimiento de la UI sea complejo.

---

## 4. Áreas de Mejora y Recomendaciones

### 4.1. Reestructuración del Proyecto (Refactoring)
**Prioridad: Alta**
- Mover todo el código de servidor a una carpeta `src/` o `server/`.
- Mover todos los archivos públicos (HTML, imagenes, CSS, JS del cliente) a `public/`.
- Unificar servicios: Mover `js/services/*` a `services/` junto con `notificationService`.
- Mover adaptadores de DB a `db/adapters/`.

### 4.2. Sistema de Migraciones de Base de Datos
**Prioridad: Alta**
- Implementar una herramienta de migraciones (ej. `db-migrate`, `knex` o simplemente scripts SQL versionados).
- Esto permitirá desplegar cambios en la estructura de la base de datos de manera segura y automática.

### 4.3. Configuración Dinámica de Hardware
**Prioridad: Media**
- Modificar la tabla `devices` o `buildings` para incluir la configuración de registros Modbus (dirección de inicio, cantidad a leer, mapeo de bits a alarmas).
- Actualizar `modbusService.js` para leer esta configuración al conectar, permitiendo flexibilidad total sin tocar código.

### 4.4. Desacoplamiento de Lógica de Alarmas
**Prioridad: Media**
- Crear un `AlarmService` o `EventProcessor`.
- Mover la lógica que está en `server.js` (escuchar eventos Modbus, insertar en DB, emitir Socket.io) a este nuevo servicio.
- `server.js` solo debería inicializar servicios, no orquestar su lógica interna.

### 4.5. Automatización y DevOps
**Prioridad: Media**
- Crear un pipeline de CI/CD (GitHub Actions) si se planea trabajar en equipo.
- Mejorar el `Dockerfile` para asegurar builds reproducibles y ligeros (multi-stage builds).

---

## 5. Conclusión
El proyecto tiene una base sólida y funcional. Las mejoras propuestas están orientadas a la **madurez del software**: hacerlo más fácil de mantener, más seguro de desplegar y más flexible ante cambios de hardware. Se recomienda empezar por la **reestructuración de directorios** para sanear el entorno de trabajo antes de abordar cambios funcionales complejos.
