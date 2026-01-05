const express = require('express');
const request = require('supertest');
const catalogRouter = require('../routes/catalog');

// Mock catalogService
jest.mock('../services/catalogService', () => ({
    getCatalogItems: jest.fn((type, id, extra) => Promise.resolve({ metas: [], type, id, extra }))
}));

const app = express();
app.use('/catalog', catalogRouter);

describe('Catalog Routes', () => {
    test('should handle standard route without extra params', async () => {
        const res = await request(app).get('/catalog/movie/vixsrc_movies.json');
        expect(res.statusCode).toBe(200);
        expect(res.body.type).toBe('movie');
        expect(res.body.id).toBe('vixsrc_movies');
        expect(res.body.extra).toEqual({});
    });

    test('should handle route with extra params (genre)', async () => {
        const res = await request(app).get('/catalog/movie/vixsrc_movies/genre=Azione.json');
        expect(res.statusCode).toBe(200);
        expect(res.body.type).toBe('movie');
        expect(res.body.id).toBe('vixsrc_movies');
        expect(res.body.extra).toEqual({ genre: 'Azione' });
    });

    test('should handle route with multiple extra params', async () => {
        const res = await request(app).get('/catalog/movie/vixsrc_movies/genre=Azione&skip=20.json');
        expect(res.statusCode).toBe(200);
        expect(res.body.type).toBe('movie');
        expect(res.body.id).toBe('vixsrc_movies');
        expect(res.body.extra).toEqual({ genre: 'Azione', skip: '20' });
    });

    test('should handle encoded special characters', async () => {
        const res = await request(app).get('/catalog/movie/vixsrc_movies/genre=Novit%C3%A0.json');
        expect(res.statusCode).toBe(200);
        expect(res.body.extra).toEqual({ genre: 'Novità' });
    });

    test('should handle plus sign in parameters', async () => {
        // "Apple TV+" encoded by Express/Browser might come as "Apple%20TV%2B" -> decoded to "Apple TV+"
        // We simulate the decoded path segment containing "+"
        // Note: supertest/express handles encoding. If we send "Apple TV+", it might be encoded.
        // Let's send encoded %2B to simulate what comes over wire
        const res = await request(app).get('/catalog/movie/vixsrc_provider_movie/provider=Apple%20TV%2B.json');
        expect(res.statusCode).toBe(200);
        expect(res.body.extra).toEqual({ provider: 'Apple TV+' });
    });
});
