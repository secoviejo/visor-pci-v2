# Tests

Este directorio contiene los tests unitarios y de integración del proyecto Visor PCI.

## Estructura

- `api.test.js` - Tests de endpoints del API
- `auth.test.js` - Tests de autenticación y seguridad
- `routes.integration.test.js` - Tests de integración de rutas modulares

## Ejecutar Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch (desarrollo)
npm run test:watch

# Ver cobertura de código
npm test -- --coverage
```

## Configuración

Los tests utilizan:
- **Jest** - Framework de testing
- **Supertest** - Testing de endpoints HTTP
- **bcryptjs** - Testing de hashing de contraseñas
- **jsonwebtoken** - Testing de tokens JWT

## Cobertura

Los tests actuales cubren:
- ✅ Endpoint de status del servidor
- ✅ Hashing y verificación de contraseñas
- ✅ Generación y validación de tokens JWT
- ✅ Rutas admin, notificaciones y simulación (integración básica)

## Próximos Tests a Implementar

- [ ] Tests de rutas de campus y edificios
- [ ] Tests de gestión de dispositivos
- [ ] Tests de alertas y eventos
- [ ] Tests de notificaciones
- [ ] Tests de integración con base de datos
