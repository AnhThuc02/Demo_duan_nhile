const https = require('https');

// API Configuration
const API_URL = 'https://getlate.dev/api/v1';
const API_KEY = 'sk_b00cf1517e5928515f6a40574be37b0d59cb6d2abef68fb57492b40a86758590';
const FACEBOOK_ID = '69646c3f4207e06f4ca84d2e';

// Google Sheet CSV URL
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1G4qUBZfpczeQrl1_n66N-LLvDg1Yvo_6NBIiG233Hog/gviz/tq?tqx=out:csv&gid=1605423378';

/**
 * Simple fetch implementation using https module to avoid dependencies
 */
function fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: () => Promise.resolve(data),
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

function parseCSV(text) {
    const lines = text.split('\n');
    return lines.map(line => {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    });
}

async function runAutoPost() {
    console.log('📊 Fetching data from Google Sheet...');

    try {
        const sheetResponse = await fetchUrl(SHEET_CSV_URL);
        if (!sheetResponse.ok) throw new Error('Failed to fetch sheet');

        const csvText = await sheetResponse.text();
        const rows = parseCSV(csvText);

        // Skip header, filter rows with content (Column E - index 4)
        // Adjust indices based on script.js logic:
        // row[0]: Day, row[1]: Time, row[2]: Platform, row[4]: Content, row[6]: Status
        const dataRows = rows.slice(1).filter(row => row.length >= 5 && row[4]);

        console.log(`📝 Found ${dataRows.length} potential posts in sheet.`);

        for (const row of dataRows) {
            const date = row[0] ? row[0].replace(/^"|"$/g, '') : '';
            const time = row[1] ? row[1].replace(/^"|"$/g, '') : '';
            const platform = row[2] ? row[2].replace(/^"|"$/g, '') : 'facebook';
            const content = row[4] ? row[4].replace(/^"|"$/g, '') : '';
            const status = row[6] ? row[6].replace(/^"|"$/g, '').toUpperCase() : 'PENDING';

            if (status.includes('TRUE') || status.includes('POSTED')) {
                console.log(`⏩ Skipping already posted item: "${content.substring(0, 30)}..."`);
                continue;
            }

            console.log(`🚀 Posting to ${platform}: "${content.substring(0, 40)}..."`);

            const payload = {
                content: content,
                platforms: [
                    { platform: 'facebook', accountId: FACEBOOK_ID }
                ],
                publishNow: true
            };

            const postResponse = await fetchUrl(`${API_URL}/posts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (postResponse.ok) {
                const result = await postResponse.json();
                console.log(`✅ Successfully posted! ID: ${result.id || 'N/A'}`);
            } else {
                const error = await postResponse.text();
                console.error(`❌ Failed to post: ${error}`);
            }
        }

        console.log('🏁 Auto-post process completed.');

    } catch (error) {
        console.error('❌ Error during process:', error.message);
    }
}

runAutoPost();
