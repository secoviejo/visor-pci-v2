# 🚨 SOLUCIÓN RÁPIDA: Imágenes de Campus

## ⚡ Ejecutar en el Servidor (3 comandos)

```bash
cd /ruta/al/visor-pci-final
node scripts/fix_campus_images_server.js
pm2 restart visor-pci
```

## 🌐 Verificar en el Navegador

1. Abrir: `http://servidor:3000/test_campus_images.html`
2. Limpiar caché: `Ctrl + Shift + R`
3. Verificar dashboard: `http://servidor:3000/dashboard.html`

## 📚 Documentación Completa

- **Guía paso a paso:** `SOLUCION_IMAGENES_CAMPUS.md`
- **Resumen ejecutivo:** `RESUMEN_SOLUCION_IMAGENES.md`
- **Avances del día:** `progresos/AVANCES_21_01_2026_IMAGENES_CAMPUS.md`

## 🛠️ Scripts Disponibles

```bash
# Diagnóstico (sin cambios)
node scripts/diagnose_campus_images.js

# Corrección automática
node scripts/fix_campus_images_server.js

# Test visual en navegador
http://servidor:3000/test_campus_images.html
```

## ❓ ¿Qué hace el script?

Actualiza las rutas en la base de datos:
- **Antes:** `campus_sf.jpg`
- **Después:** `img/campuses/campus_sf.jpg`

## ✅ Resultado Esperado

Las imágenes de los campus se mostrarán correctamente en el dashboard.

---

**Última actualización:** 21 de enero de 2026
