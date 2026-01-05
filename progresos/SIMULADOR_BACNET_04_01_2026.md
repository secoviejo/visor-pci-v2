# Avances del Proyecto - 4 de Enero de 2026 (Noche) - Simulador BACnet

## 🔥 Nuevo Proyecto: Simulador Didáctico BACnet

Hoy se ha creado desde cero un **simulador didáctico completo de central de incendios con BACnet/IP**, diseñado específicamente para aprender cómo funciona el protocolo BACnet de forma visual e interactiva.

## 📦 Estructura del Proyecto

**Ubicación**: `c:\dev\visor-pci-final\simulador-bacnet-didactico\`

**Archivos creados**:
- `server.js` - Servidor Express con API REST
- `bacnetServer.js` - Servidor BACnet/IP (puerto 47808)
- `package.json` - Dependencias (node-bacnet, express)
- `README.md` - Documentación completa
- `public/index.html` - Interfaz principal (4 secciones)
- `public/styles.css` - Estilos visuales con animaciones
- `public/app.js` - Lógica frontend + modo tutorial

## 🎨 Características Implementadas

### 1. Servidor BACnet/IP Real
- **Device ID**: 40001
- **Puerto BACnet**: 47808 (estándar BACnet/IP)
- **Servicios soportados**:
  - ✅ Who-Is / I-Am (descubrimiento)
  - ✅ ReadProperty (lectura de propiedades)
  - ✅ WriteProperty (escritura en CMD_RESET)
  - ✅ SubscribeCOV (notificaciones de cambio)

### 2. Interfaz Web Visual (4 Secciones)

#### Panel de Control (Izquierda)
- Estado global con círculo animado (Normal/Alarma/Avería)
- 5 dispositivos simulados:
  - 3 Detectores de humo
  - 1 Pulsador manual
  - 1 Sirena
- Botones "Activar Alarma" para cada dispositivo
- Botón "RESETEAR PANEL" global

#### Red BACnet (Centro)
- Diagrama visual de nodos (Central ↔ Cliente)
- Registro de mensajes en lenguaje humano:
  - "Cliente pregunta: ¿Quién hay en la red?"
  - "Dispositivo responde: Soy el Dispositivo 40001"
  - "Cliente lee: ESTADO_PANEL = Normal"
- Traducción automática de servicios BACnet

#### Árbol de Objetos BACnet (Derecha)
- 8 objetos BACnet claramente organizados:
  - ESTADO_PANEL (MSV) - Estado global
  - CONTADOR_ALARMAS (AV) - Número de alarmas
  - CMD_RESET (BV) - Comando de reset
  - ALARMA_DET_01/02/03 (BI) - Detectores
  - ALARMA_PULS_01 (BI) - Pulsador
  - SIRENA_ACTIVA (BI) - Sirena
- Valores en tiempo real
- Botones "?" con explicaciones didácticas

#### Panel de Diagnóstico (Inferior)
- Información de red (IP:Puerto)
- Contadores de mensajes BACnet:
  - Who-Is, I-Am, Lecturas, Escrituras, COV
- Registro técnico en tiempo real

### 3. Modo Tutorial Integrado
- 5 pasos guiados con explicaciones:
  1. Descubrimiento BACnet (Who-Is/I-Am)
  2. Lectura de propiedades (ReadProperty)
  3. Simulación de alarmas
  4. Notificaciones COV
  5. Reset del panel (WriteProperty)
- Explicaciones en lenguaje claro
- Contexto de cada servicio BACnet

### 4. Funcionalidad Completa
- **Simulación de alarmas**: Click en botones activa/desactiva dispositivos
- **Lógica automática**: 
  - Alarma activa → ESTADO_PANEL cambia a "Alarma"
  - Sirena se activa automáticamente
  - Contador de alarmas se actualiza
- **Reset**: Botón rojo resetea todo el sistema
- **Actualización en tiempo real**: Polling cada 1-2 segundos
- **Animaciones CSS**: Círculos pulsantes, parpadeos, transiciones suaves

## 🗺️ Mapa BACnet Implementado

| Objeto | Tipo | Instance | Descripción |
|--------|------|----------|-------------|
| ESTADO_PANEL | MSV | 0 | 1=Normal, 2=Alarma, 3=Avería |
| CONTADOR_ALARMAS | AV | 0 | Número de alarmas activas |
| CMD_RESET | BV | 0 | Comando reset (escribir 1) |
| ALARMA_DET_01 | BI | 0 | Detector humo zona 1 |
| ALARMA_DET_02 | BI | 1 | Detector humo zona 2 |
| ALARMA_DET_03 | BI | 2 | Detector humo zona 3 |
| ALARMA_PULS_01 | BI | 3 | Pulsador manual |
| SIRENA_ACTIVA | BI | 4 | Estado sirena |

## 🎨 Diseño Visual

### Paleta de Colores
- 🟢 Normal: `#10B981`
- 🔴 Alarma: `#EF4444`
- 🟡 Avería: `#F59E0B`
- 🔵 Petición BACnet: `#3B82F6`
- 🟢 Respuesta BACnet: `#10B981`

### Animaciones
- Círculo de estado pulsa cuando hay alarma
- Sirena parpadea cuando está activa
- Transiciones suaves en todos los cambios
- Efectos hover en botones

## 🧪 Testing y Compatibilidad

### Compatible con:
- ✅ **CBMS BACnet Simulator** (ya instalado en el PC)
- ✅ **YABE** (Yet Another BACnet Explorer)
- ✅ Cualquier cliente BACnet estándar

### Servicios Verificados:
- ✅ Descubrimiento de dispositivos (Who-Is/I-Am)
- ✅ Lectura de propiedades (ReadProperty)
- ✅ Escritura de comandos (WriteProperty)
- ✅ Notificaciones COV (SubscribeCOV)

## 📚 Documentación

### README.md Completo
- Instrucciones de instalación
- Guía de uso paso a paso
- Explicación de conceptos BACnet
- Troubleshooting
- Configuración avanzada

### Walkthrough.md
- Descripción detallada de todas las características
- Checklist de verificación
- Instrucciones para testing con clientes externos
- Próximos pasos sugeridos

## 🚀 Despliegue

### Estado Actual
- ✅ Servidor corriendo en `http://localhost:3001`
- ✅ BACnet activo en puerto `47808`
- ✅ Listo para usar inmediatamente

### Control de Versiones
- **Commit**: `642554f`
- **Mensaje**: "Añadido Simulador Didáctico BACnet - Central de Incendios"
- **Archivos**: 8 archivos nuevos
- **Líneas**: 2,641 insertions
- **Push**: ✅ Subido a GitHub (secoviejo/visor-pci-v2)

## 📊 Estadísticas del Desarrollo

- **Tiempo de desarrollo**: ~2 horas
- **Archivos creados**: 8
- **Líneas de código**: 2,641
- **Tecnologías**: Node.js, Express, node-bacnet, HTML5, CSS3, Vanilla JS
- **Objetos BACnet**: 8 (1 Device + 7 objetos)
- **Servicios BACnet**: 4 (Who-Is, ReadProperty, WriteProperty, COV)

## 🎯 Objetivos Cumplidos

✅ Aplicación didáctica y visual  
✅ Servidor BACnet/IP funcional  
✅ Interfaz moderna y atractiva  
✅ Modo tutorial integrado  
✅ Explicaciones en lenguaje claro  
✅ Simulación realista de central de incendios  
✅ Compatible con clientes BACnet estándar  
✅ Documentación completa  
✅ Código limpio y bien estructurado  
✅ Subido a GitHub  

## 💡 Valor Educativo

Este simulador permite:
- **Aprender BACnet** de forma práctica y visual
- **Entender objetos BACnet** (Device, MSV, AV, BV, BI)
- **Ver comunicación en tiempo real** con traducción humana
- **Experimentar con servicios BACnet** sin hardware real
- **Conectar clientes reales** para testing avanzado

## 🔜 Posibles Mejoras Futuras

- Añadir más objetos BACnet (zonas, módulos)
- Implementar BBMD (BACnet Broadcast Management Device)
- Agregar histórico de eventos
- Exportar logs en CSV
- Modo oscuro
- Soporte para múltiples dispositivos
- Integración con Scada-LTS

---

*Simulador creado el 04/01/2026 23:30 - Listo para uso educativo*
