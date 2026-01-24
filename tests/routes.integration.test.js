const request = require('supertest');
const { createTestApp, buildAuthHeader } = require('./helpers/createTestApp');

let app;
let db;

beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
});

describe('Admin routes integration', () => {
    test('GET /api/admin/hardware/status rejects non-admin', async () => {
        const response = await request(app)
            .get('/api/admin/hardware/status')
            .set('Authorization', buildAuthHeader('viewer'));

        expect(response.status).toBe(403);
    });

    test('GET /api/admin/hardware/status returns status for admin', async () => {
        const response = await request(app)
            .get('/api/admin/hardware/status')
            .set('Authorization', buildAuthHeader('admin'));

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ enabled: false });
    });

    test('GET /api/admin/users returns stored users for admin', async () => {
        await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['testuser', 'hash', 'admin']);

        const response = await request(app)
            .get('/api/admin/users')
            .set('Authorization', buildAuthHeader('admin'));

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expect.arrayContaining([expect.objectContaining({ username: 'testuser', role: 'admin' })])
        );
    });
});

describe('Notification routes integration', () => {
    test('GET /api/notifications/config masks secrets', async () => {
        await db.run(
            'UPDATE notification_config SET gmail_app_password = ?, twilio_auth_token = ?, telegram_bot_token = ? WHERE id = 1',
            ['secret', 'token', 'bot']
        );

        const response = await request(app)
            .get('/api/notifications/config')
            .set('Authorization', buildAuthHeader('admin'));

        expect(response.status).toBe(200);
        expect(response.body.gmail_app_password).toBe('***');
        expect(response.body.twilio_auth_token).toBe('***');
        expect(response.body.telegram_bot_token).toBe('***');
    });
});

describe('Simulation routes integration', () => {
    test('POST /api/simulation/alarm returns 404 when no device', async () => {
        const response = await request(app)
            .post('/api/simulation/alarm')
            .set('Authorization', buildAuthHeader('admin'));

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'No devices found' });
    });
});
