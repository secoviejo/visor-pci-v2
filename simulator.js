const ModbusRTU = require("modbus-serial");
const readline = require('readline');

// Internal State
const inputs = {
    0: false, // DI0 (Address 0)
    1: false  // DI1 (Address 1)
};

const coils = {
    0: false // DO0 (Siren)
};

// Vector calls for the Modbus Server
const vector = {
    getDiscreteInput: function (addr, unitID) {
        // Returns the boolean value for the address
        return inputs[addr] || false;
    },
    getCoil: function (addr, unitID) {
        return coils[addr] || false;
    },
    setCoil: function (addr, value, unitID) {
        console.log(`\n[SIMULATOR] Client wrote to COIL ${addr}: ${value ? 'ON' : 'OFF'}`);
        coils[addr] = value;
        return true;
    },
    getInputRegister: function (addr, unitID) { return 0; },
    getHoldingRegister: function (addr, unitID) { return 0; }
};

// Create the Server
const PORT = 502;
console.log(`Starting Modbus TCP Simulator on port ${PORT}...`);

try {
    // Note: On some systems, binding to port 502 requires admin privileges.
    // If it fails, try a higher port like 8502 and update modbusService.js
    const serverTCP = new ModbusRTU.ServerTCP(vector, { host: "0.0.0.0", port: PORT, unitID: 1 });
    console.log(`\n✅ Modbus Simulator Active on localhost:${PORT}`);
    console.log("-----------------------------------------");
    console.log("Controls:");
    console.log("  [1] Toggle DI0 (Fire Alarm Zone 1)");
    console.log("  [2] Toggle DI1 (Fire Alarm Zone 2)");
    console.log("  [q] Quit");
    console.log("-----------------------------------------");
    printStatus();

} catch (e) {
    console.error("Error starting simulator:", e.message);
    if (e.code === 'EACCES') {
        console.log("⚠️  Permission denied for port 502. Try running as Administrator or change port.");
    }
}

// Keyboard Input for Interactive Toggling
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') process.exit();
    if (key.name === 'q') process.exit();

    if (key.name === '1') {
        inputs[0] = !inputs[0];
        console.log(`\n[ACTION] Toggled DI0 to ${inputs[0]}`);
        printStatus();
    }
    if (key.name === '2') {
        inputs[1] = !inputs[1];
        console.log(`\n[ACTION] Toggled DI1 to ${inputs[1]}`);
        printStatus();
    }
});

function printStatus() {
    console.log(`\nCurrent State:`);
    console.log(`  DI0 (Addr 0): ${inputs[0] ? 'ON  🔴' : 'OFF ⚪'}`);
    console.log(`  DI1 (Addr 1): ${inputs[1] ? 'ON  🔴' : 'OFF ⚪'}`);
    console.log(`  DO0 (Siren) : ${coils[0] ? 'ON  🔊' : 'OFF 🔇'}`);
}
