const API_URL = 'http://localhost:3000/api';

async function verify() {
    try {
        const res = await fetch(`${API_URL}/campuses/stats`);
        const data = await res.json();
        console.log('Campuses Found:', data.length);
        data.forEach(c => {
            console.log(`- [${c.id}] ${c.name} (${c.description ? 'Has Desc' : 'No Desc'}) | Img: ${c.image_filename}`);
        });
    } catch (e) {
        console.error(e);
    }
}
verify();
