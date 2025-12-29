async function checkStats() {
    try {
        const res = await fetch('http://localhost:3000/api/campuses/stats');
        if (!res.ok) {
            const text = await res.text();
            console.error('Error fetching stats:', res.status, text);
        } else {
            const data = await res.json();
            console.log('Stats:', data);
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}
checkStats();
