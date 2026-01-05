const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

let browserInstance = null;

async function getBrowser() {
    if (browserInstance) return browserInstance;

    console.log('[StealthBrowser] Launching new instance (HEADFUL to bypass CF)...');
    browserInstance = await puppeteer.launch({
        headless: false, // Run headful to verify and bypass CF
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    });

    browserInstance.on('disconnected', () => {
        console.log('[StealthBrowser] Disconnected! Clearing instance.');
        browserInstance = null;
    });

    return browserInstance;
}

async function closeBrowser() {
    if (browserInstance) {
        console.log('[StealthBrowser] Closing instance...');
        await browserInstance.close();
        browserInstance = null;
    }
}

async function getStealthPage() {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set a realistic viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Remove Request Interception (Load everything to look human)
    // await page.setRequestInterception(true);
    // page.on('request', (req) => { ... });

    return page;
}

module.exports = {
    getBrowser,
    closeBrowser,
    getStealthPage
};
