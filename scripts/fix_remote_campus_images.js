require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixRemoteCampusImages() {
    console.log('🌍 Conectando a la base de datos remota...');
    console.log(`📡 Host: ${process.env.DB_HOST}`);
    console.log(`🔌 Port: ${process.env.DB_PORT}`);

    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });

        console.log('✅ Conexión establecida con éxito.');

        // Actualizar image_filename
        const [result1] = await connection.execute(`
            UPDATE campuses 
            SET image_filename = CONCAT('img/campuses/', image_filename)
            WHERE image_filename NOT LIKE 'img/%' AND image_filename IS NOT NULL
        `);
        console.log(`🖼️  Imágenes actualizadas: ${result1.affectedRows}`);

        // Actualizar background_image
        const [result2] = await connection.execute(`
            UPDATE campuses 
            SET background_image = CONCAT('img/campuses/', background_image)
            WHERE background_image NOT LIKE 'img/%' AND background_image IS NOT NULL
        `);
        console.log(`🌆 Fondos actualizados: ${result2.affectedRows}`);

        // Verificar resultados
        const [rows] = await connection.execute('SELECT id, name, image_filename, background_image FROM campuses');
        console.log('\n📋 Estado actual de los campus en el servidor:');
        console.table(rows);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

fixRemoteCampusImages();
