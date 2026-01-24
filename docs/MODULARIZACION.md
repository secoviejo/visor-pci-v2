# Guía de Modularización - Visor PCI

## Estado Actual
Se ha completado la **Fase 1** de modularización:
- ✅ Rutas de autenticación extraídas a `routes/authRoutes.js`
- ✅ Estructura base de `routes/adminRoutes.js` creada (pendiente de integración completa)

## Rutas Pendientes de Modularización

### Prioridad Alta
1. **Admin Routes** (líneas 730-850 aprox.)
   - `/api/admin/simulator/*`
   - `/api/admin/hardware/*`
   - Mover a `routes/adminRoutes.js`

2. **User Management** (buscar "app.get('/api/users'")
   - CRUD de usuarios
   - Ya preparado en `adminRoutes.js`, solo falta integrar

### Prioridad Media
3. **API Routes** (líneas 200-700 aprox.)
   - Campuses, Buildings, Floors, Devices
   - Crear `routes/apiRoutes.js`
   - Incluir: GET, POST, PUT, DELETE de cada entidad

4. **Notification Routes** (buscar "app.get('/api/notifications'")
   - Recipients, Config, Logs
   - Crear `routes/notificationRoutes.js`

### Prioridad Baja
5. **Simulation Routes** (buscar "app.post('/api/simulation'")
   - Building alarms, resolve
   - Crear `routes/simulationRoutes.js`

## Patrón de Migración

### 1. Crear el archivo de ruta
```javascript
const express = require('express');
const router = express.Router();

function initRoutes(dependencies) {
    const { db, authenticateToken, authorizeRole } = dependencies;
    
    router.get('/endpoint', authenticateToken, async (req, res) => {
        // Lógica aquí
    });
    
    return router;
}

module.exports = initRoutes;
```

### 2. Integrar en server.js
```javascript
const initMyRoutes = require('./routes/myRoutes');
app.use('/api/prefix', initMyRoutes({ 
    db, 
    authenticateToken, 
    authorizeRole,
    // ... otras dependencias
}));
```

### 3. Eliminar código duplicado
Borrar las rutas inline del `server.js` original.

## Beneficios Esperados
- **Reducción de líneas**: De ~1500 a ~300 en `server.js`
- **Mantenibilidad**: Cada módulo es independiente y testeable
- **Escalabilidad**: Fácil añadir nuevas rutas sin tocar el core

## Próximos Pasos Recomendados
1. Terminar integración de `adminRoutes.js`
2. Extraer rutas de API (la sección más grande)
3. Añadir tests unitarios para cada router
4. Configurar ESLint para mantener consistencia
