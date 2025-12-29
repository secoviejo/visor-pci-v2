const API_URL = 'http://localhost:3000/api';

async function testAdmin() {
    try {
        console.log('1. Logging in as Admin...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        if (!loginRes.ok) throw new Error(await loginRes.text());
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('✅ Admin Logged In. Token:', token.substring(0, 10) + '...');
        console.log('Role:', loginData.role);

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        console.log('\n2. Creating Operator User...');
        const userRes = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                username: 'operador_test',
                password: 'op123',
                role: 'operator'
            })
        });
        if (!userRes.ok) throw new Error(await userRes.text());
        const userData = await userRes.json();
        console.log('✅ Operator Created. ID:', userData.id);

        console.log('\n3. Listing Users...');
        const usersRes = await fetch(`${API_URL}/users`, { headers });
        const usersList = await usersRes.json();
        console.log('✅ Users:', usersList.map(u => `${u.username} (${u.role})`));

        console.log('\n4. Creating Gateway...');
        const gwRes = await fetch(`${API_URL}/gateways`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                name: 'Pasarela Test',
                type: 'MODBUS',
                ip_address: '192.168.1.50',
                port: 502
            })
        });
        if (!gwRes.ok) throw new Error(await gwRes.text());
        const gwData = await gwRes.json();
        console.log('✅ Gateway Created. ID:', gwData.id);

        console.log('\n5. Listing Gateways...');
        const gwListRes = await fetch(`${API_URL}/gateways`, { headers });
        const gwList = await gwListRes.json();
        console.log('✅ Gateways:', gwList);

        console.log('\n✅ Verification Complete!');

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

testAdmin();
