// API Configuration
const API_URL = 'https://getlate.dev/api/v1';
const API_KEY = 'sk_b00cf1517e5928515f6a40574be37b0d59cb6d2abef68fb57492b40a86758590';
const FACEBOOK_ID = '69646c3f4207e06f4ca84d2e';

// Hardcoded Sheet URL for Realtime Sync (CSV format)
// Hardcoded Sheet URL for Realtime Sync (CSV format)
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1G4qUBZfpczeQrl1_n66N-LLvDg1Yvo_6NBIiG233Hog/gviz/tq?tqx=out:csv&gid=1605423378';

let posts = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // Start Realtime Sync
    fetchAndSync();

    // Poll every 5 seconds
    setInterval(fetchAndSync, 5000);
});

// ==========================================
// CSV Parsing
// ==========================================

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

// ==========================================
// Fetch & Sync Logic
// ==========================================

async function fetchAndSync() {
    try {
        const response = await fetch(SHEET_CSV_URL);

        if (!response.ok) {
            throw new Error(`Data load failed: ${response.status}`);
        }

        const csvText = await response.text();
        const rows = parseCSV(csvText);

        // Skip header row (first row) and ensure row has data
        // Assuming Column C (index 2) is Platform
        const dataRows = rows.slice(1).filter(row => row.length >= 3 && row[0]);

        posts = dataRows.map((row, index) => ({
            id: `row-${index}`,
            date: row[0] ? row[0].replace(/^"|"$/g, '') : '',       // Col A: Day
            time: row[1] ? row[1].replace(/^"|"$/g, '') : '',       // Col B: Time
            platform: row[2] ? row[2].replace(/^"|"$/g, '') : 'Unknown', // Col C: Platform
            content: row[4] ? row[4].replace(/^"|"$/g, '') : '',    // Col E: Content
            status: row[6] ? (row[6].includes('TRUE') ? 'Posted' : 'Pending') : 'Pending' // Col G
        }));

        renderPosts();

    } catch (error) {
        console.error('Realtime sync error:', error);
    }
}

// ==========================================
// Helper: Date Time Conversion
// ==========================================

function combineDateTimeToUTC(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;

    try {
        let day, month, year;

        if (dateStr.includes('/')) {
            [day, month, year] = dateStr.split('/');
        } else if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts[0].length === 4) {
                [year, month, day] = parts;
            } else {
                [day, month, year] = parts;
            }
        } else {
            return null;
        }

        // Try to handle 2-digit years if needed, but assuming 4 digits for now based on '2026'

        day = day.padStart(2, '0');
        month = month.padStart(2, '0');
        // Ensure year is 4 digits
        if (year.length === 2) year = '20' + year;

        const [hours, minutes] = timeStr.split(':');

        // Create Date object
        const localDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);

        if (isNaN(localDate.getTime())) return null;

        return localDate.toISOString();
    } catch (e) {
        console.error("Date parse error:", e);
        return null;
    }
}

// ==========================================
// Render Logic
// ==========================================

function renderPosts() {
    const tbody = document.getElementById('posts-table-body');
    if (!tbody) return;

    tbody.innerHTML = posts.map(post => {
        let scheduleDisplay = `${post.date} ${post.time}`;

        return `
        <tr>
            <td class="post-content-cell">
                <div class="post-text" title="${post.content}">${post.content}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                    <i data-lucide="clock" style="width: 10px; height: 10px; display: inline;"></i>
                    ${scheduleDisplay}
                </div>
            </td>
            <td>
                <span class="platform-badge ${post.platform.toLowerCase().includes('facebook') ? 'facebook' : 'instagram'}">
                    <i data-lucide="${post.platform.toLowerCase().includes('facebook') ? 'facebook' : 'instagram'}"></i>
                    ${post.platform}
                </span>
            </td>
            <td>${post.status}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="postToFacebook('${post.id}')" ${post.status === 'Posted' ? 'disabled' : ''}>
                    <i data-lucide="send"></i>
                    ${post.status === 'Posted' ? 'Đã đăng' : 'Đăng ngay'}
                </button>
            </td>
        </tr>
    `}).join('');

    lucide.createIcons();
}

// ==========================================
// API Interaction
// ==========================================

async function postToFacebook(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const btn = event.currentTarget; // Get button element
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="spinning"></i> Đang đăng...';
    btn.disabled = true;
    lucide.createIcons();

    try {
        // Calculate Schedule Time
        const utcTime = combineDateTimeToUTC(post.date, post.time);

        let payload = {
            content: post.content,
            platforms: [
                { platform: 'facebook', accountId: FACEBOOK_ID }
            ]
        };

        // If valid UTC time and it's in the future
        if (utcTime && new Date(utcTime) > new Date()) {
            console.log("Scheduling for:", utcTime);
            payload.publishNow = false;
            payload.date = utcTime; // API expects 'date' for schedule
        } else {
            console.log("Publishing immediately (Time is past or invalid)");
            payload.publishNow = true;
        }

        console.log('Sending to API:', payload);

        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${errorText}`);
        }

        const data = await response.json();
        console.log('Posted to Facebook!', data);

        // Success Feedback
        btn.innerHTML = '<i data-lucide="check"></i> Thành công';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success'); // You might need to add this class or use inline style

        // Update local status mock
        post.status = 'Posted';
        setTimeout(renderPosts, 2000); // Re-render after delay

    } catch (error) {
        console.error('Post failed:', error);
        alert(`Đăng bài thất bại: ${error.message}`);

        // Reset button
        btn.innerHTML = originalText;
        btn.disabled = false;
        lucide.createIcons();
    }
}


// ==========================================
// Sheet Mode Toggle
// ==========================================

const SHEET_EDIT_URL = 'https://docs.google.com/spreadsheets/d/1G4qUBZfpczeQrl1_n66N-LLvDg1Yvo_6NBIiG233Hog/edit?usp=sharing';
const SHEET_PREVIEW_URL = 'https://docs.google.com/spreadsheets/d/1G4qUBZfpczeQrl1_n66N-LLvDg1Yvo_6NBIiG233Hog/preview';

let isEditMode = false;

function toggleSheetMode() {
    const iframe = document.querySelector('.sheet-container iframe');
    const btn = document.getElementById('modeBtn');

    isEditMode = !isEditMode;

    if (isEditMode) {
        // Switch to Edit Mode
        iframe.src = SHEET_EDIT_URL;
        btn.innerHTML = '<i data-lucide="check-circle"></i> Hoàn thành';
        btn.classList.remove('btn-soft');
        btn.classList.add('btn-primary');
    } else {
        // Switch to View Mode
        iframe.src = SHEET_PREVIEW_URL;
        btn.innerHTML = '<i data-lucide="edit-3"></i> Chỉnh sửa';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-soft');
    }

    lucide.createIcons();
}

// ==========================================
// Test API Logic
// ==========================================

async function testAPI() {
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;

    btn.innerHTML = '<i data-lucide="loader-2" class="spinning"></i> Testing...';
    btn.disabled = true;
    lucide.createIcons();

    try {
        console.log('🚀 Sending test post...');
        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: 'Hello from API Test! 🚀 ' + new Date().toLocaleTimeString(),
                platforms: [
                    { platform: 'facebook', accountId: FACEBOOK_ID }
                ],
                publishNow: true
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ API Test Success:', data);
        alert('Test API kết nối thành công! Đã đăng bài test lên Facebook.');

        btn.innerHTML = '<i data-lucide="check"></i> OK';
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.disabled = false;
            lucide.createIcons();
        }, 2000);

    } catch (error) {
        console.error('❌ API Test Failed:', error);
        alert(`Lỗi kết nối API: ${error.message}`);

        btn.innerHTML = '<i data-lucide="alert-circle"></i> Failed';
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.disabled = false;
            lucide.createIcons();
        }, 2000);
    }
}
