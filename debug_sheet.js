const https = require('https');

const url = 'https://docs.google.com/spreadsheets/d/1G4qUBZfpczeQrl1_n66N-LLvDg1Yvo_6NBIiG233Hog/gviz/tq?tqx=out:csv&gid=1605423378';

function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++; // Skip the escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell);
            currentCell = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++; // Handle \r\n
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }

    // Add the last row if exists
    if (currentRow.length > 0 || currentCell) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }

    return rows;
}

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('--- Raw Data Sample ---');
        console.log(data.slice(0, 500));
        console.log('--- End Raw Data Sample ---');

        const rows = parseCSV(data);
        console.log('Total rows parsed:', rows.length);
        rows.forEach((row, i) => {
            console.log(`Row ${i} length: ${row.length}`);
            if (row.length > 4) {
                console.log(`Row ${i} [4]:`, row[4]);
            } else {
                console.log(`Row ${i}: BROKEN/SHORT`, row);
            }
        });
    });
});
