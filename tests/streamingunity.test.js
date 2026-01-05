const movieRepo = require('../lib/db/repositories/movieRepository');
const { getDatabase } = require('../lib/db');

// Mock dependencies globally where possible
jest.mock('../lib/db/repositories/movieRepository');
jest.mock('../lib/db/repositories/tvRepository');
jest.mock('../lib/db');
jest.mock('fs');
jest.mock('../services/ingestion/tmdbClient');

describe('StreamingUnity Integration', () => {

    beforeEach(() => {
        jest.resetModules(); // CRITICAL: Clear cache to allow re-mocking
    });

    test('Harmonizer should preserve long SU description over short TMDB one', async () => {
        // Setup Mocks
        const mockDb = {
            prepare: jest.fn().mockReturnThis(),
            all: jest.fn().mockReturnValue([
                { tmdb_id: 123, title: 'SU Title', description: 'A very long and detailed Italian description from StreamingUnity.', catalog_names: '["streamingunity"]' }
            ]),
            run: jest.fn()
        };
        require('../lib/db').getDatabase.mockReturnValue(mockDb);

        require('../services/ingestion/tmdbClient').fetchTMDB.mockResolvedValue({
            details: { overview: 'Short desc' }
        });

        // Mock processor specifically for this test
        jest.doMock('../services/ingestion/processor', () => ({
            mapCommon: jest.fn().mockReturnValue({
                title: 'TMDB Title',
                description: 'Short desc',
                release_date: '2023-01-01'
            })
        }));

        // Require harmonizer AFTER mocking
        const { harmonize } = require('../services/ingestion/harmonizer');

        await harmonize('movie_metadata', 'movie', () => { });

        const updateCalls = mockDb.prepare.mock.calls.filter(call => call[0].includes('UPDATE movie_metadata'));
        expect(updateCalls.length).toBeGreaterThan(0);

        const sql = updateCalls[0][0];
        expect(sql).toContain('release_date = ?');
        expect(sql).not.toContain('description = ?');
    });

    test('Harmonizer should overwrite short SU description with long TMDB one', async () => {
        // Setup Mocks
        const mockDb = {
            prepare: jest.fn().mockReturnThis(),
            all: jest.fn().mockReturnValue([
                { tmdb_id: 456, title: 'SU Title', description: 'Too short', catalog_names: '["streamingunity"]' }
            ]),
            run: jest.fn()
        };
        require('../lib/db').getDatabase.mockReturnValue(mockDb);

        require('../services/ingestion/tmdbClient').fetchTMDB.mockResolvedValue({
            details: { overview: 'A very long and detailed description from TMDB that is much better.' }
        });

        jest.doMock('../services/ingestion/processor', () => ({
            mapCommon: jest.fn().mockReturnValue({
                title: 'TMDB Title',
                description: 'A very long and detailed description from TMDB that is much better.',
                release_date: '2023-01-01'
            })
        }));

        const { harmonize } = require('../services/ingestion/harmonizer');

        await harmonize('movie_metadata', 'movie', () => { });

        const updateCalls = mockDb.prepare.mock.calls.filter(call => call[0].includes('UPDATE movie_metadata'));
        expect(updateCalls.length).toBeGreaterThan(0);

        const sql = updateCalls[0][0];
        expect(sql).toContain('description = ?');
    });

    test('CatalogService should handle vixsrc_streamingunity_movie', async () => {
        // This one doesn't need processor mock, but we need to re-require catalogService
        const { getCatalogItems } = require('../services/catalogService');

        require('../lib/db/repositories/movieRepository').find.mockReturnValue([{ id: 1, title: 'Test Movie' }]);

        const result = await getCatalogItems('movie', 'vixsrc_streamingunity_movie', {});

        expect(require('../lib/db/repositories/movieRepository').find).toHaveBeenCalledWith(
            expect.stringContaining('catalog_names LIKE ?'),
            expect.arrayContaining(['%streamingunity%']),
            100,
            0,
            'release_date DESC'
        );
        expect(result.metas).toHaveLength(1);
    });
});
