# 🔥 Simulador Didáctico BACnet - Central de Incendios

Aplicación educativa y visual para aprender cómo funciona BACnet/IP mediante la simulación de una central de incendios.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![BACnet](https://img.shields.io/badge/BACnet-IP-green)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)

## 📋 Descripción

Este simulador es una **herramienta didáctica** que te permite:

- ✅ Visualizar comunicación BACnet en tiempo real
- ✅ Entender objetos BACnet (Device, MSV, AV, BV, BI)
- ✅ Ver mensajes Who-Is, I-Am, ReadProperty, WriteProperty
- ✅ Aprender COV (Change of Value) notifications
- ✅ Simular una central de incendios funcional

## 🚀 Inicio Rápido

### Requisitos

- Node.js >= 14.0.0
- npm

### Instalación

```bash
cd simulador-bacnet-didactico
npm install
```

### Ejecutar

```bash
npm start
```

Abre tu navegador en: **http://localhost:3001**

## 🎯 Características Principales

### 1. Panel de Control Visual
- 5 dispositivos simulados (3 detectores, 1 pulsador, 1 sirena)
- Estado global de la central (Normal/Alarma/Avería)
- Botones para activar/desactivar alarmas
- Reset completo del panel

### 2. Diagrama de Red BACnet
- Visualización de nodos (Central ↔ Cliente)
- Registro de mensajes en lenguaje humano
- Traducción de servicios BACnet

### 3. Árbol de Objetos BACnet
- 8 objetos BACnet claramente organizados
- Valores en tiempo real
- Botones de información explicativa

### 4. Panel de Diagnóstico
- Estadísticas de mensajes (Who-Is, I-Am, Read, Write, COV)
- Registro técnico
- Información de red

## 🗺️ Mapa de Objetos BACnet

| Objeto | Tipo | Instance | Descripción |
|--------|------|----------|-------------|
| ESTADO_PANEL | MSV | 0 | Estado global (1=Normal, 2=Alarma, 3=Avería) |
| CONTADOR_ALARMAS | AV | 0 | Número de alarmas activas |
| CMD_RESET | BV | 0 | Comando de reset (escribir 1 para resetear) |
| ALARMA_DET_01 | BI | 0 | Detector de humo zona 1 |
| ALARMA_DET_02 | BI | 1 | Detector de humo zona 2 |
| ALARMA_DET_03 | BI | 2 | Detector de humo zona 3 |
| ALARMA_PULS_01 | BI | 3 | Pulsador manual |
| SIRENA_ACTIVA | BI | 4 | Estado de la sirena |

## 🧪 Probar con Cliente BACnet Externo

### Opción 1: YABE (Yet Another BACnet Explorer)

1. Descarga YABE: https://sourceforge.net/projects/yetanotherbacnetexplorer/
2. Ejecuta YABE
3. Haz clic en "Add Device" → "Discover"
4. Deberías ver "Device 40001"
5. Explora los objetos y lee sus valores

### Opción 2: CBMS BACnet Simulator (Ya instalado en tu PC)

1. Abre `C:\Program Files\CBMS\BACnet Simulator\`
2. Ejecuta el simulador
3. Configura como cliente BACnet
4. Busca dispositivos en la red
5. Conecta al Device 40001 en `192.168.1.100:47808`

### Servicios BACnet Soportados

- ✅ **Who-Is / I-Am**: Descubrimiento de dispositivos
- ✅ **ReadProperty**: Lectura de propiedades
- ✅ **WriteProperty**: Escritura (solo CMD_RESET)
- ✅ **SubscribeCOV**: Notificaciones de cambio de valor

## 📚 Modo Tutorial

Haz clic en el botón **"Modo Tutorial"** en la cabecera para ver una guía paso a paso que explica:

1. Descubrimiento BACnet (Who-Is/I-Am)
2. Lectura de propiedades (ReadProperty)
3. Simulación de alarmas
4. Reset del panel (WriteProperty)
5. Notificaciones COV

## 🎨 Interfaz

La aplicación tiene 4 secciones principales:

```
┌─────────────────────────────────────────────────────────┐
│  CABECERA: Dispositivo 40001 | Modo Tutorial            │
├──────────────┬────────────────────┬──────────────────────┤
│ PANEL        │ RED BACNET         │ OBJETOS BACNET       │
│ CONTROL      │ + MENSAJES         │ ÁRBOL                │
├──────────────┴────────────────────┴──────────────────────┤
│  DIAGNÓSTICO: Estadísticas y Registro Técnico           │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Configuración

### Puerto BACnet
Por defecto: **47808** (estándar BACnet/IP)

Para cambiar el puerto, edita `bacnetServer.js`:
```javascript
const firePanel = new BACnetFirePanel(40001, 47808); // Device ID, Puerto
```

### Puerto HTTP
Por defecto: **3001**

Para cambiar, edita `server.js`:
```javascript
const HTTP_PORT = 3001;
```

## 📖 Conceptos BACnet Explicados

### ¿Qué es BACnet?
BACnet (Building Automation and Control Networks) es un protocolo de comunicación estándar para sistemas de automatización de edificios.

### Tipos de Objetos Usados

- **Device**: Representa el dispositivo físico (la central)
- **Multi-State Value (MSV)**: Valor con múltiples estados (Normal/Alarma/Avería)
- **Analog Value (AV)**: Valor numérico (contador de alarmas)
- **Binary Value (BV)**: Valor escribible on/off (comando reset)
- **Binary Input (BI)**: Entrada digital on/off (sensores)

### Servicios BACnet

- **Who-Is**: Broadcast para descubrir dispositivos
- **I-Am**: Respuesta con información del dispositivo
- **ReadProperty**: Leer el valor de una propiedad
- **WriteProperty**: Escribir un valor
- **SubscribeCOV**: Suscribirse a notificaciones de cambio

## 🐛 Solución de Problemas

### El servidor no arranca
- Verifica que el puerto 47808 no esté en uso
- Ejecuta como administrador si es necesario

### No veo el dispositivo desde YABE
- Verifica que estés en la misma red
- Desactiva el firewall temporalmente
- Usa la IP correcta (192.168.1.100 o localhost)

### Los mensajes no aparecen
- Refresca la página
- Verifica la consola del navegador (F12)
- Comprueba que el servidor esté corriendo

## 📝 Estructura del Proyecto

```
simulador-bacnet-didactico/
├── server.js              # Servidor Express + API
├── bacnetServer.js        # Servidor BACnet/IP
├── package.json           # Dependencias
├── public/
│   ├── index.html         # Interfaz principal
│   ├── styles.css         # Estilos visuales
│   └── app.js             # Lógica frontend
└── README.md              # Este archivo
```

## 🤝 Contribuir

Este es un proyecto educativo. Siéntete libre de:
- Añadir más objetos BACnet
- Mejorar la visualización
- Agregar más servicios BACnet
- Traducir a otros idiomas

## 📄 Licencia

MIT License - Úsalo libremente para aprender

## 👨‍💻 Autor

Luis Enrique Seco - Unidad de Seguridad, Universidad de Zaragoza

---

**¿Preguntas?** Abre el Modo Tutorial en la aplicación para una guía completa.
