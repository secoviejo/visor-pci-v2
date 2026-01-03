// Test script to verify the simulation endpoint works
const fetch = require('node-fetch');

async function test() {
    try {
        // First, login to get token
        console.log('1. Logging in...');
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });

        const loginData = await loginRes.json();
        console.log('✅ Login successful, token:', loginData.token.substring(0, 20) + '...');

        const token = loginData.token;

        // Test with a building without devices (should return warning)
        console.log('\n2. Testing building WITHOUT devices (ID 2)...');
        const test1 = await fetch('http://localhost:3000/api/simulation/building/2/alarm', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result1 = await test1.json();
        console.log('Response:', result1);

        // Test with CIRCE building (should activate alarms)
        console.log('\n3. Testing building WITH devices (CIRCE ID 82)...');
        const test2 = await fetch('http://localhost:3000/api/simulation/building/82/alarm', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result2 = await test2.json();
        console.log('Response:', result2);

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

test();
