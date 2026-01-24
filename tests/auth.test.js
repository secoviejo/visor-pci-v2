const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Authentication Utilities', () => {
    const SECRET_KEY = 'test-secret-key';
    
    describe('Password Hashing', () => {
        test('should hash password correctly', async () => {
            const password = 'testPassword123';
            const hash = await bcrypt.hash(password, 10);
            
            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(20);
        });

        test('should verify correct password', async () => {
            const password = 'testPassword123';
            const hash = await bcrypt.hash(password, 10);
            const isMatch = await bcrypt.compare(password, hash);
            
            expect(isMatch).toBe(true);
        });

        test('should reject incorrect password', async () => {
            const password = 'testPassword123';
            const wrongPassword = 'wrongPassword';
            const hash = await bcrypt.hash(password, 10);
            const isMatch = await bcrypt.compare(wrongPassword, hash);
            
            expect(isMatch).toBe(false);
        });
    });

    describe('JWT Token Generation', () => {
        test('should generate valid JWT token', () => {
            const payload = { id: 1, username: 'testuser', role: 'admin' };
            const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });
            
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.').length).toBe(3);
        });

        test('should verify valid JWT token', () => {
            const payload = { id: 1, username: 'testuser', role: 'admin' };
            const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });
            const decoded = jwt.verify(token, SECRET_KEY);
            
            expect(decoded.id).toBe(payload.id);
            expect(decoded.username).toBe(payload.username);
            expect(decoded.role).toBe(payload.role);
        });

        test('should reject invalid JWT token', () => {
            const invalidToken = 'invalid.token.here';
            
            expect(() => {
                jwt.verify(invalidToken, SECRET_KEY);
            }).toThrow();
        });
    });
});
