const { getDatabase } = require('../index');

class SkippedRepository {
    constructor() {
        this._stmts = null;
    }

    get stmts() {
        if (!this._stmts) {
            const db = getDatabase();
            this._stmts = {
                insert: db.prepare('INSERT OR REPLACE INTO skipped_tmdb_ids (tmdb_id,reason,last_attempt,catalog_name) VALUES (?,?,?,?)')
            };
        }
        return this._stmts;
    }

    save(id, reason, lastAttempt, catalogName) {
        return this.stmts.insert.run(id, reason, lastAttempt, catalogName);
    }
}

module.exports = new SkippedRepository();
