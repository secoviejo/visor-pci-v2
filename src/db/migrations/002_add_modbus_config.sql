-- Migration: Add Dynamic Modbus Configuration

ALTER TABLE buildings ADD COLUMN modbus_config TEXT;

-- Backfill default configuration for existing Modbus enabled buildings
-- Standard behavior: Read 2 Discrete Inputs starting at address 0
UPDATE buildings
SET
    modbus_config = '{"pollingInterval": 1000, "readMappings": [{"type": "DiscreteInputs", "address": 0, "count": 2, "names": ["di0", "di1"]}]}'
WHERE
    modbus_ip IS NOT NULL;