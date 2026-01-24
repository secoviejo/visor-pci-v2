const request = require('supertest');
const { createTestApp } = require('./helpers/createTestApp');

process.env.NODE_ENV = 'test';

let app;

beforeAll(async () => {
    ({ app } = await createTestApp({ hardwareEnabled: false }));
});

describe('API Status Endpoint', () => {
    test('GET /api/status should return 200', async () => {
        const response = await request(app).get('/api/status');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('environment');
        expect(response.body.environment).toBe('test');
    });

    test('GET /api/status should return valid JSON', async () => {
        const response = await request(app).get('/api/status');
        expect(response.headers['content-type']).toMatch(/json/);
        expect(response.body).toHaveProperty('timestamp');
    });
});

describe('API Health Check', () => {
    test('Server should respond to requests', async () => {
        const response = await request(app).get('/api/status');
        expect(response.status).not.toBe(404);
        expect(response.status).not.toBe(500);
    });
});
