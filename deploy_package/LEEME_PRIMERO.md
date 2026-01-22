# 📦 INSTRUCCIONES DE DESPLIEGUE - VISOR PCI

## 📋 Contenido de este Paquete

### Carpeta `NUEVOS/` - Archivos a CREAR en el servidor
1. **connectivityService.js** → Subir a `/js/services/` en el servidor
2. **simulator_headless.js** → Subir a `/scripts/` en el servidor

### Carpeta `MODIFICADOS/` - Archivos a SOBRESCRIBIR en el servidor
1. **server.js** → Sobrescribir en la raíz del proyecto
2. **dashboard.html** → Sobrescribir en la raíz del proyecto
3. **admin.html** → Sobrescribir en la raíz del proyecto
4. **api.js** → Sobrescribir en `/js/` del servidor
5. **modbusService.js** → Sobrescribir en `/js/services/` del servidor
6. **bacnetService.js** → Sobrescribir en `/js/services/` del servidor

---

## 🚀 PASOS RÁPIDOS CON WINSCP

### 1️⃣ HACER BACKUP (¡IMPORTANTE!)
1. Abrir WinSCP
2. Conectar a: `w_visor_pci@visor_pci.webunizar.es`
3. En el lado derecho (servidor), click derecho en la carpeta del proyecto
4. Seleccionar **"Duplicar"**
5. Renombrar a: `visor-pci-backup-20260122` (o la fecha de hoy)

### 2️⃣ SUBIR ARCHIVOS NUEVOS
Desde la carpeta `NUEVOS/` de este paquete:

**connectivityService.js:**
- Arrastrar desde `NUEVOS/connectivityService.js`
- Soltar en `/js/services/` del servidor (lado derecho de WinSCP)

**simulator_headless.js:**
- Arrastrar desde `NUEVOS/simulator_headless.js`
- Soltar en `/scripts/` del servidor

### 3️⃣ SOBRESCRIBIR ARCHIVOS MODIFICADOS
Desde la carpeta `MODIFICADOS/` de este paquete:

**Archivos de la raíz:**
- Arrastrar `server.js`, `dashboard.html`, `admin.html`
- Soltar en la raíz del proyecto en el servidor
- Cuando pregunte "¿Sobrescribir?", click en **"Sí"** o **"Sí a todo"**

**api.js:**
- Arrastrar `api.js` → Soltar en `/js/` del servidor
- Confirmar sobrescribir

**modbusService.js y bacnetService.js:**
- Arrastrar ambos archivos → Soltar en `/js/services/` del servidor
- Confirmar sobrescribir

### 4️⃣ REINICIAR EL SERVICIO
**Opción A:** Si tienes acceso a PuTTY o terminal:
```bash
pm2 restart visor-pci
```

**Opción B:** Contactar al administrador del sistema:
Enviar email solicitando: "Por favor, reiniciar el servicio Node.js del proyecto visor-pci"

### 5️⃣ VERIFICAR QUE FUNCIONA
Abrir en el navegador:
- **Dashboard:** http://visor_pci.unizar.es/dashboard.html
- Verificar que el widget "ESTADO DISPOSITIVOS" aparece (puede mostrar "N/A" si no hay IPs configuradas)
- Ir a Admin Panel → Pasarelas y Hardware
- Verificar que aparece el toggle "Modo Hardware"

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Backup creado antes de empezar
- [ ] `connectivityService.js` subido a `/js/services/`
- [ ] `simulator_headless.js` subido a `/scripts/`
- [ ] `server.js` sobrescrito en raíz
- [ ] `dashboard.html` sobrescrito en raíz
- [ ] `admin.html` sobrescrito en raíz
- [ ] `api.js` sobrescrito en `/js/`
- [ ] `modbusService.js` sobrescrito en `/js/services/`
- [ ] `bacnetService.js` sobrescrito en `/js/services/`
- [ ] Servicio reiniciado
- [ ] Dashboard carga correctamente
- [ ] Widget "Estado Dispositivos" visible

---

## 🆘 SI ALGO FALLA (ROLLBACK)

1. En WinSCP, **eliminar** la carpeta actual del proyecto
2. **Renombrar** la carpeta de backup al nombre original
3. Reiniciar el servicio
4. Todo volverá al estado anterior

---

## 📞 SOPORTE

Para más detalles, consultar el archivo **DEPLOY_UNIZAR.md** incluido en este paquete.

**Fecha de creación:** 22/01/2026
**Versión:** Estado de Conexión Dispositivos + Simulador Headless
