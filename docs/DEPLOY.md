# Guía de Despliegue - Visor PCI en Unizar

## Requisitos Previos
- VPN Unizar conectada (para acceso FTP).
- Cliente FTP (FileZilla, WinSCP, etc.).

## Credenciales de Servidor
| Servicio | Host | Puerto | Usuario | Contraseña |
|---|---|---|---|---|
| **FTP** | `visor_pci_web.unizar.es` | 21 | `w_visor_pci` | `QHIljzGIcqOboUaIFasa.` |
| **MySQL** | `visor_pci_mysql.unizar.es` | 1980 | `visor_pci` | `sO8s+vKbZ4D2VHLJCwBm` |

## Estructura de Carpetas en el Servidor
Los archivos deben subirse a `/webapps/<nombre-proyecto>/`.

## Pasos de Despliegue

### 1. Preparar Archivos Locales
```bash
# Desde la raíz del proyecto, instalar dependencias de producción
npm install --omit=dev
```

### 2. Renombrar Archivo de Entorno
```bash
# En local, copia el .env.production con las credenciales de producción
cp .env.production .env
```
> **Importante:** El archivo `.env` en producción debe tener `DB_CLIENT=mysql` y los datos del servidor MySQL.

### 3. Subir Archivos por FTP
Sube las siguientes carpetas/archivos a `/webapps/`:
- `server.js`
- `database.js`
- `package.json`
- `package-lock.json`
- `js/` (completo)
- `services/` (completo)
- `public/` (completo)
- `uploads/` (si contiene imágenes que quieras conservar)
- `.env` (renombrado)
- `node_modules/` (Opcional: puedes ejecutar `npm install` en el servidor si tiene permisos)

### 4. Ejecutar en el Servidor
Consulta con los administradores de Unizar cómo iniciar la aplicación Node.js. Probablemente sea:
```bash
cd /webapps/<proyecto>
node server.js
```
O a través de un gestor de procesos como `pm2`.

## Verificación Post-Despliegue
1.  Accede a `http://visor_pci.unizar.es/` (o la URL asignada).
2.  Inicia sesión con un usuario de prueba.
3.  Verifica que los datos (Campuses, Edificios) se carguen correctamente.
