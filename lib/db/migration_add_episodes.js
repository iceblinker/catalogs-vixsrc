
const { getDatabase } = require('./index');

function migrate() {
    const db = getDatabase();
    try {
        console.log('Checking if "episodes" column exists in tv_metadata...');
        const info = db.pragma('table_info(tv_metadata)');
        const exists = info.some(c => c.name === 'episodes');

        if (exists) {
            console.log('"episodes" column already exists.');
        } else {
            console.log('Adding "episodes" column...');
            db.prepare('ALTER TABLE tv_metadata ADD COLUMN episodes TEXT').run();
            console.log('Migration successful.');
        }
    } catch (e) {
        console.error('Migration failed:', e.message);
    }
}

migrate();
