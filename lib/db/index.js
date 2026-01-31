const Database = require('better-sqlite3');
const { DB_PATH } = require('../../config/settings');

const { ensureSchema } = require('./schema');

let dbInstance = null;

/**
 * Returns the singleton database instance.
 * Creates it if it doesn't exist.
 * @param {object} options - Options for better-sqlite3 (e.g. { readonly: true })
 * @returns {Database.Database}
 */
function getDatabase(options = {}) {
    if (!dbInstance) {
        dbInstance = new Database(DB_PATH, options);
        dbInstance.pragma('journal_mode = WAL');

        // Initialize Schema
        try {
            ensureSchema(dbInstance);
        } catch (e) {
            console.error('[DB] Schema initialization failed:', e.message);
        }

        // Add REGEXP support
        dbInstance.function('regexp', (pattern, str) => {
            if (!str) return 0;
            try {
                return new RegExp(pattern).test(str) ? 1 : 0;
            } catch (e) {
                return 0;
            }
        });
    }
    return dbInstance;
}

/**
 * Closes the database connection if it exists.
 */
function closeDatabase() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}

module.exports = {
    getDatabase,
    closeDatabase
};
