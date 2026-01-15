const https = require('https');
const fs = require('fs');

/**
 * 🛠 CẤU HÌNH HỆ THỐNG
 * Đọc thông tin từ file .env
 */
function getEnv() {
    const env = {};
    try {
        const content = fs.readFileSync('.env', 'utf8');
        content.split('\n').forEach(line => {
            const [key, ...value] = line.split('=');
            if (key && value.length > 0) env[key.trim()] = value.join('=').trim();
        });
    } catch (e) {
        console.warn('⚠️ Cảnh báo: Không tìm thấy file .env');
    }
    return env;
}

const config = getEnv();
const API_URL = config.SOCIAL_MEDIA_API_URL || 'https://getlate.dev/api/v1';
const API_KEY = config.SOCIAL_MEDIA_API_KEY;
const FACEBOOK_ID = config.FACEBOOK_ID;
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1G4qUBZfpczeQrl1_n66N-LLvDg1Yvo_6NBIiG233Hog/gviz/tq?tqx=out:csv&gid=1605423378';

// Lưu trữ các bài đã đăng để tránh trùng lặp trong một phiên làm việc
const processedPosts = new Set();

/**
 * 🛰 HÀM GỬI YÊU CẦU HTTP
 */
function fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = https.request(requestOptions, (res) => {
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
        if (options.body) req.write(options.body);
        req.end();
    });
}

/**
 * 📅 HÀM XỬ LÝ THỜI GIAN
 * Chuyển đổi Date (dd/mm/yyyy) và Time (hh:mm) từ Sheet sang ISO UTC
 */
function combineDateTimeToUTC(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    try {
        let day, month, year;
        if (dateStr.includes('/')) [day, month, year] = dateStr.split('/');
        else if (dateStr.includes('-')) [year, month, day] = dateStr.split('-');
        else return null;

        if (year.length === 2) year = '20' + year;
        const [hours, minutes] = timeStr.split(':');

        // Tạo đối tượng thời gian theo giờ địa phương
        const localDate = new Date(year, month - 1, day, hours, minutes);
        return localDate.toISOString();
    } catch (e) {
        return null;
    }
}

/**
 * 📊 HÀM PHÂN TÍCH CSV
 */
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

/**
 * 🚀 HÀM CHÍNH: QUÉT VÀ ĐĂNG BÀI
 */
async function autoPostWorker() {
    console.log(`[${new Date().toLocaleTimeString()}] 🔍 Đang quét Google Sheet tìm bài viết trễ hẹn...`);

    try {
        const response = await fetchUrl(SHEET_CSV_URL);
        if (!response.ok) throw new Error('Không thể tải dữ liệu từ Google Sheet');

        const csvText = await response.text();
        const rows = parseCSV(csvText);

        // Lọc các dòng có dữ liệu bài viết (Cột E có nội dung)
        const dataRows = rows.filter(row => {
            const hasContent = row[4] && row[4].trim() !== "" && row[4] !== "Content";
            return hasContent;
        });

        for (const row of dataRows) {
            const date = row[0].replace(/^"|"$/g, '');
            const time = row[1].replace(/^"|"$/g, '');
            const content = row[4].replace(/^"|"$/g, '');
            const status = row[6] ? row[6].toUpperCase() : 'PENDING';

            // Bỏ qua nếu đã đăng (dựa trên trạng thái trong sheet hoặc bộ nhớ tạm)
            if (status.includes('TRUE') || status.includes('POSTED')) continue;

            const postKey = `${content.substring(0, 20)}_${date}_${time}`;
            if (processedPosts.has(postKey)) continue;

            // Xử lý thời gian đặt lịch
            const scheduleTime = combineDateTimeToUTC(date, time);
            const now = new Date();

            if (!scheduleTime) continue;

            const isPast = new Date(scheduleTime) <= now;

            // Nếu đến giờ đăng (hoặc đã quá giờ)
            if (isPast) {
                console.log(`⏰ Đã đến giờ! Đang đăng bài: "${content.substring(0, 30)}..."`);

                const payload = {
                    content: content,
                    platforms: [{ platform: 'facebook', accountId: FACEBOOK_ID }],
                    publishNow: true
                };

                const postRes = await fetchUrl(`${API_URL}/posts`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (postRes.ok) {
                    console.log(`✅ Đăng thành công bài viết ngày ${date} lúc ${time}`);
                    processedPosts.add(postKey);
                } else {
                    const errMsg = await postRes.text();
                    console.error(`❌ Lỗi API: ${errMsg}`);
                }

                // Nghỉ 2s giữa các bài đăng
                await new Promise(r => setTimeout(r, 2000));
            }
        }

    } catch (error) {
        console.error('❌ Lỗi Worker:', error.message);
    }
}

// KHỞI CHẠY WORKER: Quét mỗi 60 giây
if (!API_KEY || !FACEBOOK_ID) {
    console.error('❌ LỖI: Thiếu SOCIAL_MEDIA_API_KEY hoặc FACEBOOK_ID trong file .env');
    process.exit(1);
}

console.log('🤖 HỆ THỐNG TỰ ĐỘNG ĐĂNG BÀI THEO LỊCH ĐÃ BẮT ĐẦU');
console.log('--------------------------------------------------');
console.log(`📍 API URL: ${API_URL}`);
console.log(`📍 Facebook ID: ${FACEBOOK_ID}`);
console.log('--------------------------------------------------');

autoPostWorker();
setInterval(autoPostWorker, 60000);
