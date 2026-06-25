/**
 * CTF Cyber Range - Admin Review Bot
 * ===================================
 * Headless Chromium bot that simulates an admin reviewing feedback.
 * 
 * When a new feedback is submitted, this bot:
 * 1. Launches headless Chrome
 * 2. Sets the admin cookie (pre_mfa_session=adm_sess_xxx)
 * 3. Navigates to the feedback page
 * 4. XSS payloads execute naturally in the browser context
 * 5. Stolen cookies are exfiltrated via fetch() to /api/collect
 *
 * FIXES:
 * - Fix 1 (pendingVisit): Bot tidak lagi skip kunjungan baru saat sedang busy.
 *   Kunjungan baru dicatat dan dieksekusi ulang setelah bot selesai.
 * - Fix 2 (dialog handler): alert() dari payload salah tidak lagi
 *   memblokir eksekusi payload fetch exfil berikutnya.
 * - Fix 3 (logging + cookie verify): Log lebih detail dan cookie bot
 *   diverifikasi sebelum navigasi.
 */

const puppeteer = require('puppeteer-core');

const ADMIN_COOKIE_VALUE = 'adm_sess_7f3c2a1b9e4d5678a0c1';
const APP_URL = 'http://localhost:3075';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

// Track if bot is currently busy (prevent overlapping browser instances)
let botBusy = false;

// Track if a new visit was requested while the bot was busy.
// Ensures the correct exfil payload always gets executed even if
// wrong payloads were submitted first.
let pendingVisit = false;

/**
 * Simulate admin reviewing feedbacks by visiting the page
 * with the admin cookie set in a real headless browser.
 */
async function visitFeedbackAsAdmin() {
    // FIX 1: Instead of "skip if busy", mark as pending and return.
    // The bot will re-run automatically after the current visit finishes.
    if (botBusy) {
        console.log('[ADMIN BOT] Bot is busy — marking visit as pending (will re-run after)...');
        pendingVisit = true;
        return;
    }

    botBusy = true;
    pendingVisit = false;
    let browser = null;

    try {
        console.log('[ADMIN BOT] ========================================');
        console.log('[ADMIN BOT] Launching headless browser...');

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: CHROMIUM_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions'
            ]
        });

        const page = await browser.newPage();

        // ---------------------------------------------------------
        // FIX 2: Auto-dismiss ALL JavaScript dialogs (alert/confirm/prompt)
        // ---------------------------------------------------------
        // Payload salah seperti <svg onload=alert(1)> membuat browser
        // bot menampilkan dialog alert. Jika tidak di-handle, alert()
        // bisa menghambat eksekusi JS lainnya di halaman, termasuk
        // fetch() dari payload exfil yang benar.
        // Dengan handler ini, semua dialog langsung di-dismiss secara
        // otomatis sehingga eksekusi payload exfil tidak terganggu.
        page.on('dialog', async (dialog) => {
            console.log(`[ADMIN BOT] Dialog auto-dismissed: "${dialog.message()}" (type: ${dialog.type()})`);
            await dialog.dismiss();
        });

        // Set User-Agent to look like a real admin browser
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Set the admin cookie BEFORE navigating
        await page.setCookie({
            name: 'pre_mfa_session',
            value: ADMIN_COOKIE_VALUE,
            url: APP_URL,
            httpOnly: false,
            secure: false
        });

        // FIX 3: Verify cookie was correctly set in browser context before visiting
        const cookies = await page.cookies(APP_URL);
        const adminCookie = cookies.find(c => c.name === 'pre_mfa_session');
        if (adminCookie) {
            console.log(`[ADMIN BOT] Cookie verified: ${adminCookie.name}=${adminCookie.value}`);
        } else {
            console.warn('[ADMIN BOT] WARNING: Admin cookie NOT found in browser! Exfil will capture wrong cookie.');
        }

        console.log('[ADMIN BOT] Navigating to feedback page...');

        // Navigate to the main page which displays all feedbacks.
        // All stored XSS payloads will execute here in the browser context.
        await page.goto(APP_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        console.log('[ADMIN BOT] Page loaded. Waiting for XSS payloads to execute...');

        // Wait for all XSS payloads to execute (alert dismiss + fetch calls).
        // Increased from 5s to 7s to ensure fetch() completes fully.
        await new Promise(resolve => setTimeout(resolve, 7000));

        const title = await page.title();
        console.log(`[ADMIN BOT] Page title: "${title}"`);
        console.log('[ADMIN BOT] Review complete. Closing browser.');
        console.log('[ADMIN BOT] ========================================');

    } catch (error) {
        console.error('[ADMIN BOT] Error during review:', error.message);
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error('[ADMIN BOT] Error closing browser:', e.message);
            }
        }
        botBusy = false;

        // FIX 1 (continued): After this visit finishes, check if a new
        // visit was requested while we were busy. If so, re-run now so
        // the latest payload (correct exfil) gets executed.
        if (pendingVisit) {
            console.log('[ADMIN BOT] Pending visit detected — re-running for latest payload...');
            pendingVisit = false;
            setTimeout(() => {
                visitFeedbackAsAdmin().catch(err => {
                    console.error('[ADMIN BOT] Pending re-visit failed:', err.message);
                });
            }, 2000);
        }
    }
}

module.exports = { visitFeedbackAsAdmin };
