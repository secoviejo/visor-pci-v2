const db = require('./database');

const count = db.prepare('SELECT count(*) as count FROM campuses').get();
console.log('Campuses count:', count.count);

if (count.count === 0) {
    const stmtCampus = db.prepare('INSERT INTO campuses (name, description, image_filename) VALUES (?, ?, ?)');
    stmtCampus.run('Campus San Francisco', 'Campus principal con facultades de humanidades y ciencias. 12 Edificios.', 'campus_sf.jpg'); // ID 1
    stmtCampus.run('Campus Río Ebro', 'Facultades de ingeniería y arquitectura. 8 Edificios.', 'campus_rio_ebro.jpg');     // ID 2
    stmtCampus.run('Campus Huesca', 'Ciencias de la salud y sociales. 6 Edificios.', 'campus_huesca.jpg'); // ID 3
    console.log('Seeded Campuses via script.');

    // Update Default Building
    db.prepare('UPDATE buildings SET campus_id = 2 WHERE id = 1').run();
    console.log('Updated Building 1 to Campus 2');
}
