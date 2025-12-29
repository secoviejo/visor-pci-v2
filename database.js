const Database = require('better-sqlite3');
const path = require('path');
// Database Setup
const db = new Database('pci.db', { verbose: console.log }); // File based DB

// Initialize Schema
function initDb() {
    // Buildings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS buildings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            campus_id INTEGER DEFAULT 1,
            x REAL,
            y REAL,
            FOREIGN KEY(campus_id) REFERENCES campuses(id)
        )
    `);

    // Campuses table
    db.exec(`
        CREATE TABLE IF NOT EXISTS campuses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    `);

    // Migration: Add description and image_filename if missing
    const campusCols = db.prepare("PRAGMA table_info(campuses)").all();
    if (!campusCols.some(c => c.name === 'description')) {
        db.exec("ALTER TABLE campuses ADD COLUMN description TEXT");
        console.log('Added description column to campuses.');
    }
    if (!campusCols.some(c => c.name === 'background_image')) {
        db.exec("ALTER TABLE campuses ADD COLUMN background_image TEXT");
        console.log('Added background_image column to campuses.');
    }

    // Migration for Building Campus Link & Coords
    const buildingCols = db.prepare("PRAGMA table_info(buildings)").all();
    if (!buildingCols.some(c => c.name === 'campus_id')) {
        db.exec("ALTER TABLE buildings ADD COLUMN campus_id INTEGER DEFAULT 1");
    }
    if (!buildingCols.some(c => c.name === 'x')) {
        db.exec("ALTER TABLE buildings ADD COLUMN x REAL");
    }
    if (!buildingCols.some(c => c.name === 'y')) {
        db.exec("ALTER TABLE buildings ADD COLUMN y REAL");
    }

    // Check if we need to migrate floors (add building_id)
    // We can't easily ALTER COLUMN to add FK in SQLite, so we check if table exists and has column.
    // Simplifying for this task: We will check if 'buildings' is empty (newly created)
    // and if we have floors.

    // Floors table - We want to add building_id. 
    // If it's a new run, just create it. 
    // If it exists from previous version, we need to handle it.

    const tableInfo = db.prepare("PRAGMA table_info(floors)").all();
    const hasBuildingId = tableInfo.some(c => c.name === 'building_id');

    if (!hasBuildingId) {
        console.log('Migrating database to support buildings...');

        // 1. Create Default Building
        const validBuilding = db.prepare('SELECT id FROM buildings WHERE id = 1').get();
        if (!validBuilding) {
            db.prepare("INSERT INTO buildings (id, name) VALUES (1, 'Edificio Principal (CIRCE)')").run();
        }

        // 2. Migration: We need to recreate the table to add the constraint cleanly or just add column.
        // SQLite supports ADD COLUMN. 
        // Note: SQLite has limitations on adding columns with FKs and Defaults simultaneously.
        // We will add the column without the FK constraint for the migration to be safe/simple.
        db.exec(`ALTER TABLE floors ADD COLUMN building_id INTEGER DEFAULT 1`);
        console.log('Floors table updated with building_id.');
    } else {
        // Ensure table exists if fresh start
        db.exec(`
            CREATE TABLE IF NOT EXISTS floors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                image_filename TEXT NOT NULL,
                width INTEGER DEFAULT 0,
                height INTEGER DEFAULT 0,
                building_id INTEGER DEFAULT 1,
                FOREIGN KEY(building_id) REFERENCES buildings(id)
            )
        `);
    }

    // Devices table (Elementos)
    db.exec(`
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            floor_id INTEGER,
            device_id TEXT, -- The external ID from the device (e.g. 1627485277)
            number TEXT,    -- The short number (e.g. 38)
            type TEXT,      -- detector, pulsador, sirena
            x REAL,
            y REAL,
            location TEXT,
            FOREIGN KEY(floor_id) REFERENCES floors(id)
        )
    `);

    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            role TEXT DEFAULT 'viewer' -- admin, operator, viewer
        )
    `);

    // Migration for Roles
    const userCols = db.prepare("PRAGMA table_info(users)").all();
    if (!userCols.some(c => c.name === 'role')) {
        db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'viewer'");
        db.prepare("UPDATE users SET role = 'admin' WHERE username = 'admin'").run();
        console.log('Migrated users table with roles.');
    }

    // Gateways table (Configuración Pasarelas)
    db.exec(`
        CREATE TABLE IF NOT EXISTS gateways (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL, -- MODBUS, BACNET
            ip_address TEXT,
            port INTEGER,
            config TEXT -- JSON extra config
        )
    `);

    // Events History table
    db.exec(`
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT, -- Link to device external ID if applicable
            type TEXT NOT NULL, -- ALARM, FAULT, INFO
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            acknowledged BOOLEAN DEFAULT 0,
            acknowledged_by TEXT,
            resolved BOOLEAN DEFAULT 0,
            value TEXT, -- Raw value or JSON
            origin TEXT -- REAL, SIM
        )
    `);

    console.log('Database schema initialized.');
    seedData();
}

function seedData() {
    // Seed Admin User (admin / admin123)
    try {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('admin123', 10);

        // Ensure fresh start for admin
        const deleteStmt = db.prepare('DELETE FROM users WHERE username = ?');
        deleteStmt.run('admin');

        const insertStmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
        insertStmt.run('admin', hash, 'admin');
        console.log('✅ Admin user reset: admin / admin123 / role:admin');
    } catch (e) {
        console.error('⚠️ Could not seed admin user:', e.message);
        console.log('Please ensure "bcryptjs" is installed (npm install).');
    }

    // Check Campuses
    const campusCount = db.prepare('SELECT count(*) as count FROM campuses').get();

    // If we have less than 6 campuses, assume we need to re-seed (migration from 3 to 6)
    if (campusCount.count < 6) {
        console.log('Seeding/Updating Campuses...');

        // Clear existing to avoid duplicates or IDs mismatch if we want clean list
        // WARNING: This might break FKs if we delete. Better to Upsert or just Delete if safe.
        // Since this is dev/demo, we can try to DELETE ALL and re-insert, but that breaks buildings links.
        // Better strategy: Update existing by ID 1, 2, 3 and Insert 4, 5, 6.

        const campuses = [
            { id: 1, name: 'Campus Plaza San Francisco', desc: 'Campus principal. Ciencias, Derecho, Educación.', img: 'img/campuses/campus_sf.jpg', bg: 'img/campuses/campus_sf_3d.png' },
            { id: 2, name: 'Campus Río Ebro', desc: 'Ingeniería (EINA) y Arquitectura.', img: 'img/campuses/campus_rio_ebro.jpg', bg: 'img/campuses/rio_ebro_3d.png' },
            { id: 3, name: 'Campus Huesca y Jaca', desc: 'Salud, Deporte y Gestión Pública.', img: 'img/campuses/campus_huesca.jpg', bg: 'img/campuses/campus_huesca.jpg' },
            { id: 4, name: 'Campus Paraíso', desc: 'Facultades de Economía, Empresa y Gran Vía.', img: 'img/campuses/campus_paraiso.jpg', bg: 'img/campuses/campus_paraiso.jpg' },
            { id: 5, name: 'Campus Veterinaria', desc: 'Facultad de Veterinaria.', img: 'img/campuses/campus_veterinaria.jpg', bg: 'img/campuses/campus_veterinaria.jpg' },
            { id: 6, name: 'Campus Teruel', desc: 'Ciencias Sociales y Humanas, Ingeniería.', img: 'img/campuses/campus_teruel.jpg', bg: 'img/campuses/campus_teruel.jpg' }
        ];

        const upsert = db.prepare(`
            INSERT INTO campuses (id, name, description, image_filename, background_image) 
            VALUES (@id, @name, @desc, @img, @bg)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, 
                description=excluded.description, 
                image_filename=excluded.image_filename,
                background_image=excluded.background_image
        `);

        const insert = db.prepare('INSERT INTO campuses (name, description, image_filename, background_image) VALUES (@name, @desc, @img, @bg)');

        for (const c of campuses) {
            // Check if exists
            const exists = db.prepare('SELECT id FROM campuses WHERE id = ?').get(c.id);
            if (exists) {
                upsert.run(c);
            } else {
                // If we rely on autoincrement but want specific IDs, we can force ID text or just insert
                // SQLite allows inserting ID.
                upsert.run(c);
            }
        }
        console.log('✅ Campuses Updated (6 Campuses).');
    }

    const floorsCount = db.prepare('SELECT count(*) as count FROM floors').get();
    if (floorsCount.count === 0) {
        console.log('Seeding initial floors/devices...');

        // 1. Insert Main Floor (Image from index.html)
        // 0. Insert Default Campuses
        // This block is now handled by the campus update logic above.
        // const stmtCampus = db.prepare('INSERT INTO campuses (name, description, image_filename) VALUES (?, ?, ?)');

        // const campuses = [
        //     { name: 'Campus Paraíso', desc: 'Facultades de Economía, Empresa y Gran Vía.', img: 'campus_paraiso.jpg' },
        //     { name: 'Campus Plaza San Francisco', desc: 'Campus principal. Ciencias, Derecho, Educación.', img: 'campus_sf.jpg' },
        //     { name: 'Campus Río Ebro', desc: 'Ingeniería (EINA) y Arquitectura.', img: 'campus_rio_ebro.jpg' },
        //     { name: 'Campus Veterinaria', desc: 'Facultad de Veterinaria.', img: 'campus_veterinaria.jpg' },
        //     { name: 'Campus Huesca y Jaca', desc: 'Salud, Deporte y Gestión Pública.', img: 'campus_huesca.jpg' },
        //     { name: 'Campus Teruel', desc: 'Ciencias Sociales y Humanas, Ingeniería.', img: 'campus_teruel.jpg' }
        // ];

        // for (const c of campuses) {
        //     stmtCampus.run(c.name, c.desc, c.img);
        // }

        // console.log('Seeded Campuses (Real University List).');

        // 1. Insert Main Floor (Image from index.html)
        const stmt = db.prepare('INSERT INTO floors (name, image_filename, building_id) VALUES (?, ?, ?)');
        // Ensure building 1 is linked to Campus 2 (Río Ebro -> CIRCE usually)
        // But for simplicity, let's update Building 1 to be in Campus 2
        db.prepare('UPDATE buildings SET campus_id = 2 WHERE id = 1').run();

        const info = stmt.run('Planta 1 - General', 'img/placeholders/floor_generic.jpg', 1);
        const floorId = info.lastInsertRowid;

        // 2. Insert Devices (Extracted from index.html)
        const insertDevice = db.prepare(`
            INSERT INTO devices (floor_id, device_id, number, type, x, y, location) 
            VALUES (@floorId, @id, @n, @t, @x, @y, @loc)
        `);

        const initialDevices = [
            // --- SALA GRANDE IZQUIERDA (01.280) ---
            { n: "38", id: "1627485277", t: "detector", x: 12, y: 58, loc: "Altillo Sur (Entrada/Abajo)" },
            { n: "39", id: "1627492255", t: "detector", x: 12, y: 48, loc: "Altillo Sur (Fondo Izq)" },
            { n: "40", id: "1627489996", t: "detector", x: 18, y: 45, loc: "Altillo Sur (Fondo Der)" },
            { n: "41", id: "1627471971", t: "detector", x: 18, y: 55, loc: "Altillo Sur (Centro)" },
            { n: "42", id: "1627486077", t: "detector", x: 23, y: 53, loc: "Altillo Sur (Puerta)" },
            // --- PASILLO ---
            { n: "26", id: "1627494560", t: "detector", x: 45, y: 32, loc: "Despacho 01.170 (Junto escalera)" },
            { n: "27", id: "1627493997", t: "detector", x: 43, y: 35, loc: "Despacho 01.180" },
            { n: "28", id: "1627494574", t: "detector", x: 41, y: 38, loc: "Despacho 01.190" },
            { n: "29", id: "1627493216", t: "detector", x: 39, y: 41, loc: "Despacho 01.200" },
            { n: "30", id: "1627493132", t: "detector", x: 37, y: 44, loc: "Despacho 01.210" },
            { n: "31", id: "1627490052", t: "detector", x: 35, y: 47, loc: "Despacho 01.220 (Final pasillo)" },
            // --- ZONA SERVICIOS ---
            { n: "36", id: "1627494565", t: "detector", x: 32, y: 50, loc: "Hueco Baterías (01.270)" },
            { n: "35", id: "1627486556", t: "detector", x: 37, y: 52, loc: "Limpieza (01.260)" },
            { n: "34", id: "1627493144", t: "detector", x: 38, y: 54, loc: "Vestuarios (01.250)" },
            { n: "33", id: "1627490009", t: "detector", x: 40, y: 51, loc: "Aseo Minusválidos (01.240)" },
            { n: "32", id: "1627488952", t: "detector", x: 42, y: 49, loc: "Aseo Señoras (01.230)" },
            // --- ZONA SUPERIOR ---
            { n: "37", id: "1627493988", t: "detector", x: 50, y: 28, loc: "Altillo Norte (Puente/Lobby)" },
            { n: "51", id: "1140855775", t: "pulsador", x: 55, y: 35, loc: "Pulsador Escalera" },
            { n: "52", id: "2154849293", t: "sirena", x: 57, y: 35, loc: "Sirena Escalera" },
            // --- SALA CENTRAL ---
            { n: "77", id: "1140855809", t: "pulsador", x: 52, y: 53, loc: "Pulsador Sala Central" },
            { n: "78", id: "2154849242", t: "sirena", x: 53, y: 55, loc: "Sirena Sala Central" },
            { n: "18", id: "1627494659", t: "detector", x: 56, y: 50, loc: "Sala Expo (Norte)" },
            { n: "19", id: "1627494573", t: "detector", x: 60, y: 50, loc: "Sala Expo (Noreste)" },
            { n: "20", id: "1627493127", t: "detector", x: 62, y: 53, loc: "Sala Expo (Este)" },
            { n: "21", id: "1627493070", t: "detector", x: 61, y: 56, loc: "Sala Expo (Sureste)" },
            { n: "22", id: "1627494572", t: "detector", x: 58, y: 57, loc: "Sala Expo (Sur)" },
            { n: "23", id: "1627494570", t: "detector", x: 55, y: 56, loc: "Sala Expo (Suroeste)" },
            { n: "24", id: "1627494564", t: "detector", x: 54, y: 53, loc: "Sala Expo (Oeste)" },
            // --- ANILLO DESPACHOS ---
            { n: "13", id: "1627489001", t: "detector", x: 64, y: 30, loc: "Despacho 05 (01.110)" },
            { n: "14", id: "1627488084", t: "detector", x: 69, y: 35, loc: "Despacho 04 (01.120)" },
            { n: "15", id: "1627490042", t: "detector", x: 73, y: 42, loc: "Despacho 03 (01.130)" },
            { n: "16", id: "1627486986", t: "detector", x: 76, y: 50, loc: "Despacho 02 (01.140)" },
            { n: "50", id: "1627493172", t: "detector", x: 74, y: 62, loc: "Despacho 05 (01.010)" },
            { n: "49", id: "1627488695", t: "detector", x: 70, y: 70, loc: "Despacho 06 (01.020)" },
            { n: "48", id: "1627487184", t: "detector", x: 65, y: 76, loc: "Despacho 07 (01.030)" },
            { n: "47", id: "1627487496", t: "detector", x: 58, y: 80, loc: "Despacho 08 (01.040)" },
            { n: "46", id: "1627485283", t: "detector", x: 51, y: 81, loc: "Despacho 09 (01.050)" },
            { n: "45", id: "1627493136", t: "detector", x: 45, y: 78, loc: "Despacho 10 (01.060)" }
        ];


        const insertTx = db.transaction((devices) => {
            for (const d of devices) {
                insertDevice.run({
                    floorId: floorId,
                    id: d.id,
                    n: d.n,
                    t: d.t,
                    x: d.x,
                    y: d.y,
                    loc: d.loc
                });
            }
        });

        insertTx(initialDevices);
        console.log('Seeded initial devices.');
    }
}

initDb();

module.exports = db;
