const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class ScreenshotService {
    constructor() {
        this.browser = null;
        this.baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    }

    async init() {
        // Optional: Pre-launch browser?
        // For now, we launch on demand to save resources if no alarms
    }

    async getBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for some envs
            });
        }
        return this.browser;
    }

    async captureAlarm(floorId, deviceId, buildingId) {
        let page = null;
        try {
            console.log(`[Screenshot] Generating for B:${buildingId} F:${floorId} D:${deviceId}`);
            const browser = await this.getBrowser();
            page = await browser.newPage();

            // Set viewport size (matches map_renderer css)
            await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 }); // x2 for better quality

            const url = `${this.baseUrl}/map_renderer.html?buildingId=${buildingId}&floorId=${floorId}&deviceId=${deviceId}`;
            console.log(`[Screenshot] Navigating to ${url}`);

            await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });

            // Wait for render signal
            await page.waitForFunction('window.renderComplete === true', { timeout: 5000 });

            // Ensure images are fully loaded (sometimes extra safe wait)
            // await new Promise(r => setTimeout(r, 500)); 

            // Screenshot
            const buffer = await page.screenshot({
                type: 'jpeg',
                quality: 80,
                fullPage: true
            });

            console.log(`[Screenshot] Captured ${buffer.length} bytes`);
            return buffer;

        } catch (error) {
            console.error('[Screenshot] Error:', error.message);
            // Close browser on critical error to reset state?
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            return null;
        } finally {
            if (page) await page.close();
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

const screenshotService = new ScreenshotService();
module.exports = screenshotService;
