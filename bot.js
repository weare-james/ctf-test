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
 */

const puppeteer = require('puppeteer-core');

const ADMIN_COOKIE_VALUE = 'adm_sess_7f3c2a1b9e4d5678a0c1';
const APP_URL = 'http://localhost:3075';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

// Track if bot is currently busy (prevent overlapping visits)
let botBusy = false;

/**
 * Simulate admin reviewing feedbacks by visiting the page
 * with the admin cookie set in a real headless browser.
 */
async function visitFeedbackAsAdmin() {
    if (botBusy) {
        console.log('[ADMIN BOT] Bot is busy, queuing visit...');
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (botBusy) {
            console.log('[ADMIN BOT] Bot still busy, skipping this visit.');
            return;
        }
    }

    botBusy = true;
    let browser = null;

    try {
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

        // Set User-Agent to look like a real admin browser
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Set the admin cookie BEFORE navigating
        // Using 'url' instead of 'domain' is highly recommended in Puppeteer
        // as it guarantees the cookie is correctly set even when currently on about:blank.
        await page.setCookie({
            name: 'pre_mfa_session',
            value: ADMIN_COOKIE_VALUE,
            url: APP_URL,
            httpOnly: false,
            secure: false
        });

        console.log('[ADMIN BOT] Cookie set: pre_mfa_session=' + ADMIN_COOKIE_VALUE);
        console.log('[ADMIN BOT] Navigating to feedback page...');

        // Navigate to the main page which displays all feedbacks
        // Any stored XSS will execute here in the browser context
        // Using 'domcontentloaded' is faster and more robust than 'networkidle2' in Docker.
        await page.goto(APP_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        console.log('[ADMIN BOT] Page loaded. Waiting for potential XSS execution...');

        // Wait for any XSS payloads to execute (fetch calls, etc.)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Log the page title for debugging
        const title = await page.title();
        console.log(`[ADMIN BOT] Page title: "${title}"`);

        console.log('[ADMIN BOT] Review complete. Closing browser.');

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
    }
}

module.exports = { visitFeedbackAsAdmin };
