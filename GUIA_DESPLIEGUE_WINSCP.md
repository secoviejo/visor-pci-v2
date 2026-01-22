# 🚀 Guía de Despliegue WinSCP - Descomprimir en Local

## 📍 Situación Actual
- ✅ Tienes el archivo `VISOR_PCI_DEPLOY_20260122_1756.zip` en tu PC
- ✅ Tienes WinSCP conectado al servidor
- 📂 Vas a descomprimir en tu PC y subir los archivos

---

## 🔧 PASO 1: Descomprimir en tu PC

1. **Localizar el ZIP en tu PC:**
   - Ruta: `c:\dev\visor-pci-final\VISOR_PCI_DEPLOY_20260122_1756.zip`

2. **Descomprimir:**
   - Click derecho en el archivo ZIP
   - Seleccionar **"Extraer aquí"** o **"Extract here"**
   - Se creará la carpeta `deploy_package`

3. **Verificar contenido:**
   ```
   deploy_package/
   ├── NUEVOS/
   │   ├── connectivityService.js
   │   └── simulator_headless.js
   ├── MODIFICADOS/
   │   ├── server.js
   │   ├── dashboard.html
   │   ├── admin.html
   │   ├── api.js
   │   ├── modbusService.js
   │   └── bacnetService.js
   ├── LEEME_PRIMERO.md
   └── DEPLOY_UNIZAR.md
   ```

---

## 🔒 PASO 2: HACER BACKUP EN EL SERVIDOR (¡IMPORTANTE!)

**En WinSCP:**

1. **Panel derecho (servidor):** Navegar a la carpeta del proyecto
   - Probablemente: `/home/w_visor_pci/visor-pci/` o similar

2. **Duplicar la carpeta completa:**
   - Click derecho en la carpeta del proyecto
   - Seleccionar **"Duplicar"**
   - Nombre nuevo: `visor-pci-backup-20260122`

3. **Verificar que el backup se creó correctamente**

---

## 📤 PASO 3: Subir Archivos NUEVOS

**En WinSCP:**

### 3.1 Subir `connectivityService.js`
- **Panel izquierdo (tu PC):** Navegar a `c:\dev\visor-pci-final\deploy_package\NUEVOS\`
- **Panel derecho (servidor):** Navegar a `/js/services/`
- **Arrastrar** `connectivityService.js` del panel izquierdo al derecho
- ✅ Confirmar subida

### 3.2 Subir `simulator_headless.js`
- **Panel izquierdo (tu PC):** Mantener en `deploy_package\NUEVOS\`
- **Panel derecho (servidor):** Navegar a `/scripts/`
- **Arrastrar** `simulator_headless.js` del panel izquierdo al derecho
- ✅ Confirmar subida

---

## 🔄 PASO 4: Sobrescribir Archivos MODIFICADOS

**En WinSCP:**

### 4.1 Archivos en la raíz del proyecto
- **Panel izquierdo (tu PC):** Navegar a `c:\dev\visor-pci-final\deploy_package\MODIFICADOS\`
- **Panel derecho (servidor):** Navegar a la **raíz del proyecto**

**Arrastrar estos 3 archivos:**
1. `server.js`
2. `dashboard.html`
3. `admin.html`

**Cuando pregunte "¿Sobrescribir?":**
- ✅ Confirmar **"Sí"** o **"Sí a todo"**

### 4.2 Archivo en `/js/`
- **Panel izquierdo (tu PC):** Mantener en `deploy_package\MODIFICADOS\`
- **Panel derecho (servidor):** Navegar a `/js/`

**Arrastrar:**
1. `api.js`

**Sobrescribir:** ✅ Confirmar **"Sí"**

### 4.3 Archivos en `/js/services/`
- **Panel izquierdo (tu PC):** Mantener en `deploy_package\MODIFICADOS\`
- **Panel derecho (servidor):** Navegar a `/js/services/`

**Arrastrar estos 2 archivos:**
1. `modbusService.js`
2. `bacnetService.js`

**Sobrescribir:** ✅ Confirmar **"Sí a todo"**

---

## ✅ PASO 5: Verificar que Todo se Subió

**En WinSCP, verificar que existen en el servidor:**

### Archivos NUEVOS (deben existir):
- ✅ `/js/services/connectivityService.js`
- ✅ `/scripts/simulator_headless.js`

### Archivos MODIFICADOS (deben tener fecha/hora reciente):
- ✅ `/server.js`
- ✅ `/dashboard.html`
- ✅ `/admin.html`
- ✅ `/js/api.js`
- ✅ `/js/services/modbusService.js`
- ✅ `/js/services/bacnetService.js`

**Tip:** En WinSCP, ordena por "Modificado" para ver los archivos más recientes arriba.

---

## 🔄 PASO 6: Reiniciar el Servicio

### Opción A: Contactar al Administrador
Enviar mensaje:
> "Por favor, reiniciar el servicio Node.js del proyecto visor-pci para aplicar las actualizaciones del despliegue de hoy 22/01/2026"

### Opción B: Si tienes acceso SSH (PuTTY)
```bash
pm2 restart visor-pci
# o
pm2 restart all
```

---

## 🧪 PASO 7: Verificar que Funciona

### 7.1 Abrir el Dashboard
- URL: `http://visor_pci.unizar.es/dashboard.html`
- Login con tu usuario

### 7.2 Verificar Widget "Estado Dispositivos"
- ✅ Debe aparecer un nuevo widget en el dashboard
- ✅ Muestra porcentaje de dispositivos online
- ✅ Click en el widget abre un modal con detalles

### 7.3 Verificar Panel de Administración
- URL: `http://visor_pci.unizar.es/admin.html`
- ✅ Debe aparecer un toggle "Modo Hardware"
- ✅ Debe poder activarse/desactivarse

### 7.4 Verificar Simulador (Opcional)
- En Admin Panel → Simulación
- ✅ Iniciar simulador debe funcionar sin errores en consola

---

## 🗑️ PASO 8: Limpiar (Opcional)

Una vez verificado que todo funciona:

### En el servidor (WinSCP):
- Eliminar el archivo ZIP de `/tmp/` si lo subiste

### En tu PC:
- Puedes conservar la carpeta `deploy_package` por si necesitas revertir
- O eliminarla si ya no la necesitas

---

## 🆘 Si Algo Sale Mal

### Revertir al Backup:
1. En WinSCP, eliminar la carpeta del proyecto actual
2. Renombrar `visor-pci-backup-20260122` al nombre original
3. Reiniciar el servicio

### Verificar Logs:
Si el servidor no arranca:
```bash
pm2 logs visor-pci
```

---

## 📞 Contacto de Soporte

Si necesitas ayuda durante el despliegue, puedes:
1. Revisar los logs del servidor
2. Verificar que todos los archivos se subieron correctamente
3. Confirmar que el servicio se reinició

---

## ✨ Nuevas Funcionalidades Desplegadas

Una vez completado el despliegue, tendrás:

1. **Widget de Estado de Dispositivos** 📊
   - Muestra % de dispositivos Modbus online en tiempo real
   - Click para ver detalles de cada edificio (IP, puerto, latencia, errores)

2. **Toggle de Modo Hardware** 🔧
   - Activar/desactivar integración Modbus/BACnet sin reiniciar
   - Útil para desarrollo y producción

3. **Simulador Headless** 🤖
   - Funciona en producción sin errores de terminal
   - Controlable vía API HTTP

---

**¡Buena suerte con el despliegue!** 🚀
