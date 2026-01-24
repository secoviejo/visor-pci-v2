# Instrucciones de Despliegue - Servidor Universidad de Zaragoza (WinSCP)

## Archivos Modificados en este Commit

### Nuevos Archivos
1. **`js/services/connectivityService.js`** - Servicio de verificación TCP para dispositivos Modbus
2. **`scripts/simulator_headless.js`** - Simulador sin terminal para entornos de producción

### Archivos Modificados
1. **`server.js`** - Nuevos endpoints de conectividad y uso del simulador headless
2. **`js/api.js`** - Función `getDeviceConnectivity()` añadida
3. **`dashboard.html`** - Widget dinámico de estado de dispositivos con modal
4. **`admin.html`** - Toggle de Modo Hardware
5. **`js/services/modbusService.js`** - Métodos `start()` y `stop()`
6. **`js/services/bacnetService.js`** - Métodos `start()` y `stop()`

---

## Pasos para Subir al Servidor de la Universidad (con WinSCP)

### 1. Abrir WinSCP y Conectar
- Abrir WinSCP
- Conectar a: `w_visor_pci@visor_pci.webunizar.es`
- Navegar al directorio del proyecto (lado derecho)

### 2. Hacer Backup (MUY RECOMENDADO)
**Antes de subir nada**, crear una copia de seguridad:
1. En WinSCP, seleccionar la carpeta raíz del proyecto
2. Click derecho → **Duplicar**
3. Renombrar a: `visor-pci-backup-YYYYMMDD` (ejemplo: `visor-pci-backup-20260122`)

### 3. Subir Archivos Nuevos
Desde tu PC local (`c:\dev\visor-pci-final`), arrastrar estos archivos al servidor:

**Carpeta `js/services/`:**
- Arrastrar `connectivityService.js` → `/js/services/` (servidor)

**Carpeta `scripts/`:**
- Arrastrar `simulator_headless.js` → `/scripts/` (servidor)

### 4. Sobrescribir Archivos Modificados
Arrastrar y **sobrescribir** estos archivos (WinSCP preguntará, confirmar "Sí"):

- `server.js` → raíz del proyecto
- `dashboard.html` → raíz del proyecto  
- `admin.html` → raíz del proyecto
- `js/api.js` → `/js/`
- `js/services/modbusService.js` → `/js/services/`
- `js/services/bacnetService.js` → `/js/services/`

### 5. Verificar que `.env` esté Correcto
En WinSCP, abrir el archivo `.env` del servidor (doble click) y verificar:
```env
DB_CLIENT=mysql
DB_HOST=visor_pci_mysql.unizar.es
DB_PORT=1980
DB_USER=visor_pci
DB_PASSWORD=sO8s+vKbZ4D2VHLJCwBm
DB_NAME=visor_pci_db
PORT=3000
NODE_ENV=production
ENABLE_HARDWARE=false
```

### 6. Reiniciar el Servicio Node.js

**Opción A: Usando PuTTY (si tienes acceso)**
```bash
pm2 restart visor-pci
pm2 logs visor-pci --lines 50
```

**Opción B: Desde el Panel de Control de la Universidad**
- Acceder al panel web de gestión del servidor
- Buscar el servicio "visor-pci" o "Node.js"
- Click en "Reiniciar" o "Restart"

**Opción C: Contactar con el Administrador**
Si no tienes permisos para reiniciar, enviar un correo al administrador del servidor solicitando:
> "Por favor, reiniciar el servicio Node.js del proyecto visor-pci para aplicar las actualizaciones"

### 7. Verificar que Funciona
Abrir en el navegador:
- **Dashboard:** `http://visor_pci.unizar.es/dashboard.html`
- Verificar que el widget "ESTADO DISPOSITIVOS" muestra datos (puede ser "N/A" si no hay IPs configuradas aún)

---

## Lista de Archivos a Subir (Checklist)

### ✅ Archivos Nuevos (Crear en servidor)
- [ ] `js/services/connectivityService.js`
- [ ] `scripts/simulator_headless.js`

### ✅ Archivos Modificados (Sobrescribir)
- [ ] `server.js`
- [ ] `dashboard.html`
- [ ] `admin.html`
- [ ] `js/api.js`
- [ ] `js/services/modbusService.js`
- [ ] `js/services/bacnetService.js`

---

## Nuevas Funcionalidades Disponibles

### 1. Estado de Conexión de Dispositivos
- **URL Dashboard:** `http://visor_pci.unizar.es/dashboard.html`
- El widget "ESTADO DISPOSITIVOS" ahora muestra el % real de dispositivos Modbus online
- Click en el widget abre un modal con detalles de cada edificio

### 2. Modo Hardware Dinámico
- **URL Admin:** `http://visor_pci.unizar.es/admin.html`
- En la pestaña "Pasarelas y Hardware" hay un toggle para activar/desactivar hardware sin reiniciar

### 3. Simulador Headless
- Ahora funciona correctamente en el servidor sin necesidad de terminal interactiva
- Se puede activar desde el Admin Panel

---

## Verificación Post-Despliegue

### Checklist
- [ ] Los archivos se subieron correctamente (verificar en WinSCP)
- [ ] El servicio se reinició sin errores
- [ ] Dashboard carga correctamente (`http://visor_pci.unizar.es/dashboard.html`)
- [ ] Widget "Estado Dispositivos" muestra datos (puede ser "N/A" si no hay IPs configuradas)
- [ ] Admin Panel → Pasarelas y Hardware → Toggle de Modo Hardware funciona
- [ ] Simulador se puede activar desde Admin Panel sin errores

### Configurar IPs Modbus (Opcional)
Para que el widget de conectividad muestre datos reales:
1. Ir a Admin Panel → Pasarelas y Hardware
2. En "Configuración de Centrales por Edificio", añadir las IPs de las centrales SOLAE
3. Guardar
4. Refrescar el Dashboard para ver el estado actualizado

---

## Rollback (Si algo falla)

### Con WinSCP
1. Conectar al servidor
2. **Eliminar** la carpeta del proyecto actual
3. **Renombrar** la carpeta de backup (`visor-pci-backup-YYYYMMDD`) al nombre original
4. Reiniciar el servicio Node.js

---

## Contacto y Soporte
Si hay algún problema durante el despliegue:
- Verificar los logs del servidor (si tienes acceso)
- Contactar con el administrador del sistema
- Revisar que todos los archivos se hayan subido correctamente en WinSCP
