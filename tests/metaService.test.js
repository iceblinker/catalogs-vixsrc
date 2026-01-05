const { fullMeta, toMetaPreview, buildCollectionMeta } = require('../services/metaService');

// Mock constants
jest.mock('../config/constants', () => ({
    GENRE_MAP: { 'Action': 'Action', 'Adventure': 'Adventure' },
    MANIFEST_COLLECTION_GENRES: ['Action', 'Adventure', 'Comedy']
}));

describe('metaService', () => {
    describe('fullMeta', () => {
        it('should return null if row is null', () => {
            expect(fullMeta(null, 'movie')).toBeNull();
        });

        it('should correctly map movie fields', () => {
            const row = {
                tmdb_id: 123,
                title: 'Test Movie',
                poster_path: '/poster.jpg',
                background_path: '/bg.jpg',
                logo_path: '/logo.png',
                description: 'A test movie',
                release_year: 2023,
                rating: 8.5,
                runtime: 120,
                genres: JSON.stringify([{ name: 'Action' }]),
                cast: JSON.stringify([{ name: 'Actor 1' }]),
                director: JSON.stringify([{ name: 'Director 1' }])
            };
            const result = fullMeta(row, 'movie');
            expect(result).toEqual({
                id: 'tmdb:123',
                type: 'movie',
                name: 'Test Movie',
                poster: 'https://image.tmdb.org/t/p/w500/poster.jpg',
                background: 'https://image.tmdb.org/t/p/original/bg.jpg',
                logo: 'https://image.tmdb.org/t/p/original/logo.png',
                description: 'A test movie',
                releaseInfo: 2023,
                year: 2023,
                imdbRating: '8.5',
                genres: ['Action'],
                cast: ['Actor 1'],
                director: ['Director 1'],
                runtime: '120 min',
                videos: []
            });
        });

        it('should handle JSON parsing errors gracefully', () => {
            const row = {
                tmdb_id: 456,
                title: 'Bad JSON Movie',
                genres: 'invalid json',
                cast: 'invalid json',
                director: 'invalid json'
            };
            const result = fullMeta(row, 'movie');
            expect(result.genres).toEqual([]);
            expect(result.cast).toEqual([]);
            expect(result.director).toEqual([]);
        });
    });

    describe('toMetaPreview', () => {
        it('should return null if meta is null', () => {
            expect(toMetaPreview(null)).toBeNull();
        });

        it('should return a subset of fields', () => {
            const meta = {
                id: 'tmdb:123',
                type: 'movie',
                name: 'Test Movie',
                poster: 'poster_url',
                background: 'bg_url',
                genres: ['Action'],
                description: 'Desc',
                year: 2023,
                imdbRating: '8.5',
                extraField: 'should be ignored'
            };
            const result = toMetaPreview(meta);
            expect(result).toEqual({
                id: 'tmdb:123',
                type: 'movie',
                name: 'Test Movie',
                poster: 'poster_url',
                background: 'bg_url',
                genres: ['Action'],
                description: 'Desc',
                year: '2023',
                imdbRating: '8.5'
            });
        });
    });

    describe('buildCollectionMeta', () => {
        it('should correctly aggregate collection data', () => {
            const coll = {
                id: 1,
                name: 'Test Collection',
                name_en: 'Test Collection EN',
                description: 'Collection Desc',
                poster: 'coll_poster',
                background: 'coll_bg'
            };
            const items = [
                {
                    tmdb_id: 101,
                    title: 'Movie 1',
                    release_date: '2020-01-01',
                    rating: 8.0,
                    genres: JSON.stringify([{ name: 'Action' }]),
                    director: JSON.stringify([{ name: 'Dir 1' }]),
                    cast: JSON.stringify([{ name: 'Actor 1' }])
                },
                {
                    tmdb_id: 102,
                    title: 'Movie 2',
                    release_date: '2022-01-01',
                    rating: 9.0,
                    genres: JSON.stringify([{ name: 'Adventure' }]),
                    director: JSON.stringify([{ name: 'Dir 2' }]),
                    cast: JSON.stringify([{ name: 'Actor 2' }])
                }
            ];

            const result = buildCollectionMeta(coll, items);
            console.log('DEBUG RESULT:', JSON.stringify(result, null, 2));

            expect(result.id).toBe('ctmdb.1');
            expect(result.name).toBe('Test Collection');
            expect(result.imdbRating).toBe('8.5'); // Average of 8.0 and 9.0
            expect(result.releaseInfo).toBe('2020-2022');
            expect(result.genres).toEqual(expect.arrayContaining(['Action', 'Adventure']));
            expect(result.director).toEqual(expect.arrayContaining(['Dir 1', 'Dir 2']));
            expect(result.cast).toEqual(expect.arrayContaining(['Actor 1', 'Actor 2']));
        });
    });
});
