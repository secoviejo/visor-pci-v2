const { db, initDb } = require('./database');

async function check() {
    await initDb();

    const isMysql = process.env.DB_CLIENT === 'mysql';

    console.log("Checking notification_config:");
    try {
        const query = isMysql ? 'DESCRIBE notification_config' : 'PRAGMA table_info(notification_config)';
        const configCols = await db.query(query);
        console.log(configCols);
    } catch (e) { console.error(e); }

    console.log("\nChecking notification_recipients:");
    try {
        const query = isMysql ? 'DESCRIBE notification_recipients' : 'PRAGMA table_info(notification_recipients)';
        const recipientCols = await db.query(query);
        console.log(recipientCols);
    } catch (e) { console.error(e); }

    process.exit(0);
}

check();
