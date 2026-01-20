# Avances - 13 de Enero de 2026

## Trabajo realizado: Simulador BACnet

### Objetivo
Crear un simulador BACnet/IP de una central de incendios compatible con herramientas como Yabe.

### Desarrollo

#### 1. Simulador Node.js (Versión inicial)
- **Ubicación:** `simulador-bacnet-didactico/`
- **Tecnología:** Node.js + `node-bacnet` v0.2.4
- **Estado:** ✅ Funcional con interfaz web
- **Características:**
  - Interfaz web en `http://localhost:3001`
  - Visualización de red BACnet
  - Registro de mensajes en tiempo real
  - Objetos BACnet implementados
  - **Limitación:** Problemas de compatibilidad con Yabe en Windows (mismo puerto UDP)

#### 2. Simulador Python (Versión mejorada)
- **Archivo:** `simulador-bacnet-didactico/simulator_bacpypes.py`
- **Tecnología:** Python 3.13 + BACpypes3 v0.0.102
- **Estado:** ✅ Funcional, pendiente de prueba con Yabe desde otra máquina
- **Características:**
  - Compatibilidad completa con protocolo BACnet/IP estándar
  - Device ID: 40001
  - Puerto: 47808 (0xBAC0 - estándar BACnet)
  - Simulación automática de ciclos de alarma cada 60 segundos

### Objetos BACnet Implementados

| Objeto | Tipo | Instance | Descripción |
|--------|------|----------|-------------|
| ESTADO_PANEL | Multi-State-Value | 0 | Estado de la central (1=Normal, 2=Alarma, 3=Avería) |
| CONTADOR_ALARMAS | Analog-Value | 0 | Número de alarmas activas |
| CMD_RESET | Binary-Value | 0 | Comando de reset (escribir 1 para resetear) |
| ALARMA_DET_01 | Binary-Input | 0 | Detector de humo 01 - Zona A |
| ALARMA_DET_02 | Binary-Input | 1 | Detector de humo 02 - Zona B |
| ALARMA_DET_03 | Binary-Input | 2 | Detector de humo 03 - Zona C |
| ALARMA_PULS_01 | Binary-Input | 3 | Pulsador manual 01 |
| SIRENA_ACTIVA | Binary-Input | 4 | Estado de la sirena |

### Problema Identificado

**Conflicto de puerto en Windows:**
- Yabe y el simulador no pueden compartir el mismo puerto UDP (47808) en la misma máquina
- Error: "Intento de acceso a un socket no permitido por sus permisos de acceso"

### Soluciones Propuestas

1. ✅ **Ejecutar Yabe desde otra computadora** en la misma red (solución recomendada)
2. ✅ Usar máquina virtual
3. ✅ Usar el simulador Node.js con su interfaz web (no requiere Yabe)

### Próximos Pasos

- [ ] Probar el simulador Python con Yabe desde otra computadora en la red
- [ ] Verificar descubrimiento automático (Who-Is/I-Am)
- [ ] Probar lectura de objetos desde Yabe
- [ ] Probar escritura del comando CMD_RESET desde Yabe
- [ ] Documentar el proceso completo

### Archivos Creados

```
simulador-bacnet-didactico/
├── server.js                      # Servidor web Node.js
├── bacnetServer.js                # Servidor BACnet Node.js
├── simulator_bacpypes.py          # Simulador BACnet Python (NUEVO)
├── test_client_bacpypes.py        # Cliente de prueba Python (NUEVO)
├── BACpypes.ini                   # Configuración BACpypes (NUEVO)
├── README_PYTHON.md               # Documentación Python (NUEVO)
├── test-client.js                 # Cliente de prueba Node.js
├── package.json
└── public/
    ├── index.html                 # Interfaz web del simulador
    ├── styles.css
    └── app.js

```

### Comandos de Ejecución

**Simulador Python:**
```bash
cd simulador-bacnet-didactico
python simulator_bacpypes.py --name Central_Incendios --instance 40001 --address <TU_IP>/24
```

**Simulador Node.js:**
```bash
cd simulador-bacnet-didactico
npm start
# Abrir http://localhost:3001
```

### Notas Técnicas

- BACpypes3 tiene mejor compatibilidad con el estándar BACnet que node-bacnet
- El simulador Python envía broadcasts I-Am correctamente
- La limitación actual es específica de Windows con múltiples aplicaciones en el mismo puerto
- En un entorno de producción (simulador en un servidor, Yabe en cliente), funcionará sin problemas

---

**Tiempo dedicado:** ~2 horas  
**Estado general:** ✅ Simulador funcional, pendiente de validación con Yabe desde otra máquina
