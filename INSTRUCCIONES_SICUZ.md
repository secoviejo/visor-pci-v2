# Guía de Despliegue para el SICUZ - Visor PCI

Este documento contiene las especificaciones técnicas necesarias para el despliegue de la aplicación **Visor PCI** utilizando Docker.

## 1. Arquitectura de la Aplicación
- **Backend:** Node.js 20 (Express.js).
- **Base de Datos:** SQLite (archivo local `pci.db`).
- **Comunicación tiempo real:** WebSockets (Socket.io).
- **Integración Hardware:** Modbus TCP y BACnet/IP.

## 2. Instrucciones de Despliegue con Docker

La aplicación está completamente dockerizada. Se proporcionan un `Dockerfile` y un `docker-compose.yml` listos para producción.

### Requisitos previos
- Docker Engine >= 20.10
- Docker Compose v2 (o superior)

### Ejecución
Para poner en marcha el servicio, situarse en el directorio raíz del proyecto y ejecutar:
```bash
docker-compose up -d --build
```

## 3. Configuración del Entorno (Variables de Entorno)
La aplicación utiliza un archivo `.env` para su configuración. Se adjunta un archivo `.env.example` como referencia. Es necesario configurar:
- `JWT_SECRET`: Clave aleatoria para la firma de tokens.
- `ENABLE_HARDWARE`: Debe ser `true` para permitir la comunicación con las centrales de incendio.
- `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`: Para el envío de notificaciones de alarma.

## 4. Persistencia (Volúmenes)
El contenedor requiere que se mapeen los siguientes volúmenes para asegurar la persistencia de los datos críticos:

| Origen (Host) | Destino (Contenedor) | Propósito |
| :--- | :--- | :--- |
| `./pci.db` | `/usr/src/app/pci.db` | Base de datos SQLite |
| `./uploads` | `/usr/src/app/uploads` | Imágenes de plantas y archivos temporales |
| `./datos_edificios` | `/usr/src/app/datos_edificios` | Estructura de cartografía e iconos |
| `./.env` | `/usr/src/app/.env` | Configuración y secretos |

## 5. Requerimientos de Red (Firewall)
Para que la monitorización real funcione, el contenedor debe tener visibilidad IP hacia las centrales de incendio a través de los siguientes puertos:

- **Puerto 502 (TCP):** Protocolo Modbus/TCP.
- **Puertos 47808 y 47809 (UDP):** Protocolo BACnet/IP (Discovery y Comunicación).
- **Puerto 3000 (TCP):** Acceso a la interfaz web del Visor (Exponer fuera de la red local según necesidad).

## 6. Soporte Técnico
En caso de dudas sobre la lógica de comunicaciones o el mapeo de objetos Modbus/BACnet, contactar con la **Unidad de Seguridad de la Universidad de Zaragoza**.
