# Visor PCI - Gestión e Integración IoT

Sistema de visualización y gestión para elementos de Protección Contra Incendios (PCI), desarrollado para la gestión de las instalaciones de NAES (Diciembre 2025).

El proyecto ha evolucionado para incluir integración hardware real con controladores **Sollae CIE-H12**.

## 🚀 Funcionalidades Principales

### 1. Gestión de Planos y Dispositivos
- Carga de planos por plantas.
- Posicionamiento visual (Drag & Drop) de sensores.
- CRUD completo de dispositivos (Detectores, Pulsadores, Sirenas).

### 2. Sistema de Alertas Híbrido
Soporta dos fuentes de eventos simultáneas:
- **Simulador Web:** Para pruebas y demostraciones sin hardware.
- **Hardware Real (CIE-H12):** Integración vía Modbus/TCP.

### 3. Integración Sollae CIE-H12 (Nuevo)
Implementación completa del controlador de E/S remoto:
- **Conectividad:** Protocolo Modbus/TCP sobre Ethernet.
- **Monitoreo:** Polling automático de entradas digitales (DI0/DI1) para detección de incendios reales.
- **Control:** Activación remota de sirenas físicas (Salida de Relé DO0) desde la interfaz web.
- **Resiliencia:** Reconexión automática y logs detallados.

### 4. Tiempo Real
- Uso de **Socket.io** para notificación instantánea de alarmas al frontend.
- Persistencia automática de eventos en base de datos SQLite.

## 🛠️ Tecnologías
- **Backend:** Node.js, Express, Modbus-Serial, Socket.io, SQLite (better-sqlite3).
- **Frontend:** Vanilla JS (ES6 Modules), CSS3 Moderno.

## 📦 Instalación

```bash
git clone https://github.com/secoviejo/visor-pci-circe.git
cd visor-pci-circe
npm install
node server.js
```

## ⚙️ Configuración CIE-H12
Por defecto, el sistema busca el controlador en:
- **IP:** `192.168.0.200`
- **Puerto:** `502`
- **Unit ID:** `1`

(Configurable vía variables de entorno en futuras versiones).
