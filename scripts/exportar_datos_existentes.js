const fs = require('fs');
const path = require('path');
const db = require('../database');

const OUTPUT_FILE = path.join(__dirname, '../datos_edificios/Campus Rio Ebro/CIRCE/dispositivos.csv');
console.log('Exportando dispositivos a:', OUTPUT_FILE);

// Define mapping from current filenames to new filenames to use in CSV
// We know we renamed them in the previous step
const FILE_MAPPING = {
    'image_9020d6.jpg': 'planta_1.jpg',
    'floor_1766082423364-92024050.png': 'planta_baja.png'
};

try {
    // Select all devices for building 'CIRCE'
    const query = `
        SELECT d.number, d.type, d.location, d.x, d.y, f.image_filename
        FROM devices d
        JOIN floors f ON d.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        WHERE b.name = 'CIRCE'
    `;

    const devices = db.prepare(query).all();

    // Create CSV content
    // Header: planta,tipo,numero,ubicacion,x,y
    let csvContent = 'planta,tipo,numero,ubicacion,x,y\n';

    devices.forEach(d => {
        // Map old filename to new filename, or keep old if not found (though we know them)
        const newFilename = FILE_MAPPING[d.image_filename] || d.image_filename;

        // Escape fields if necessary (simple comma handling)
        const location = d.location ? `"${d.location.replace(/"/g, '""')}"` : '';
        const number = d.number ? `"${d.number}"` : '';

        csvContent += `${newFilename},${d.type},${number},${location},${d.x},${d.y}\n`;
    });

    fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf8');
    console.log(`✅ Exportados ${devices.length} dispositivos.`);

} catch (e) {
    console.error('Error exportando:', e);
}
