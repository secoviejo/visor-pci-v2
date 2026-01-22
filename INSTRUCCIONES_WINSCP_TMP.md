# Instrucciones para Descomprimir y Desplegar desde WinSCP

## Situación Actual
Veo que ya has subido el archivo `VISOR_PCI_DEPLOY_20...zip` a la carpeta `tmp` del servidor.

## Opción 1: Descomprimir en el Servidor (Recomendado)

### Paso 1: Descomprimir el ZIP en el servidor
1. En WinSCP, navega a la carpeta `tmp` (donde está el ZIP)
2. Click derecho en el archivo ZIP
3. Seleccionar **"Descomprimir"** o **"Extract"**
4. Elegir descomprimir en la misma carpeta `tmp`

Esto creará una carpeta `deploy_package` dentro de `tmp`.

### Paso 2: Hacer Backup del Proyecto Actual
1. Navegar a la carpeta del proyecto principal (probablemente en `/home/w_visor_pci/` o similar)
2. Click derecho en la carpeta del proyecto
3. **Duplicar**
4. Renombrar a: `visor-pci-backup-20260122`

### Paso 3: Copiar Archivos NUEVOS
Desde `tmp/deploy_package/NUEVOS/`:

**connectivityService.js:**
- Arrastrar desde `tmp/deploy_package/NUEVOS/connectivityService.js`
- Soltar en `/js/services/` del proyecto principal

**simulator_headless.js:**
- Arrastrar desde `tmp/deploy_package/NUEVOS/simulator_headless.js`
- Soltar en `/scripts/` del proyecto principal

### Paso 4: Sobrescribir Archivos MODIFICADOS
Desde `tmp/deploy_package/MODIFICADOS/`:

1. Arrastrar `server.js`, `dashboard.html`, `admin.html` → Raíz del proyecto
2. Arrastrar `api.js` → `/js/` del proyecto
3. Arrastrar `modbusService.js`, `bacnetService.js` → `/js/services/` del proyecto

Cuando pregunte "¿Sobrescribir?", confirmar **"Sí a todo"**

---

## Opción 2: Descomprimir en tu PC Local

Si prefieres trabajar desde tu PC:

1. Descargar el ZIP desde `tmp` a tu PC (click derecho → Descargar)
2. Descomprimir en tu PC
3. Seguir las instrucciones del `LEEME_PRIMERO.md`
4. Subir los archivos desde tu PC al servidor

---

## Después de Copiar los Archivos

### Verificar que todo se copió correctamente
En WinSCP, verificar que existen:
- ✅ `/js/services/connectivityService.js` (NUEVO)
- ✅ `/scripts/simulator_headless.js` (NUEVO)
- ✅ Los 6 archivos modificados se sobrescribieron

### Reiniciar el Servicio
Contactar al administrador del sistema:
> "Por favor, reiniciar el servicio Node.js del proyecto visor-pci para aplicar las actualizaciones"

O si tienes acceso a PuTTY:
```bash
pm2 restart visor-pci
```

### Verificar que Funciona
Abrir en el navegador:
- http://visor_pci.unizar.es/dashboard.html
- Verificar que el widget "Estado Dispositivos" aparece

---

## Limpiar Archivos Temporales (Opcional)
Una vez verificado que todo funciona, puedes eliminar:
- La carpeta `tmp/deploy_package`
- El archivo ZIP de `tmp`

---

## ¿Necesitas Ayuda?
Si tienes algún problema durante el proceso, avísame y te ayudo paso a paso.
