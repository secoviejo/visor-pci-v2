# Avances - 20 de enero de 2026 - Migración a MySQL y Despliegue en Unizar

## Resumen General
Hoy se ha completado la migración estructural más importante del proyecto: el cambio de una base de datos local basada en SQLite a un sistema profesional basado en **MySQL (MariaDB 10.5)** para su alojamiento en la Universidad de Zaragoza. Se ha realizado el despliegue inicial por FTP y la actualización del repositorio en GitHub.

---

## 🚀 Logros Principales

### 1. Motor de Base de Datos (SQL Universal)
- **Patrón Adapter**: Se han creado adaptadores asíncronos (`sqliteAdapter.js` y `mysqlAdapter.js`) que permiten a la aplicación cambiar de base de datos simplemente modificando el archivo `.env`.
- **Refactorización Async/Await**: Se ha convertido todo el código de `server.js` y servicios para que sean no bloqueantes (asíncronos), requisito indispensable para usar MySQL de forma profesional.

### 2. Migración de Datos a Unizar
- **Transferencia Exitosa**: Se han migrado todos los datos reales (Campuses, Edificios, Plantas, Dispositivos) desde el archivo local `pci.db` al servidor MySQL de la Universidad (`visor_pci_mysql.unizar.es`).
- **Verificación**: Se ha comprobado la conexión remota desde el entorno de desarrollo.

### 3. Despliegue por FTP
- **Subida de Archivos**: Se ha utilizado WinSCP para subir el código fuente, archivos HTML y el archivo de configuración `.env` al directorio `/webapps/` de Unizar.
- **Preparación del Servidor**: Se ha creado la estructura necesaria (carpeta `tmp/restart.txt`) para gestionar el reinicio de la aplicación en el servidor de la Universidad.

### 4. Organización del Proyecto y GitHub
- **Limpieza Estructural**: Se han organizado más de 40 archivos sueltos en carpetas categorizadas:
    - `scripts/`: Herramientas y diagnósticos.
    - `docs/`: Guías de despliegue y recursos.
    - `backups/`: Copias de seguridad de versiones antiguas.
- **Rama en GitHub**: Se ha creado y subido la rama `feature/mysql-async-refactor` con todos los cambios, protegiendo las credenciales mediante un `.gitignore` reforzado.

---

## ⚠️ Estado Actual y Bloqueos
- **Error 502 Bad Gateway**: La aplicación está en el servidor de Unizar pero no arranca. 
- **Causa**: Incompatibilidad de los archivos de `node_modules` (subidos de Windows a un servidor Linux).
- **Acción Realizada**: Se ha enviado un correo a los servicios informáticos de Unizar solicitando que ejecuten `npm install` directamente en el servidor para reconstruir las librerías para Linux.

---

## 🔧 Correcciones Críticas de Compatibilidad MySQL (20/01/2026 - Tarde)

### Problema Detectado
Al probar la aplicación en local conectada a la base de datos MySQL de Unizar, se detectaron **3 errores críticos** que impedían el funcionamiento correcto:

1. **Error 500 en Dashboard**: La consulta SQL de estadísticas de campus no era compatible con MySQL/MariaDB
2. **Edificios mezclados**: Todos los edificios aparecían en todos los campus (faltaba filtrado por `campus_id`)
3. **Imágenes no visibles**: Los logos no se servían correctamente desde la raíz del proyecto

### Soluciones Implementadas

#### 1. Consulta SQL Compatible con MySQL
**Archivo**: `server.js` - Ruta `/api/campuses/stats`

**Problema**: MySQL no permite referencias a columnas de la tabla externa (`c.id`) dentro de subconsultas correlacionadas en la cláusula `FROM`.

**Solución**: Se reescribió la consulta usando `LEFT JOIN` con subconsultas derivadas:

```sql
SELECT 
    c.id, c.name, c.description, c.image_filename, c.background_image,
    COALESCE(b_count.count, 0) as building_count,
    COALESCE(a_count.count, 0) as alarm_count
FROM campuses c
LEFT JOIN (
    SELECT campus_id, COUNT(*) as count 
    FROM buildings 
    GROUP BY campus_id
) b_count ON c.id = b_count.campus_id
LEFT JOIN (
    SELECT campus_id, COUNT(DISTINCT uid) as count
    FROM (
        SELECT b2.campus_id, d.device_id as uid
        FROM devices d
        JOIN floors f ON d.floor_id = f.id
        JOIN buildings b2 ON f.building_id = b2.id
        JOIN events e ON (e.device_id = d.device_id AND e.type = 'ALARM' AND e.resolved = 0)
        UNION
        SELECT b3.campus_id, a.element_id as uid
        FROM alerts a
        JOIN buildings b3 ON a.building_id = b3.id
        WHERE a.status = 'ACTIVA'
    ) combined
    GROUP BY campus_id
) a_count ON c.id = a_count.campus_id
```

#### 2. Filtrado de Edificios por Campus
**Archivo**: `server.js` - Ruta `/api/buildings`

**Problema**: La API devolvía todos los edificios sin importar el campus solicitado.

**Solución**: Se añadió soporte para el parámetro `campusId` en la query string:

```javascript
app.get('/api/buildings', async (req, res) => {
    try {
        const { campusId } = req.query;
        let sql = 'SELECT id, name, campus_id, x, y, thumbnail, modbus_ip, modbus_port FROM buildings';
        const params = [];

        if (campusId) {
            sql += ' WHERE campus_id = ?';
            params.push(campusId);
        }

        const rows = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('[API] Error fetching buildings:', err);
        res.status(500).json({ error: err.message });
    }
});
```

#### 3. Servir Archivos Estáticos desde la Raíz
**Archivo**: `server.js` - Configuración de Express

**Problema**: Los archivos HTML y logos en la raíz del proyecto no se servían correctamente.

**Solución**: Se añadió `app.use(express.static(__dirname))` para servir archivos desde la raíz:

```javascript
app.use(express.static('public'));
app.use(express.static(__dirname)); // Serve HTML files in root
app.use('/uploads', express.static('uploads'));
```

#### 4. Carga Condicional de Adaptadores
**Archivo**: `database.js`

**Problema**: En el servidor Linux de Unizar, intentaba cargar el adaptador de SQLite (que tiene dependencias nativas de C++) incluso cuando se usaba MySQL.

**Solución**: Se modificó para cargar solo el adaptador necesario según `DB_CLIENT`:

```javascript
if (DB_CLIENT === 'mysql') {
    const MysqlAdapter = require('./js/db/adapters/mysqlAdapter');
    db = new MysqlAdapter({...});
} else {
    const SqliteAdapter = require('./js/db/adapters/sqliteAdapter');
    db = new SqliteAdapter({...});
}
```

#### 5. Ruta de Estado del Sistema
**Archivo**: `server.js`

**Problema**: El frontend intentaba consultar `/api/status` que no existía.

**Solución**: Se añadió la ruta faltante:

```javascript
app.get('/api/status', (req, res) => {
    res.json({
        environment: process.env.NODE_ENV === 'production' ? 'cloud' : 'local',
        hardware_enabled: process.env.ENABLE_HARDWARE === 'true'
    });
});
```

### Verificación Local
Se ha probado la aplicación en local conectada a la base de datos MySQL de Unizar y se ha confirmado:
- ✅ Dashboard carga correctamente con los 6 campus
- ✅ Cada campus muestra solo sus edificios (35, 11, 16, 4, 10, 5 respectivamente)
- ✅ No hay errores 500 en la consola
- ✅ Las imágenes se cargan correctamente

### Archivos Actualizados en el Servidor
Se han subido por FTP a `/webapps/` los siguientes archivos corregidos:
- `server.js` (55 KB - 20/01/2026 21:07:37)
- `database.js` (8 KB - actualizado)
- `logo_sec.png` y `logo_unizar.png` (movidos a raíz)
- `tmp/restart.txt` (creado para forzar reinicio)

---

## 📂 Archivos Clave Creados/Modificados Hoy
- `js/db/adapters/baseAdapter.js` (Nueva interfaz)
- `js/db/adapters/mysqlAdapter.js` (Nuevo motor MySQL)
- `database.js` (Cargador dinámico de bases de datos + carga condicional)
- `server.js` (Refactorizado a asíncrono + correcciones MySQL)
- `DEPLOY.md` (Nueva guía de despliegue)
- `.env.production` (Configuración para Unizar)
- `scripts/check_buildings_by_campus.js` (Script de verificación)
- `scripts/test_problematic_query.js` (Script de diagnóstico SQL)
- `AVANCES_20_01_2026_UNIZAR.md` (Este documento)
