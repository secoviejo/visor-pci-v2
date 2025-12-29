const db = require('./database');
const query = `
    SELECT c.id, c.name, COUNT(e.id) as alarm_count 
    FROM campuses c 
    LEFT JOIN buildings b ON b.campus_id = c.id 
    LEFT JOIN floors f ON f.building_id = b.id 
    LEFT JOIN devices d ON d.floor_id = f.id 
    LEFT JOIN events e ON (e.device_id = d.device_id AND e.type = 'ALARM' AND e.resolved = 0)
    GROUP BY c.id
`;
const stats = db.prepare(query).all();
console.log(JSON.stringify(stats, null, 2));
console.log('--- EVENTOS ALARMA NO RESUELTOS ---');
const events = db.prepare("SELECT * FROM events WHERE type = 'ALARM' AND resolved = 0").all();
console.log(events);
