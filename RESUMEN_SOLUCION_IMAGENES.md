# Resumen: Solución de Imágenes de Campus

## 🎯 Problema Identificado

Las imágenes de los campus no se muestran en el dashboard porque las rutas en la base de datos **no incluyen el prefijo `img/campuses/`**.

## 🚀 Solución Rápida (3 pasos)

### En el Servidor de la Universidad:

```bash
# 1. Ejecutar diagnóstico (opcional, para ver el problema)
node scripts/diagnose_campus_images.js

# 2. Ejecutar corrección automática
node scripts/fix_campus_images_server.js

# 3. Reiniciar el servidor
pm2 restart visor-pci
# O si no usas PM2:
# sudo systemctl restart visor-pci
```

### En tu Navegador:

```
4. Limpiar caché: Ctrl + Shift + R
5. Recargar el dashboard
```

## 📂 Archivos Creados

| Archivo | Propósito |
|---------|-----------|
| `scripts/diagnose_campus_images.js` | Diagnóstico sin cambios |
| `scripts/fix_campus_images_server.js` | Corrección automática (Node.js) |
| `scripts/fix_campus_images.sql` | Corrección manual (SQL) |
| `SOLUCION_IMAGENES_CAMPUS.md` | Documentación completa |

## ⚡ Ejemplo del Cambio

**Antes (incorrecto):**
```sql
image_filename: "campus_sf.jpg"
```

**Después (correcto):**
```sql
image_filename: "img/campuses/campus_sf.jpg"
```

## ✅ Verificación

Después de ejecutar la solución, verifica:

1. ✅ Las tarjetas de campus muestran imágenes
2. ✅ No hay errores 404 en la consola (F12)
3. ✅ Puedes acceder a: `http://servidor:3000/img/campuses/campus_sf.jpg`

## 🆘 Si Persiste el Problema

1. Ejecuta el diagnóstico y comparte la salida:
   ```bash
   node scripts/diagnose_campus_images.js > diagnostico.txt
   ```

2. Verifica que las imágenes existen:
   ```bash
   ls -la img/campuses/
   ```

3. Verifica permisos:
   ```bash
   chmod 644 img/campuses/*.jpg
   chmod 644 img/campuses/*.png
   ```

---

**Nota:** Los scripts son seguros de ejecutar múltiples veces y no modifican datos innecesariamente.
