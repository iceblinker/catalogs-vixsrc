// Mock repositories and DB BEFORE requiring service
jest.mock('../lib/db/repositories/movieRepository', () => ({
    find: jest.fn(),
    getByCollectionId: jest.fn()
}));
jest.mock('../lib/db/repositories/tvRepository', () => ({
    find: jest.fn(),
    getByCollectionId: jest.fn()
}));
jest.mock('../lib/cache', () => ({
    get: jest.fn(),
    set: jest.fn()
}));
jest.mock('fs', () => ({
    existsSync: jest.fn(() => false),
    readFileSync: jest.fn()
}));

const { getCatalogItems } = require('../services/catalogService');
// Get the mocked repository instance
const movieRepo = require('../lib/db/repositories/movieRepository');

describe('Cinema TV Mapping', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        movieRepo.find.mockReturnValue([]);
    });

    test('should map "Cinema TV" to "TV Movie" in query', async () => {
        await getCatalogItems('movie', 'vixsrc_movies', { genre: 'Cinema TV' });

        const findCall = movieRepo.find.mock.calls[0];
        const whereClause = findCall[0];
        const params = findCall[1];

        // Check if "televisione film" is used in the params instead of "Cinema TV"
        expect(params).toContain('%televisione film%');
        expect(params).not.toContain('%Cinema TV%');
    });

    test('should keep other genres as is', async () => {
        await getCatalogItems('movie', 'vixsrc_movies', { genre: 'Action' });

        const findCall = movieRepo.find.mock.calls[0];
        const params = findCall[1];

        expect(params).toContain('%Action%');
    });
});
