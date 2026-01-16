const https = require('https');

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1G4qUBZfpczeQrl1_n66N-LLvDg1Yvo_6NBIiG233Hog/gviz/tq?tqx=out:csv&gid=1605423378';

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

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
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell);
            currentCell = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }

    if (currentRow.length > 0 || currentCell) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }

    return rows;
}

async function run() {
    console.log('Fetching URL:', SHEET_CSV_URL);
    try {
        const result = await fetchUrl(SHEET_CSV_URL);
        console.log('Status Code:', result.status);

        if (result.status !== 200) {
            console.error('Failed to fetch. Body:', result.data);
            return;
        }

        const rows = parseCSV(result.data);
        console.log('Total Parsed Rows:', rows.length);

        let headerRowIndex = -1;
        // Find row with "CONTENT FB IG"
        rows.forEach((row, index) => {
            if (row.some(cell => cell && cell.toUpperCase().includes('CONTENT FB IG'))) {
                headerRowIndex = index;
            }
        });

        if (headerRowIndex !== -1) {
            console.log(`\n--- HEADER FOUND AT ROW ${headerRowIndex} ---`);
            rows[headerRowIndex].forEach((col, i) => {
                if (col && col.trim()) console.log(`Index ${i}: ${col}`);
            });

            console.log(`\n--- DATA ROW 1 (Row ${headerRowIndex + 1}) ---`);
            rows[headerRowIndex + 1].forEach((col, i) => {
                console.log(`Index ${i}: '${col}'`);
            });

            console.log(`\n--- DATA ROW 2 (Row ${headerRowIndex + 2}) ---`);
            rows[headerRowIndex + 2].forEach((col, i) => {
                if (col && col.trim()) console.log(`Index ${i}: ${col}`);
            });

            // New block for Row 17
            if (rows.length > 16) { // Check if row 17 (index 16) exists
                console.log(`\n--- ROW 17 (Index 16) ---`);
                rows[16].forEach((col, i) => {
                    console.log(`Index ${i}: '${col}'`);
                });
            } else {
                console.log(`\n--- ROW 17 (Index 16) ---`);
                console.log("Row 17 does not exist.");
            }

        } else {
            console.log("Could not find row with 'CONTENT FB IG'");
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
