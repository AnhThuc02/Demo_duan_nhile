// API Configuration
// Using CORS Proxy to avoid local development CORS issues
const API_URL = 'https://getlate.dev/api/v1';
const API_KEY = 'sk_b00cf1517e5928515f6a40574be37b0d59cb6d2abef68fb57492b40a86758590';
const FACEBOOK_ID = '69646c3f4207e06f4ca84d2e';

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

        // Improved filtering: Look for rows that actually have a platform and content
        // and skip the dashboard/header rows (usually rows starting with empty cols)
        const dataRows = rows.filter(row => {
            // Need at least index 4 (Content) and index 2 (Platform) or index 0 (Date)
            const hasContent = row[4] && row[4].trim() !== "" && row[4] !== "Content";
            const hasIndicator = (row[0] && row[0].length > 2) || (row[2] && row[2].length > 2);
            return hasContent && hasIndicator;
        });

        posts = dataRows.map((row, index) => ({
            id: `row-${index}`,
            date: row[0] ? row[0].replace(/^"|"$/g, '') : '',       // Col A: Day
            time: row[1] ? row[1].replace(/^"|"$/g, '') : '',       // Col B: Time
            platform: row[2] ? row[2].replace(/^"|"$/g, '') : 'Unknown', // Col C: Platform
            content: row[4] ? row[4].replace(/^"|"$/g, '') : '',    // Col E: Content
            status: row[6] ? (row[6].includes('TRUE') || row[6].includes('Posted') ? 'Posted' : 'Pending') : 'Pending' // Col G
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

    if (posts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 48px; color: #64748b;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <i data-lucide="inbox" style="width: 32px; height: 32px; color: #cbd5e1;"></i>
                        <p>Không có bài đăng nào cần xử lý</p>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

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

    // Support both manual button and automatic call
    const btn = event && event.currentTarget ? event.currentTarget : null;
    let originalText = '';

    if (btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="spinning"></i> Đang đăng...';
        btn.disabled = true;
        lucide.createIcons();
    }

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

        if (btn) {
            // Success Feedback
            btn.innerHTML = '<i data-lucide="check"></i> Thành công';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');
        }

        // Update local status mock
        post.status = 'Posted';
        setTimeout(renderPosts, 2000); // Re-render after delay
        return true;

    } catch (error) {
        console.error('Post failed:', error);
        if (btn) {
            alert(`Đăng bài thất bại: ${error.message}`);
            // Reset button
            btn.innerHTML = originalText;
            btn.disabled = false;
            lucide.createIcons();
        }
        return false;
    }
}

async function autoPostAll() {
    const pendingPosts = posts.filter(p => p.status !== 'Posted');

    if (pendingPosts.length === 0) {
        alert('Không có bài viết nào cần đăng!');
        return;
    }

    if (!confirm(`Phát hiện ${pendingPosts.length} bài viết cần đăng. Bạn có muốn bắt đầu không?`)) {
        return;
    }

    const btn = document.getElementById('autoPostBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;

    let successCount = 0;

    for (let i = 0; i < pendingPosts.length; i++) {
        const post = pendingPosts[i];
        btn.innerHTML = `<i data-lucide="loader-2" class="spinning"></i> Đang đăng ${i + 1}/${pendingPosts.length}...`;
        lucide.createIcons();

        const success = await postToFacebook(post.id);
        if (success) successCount++;

        // Wait 1s between posts to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    btn.innerHTML = `<i data-lucide="check-circle"></i> Xong (${successCount}/${pendingPosts.length})`;
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-success');

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
        lucide.createIcons();
    }, 5000);
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
// View Switching Logic
// ==========================================

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.dashboard-view').forEach(el => el.style.display = 'none');
    document.getElementById('schedule-view').style.display = 'none';
    document.getElementById('settings-view').style.display = 'none';

    // Remove active class from nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Show selected view
    if (viewName === 'dashboard') {
        document.querySelectorAll('.dashboard-view').forEach(el => el.style.display = 'block'); // Or flex/whatever
        document.querySelector('.nav-item:nth-child(1)').classList.add('active'); // Dashboard
        document.querySelector('.nav-item:nth-child(2)').classList.remove('active');
    } else if (viewName === 'posts') {
        // Same as dashboard for now, but maybe focus on list?
        document.querySelectorAll('.dashboard-view').forEach(el => el.style.display = 'block');
        document.querySelector('.nav-item:nth-child(2)').classList.add('active'); // Posts
        document.querySelector('.nav-item:nth-child(1)').classList.remove('active');
        // Scroll to list?
        document.getElementById('dashboard-list').scrollIntoView({ behavior: 'smooth' });
    } else if (viewName === 'schedule') {
        document.getElementById('schedule-view').style.display = 'block';
        document.querySelector('.nav-item:nth-child(3)').classList.add('active');
        renderSchedule(); // Helper to render schedule specific list
    } else if (viewName === 'settings') {
        document.getElementById('settings-view').style.display = 'block';
        document.querySelector('.nav-item:nth-child(4)').classList.add('active');
    }

    lucide.createIcons();
}

function renderSchedule() {
    // Simple filter for future posts
    const container = document.getElementById('schedule-list');
    const futurePosts = posts.filter(p => {
        const utc = combineDateTimeToUTC(p.date, p.time);
        return utc && new Date(utc) > new Date();
    });

    if (futurePosts.length === 0) {
        container.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 40px;">
            <i data-lucide="calendar" style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
            <p>Không có bài đăng nào được lên lịch trong tương lai.</p>
        </div>`;
        lucide.createIcons();
        return;
    }

    // Render list
    container.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Thời gian</th>
                    <th>Nội dung</th>
                    <th>Nền tảng</th>
                </tr>
            </thead>
            <tbody>
                ${futurePosts.map(p => `
                    <tr>
                        <td>${p.date} ${p.time}</td>
                        <td class="post-content-cell"><div class="post-text">${p.content}</div></td>
                        <td>${p.platform}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    lucide.createIcons();
}


