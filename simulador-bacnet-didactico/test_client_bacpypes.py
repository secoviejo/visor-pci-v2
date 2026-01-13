"""
Cliente BACnet simple para probar el simulador
"""

import asyncio
from bacpypes3.debugging import bacpypes_debugging, ModuleLogger
from bacpypes3.argparse import SimpleArgumentParser
from bacpypes3.app import Application
from bacpypes3.pdu import Address
from bacpypes3.primitivedata import ObjectIdentifier

_debug = 0
_log = ModuleLogger(globals())


@bacpypes_debugging
async def main():
    """Cliente BACnet para leer objetos del simulador"""
    
    parser = SimpleArgumentParser()
    args = parser.parse_args()
    
    # Crear aplicación cliente
    app = Application.from_args(args)
    
    # Dirección del simulador
    simulator_address = Address("192.168.0.225")
    device_id = 40001
    
    print("\n╔═══════════════════════════════════════════════════════════╗")
    print("║  Cliente BACnet - Prueba del Simulador                  ║")
    print("╚═══════════════════════════════════════════════════════════╝\n")
    print(f"Conectando al dispositivo {device_id} en {simulator_address}...\n")
    
    await asyncio.sleep(2)
    
    # Leer objetos del simulador
    objects_to_read = [
        ("multiStateValue", 0, "ESTADO_PANEL"),
        ("analogValue", 0, "CONTADOR_ALARMAS"),
        ("binaryValue", 0, "CMD_RESET"),
        ("binaryInput", 0, "ALARMA_DET_01"),
        ("binaryInput", 1, "ALARMA_DET_02"),
        ("binaryInput", 2, "ALARMA_DET_03"),
        ("binaryInput", 3, "ALARMA_PULS_01"),
        ("binaryInput", 4, "SIRENA_ACTIVA"),
    ]
    
    print("📋 Leyendo objetos BACnet del simulador:\n")
    
    for obj_type, obj_instance, obj_name in objects_to_read:
        try:
            obj_id = ObjectIdentifier(f"{obj_type},{obj_instance}")
            value = await app.read_property(
                simulator_address,
                obj_id,
                "presentValue"
            )
            
            # Formatear el valor según el tipo
            if obj_type == "multiStateValue":
                estados = {1: "Normal", 2: "Alarma", 3: "Avería"}
                formatted_value = estados.get(value, str(value))
            elif obj_type == "binaryInput" or obj_type == "binaryValue":
                formatted_value = "ACTIVO" if value == 1 else "INACTIVO"
            else:
                formatted_value = str(value)
            
            print(f"✅ {obj_name:20s} = {formatted_value}")
            
        except Exception as e:
            print(f"❌ {obj_name:20s} = Error: {e}")
        
        await asyncio.sleep(0.5)
    
    print("\n╔═══════════════════════════════════════════════════════════╗")
    print("║  Prueba completada exitosamente                         ║")
    print("╚═══════════════════════════════════════════════════════════╝\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Cliente detenido")
