# Instrucciones de Despliegue - Servidor Universidad de Zaragoza

**FECHA:** 25/01/2026
**TIPO:** Actualización COMPLETA (Full Update)

Debido a cambios estructurales importantes (nuevas carpetas `src`, `public`, etc.), **no se pueden subir archivos sueltos**. Es necesario reemplazar la estructura del proyecto.

---

## ⚠️ PASO 0: BACKUP (CRÍTICO)

1. Conéctate por WinSCP al servidor (`visor_pci.webunizar.es`).
2. Localiza la carpeta actual del proyecto (ej: `/home/w_visor_pci/` o similar).
3. **NO BORRES NADA AÚN.**
4. Crea una copia de la carpeta actual y llámala `visor-pci-backup-20260125`.

---

## 🚀 PASO 1: SUBIR EL ARCHIVO

1. Sube el archivo `visor-pci-deploy.zip` a la carpeta raíz o `tmp` del servidor.

---

## 🛠️ PASO 2: DESPLEGAR

### Si tienes acceso por consola (SSH/PuTTY):

1. **Detén el servidor:**
   ```bash
   pm2 stop visor-pci
   ```

2. **Prepara el directorio:**
   (Asumiendo que estás en la carpeta del proyecto)
   ```bash
   # Mueve archivos de usuario a un lugar seguro temporalmente
   mv .env ../env.temp
   mv pci.db ../pci.db.temp
   mv uploads ../uploads.temp
   
   # Elimina archivos antiguos (EXCEPTO node_modules si quieres intentar conservarlos, pero mejor reinstalar)
   rm -rf * 
   ```

3. **Descomprime:**
   ```bash
   unzip path/to/visor-pci-deploy.zip -d .
   ```

4. **Restaura archivos de usuario:**
   ```bash
   mv ../env.temp .env
   mv ../pci.db.temp pci.db
   mv ../uploads.temp uploads
   ```

5. **Instala dependencias:**
   ```bash
   npm install --production
   ```

6. **Inicia el servidor:**
   ```bash
   pm2 restart visor-pci
   ```

### Si SOLO tienes WinSCP (Sin consola):

1. **Entra en la carpeta del proyecto.**
2. **Borra todo EXCEPTO:**
   - `.env` (Configuración)
   - `pci.db` (Base de datos)
   - `uploads/` (Imágenes subidas)
   - `node_modules/` (Opcional, pero recomendado borrar si puedes ejecutar npm install)
3. **Descomprime el ZIP en tu PC** y sube todo el contenido de la carpeta descomprimida al servidor, sobrescribiendo lo que haya.
4. **IMPORTANTE:** Si no tienes consola, necesitarás reiniciar el servicio Node.js desde el panel de control del hosting o pedir a los administradores que ejecuten `npm install --production` y reinicien el servicio, ya que hemos añadido nuevas librerías.

---

## ✅ PASO 3: VERIFICACIÓN

1. Abre `http://visor_pci.unizar.es/dashboard.html`
2. Verifica que carga correctamente.
3. Verifica que el widget de "Estado Dispositivos" aparece.
