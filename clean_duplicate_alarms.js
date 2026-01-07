const db = require('better-sqlite3')('pci.db');

console.log('=== CLEANING DUPLICATE ALARMS ===\n');

// Get all active alerts grouped by element_id
const duplicates = db.prepare(`
    SELECT element_id, COUNT(*) as count, MIN(id) as keep_id
    FROM alerts 
    WHERE status = 'ACTIVA'
    GROUP BY element_id
    HAVING COUNT(*) > 1
`).all();

console.log(`Found ${duplicates.length} element_ids with duplicates:`);
duplicates.forEach(d => {
    console.log(`  - ${d.element_id}: ${d.count} duplicates, keeping ID ${d.keep_id}`);
});

// Delete duplicates, keeping only the oldest (MIN id) for each element_id
let totalDeleted = 0;
duplicates.forEach(d => {
    const result = db.prepare(`
        DELETE FROM alerts 
        WHERE element_id = ? AND status = 'ACTIVA' AND id != ?
    `).run(d.element_id, d.keep_id);

    console.log(`  Deleted ${result.changes} duplicate(s) for ${d.element_id}`);
    totalDeleted += result.changes;
});

console.log(`\n✅ Total duplicates deleted: ${totalDeleted}`);

// Show final count
const finalCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'ACTIVA'").get();
console.log(`\n📊 Active alerts remaining: ${finalCount.count}`);

db.close();
