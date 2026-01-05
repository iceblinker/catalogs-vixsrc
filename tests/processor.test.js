let processList, mapCommon;
let movieRepo, tvRepo, skippedRepo, tmdbClient;

describe('processor', () => {
    beforeEach(() => {
        jest.resetModules(); // Clear module cache to ensure mocks are applied

        // Mock dependencies using doMock to avoid hoisting issues with resetModules
        jest.doMock('../lib/db/index', () => ({
            getDatabase: jest.fn(() => ({ prepare: jest.fn() })),
            closeDatabase: jest.fn()
        }));
        jest.doMock('../lib/db/repositories/movieRepository', () => ({
            exists: jest.fn(),
            save: jest.fn(),
            getById: jest.fn()
        }));
        jest.doMock('../lib/db/repositories/tvRepository', () => ({
            exists: jest.fn(),
            save: jest.fn(),
            getById: jest.fn()
        }));
        jest.doMock('../lib/db/repositories/skippedRepository', () => ({
            save: jest.fn()
        }));
        jest.doMock('../services/ingestion/tmdbClient', () => ({
            fetchTMDB: jest.fn(),
            normalizeProviders: jest.fn()
        }));
        jest.doMock('../config/settings', () => ({
            CATALOG_NAME: 'test_catalog'
        }));

        // Require modules under test
        const processor = require('../services/ingestion/processor');
        processList = processor.processList;
        mapCommon = processor.mapCommon;

        // Get mock instances to configure them in tests
        movieRepo = require('../lib/db/repositories/movieRepository');
        tvRepo = require('../lib/db/repositories/tvRepository');
        skippedRepo = require('../lib/db/repositories/skippedRepository');
        tmdbClient = require('../services/ingestion/tmdbClient');

        // Default mock behavior
        tmdbClient.normalizeProviders.mockReturnValue({ providers: [], watch_providers: {}, provider_catalog_names: [] });
    });

    describe('mapCommon', () => {
        it('should map movie details correctly', () => {
            const details = {
                id: 1,
                title: 'Test Movie',
                release_date: '2023-01-01',
                genres: [{ id: 28, name: 'Action' }],
                vote_average: 8.5,
                overview: 'Overview',
                'watch/providers': {}
            };
            const result = mapCommon(details, [], 'movie');
            expect(result.tmdb_id).toBe(1);
            expect(result.title).toBe('Test Movie');
            expect(result.release_year).toBe(2023);
            expect(result.actual_type).toBe('movie');
        });
    });

    describe('processList', () => {
        it('should skip if item already exists', async () => {
            movieRepo.exists.mockReturnValue(true);
            const result = await processList([1], 'movie', jest.fn());
            expect(result.already).toBe(1);
            expect(tmdbClient.fetchTMDB).not.toHaveBeenCalled();
        });

        it('should fetch and save if item does not exist', async () => {
            movieRepo.exists.mockReturnValue(false);
            tvRepo.exists.mockReturnValue(false);
            tmdbClient.fetchTMDB.mockResolvedValue({
                actualType: 'movie',
                details: {
                    id: 1,
                    title: 'New Movie',
                    release_date: '2023-01-01',
                    'watch/providers': {}
                }
            });

            const result = await processList([1], 'movie', jest.fn());
            expect(tmdbClient.fetchTMDB).toHaveBeenCalledWith(1, 'movie', expect.any(Function));
            expect(movieRepo.save).toHaveBeenCalled();
            expect(result.movie).toBe(1);
        });

        it('should handle 404 and fallback', async () => {
            movieRepo.exists.mockReturnValue(false);
            tvRepo.exists.mockReturnValue(false);

            // First call returns null (not found as movie)
            tmdbClient.fetchTMDB.mockResolvedValueOnce(null);
            // Second call (fallback to tv) returns null
            tmdbClient.fetchTMDB.mockResolvedValueOnce(null);

            const result = await processList([1], 'movie', jest.fn());
            expect(tmdbClient.fetchTMDB).toHaveBeenCalledTimes(2);
            expect(skippedRepo.save).toHaveBeenCalled();
            expect(result.skipped).toBe(1);
        });

        it('should handle fallback success', async () => {
            movieRepo.exists.mockReturnValue(false);
            tvRepo.exists.mockReturnValue(false);

            // First call returns null (not found as movie)
            tmdbClient.fetchTMDB.mockImplementationOnce(() => Promise.resolve(null));
            // Second call (fallback to tv) returns success
            tmdbClient.fetchTMDB.mockImplementationOnce(() => Promise.resolve({
                actualType: 'tv',
                details: {
                    id: 1,
                    name: 'New Series',
                    first_air_date: '2023-01-01',
                    'watch/providers': {}
                }
            }));

            const result = await processList([1], 'movie', jest.fn());
            expect(tmdbClient.fetchTMDB).toHaveBeenCalledTimes(2);
            expect(tvRepo.save).toHaveBeenCalled();
            expect(result.tv).toBe(1);
        });
    });
});
