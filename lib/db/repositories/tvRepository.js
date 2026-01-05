const { getDatabase } = require('../index');

class TvRepository {
    constructor() {
        this._stmts = null;
    }

    get stmts() {
        if (!this._stmts) {
            const db = getDatabase();
            this._stmts = {
                getById: db.prepare('SELECT * FROM tv_metadata WHERE tmdb_id = ?'),
                count: db.prepare('SELECT COUNT(*) as c FROM tv_metadata'),
                upsert: db.prepare(`INSERT OR REPLACE INTO tv_metadata (
                    tmdb_id,imdb_id,title,name,release_year,first_air_year,genres,rating,director,cast,trailers,logo_path,background_path,poster_path,runtime,description,keywords,writers,countries,original_title,popularity,decade,genre_ids,status,release_date,seasons,last_episode_to_air,next_episode_to_air,watch_providers,created_by,episode_run_time,in_production,languages,last_air_date,networks,number_of_episodes,number_of_seasons,origin_country,production_companies,type,vote_count,catalog_names,primary_catalog,providers,actual_type,provider_catalog_names,episodes,updated_at,created_at
                ) VALUES (
                    @tmdb_id,@imdb_id,@title,@name,@release_year,@first_air_year,@genres,@rating,@director,@cast,@trailers,@logo_path,@background_path,@poster_path,@runtime,@description,@keywords,@writers,@countries,@original_title,@popularity,@decade,@genre_ids,@status,@release_date,@seasons,@last_episode_to_air,@next_episode_to_air,@watch_providers,@created_by,@episode_run_time,@in_production,@languages,@last_air_date,@networks,@number_of_episodes,@number_of_seasons,@origin_country,@production_companies,@type,@vote_count,@catalog_names,@primary_catalog,@providers,@actual_type,@provider_catalog_names,@episodes,CURRENT_TIMESTAMP,COALESCE((SELECT created_at FROM tv_metadata WHERE tmdb_id=@tmdb_id), CURRENT_TIMESTAMP)
                )`),
                check: db.prepare('SELECT tmdb_id FROM tv_metadata WHERE tmdb_id = ?'),
                getAllIds: db.prepare('SELECT tmdb_id FROM tv_metadata')
            };
        }
        return this._stmts;
    }

    getById(id) {
        return this.stmts.getById.get(id);
    }

    exists(id) {
        return !!this.stmts.check.get(id);
    }

    getAllIds() {
        return this.stmts.getAllIds.all().map(r => r.tmdb_id);
    }

    save(item) {
        return this.stmts.upsert.run(item);
    }

    saveMany(items) {
        const insert = this.stmts.upsert;
        const insertMany = getDatabase().transaction((rows) => {
            for (const row of rows) insert.run(row);
        });
        return insertMany(items);
    }

    count(whereClause = '', params = []) {
        if (!whereClause) return this.stmts.count.get().c;
        return getDatabase().prepare(`SELECT COUNT(*) as c FROM tv_metadata ${whereClause}`).get(...params).c;
    }

    find(whereClause = '', params = [], limit = 100, offset = 0, orderBy = 'last_air_date DESC') {
        const query = `SELECT * FROM tv_metadata ${whereClause ? 'WHERE ' + whereClause : ''} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
        return getDatabase().prepare(query).all(...params, limit, offset);
    }

    getByCollectionId(collectionId, limit = 100, offset = 0) {
        return getDatabase().prepare(`SELECT * FROM tv_metadata WHERE collection_id = ? ORDER BY last_air_date DESC LIMIT ? OFFSET ?`).all(collectionId, limit, offset);
    }
}

module.exports = new TvRepository();
