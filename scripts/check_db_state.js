const { db, initDb } = require('./database');

async function check() {
    await initDb();

    console.log('=== CHECKING EVENTS TABLE ===');
    const events = await db.query("SELECT * FROM events WHERE type = 'ALARM' AND resolved = 0 ORDER BY timestamp DESC LIMIT 10");
    console.log(`Found ${events.length} active alarm events:`);
    events.forEach(e => {
        console.log(`- Event ID: ${e.id}, Device: ${e.device_id}, Message: ${e.message}, Origin: ${e.origin}`);
    });

    console.log('\n=== CHECKING ALERTS TABLE ===');
    const alerts = await db.query("SELECT * FROM alerts WHERE status = 'ACTIVA' ORDER BY started_at DESC LIMIT 10");
    console.log(`Found ${alerts.length} active alerts:`);
    alerts.forEach(a => {
        console.log(`- Alert ID: ${a.id}, Device: ${a.element_id}, Building: ${a.building_id}, Origin: ${a.origin}`);
    });

    console.log('\n=== CHECKING DEVICES IN BUILDING 1 (CIRCE) ===');
    const devices = await db.query(`
        SELECT d.* FROM devices d
        JOIN floors f ON d.floor_id = f.id
        WHERE f.building_id = 1
        LIMIT 5
    `);
    console.log(`Found ${devices.length} devices (showing first 5):`);
    devices.forEach(d => {
        console.log(`- Device ID: ${d.device_id}, Type: ${d.type}, Floor: ${d.floor_id}`);
    });

    process.exit(0);
}

check();
