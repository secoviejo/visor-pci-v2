const http = require('http');

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3000${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        }).on('error', reject);
    });
}

async function testDashboard() {
    console.log('🔍 Testing Dashboard API Endpoints...\n');

    // Test 1: Campus Stats
    console.log('1️⃣ Testing /api/campuses/stats');
    const stats = await makeRequest('/api/campuses/stats');
    console.log('   Status:', stats.status);
    if (stats.status === 200) {
        console.log('   ✅ Campuses loaded:', stats.data.length);
        stats.data.forEach(c => {
            console.log(`      - ${c.name}: ${c.building_count} buildings, ${c.alarm_count} alarms`);
            console.log(`        Image: ${c.image_filename}`);
        });
    } else {
        console.log('   ❌ Error:', stats.data);
    }

    // Test 2: Buildings for Campus 1
    console.log('\n2️⃣ Testing /api/buildings?campusId=1');
    const buildings = await makeRequest('/api/buildings?campusId=1');
    console.log('   Status:', buildings.status);
    if (buildings.status === 200) {
        console.log('   ✅ Buildings loaded:', buildings.data.length);
        buildings.data.slice(0, 5).forEach(b => {
            console.log(`      - ${b.name} (thumbnail: ${b.thumbnail || 'none'})`);
        });
    } else {
        console.log('   ❌ Error:', buildings.data);
    }

    // Test 3: Image availability
    console.log('\n3️⃣ Testing image serving');
    const imgTest = await new Promise((resolve) => {
        http.get('http://localhost:3000/img/campuses/campus_sf.jpg', (res) => {
            resolve({ status: res.statusCode, type: res.headers['content-type'] });
            res.resume();
        }).on('error', () => resolve({ status: 0 }));
    });
    console.log('   Status:', imgTest.status);
    console.log('   Content-Type:', imgTest.type);
    console.log(imgTest.status === 200 ? '   ✅ Images are served correctly' : '   ❌ Image not found');

    console.log('\n✨ Test completed!');
}

testDashboard().catch(console.error);
