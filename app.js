/**
 * CTF Cyber Range - Admin Feedback System
 * Vulnerable Application for Red Team / Blue Team CTF
 * 
 * SCENARIO: Cookie Reuse & MFA Bypass
 * Zone: feedback.admin.local
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const { visitFeedbackAsAdmin } = require('./bot');

const app = express();
const PORT = 3075;

// ============================================================
// In-memory store for feedbacks (simulates a database)
// ============================================================
const feedbacks = [];
const capturedCookies = [];

// ============================================================
// Middleware
// ============================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// X-Powered-By is set by Express automatically (Flag: SCENARIO75{Node.js})
// We keep it enabled intentionally (vulnerable config)

// Pre-MFA session cookie middleware
// Sets pre_mfa_session=pending_mfa_verification for all visitors
// HttpOnly explicitly set to false (Flag: SCENARIO75{False})
app.use((req, res, next) => {
    if (!req.cookies.pre_mfa_session) {
        res.cookie('pre_mfa_session', 'pending_mfa_verification', {
            httpOnly: false,  // Deliberately insecure - Flag: SCENARIO75{False}
            secure: false,
            path: '/',
            sameSite: 'Lax'
        });
    }
    next();
});

// ============================================================
// robots.txt - Disallow /api/verify-mfa (Flag: SCENARIO75{/api/verify-mfa})
// ============================================================
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(
        'User-agent: *\n' +
        'Disallow: /api/verify-mfa\n' +
        '# Admin area - restricted access\n' +
        'Disallow: /dashboard\n'
    );
});

// ============================================================
// Home Page - Feedback Form + Guestbook Display
// Contains ASCII art clue in HTML comments (Flag: SCENARIO75{robots.txt})
// ============================================================
app.get('/', (req, res) => {
    // Build feedbacks HTML (renders user input unsafely - Stored XSS)
    let feedbacksHtml = '';
    feedbacks.forEach((fb, i) => {
        feedbacksHtml += `
            <div class="feedback-card">
                <div class="feedback-header">
                    <span class="feedback-user">Anonymous User #${i + 1}</span>
                    <span class="feedback-time">${fb.timestamp}</span>
                </div>
                <div class="feedback-body xss-payload">${fb.content}</div>
            </div>`;
    });

    if (feedbacks.length === 0) {
        feedbacksHtml = '<p class="no-feedback">No feedback submitted yet. Be the first!</p>';
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Feedback System - feedback.admin.local</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0e17;
            color: #c9d1d9;
            min-height: 100vh;
        }
        .navbar {
            background: linear-gradient(135deg, #161b22 0%, #0d1117 100%);
            border-bottom: 1px solid #30363d;
            padding: 0.75rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            min-height: 56px;
        }
        .navbar h1 {
            color: #58a6ff;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .navbar .badge {
            background: #238636;
            color: #fff;
            padding: 0.2rem 0.6rem;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: 600;
        }
        .container {
            max-width: 800px;
            margin: 7rem auto;
            padding: 0 1.5rem;
        }
        .card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        .card h2 {
            color: #58a6ff;
            margin-bottom: 1rem;
            font-size: 1.2rem;
            border-bottom: 1px solid #21262d;
            padding-bottom: 0.5rem;
        }
        textarea {
            width: 100%;
            min-height: 120px;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 6px;
            color: #c9d1d9;
            padding: 0.75rem;
            font-family: inherit;
            font-size: 0.95rem;
            resize: vertical;
        }
        textarea:focus {
            outline: none;
            border-color: #58a6ff;
            box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
        }
        .btn {
            background: #238636;
            color: #fff;
            border: none;
            padding: 0.7rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.95rem;
            font-weight: 600;
            margin-top: 0.75rem;
            transition: background 0.2s;
        }
        .btn:hover { background: #2ea043; }
        .feedback-card {
            background: #0d1117;
            border: 1px solid #21262d;
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 0.75rem;
        }
        .feedback-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            font-size: 0.85rem;
        }
        .feedback-user { color: #58a6ff; font-weight: 600; }
        .feedback-time { color: #484f58; }
        .feedback-body { color: #c9d1d9; line-height: 1.5; }
        .no-feedback { color: #484f58; font-style: italic; text-align: center; padding: 2rem; }
        .status-bar {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 0.5rem 1rem;
            font-size: 0.8rem;
            color: #484f58;
            margin-bottom: 1rem;
            display: flex;
            gap: 1.5rem;
        }
        .status-bar span { display: flex; align-items: center; gap: 0.3rem; }
        .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .dot-green { background: #238636; }
        .dot-yellow { background: #d29922; }
        .alert-box {
            background: rgba(35, 134, 54, 0.1);
            border: 1px solid #238636;
            border-radius: 6px;
            padding: 1rem;
            margin-top: 1rem;
            color: #3fb950;
            font-size: 0.9rem;
            display: none;
        }
        footer {
            text-align: center;
            padding: 2rem;
            color: #30363d;
            font-size: 0.8rem;
            border-top: 1px solid #21262d;
            margin-top: 3rem;
        }
    </style>
</head>
<!--
     _____ _______ ______
    / ____|__   __|  ____|
   | |       | |  | |__
   | |       | |  |  __|
   | |____   | |  | |
    \\_____|  |_|  |_|

    ==============================================
    = ADMIN FEEDBACK SYSTEM v2.7.5               =
    = Zone: feedback.admin.local                 =
    ==============================================
    
    TODO: Remove debug info before production!
    
    Hint: Did you check robots.txt yet? ;)
    
    Flag: SCENARIO75{robots.txt}
    
    Developer Notes:
    - MFA endpoint moved to /api/verify-mfa
    - Admin dashboard at /dashboard  
    - Pre-auth cookie: pre_mfa_session
    - Session validation uses cookie prefix check
    
-->
<body>
    <nav class="navbar">
        <h1>🛡️ Admin Feedback System</h1>
        <span class="badge">v2.7.5 INTERNAL</span>
    </nav>

    <div class="container">
        <div class="status-bar">
            <span><span class="dot dot-green"></span> System Online</span>
            <span><span class="dot dot-yellow"></span> WAF Active</span>
            <span>Zone: feedback.admin.local</span>
        </div>

        <div class="card">
            <h2>📝 Submit Feedback</h2>
            <p style="color: #8b949e; margin-bottom: 1rem; font-size: 0.9rem;">
                Share your thoughts with our admin team. All submissions are reviewed by an administrator.
            </p>
            <form id="feedbackForm" method="POST" action="/api/feedback">
                <textarea name="feedback" id="feedbackInput" 
                    placeholder="Type your feedback here... "
                    required></textarea>
                <button type="submit" class="btn">Submit Feedback</button>
            </form>
            <div class="alert-box" id="successAlert">
                ✅ Feedback submitted successfully! An admin will review it shortly.
            </div>
        </div>

        <div class="card">
            <h2>💬 Recent Feedback (${feedbacks.length})</h2>
            ${feedbacksHtml}
        </div>
    </div>

    <footer>
        &copy; 2025 Admin Feedback System | feedback.admin.local | Internal Use Only
    </footer>

    <script>
        document.getElementById('feedbackForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const feedback = document.getElementById('feedbackInput').value;
            
            try {
                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ feedback: feedback })
                });
                
                const data = await response.json();
                
                if (response.status === 403) {
                    alert('WAF BLOCKED: ' + data.error);
                    return;
                }
                
                if (data.success) {
                    document.getElementById('successAlert').style.display = 'block';
                    setTimeout(() => location.reload(), 1500);
                }
            } catch (err) {
                alert('Error submitting feedback: ' + err.message);
            }
        });
    </script>
</body>
</html>`);
});

// ============================================================
// WAF Middleware
// Blocks <script> tags -> 403 (Flag: SCENARIO75{403})
// Blocks direct document.cookie access
// VULNERABLE: Does NOT block <svg> (Flag: SCENARIO75{<svg>})
// VULNERABLE: Does NOT block obfuscated cookie access (Flag: SCENARIO75{window['docu'+'ment']['coo'+'kie']})
// ============================================================
function wafMiddleware(req, res, next) {
    const feedback = req.body.feedback || '';

    // Block <script> tags - returns HTTP 403
    if (/<script/i.test(feedback)) {
        console.log(`[WAF] BLOCKED: <script> tag detected from ${req.ip}`);
        return res.status(403).json({
            error: 'WAF Alert: Malicious <script> tag detected and blocked.',
            code: 403,
            rule: 'XSS-SCRIPT-001'
        });
    }

    // Block direct document.cookie access pattern
    if (/document\s*\.\s*cookie/i.test(feedback)) {
        console.log(`[WAF] BLOCKED: document.cookie access from ${req.ip}`);
        return res.status(403).json({
            error: 'WAF Alert: Direct cookie access pattern detected and blocked.',
            code: 403,
            rule: 'COOKIE-ACCESS-001'
        });
    }

    // VULNERABILITY: <svg>, <img>, <details> tags are NOT blocked
    // VULNERABILITY: window['docu'+'ment']['coo'+'kie'] is NOT blocked
    // VULNERABILITY: fetch() API calls are NOT blocked

    next();
}

// ============================================================
// POST /api/feedback - Feedback Submission (Flag: SCENARIO75{POST})
// Only accepts POST method
// ============================================================
app.post('/api/feedback', wafMiddleware, (req, res) => {
    const feedback = req.body.feedback || '';

    if (!feedback.trim()) {
        return res.status(400).json({ error: 'Feedback cannot be empty.' });
    }

    const entry = {
        content: feedback,  // Stored RAW - no sanitization (Stored XSS vulnerability)
        timestamp: new Date().toISOString(),
        ip: req.ip
    };

    feedbacks.push(entry);
    console.log(`[FEEDBACK] New submission stored (ID: ${feedbacks.length})`);

    // Puppeteer admin bot reviews feedback after a short delay
    // Bot opens a real headless browser with admin cookie set
    setTimeout(() => {
        console.log('[ADMIN BOT] Scheduling review of new feedback...');
        visitFeedbackAsAdmin().catch(err => {
            console.error('[ADMIN BOT] Review failed:', err.message);
        });
    }, 5000);

    res.json({
        success: true,
        message: 'Feedback submitted successfully. An admin will review it shortly.',
        feedback_id: feedbacks.length
    });
});

// GET /api/feedback should return 405 Method Not Allowed
app.get('/api/feedback', (req, res) => {
    res.status(405).json({
        error: 'Method Not Allowed',
        message: 'This endpoint only accepts POST requests.',
        allowed: ['POST']
    });
});

// ============================================================
// Admin Bot (Puppeteer-based)
// When feedback is submitted, a real headless Chrome browser
// opens the feedback page with the admin cookie set.
// XSS payloads execute naturally in the browser context.
// See bot.js for implementation details.
// ============================================================

// ============================================================
// Cookie Collection Endpoint (for XSS exfiltration demo)
// Red Team uses this to capture admin cookies
// ============================================================
app.get('/api/collect', (req, res) => {
    const cookie = req.query.c || '';
    if (cookie) {
        capturedCookies.push({
            cookie: cookie,
            timestamp: new Date().toISOString(),
            source_ip: req.ip
        });
        console.log(`[EXFIL] Cookie captured: ${cookie}`);
    }
    res.status(200).send('OK');
});

// View captured cookies (for CTF convenience)
app.get('/api/captured', (req, res) => {
    res.json({
        captured: capturedCookies,
        count: capturedCookies.length
    });
});

// ============================================================
// POST /api/verify-mfa - MFA Verification
// VULNERABILITY: Bypassed if cookie value starts with 'adm_sess' prefix
// (Flag: SCENARIO75{/api/verify-mfa}, SCENARIO75{adm_sess})
// ============================================================
app.post('/api/verify-mfa', (req, res) => {
    const sessionCookie = req.cookies.pre_mfa_session || '';

    console.log(`[MFA] Verification attempt with cookie: ${sessionCookie}`);

    // VULNERABILITY: If cookie starts with admin session prefix,
    // MFA check is completely bypassed
    if (sessionCookie.startsWith('adm_sess')) {
        console.log(`[MFA] BYPASS: Admin session prefix detected, skipping MFA`);

        return res.json({
            success: true,
            message: 'MFA verification successful. Access granted.',
            redirect: '/dashboard',
            session_valid: true
        });
    }

    // Normal MFA flow - requires actual code
    const mfaCode = req.body.mfa_code || '';
    if (!mfaCode) {
        return res.status(401).json({
            error: 'MFA verification failed.',
            message: 'Please provide a valid MFA code.',
            hint: 'MFA code is required for non-admin sessions.'
        });
    }

    res.status(401).json({
        error: 'MFA verification failed.',
        message: 'Invalid MFA code provided.'
    });
});

app.get('/api/verify-mfa', (req, res) => {
    res.status(405).json({
        error: 'Method Not Allowed',
        message: 'Use POST method for MFA verification.'
    });
});

// ============================================================
// GET /dashboard - Admin Dashboard (Flag: SCENARIO75{/dashboard})
// Requires valid admin session cookie
// Reflects XSS payload in container with class 'xss-payload' (Flag: SCENARIO75{xss-payload})
// Contains final Red Team flag: SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}
// ============================================================
app.get('/dashboard', (req, res) => {
    const sessionCookie = req.cookies.pre_mfa_session || '';

    // Check for admin session
    if (!sessionCookie.startsWith('adm_sess')) {
        return res.status(401).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Access Denied - Admin Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0e17;
            color: #c9d1d9;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .access-denied {
            text-align: center;
            background: #161b22;
            border: 1px solid #f85149;
            border-radius: 12px;
            padding: 3rem;
            max-width: 500px;
        }
        .access-denied h1 { color: #f85149; font-size: 3rem; margin-bottom: 1rem; }
        .access-denied p { color: #8b949e; margin-bottom: 0.5rem; }
        .access-denied .code { color: #f85149; font-size: 5rem; font-weight: bold; }
    </style>
</head>
<body>
    <div class="access-denied">
        <div class="code">401</div>
        <h1>🔒 Access Denied</h1>
        <p>You must have a valid admin session to access this dashboard.</p>
        <p style="color: #484f58; font-size: 0.8rem; margin-top: 1rem;">
            Session cookie required: Valid admin session prefix
        </p>
    </div>
</body>
</html>`);
    }

    // Build feedback entries for dashboard (reflects XSS in xss-payload container)
    let feedbacksHtml = '';
    feedbacks.forEach((fb, i) => {
        feedbacksHtml += `
            <tr>
                <td>#${i + 1}</td>
                <td class="xss-payload">${fb.content}</td>
                <td>${fb.timestamp}</td>
                <td><span class="status-badge">Pending</span></td>
            </tr>`;
    });

    if (feedbacks.length === 0) {
        feedbacksHtml = `<tr><td colspan="4" style="text-align:center; color:#484f58;">No feedback entries</td></tr>`;
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - feedback.admin.local</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0e17;
            color: #c9d1d9;
            min-height: 100vh;
        }
        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: 250px;
            background: #161b22;
            border-right: 1px solid #30363d;
            padding: 1.5rem;
        }
        .sidebar h2 {
            color: #58a6ff;
            font-size: 1.1rem;
            margin-bottom: 1.5rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid #21262d;
        }
        .sidebar a {
            display: block;
            color: #8b949e;
            text-decoration: none;
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            margin-bottom: 0.25rem;
            font-size: 0.9rem;
        }
        .sidebar a:hover, .sidebar a.active { background: #21262d; color: #c9d1d9; }
        .sidebar a.active { border-left: 3px solid #58a6ff; }
        .main {
            margin-left: 250px;
            padding: 2rem;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #21262d;
        }
        .header h1 { color: #c9d1d9; font-size: 1.5rem; }
        .admin-badge {
            background: #da3633;
            color: #fff;
            padding: 0.3rem 0.8rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 1.25rem;
        }
        .stat-card .label { color: #8b949e; font-size: 0.8rem; margin-bottom: 0.5rem; }
        .stat-card .value { color: #c9d1d9; font-size: 1.8rem; font-weight: bold; }
        .stat-card .value.green { color: #3fb950; }
        .stat-card .value.blue { color: #58a6ff; }
        .stat-card .value.yellow { color: #d29922; }
        .stat-card .value.red { color: #f85149; }
        .panel {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        .panel h3 {
            color: #58a6ff;
            margin-bottom: 1rem;
            font-size: 1.1rem;
            border-bottom: 1px solid #21262d;
            padding-bottom: 0.5rem;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            text-align: left;
            padding: 0.75rem;
            border-bottom: 1px solid #21262d;
            font-size: 0.9rem;
        }
        th { color: #8b949e; font-weight: 600; }
        .status-badge {
            background: #d29922;
            color: #000;
            padding: 0.15rem 0.5rem;
            border-radius: 10px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .flag-banner {
            background: linear-gradient(135deg, #238636 0%, #1a7f37 100%);
            border: 1px solid #3fb950;
            border-radius: 8px;
            padding: 1.5rem;
            text-align: center;
            margin-top: 2rem;
        }
        .flag-banner h3 { color: #fff; border: none; padding: 0; margin-bottom: 0.5rem; }
        .flag-banner .flag {
            font-family: 'Courier New', monospace;
            font-size: 1.2rem;
            color: #aeffc7;
            background: rgba(0,0,0,0.3);
            padding: 0.5rem 1rem;
            border-radius: 4px;
            display: inline-block;
            margin-top: 0.5rem;
            word-break: break-all;
        }
        .xss-payload { }
    </style>
</head>
<body>
    <div class="sidebar">
        <h2>🛡️ Admin Panel</h2>
        <a href="/dashboard" class="active">📊 Dashboard</a>
        <a href="#">📝 Feedbacks</a>
        <a href="#">👥 Users</a>
        <a href="#">⚙️ Settings</a>
        <a href="#">📋 Audit Log</a>
        <a href="#">🔐 MFA Config</a>
    </div>

    <div class="main">
        <div class="header">
            <h1>📊 Admin Dashboard</h1>
            <span class="admin-badge">🔑 ADMIN SESSION ACTIVE</span>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="label">Total Feedbacks</div>
                <div class="value blue">${feedbacks.length}</div>
            </div>
            <div class="stat-card">
                <div class="label">Active Sessions</div>
                <div class="value green">3</div>
            </div>
            <div class="stat-card">
                <div class="label">WAF Blocks (24h)</div>
                <div class="value yellow">12</div>
            </div>
            <div class="stat-card">
                <div class="label">Security Alerts</div>
                <div class="value red">2</div>
            </div>
        </div>

        <div class="panel">
            <h3>📝 Feedback Submissions (Review Queue)</h3>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Content</th>
                        <th>Submitted</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${feedbacksHtml}
                </tbody>
            </table>
        </div>

        <!-- ======================================== -->
        <!-- RED TEAM FINAL FLAG                      -->
        <!-- ======================================== -->
        <div class="flag-banner">
            <h3>🏁 System Configuration Flag</h3>
            <p style="color: rgba(255,255,255,0.8); margin-bottom: 0.5rem;">
                Congratulations! You have successfully compromised the admin dashboard.
            </p>
            <div class="flag">SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}</div>
        </div>
    </div>
</body>
</html>`);
});

// ============================================================
// Health check endpoint
// ============================================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Admin Feedback System',
        zone: 'feedback.admin.local',
        uptime: process.uptime()
    });
});

// ============================================================
// Start Server
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(55));
    console.log('  CTF Cyber Range - Admin Feedback System');
    console.log('  Zone: feedback.admin.local');
    console.log(`  HTTP Server listening on port ${PORT}`);
    console.log('  WAF Status: ACTIVE (rules: XSS-SCRIPT-001, COOKIE-ACCESS-001)');
    console.log('='.repeat(55));
});
