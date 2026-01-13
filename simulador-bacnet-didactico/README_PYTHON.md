# Simulador BACnet de Central de Incendios (Python)

Este es un simulador BACnet/IP de una central de incendios, compatible con Yabe y otros clientes BACnet.

## Requisitos

- Python 3.8 o superior
- bacpypes3

## Instalación

```bash
pip install bacpypes3
```

## Uso

### Ejecución básica

```bash
python simulator_bacpypes.py
```

### Opciones de configuración

```bash
# Especificar Device ID personalizado
python simulator_bacpypes.py --device-id 40002

# Especificar nombre de dispositivo
python simulator_bacpypes.py --device-name "Central_Edificio_A"

# Especificar dirección IP
python simulator_bacpypes.py --address 192.168.1.100/24
```

## Objetos BACnet

El simulador expone los siguientes objetos BACnet:

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

## Uso con Yabe

1. Inicia el simulador:
   ```bash
   python simulator_bacpypes.py
   ```

2. Abre Yabe

3. Configura el canal BACnet:
   - Port: `BAC0` (47808)
   - Local endpoint: Tu IP local (ej: `192.168.0.225`)
   - Haz clic en "Start"

4. Descubre el dispositivo:
   - Haz clic derecho en el canal → "Send WhoIs"
   - El dispositivo `40001` (Central_Incendios) debería aparecer automáticamente

5. Explora los objetos:
   - Expande el dispositivo en el árbol
   - Haz doble clic en cualquier objeto para ver sus propiedades
   - Puedes leer valores en tiempo real

6. Prueba el comando de reset:
   - Navega a `CMD_RESET` (Binary-Value:0)
   - Escribe el valor `1` en `Present-Value`
   - La central se reseteará automáticamente

## Simulación automática

El simulador ejecuta un ciclo de demostración cada 60 segundos:
- Activa una alarma en DETECTOR 01
- Mantiene la alarma por 15 segundos
- Auto-resetea la central
- Espera 45 segundos antes del próximo ciclo

Esto te permite ver cómo cambian los valores en tiempo real en Yabe.

## Detener el simulador

Presiona `Ctrl+C` en la terminal donde está corriendo el simulador.
