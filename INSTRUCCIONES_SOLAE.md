# Instrucciones para Conectar SOLAE en Local

## 📋 Preparación Completada

✅ Código del servicio Modbus revisado y funcionando correctamente  
✅ Edificio "OUAD" configurado en la base de datos (ID: 27)  
✅ Script de prueba `test_modbus_solae.js` creado  

---

## 🔧 Pasos para el Lunes (cuando tengas el SOLAE)

### 1. Conectar el SOLAE a tu red local

- Encender el SOLAE
- Conectarlo a la misma red que tu PC
- **Anotar la IP asignada** (por ejemplo, podría ser `192.168.1.100` o similar)

### 2. Probar conectividad básica

Abre PowerShell y ejecuta:

```powershell
ping [IP_DEL_SOLAE]
```

**Ejemplo:**
```powershell
ping 192.168.1.100
```

✅ **Resultado esperado:** Respuestas exitosas, sin pérdida de paquetes

---

### 3. Actualizar IP en la Base de Datos

Abre una terminal en `c:\dev\visor-pci-final` y ejecuta:

```powershell
node -e "const db = require('./database.js'); db.prepare('UPDATE buildings SET modbus_ip = ? WHERE id = 27').run('TU_IP_LOCAL'); console.log('✅ IP actualizada');"
```

**Reemplaza `TU_IP_LOCAL` con la IP real del SOLAE**

**Ejemplo:**
```powershell
node -e "const db = require('./database.js'); db.prepare('UPDATE buildings SET modbus_ip = ? WHERE id = 27').run('192.168.1.100'); console.log('✅ IP actualizada');"
```

---

### 4. Probar Comunicación Modbus (OPCIONAL pero RECOMENDADO)

Antes de arrancar el servidor completo, prueba que la comunicación Modbus funciona:

```powershell
node test_modbus_solae.js [IP_DEL_SOLAE] 502
```

**Ejemplo:**
```powershell
node test_modbus_solae.js 192.168.1.100 502
```

✅ **Resultado esperado:**
```
=== Prueba de Conexión Modbus ===
IP: 192.168.1.100
Puerto: 502

Conectando...
✅ Conexión establecida correctamente

Leyendo entradas digitales (FC02, addr 0, count 2)...

--- Estado de Entradas Digitales ---
DI0 (Contacto 1): ⚪ ABIERTO (NORMAL)
DI1 (Contacto 2): ⚪ ABIERTO (NORMAL)

--- Valores Crudos ---
DI0: false
DI1: false

✅ Prueba completada exitosamente
```

**Si ves esto, ¡perfecto!** La comunicación Modbus funciona correctamente.

---

### 5. Habilitar Hardware en el Sistema

Edita el archivo `.env` y cambia:

```diff
-ENABLE_HARDWARE=false
+ENABLE_HARDWARE=true
```

**O ejecuta este comando rápido:**

```powershell
(Get-Content .env) -replace 'ENABLE_HARDWARE=false', 'ENABLE_HARDWARE=true' | Set-Content .env
```

---

### 6. Arrancar el Servidor

```powershell
npm run dev
```

✅ **Busca en la consola:**
```
[Hardware] Initializing Modbus and BACnet services...
[Modbus] Connecting to Building 27 (192.168.1.100:502)...
[Modbus] ✅ Connected to Building 27 (192.168.1.100).
[Hardware] Modbus and BACnet services initialized
```

❌ **Si ves errores de conexión:**
- Verifica que la IP sea correcta
- Asegúrate de que el SOLAE esté encendido
- Repite el paso 2 (ping)

---

### 7. Probar en el Dashboard

1. Abre el navegador en `http://localhost:3000`
2. Navega al edificio OUAD
3. **Acción física:** Abre/cierra el contacto seco en el SOLAE
4. **Verifica:** 
   - Deberías ver cambios en tiempo real en el dashboard
   - Se debe registrar una alarma cuando cierres el contacto
   - La alarma debe resolverse cuando abras el contacto

---

## 🔍 Verificación de Eventos en Consola

Cuando cambies el estado del contacto, deberías ver en la consola del servidor algo como:

```
[Hardware Event] { buildingId: 27, port: 0, distinct: 'di0', value: true, source: 'REAL' }
[Socket] Emitted pci:alarm:on
```

---

## ❌ Posibles Problemas y Soluciones

### Problema 1: "Connection timeout" o "Connection refused"

**Causa:** El SOLAE no es accesible en esa IP/puerto

**Solución:**
1. Verifica la IP con `ping`
2. Confirma que el puerto Modbus del SOLAE es 502
3. Revisa la configuración de red del SOLAE

### Problema 2: Conexión OK pero no se detectan cambios

**Causa posible:** Mapeo de registros incorrecto

**Acción:**
1. Consulta la documentación del SOLAE sobre su mapeo Modbus
2. Puede que uses direcciones diferentes (no 0 y 1)
3. Puede que necesites Function Code 01 en lugar de 02

**Si es así, avísame y ajustaremos el código en `js/services/modbusService.js`**

### Problema 3: Muchos errores BACnet en consola

```
[BACnet] Error reading BI:0 from 127.0.0.1:47809: ERR_TIMEOUT
```

**Solución:** Estos errores NO afectan a Modbus. Puedes ignorarlos o ejecutar:

```powershell
node -e "const db = require('./database.js'); db.prepare('UPDATE buildings SET bacnet_ip = NULL WHERE id = 83').run(); console.log('✅ BACnet desactivado');"
```

---

## 📝 Información Técnica

### Configuración Actual del SOLAE

- **Edificio:** OUAD (ID: 27)
- **IP configurada:** 155.210.147.1 (⚠️ hay que cambiarla a tu IP local)
- **Puerto:** 502
- **Protocolo:** Modbus TCP
- **Registros leídos:** 
  - Dirección 0, Cantidad: 2
  - Function Code: 02 (Read Discrete Inputs)
  - DI0 → Contacto 1
  - DI1 → Contacto 2
- **Intervalo de polling:** 1 segundo (configurable con variable `CIE_POLL_MS`)

### Archivos Relevantes

- **Servicio Modbus:** `js/services/modbusService.js`
- **Configuración:** `.env`
- **Script de prueba:** `test_modbus_solae.js`
- **Base de datos:** `pci.db`

---

## 📞 Contacto

Si encuentras algún problema el lunes, anota:
1. La IP del SOLAE
2. Los mensajes de error exactos de la consola
3. Si el script de prueba funciona o no

¡Y lo revisamos juntos!
