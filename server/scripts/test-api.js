const http = require('http');

http.get('http://localhost:3001/api/matching/candidates?femalePetId=cmstm0wyp000d3j6s31a8jlsh', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.data) {
        json.data.forEach(p => {
            console.log(`[${p.name}] ${p.location} - ${p.distanceKm} km`);
        });
    } else {
        console.log("No data", json);
    }
  });
});
