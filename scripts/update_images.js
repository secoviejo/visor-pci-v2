const db = require('../database');

const campuses = [
    { id: 1, name: 'Campus Plaza San Francisco', desc: 'Campus principal. Ciencias, Derecho, Educación.', img: 'img/campuses/thumbnail_sf.jpg', bg: 'img/campuses/campus_sf_3d.png' },
    { id: 2, name: 'Campus Río Ebro', desc: 'Ingeniería (EINA) y Arquitectura.', img: 'img/campuses/thumbnail_rio_ebro.png', bg: 'img/campuses/rio_ebro_3d.png' },
    { id: 3, name: 'Campus Huesca y Jaca', desc: 'Salud, Deporte y Gestión Pública.', img: 'img/campuses/thumbnail_huesca.png', bg: 'img/campuses/campus_huesca.jpg' },
    { id: 4, name: 'Campus Paraíso', desc: 'Facultades de Economía, Empresa y Gran Vía.', img: 'img/campuses/thumbnail_paraiso.png', bg: 'img/campuses/campus_paraiso.jpg' },
    { id: 5, name: 'Campus Veterinaria', desc: 'Facultad de Veterinaria.', img: 'img/campuses/thumbnail_veterinaria.png', bg: 'img/campuses/campus_veterinaria.jpg' },
    { id: 6, name: 'Campus Teruel', desc: 'Ciencias Sociales y Humanas, Ingeniería.', img: 'img/campuses/thumbnail_teruel.png', bg: 'img/campuses/campus_teruel.jpg' }
];

const updateStmt = db.prepare(`
    UPDATE campuses 
    SET image_filename = @img, background_image = @bg
    WHERE id = @id
`);

try {
    const transaction = db.transaction((list) => {
        for (const c of list) {
            updateStmt.run(c);
            console.log(`Updated Campus ${c.id}: ${c.name} -> Img: ${c.img}`);
        }
    });

    transaction(campuses);
    console.log('Update complete.');
} catch (e) {
    console.error('Error updating images:', e);
}
