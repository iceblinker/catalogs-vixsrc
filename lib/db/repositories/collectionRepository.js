const { getDatabase } = require('../index');

class CollectionRepository {
    constructor() {
        this._stmts = null;
    }

    get stmts() {
        if (!this._stmts) {
            const db = getDatabase();
            this._stmts = {
                getById: db.prepare('SELECT * FROM collections WHERE id = ?'),
                upsert: db.prepare('INSERT OR REPLACE INTO collections (id,name,overview,poster_path,backdrop_path,parts) VALUES (?,?,?,?,?,?)'),
                exists: db.prepare('SELECT 1 FROM collections WHERE id = ?')
            };
        }
        return this._stmts;
    }

    getById(id) {
        return this.stmts.getById.get(id);
    }

    exists(id) {
        return !!this.stmts.exists.get(id);
    }

    save(id, name, overview, posterPath, backdropPath, parts) {
        return this.stmts.upsert.run(id, name, overview, posterPath, backdropPath, JSON.stringify(parts));
    }
}

module.exports = new CollectionRepository();
