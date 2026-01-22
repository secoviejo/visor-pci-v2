# Instrucciones de Despliegue - Servidor Universidad de Zaragoza

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

## Pasos para Subir al Servidor de la Universidad

### 1. Conectar al Servidor
```bash
ssh tu_usuario@visor_pci.unizar.es
```

### 2. Navegar al Directorio del Proyecto
```bash
cd /ruta/al/proyecto/visor-pci
```

### 3. Hacer Backup (Recomendado)
```bash
cp -r . ../visor-pci-backup-$(date +%Y%m%d-%H%M%S)
```

### 4. Actualizar Código desde Git
```bash
git fetch origin
git pull origin feature/mysql-async-refactor
```

### 5. Instalar Dependencias (si es necesario)
```bash
npm install
```

### 6. Verificar Variables de Entorno
Asegúrate de que el archivo `.env` en el servidor tenga:
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

### 7. Reiniciar el Servicio
Dependiendo de cómo esté configurado el servidor:

**Si usa PM2:**
```bash
pm2 restart visor-pci
pm2 logs visor-pci --lines 50
```

**Si usa systemd:**
```bash
sudo systemctl restart visor-pci
sudo systemctl status visor-pci
```

**Si es manual:**
```bash
# Detener proceso actual
pkill -f "node server.js"

# Iniciar nuevo proceso
nohup node server.js > logs/server.log 2>&1 &
```

### 8. Verificar que Funciona
```bash
# Verificar que el servidor responde
curl http://localhost:3000/api/status

# Verificar conectividad de dispositivos
curl http://localhost:3000/api/devices/connectivity
```

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
- [ ] El servidor arranca sin errores (`pm2 logs` o `systemctl status`)
- [ ] Dashboard carga correctamente
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
```bash
cd /ruta/al/proyecto
git reset --hard HEAD~1
pm2 restart visor-pci
```

O restaurar desde backup:
```bash
rm -rf visor-pci
mv ../visor-pci-backup-YYYYMMDD-HHMMSS visor-pci
pm2 restart visor-pci
```

---

## Contacto
Si hay algún problema durante el despliegue, revisar los logs:
```bash
pm2 logs visor-pci --lines 100
# o
tail -f logs/server.log
```
