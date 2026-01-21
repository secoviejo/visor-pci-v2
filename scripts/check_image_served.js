const http = require('http');

http.get('http://localhost:3000/img/campuses/campus_sf.jpg', (res) => {
    console.log('Status:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    if (res.statusCode === 200) console.log('✅ Image found');
    else console.log('❌ Image not found');
    res.resume();
}).on('error', (err) => {
    console.error('Error:', err.message);
});
