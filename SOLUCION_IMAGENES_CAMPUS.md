# Solución: Imágenes de Campus No Se Muestran

## 📋 Diagnóstico del Problema

Las imágenes de los campus no se están mostrando porque las rutas almacenadas en la base de datos **no incluyen el prefijo correcto** `img/campuses/`.

### Ejemplo del problema:
- **Base de datos dice:** `campus_sf.jpg`
- **Debería decir:** `img/campuses/campus_sf.jpg`

## 🔧 Solución

### Opción 1: Ejecutar el Script Node.js (Recomendado)

1. **Conectarse al servidor de la Universidad** vía SSH o acceso remoto

2. **Navegar al directorio del proyecto:**
   ```bash
   cd /ruta/al/visor-pci-final
   ```

3. **Ejecutar el script de corrección:**
   ```bash
   node scripts/fix_campus_images_server.js
   ```

4. **Reiniciar el servidor:**
   ```bash
   # Si usas PM2:
   pm2 restart visor-pci
   
   # Si usas systemd:
   sudo systemctl restart visor-pci
   
   # Si ejecutas manualmente:
   # Detener el proceso actual (Ctrl+C) y volver a ejecutar:
   node server.js
   ```

5. **Limpiar caché del navegador:**
   - Presiona `Ctrl + Shift + R` (Windows/Linux)
   - O `Cmd + Shift + R` (Mac)

### Opción 2: Ejecutar SQL Manualmente

Si prefieres ejecutar SQL directamente en la base de datos MySQL:

1. **Conectarse a MySQL:**
   ```bash
   mysql -u usuario -p nombre_base_datos
   ```

2. **Ejecutar el script SQL:**
   ```bash
   source scripts/fix_campus_images.sql
   ```

   O copiar y pegar el contenido del archivo `fix_campus_images.sql` en el cliente MySQL.

3. **Verificar los cambios:**
   ```sql
   SELECT id, name, image_filename, background_image FROM campuses;
   ```

4. **Reiniciar el servidor** (ver paso 4 de la Opción 1)

## 📁 Estructura de Archivos Esperada

Las imágenes deben estar en:
```
visor-pci-final/
├── img/
│   └── campuses/
│       ├── campus_sf.jpg
│       ├── campus_sf_dark.jpg
│       ├── campus_sf_light.png
│       ├── campus_rio_ebro.jpg
│       ├── campus_rio_ebro_real.jpg
│       ├── campus_huesca.jpg
│       ├── campus_paraiso.jpg
│       ├── campus_veterinaria.jpg
│       └── campus_teruel.jpg
```

## ✅ Verificación

Después de aplicar la solución, verifica que:

1. **Las imágenes se cargan en el dashboard** (http://servidor:3000/dashboard.html)
2. **No hay errores 404 en la consola del navegador** (F12 → Console)
3. **Las tarjetas de campus muestran las imágenes correctamente**

## 🐛 Solución de Problemas

### Si las imágenes aún no se muestran:

1. **Verificar que las imágenes existen en el servidor:**
   ```bash
   ls -la img/campuses/
   ```

2. **Verificar permisos de lectura:**
   ```bash
   chmod 644 img/campuses/*.jpg
   chmod 644 img/campuses/*.png
   ```

3. **Verificar que el servidor sirve archivos estáticos:**
   - Abre en el navegador: `http://servidor:3000/img/campuses/campus_sf.jpg`
   - Debería mostrar la imagen directamente

4. **Revisar logs del servidor:**
   ```bash
   # Si usas PM2:
   pm2 logs visor-pci
   
   # Si usas systemd:
   sudo journalctl -u visor-pci -f
   ```

5. **Verificar la configuración de Express en server.js:**
   ```javascript
   app.use(express.static(__dirname)); // Debe estar presente
   ```

## 📝 Notas Adicionales

- El script `fix_campus_images_server.js` es **seguro de ejecutar múltiples veces** - solo actualiza las rutas que necesitan corrección
- **No modifica** las rutas que ya están correctas
- **Verifica la existencia de archivos** antes de actualizar
- **Genera un reporte detallado** del proceso

## 🆘 Si Necesitas Ayuda

Si después de seguir estos pasos las imágenes aún no se muestran:

1. Captura de pantalla de la consola del navegador (F12)
2. Salida completa del script `fix_campus_images_server.js`
3. Resultado de: `SELECT * FROM campuses;` en MySQL
4. Resultado de: `ls -la img/campuses/` en el servidor

---

**Fecha:** 21 de enero de 2026  
**Autor:** Asistente IA - Visor PCI
