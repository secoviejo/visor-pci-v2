"""
Simulador BACnet de Central de Incendios
Compatible con Yabe y otros clientes BACnet/IP
"""

import asyncio
from bacpypes3.debugging import bacpypes_debugging, ModuleLogger
from bacpypes3.argparse import SimpleArgumentParser
from bacpypes3.app import Application
from bacpypes3.local.analog import AnalogValueObject
from bacpypes3.local.binary import BinaryInputObject, BinaryValueObject
from bacpypes3.local.multistate import MultiStateValueObject
from bacpypes3.primitivedata import Real, Unsigned

# Logging
_debug = 0
_log = ModuleLogger(globals())


@bacpypes_debugging
class FirePanelSimulator:
    """Simulador de Central de Incendios BACnet"""
    
    def __init__(self, app):
        self.app = app
        self.panel_state = 1  # 1=Normal, 2=Alarma, 3=Avería
        self.active_alarms_count = 0
        
        # Crear objetos BACnet
        self._create_bacnet_objects()
        
        print("\n╔═══════════════════════════════════════════════════════════╗")
        print("║  Simulador BACnet - Central de Incendios (Python)       ║")
        print("╠═══════════════════════════════════════════════════════════╣")
        print(f"║  Device ID: {app.device_object.objectIdentifier[1]}                                         ║")
        print(f"║  Device Name: {app.device_object.objectName}                    ║")
        print("║  Puerto BACnet: 47808 (0xBAC0)                           ║")
        print("╚═══════════════════════════════════════════════════════════╝\n")
        print("✅ Simulador listo. Esperando conexiones BACnet...")
        print("   Puedes usar Yabe para descubrir este dispositivo.\n")
    
    def _create_bacnet_objects(self):
        """Crear todos los objetos BACnet del simulador"""
        
        # 1. ESTADO_PANEL (Multi-State-Value:0)
        # Estados: 1=Normal, 2=Alarma, 3=Avería
        self.estado_panel = MultiStateValueObject(
            objectIdentifier=("multiStateValue", 0),
            objectName="ESTADO_PANEL",
            presentValue=Unsigned(1),
            numberOfStates=Unsigned(3),
            stateText=["", "Normal", "Alarma", "Avería"],
            description="Estado general de la central de incendios"
        )
        self.app.add_object(self.estado_panel)
        
        # 2. CONTADOR_ALARMAS (Analog-Value:0)
        self.contador_alarmas = AnalogValueObject(
            objectIdentifier=("analogValue", 0),
            objectName="CONTADOR_ALARMAS",
            presentValue=Real(0.0),
            description="Número de alarmas activas"
        )
        self.app.add_object(self.contador_alarmas)
        
        # 3. CMD_RESET (Binary-Value:0)
        # Escribible para resetear la central
        self.cmd_reset = BinaryValueObject(
            objectIdentifier=("binaryValue", 0),
            objectName="CMD_RESET",
            presentValue=Unsigned(0),
            description="Comando para resetear la central (escribir 1)"
        )
        self.app.add_object(self.cmd_reset)
        
        # 4. Detectores de humo (Binary-Input:0-2)
        self.det01_alarm = BinaryInputObject(
            objectIdentifier=("binaryInput", 0),
            objectName="ALARMA_DET_01",
            presentValue=Unsigned(0),
            description="Detector de humo 01 - Zona A"
        )
        self.app.add_object(self.det01_alarm)
        
        self.det02_alarm = BinaryInputObject(
            objectIdentifier=("binaryInput", 1),
            objectName="ALARMA_DET_02",
            presentValue=Unsigned(0),
            description="Detector de humo 02 - Zona B"
        )
        self.app.add_object(self.det02_alarm)
        
        self.det03_alarm = BinaryInputObject(
            objectIdentifier=("binaryInput", 2),
            objectName="ALARMA_DET_03",
            presentValue=Unsigned(0),
            description="Detector de humo 03 - Zona C"
        )
        self.app.add_object(self.det03_alarm)
        
        # 5. Pulsador manual (Binary-Input:3)
        self.mcp01_alarm = BinaryInputObject(
            objectIdentifier=("binaryInput", 3),
            objectName="ALARMA_PULS_01",
            presentValue=Unsigned(0),
            description="Pulsador manual 01"
        )
        self.app.add_object(self.mcp01_alarm)
        
        # 6. Sirena (Binary-Input:4)
        self.sirena_activa = BinaryInputObject(
            objectIdentifier=("binaryInput", 4),
            objectName="SIRENA_ACTIVA",
            presentValue=Unsigned(0),
            description="Estado de la sirena"
        )
        self.app.add_object(self.sirena_activa)
        
        print("📋 Objetos BACnet creados:")
        print("   - ESTADO_PANEL (Multi-State-Value:0)")
        print("   - CONTADOR_ALARMAS (Analog-Value:0)")
        print("   - CMD_RESET (Binary-Value:0)")
        print("   - ALARMA_DET_01 (Binary-Input:0)")
        print("   - ALARMA_DET_02 (Binary-Input:1)")
        print("   - ALARMA_DET_03 (Binary-Input:2)")
        print("   - ALARMA_PULS_01 (Binary-Input:3)")
        print("   - SIRENA_ACTIVA (Binary-Input:4)")
    
    async def monitor_reset_command(self):
        """Monitorear el comando de reset"""
        while True:
            await asyncio.sleep(1)
            if self.cmd_reset.presentValue == 1:
                print("\n🔄 Comando RESET recibido - Reseteando central...")
                await self.reset_panel()
    
    async def reset_panel(self):
        """Resetear la central de incendios"""
        self.det01_alarm.presentValue = Unsigned(0)
        self.det02_alarm.presentValue = Unsigned(0)
        self.det03_alarm.presentValue = Unsigned(0)
        self.mcp01_alarm.presentValue = Unsigned(0)
        self.sirena_activa.presentValue = Unsigned(0)
        self.estado_panel.presentValue = Unsigned(1)
        self.contador_alarmas.presentValue = Real(0.0)
        self.cmd_reset.presentValue = Unsigned(0)
        self.active_alarms_count = 0
        self.panel_state = 1
        print("✅ Central reseteada - Estado: NORMAL")
    
    async def simulate_alarm_cycle(self):
        """Simular un ciclo de alarma cada 60 segundos para demostración"""
        await asyncio.sleep(10)  # Esperar 10s antes del primer ciclo
        
        while True:
            # Activar alarma en DET01
            print("\n🔥 SIMULACIÓN: Activando alarma en DETECTOR 01...")
            self.det01_alarm.presentValue = Unsigned(1)
            self.active_alarms_count = 1
            self.panel_state = 2
            self.estado_panel.presentValue = Unsigned(2)
            self.contador_alarmas.presentValue = Real(1.0)
            self.sirena_activa.presentValue = Unsigned(1)
            
            # Mantener alarma por 15 segundos
            await asyncio.sleep(15)
            
            # Auto-reset
            print("🔄 SIMULACIÓN: Auto-reset de la central...")
            await self.reset_panel()
            
            # Esperar 45 segundos antes del próximo ciclo
            await asyncio.sleep(45)


async def main():
    """Función principal"""
    
    # Configurar argumentos usando BACpypes
    parser = SimpleArgumentParser()
    args = parser.parse_args()
    
    # Crear aplicación BACnet
    app = Application.from_args(args)
    
    # Configurar el Device Object
    app.device_object.objectIdentifier = ("device", 40001)
    app.device_object.objectName = "Central_Incendios"
    app.device_object.vendorIdentifier = 999
    app.device_object.vendorName = "Simulador Didáctico"
    app.device_object.modelName = "Central Incendios v1.0"
    
    # Crear simulador
    simulator = FirePanelSimulator(app)
    
    # Iniciar tareas asíncronas
    asyncio.create_task(simulator.monitor_reset_command())
    asyncio.create_task(simulator.simulate_alarm_cycle())
    
    # Ejecutar indefinidamente
    await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Simulador detenido por el usuario")
