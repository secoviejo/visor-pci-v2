const fetch = require('node-fetch');

async function testApi() {
    try {
        // Authenticate first
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });

        if (!loginRes.ok) {
            console.error('Login failed');
            return;
        }

        const { token } = await loginRes.json();
        console.log('Login successful');

        // Test campuses/stats
        const statsRes = await fetch('http://localhost:3000/api/campuses/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await statsRes.json();
        console.log('\n--- CAMPUSES STATS ---');
        console.log(JSON.stringify(stats, null, 2));

        // Test buildings
        const buildingsRes = await fetch('http://localhost:3000/api/buildings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const buildings = await buildingsRes.json();
        console.log('\n--- BUILDINGS (count) ---');
        console.log(buildings.length);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

testApi();
