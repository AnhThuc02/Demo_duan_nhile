const https = require('https');

const url = 'https://docs.google.com/spreadsheets/d/1G4qUBZfpczeQrl1_n66N-LLvDg1Yvo_6NBIiG233Hog/gviz/tq?tqx=out:csv&gid=1605423378';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const rows = data.split('\n');
        console.log('Total rows:', rows.length);
        rows.slice(0, 20).forEach((row, i) => {
            console.log(`Row ${i}: ${row}`);
        });
    });
});
