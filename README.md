# Visor PCI - Fire Alarm Monitoring System

Sistema de monitorización de alarmas contra incendios para la Universidad de Zaragoza.

## Variables de Entorno

### ENABLE_HARDWARE
- **Descripción:** Habilita/deshabilita las conexiones a dispositivos físicos (Modbus/BACnet)
- **Valores:** `true` | `false`
- **Por defecto:** `false`
- **Uso:**
  - `true`: Para desarrollo local con acceso a dispositivos reales
  - `false`: Para despliegues en cloud (Render, Heroku, etc.) donde no hay dispositivos

### PORT
- **Descripción:** Puerto en el que escucha el servidor
- **Por defecto:** `3000`
- **Uso:** Configurado automáticamente por servicios como Render

## Despliegue en Render

1. Crear nuevo Web Service en https://dashboard.render.com
2. Conectar repositorio GitHub: `secoviejo/visor-pci-v2`
3. Configurar:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. **Variables de entorno** (Environment):
   ```
   ENABLE_HARDWARE=false
   ```
5. Deploy

**Nota:** Con `ENABLE_HARDWARE=false`, la aplicación funcionará en modo "solo visualización" sin intentar conectarse a dispositivos Modbus/BACnet.

## Desarrollo Local

Para desarrollo con dispositivos reales:
```bash
ENABLE_HARDWARE=true node server.js
```

O añade a tu `.env`:
```
ENABLE_HARDWARE=true
```

## Instalación

```bash
npm install
node server.js
```

Accede a `http://localhost:3000`

**Usuario por defecto:**
- Username: `admin`
- Password: `admin123`

## Tecnologías

- Node.js + Express
- Socket.IO (tiempo real)
- better-sqlite3 (base de datos)
- Tailwind CSS
- Modbus TCP (solo si ENABLE_HARDWARE=true)
- BACnet/IP (solo si ENABLE_HARDWARE=true)
