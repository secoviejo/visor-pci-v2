-- Script para consultar edificios con Modbus configurado
SELECT id, name, modbus_ip, modbus_port 
FROM buildings 
WHERE modbus_ip IS NOT NULL;
