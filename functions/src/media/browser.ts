import * as puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import * as logger from 'firebase-functions/logger';

/**
 * Fetches URL content using a headless browser (Puppeteer Core + Chromium).
 * Optimized for Serverless (Cloud Functions).
 */
export async function fetchWithBrowser(url: string): Promise<string> {
    logger.info(`Launching Headless Chromium for: ${url}`);

    let browser = null;
    try {
        // Configure Chromium for Serverless
        // Cast to any to avoid TS errors with specific version mismatch
        const chrome = chromium as any;
        browser = await puppeteer.launch({
            args: chrome.args,
            defaultViewport: chrome.defaultViewport,
            executablePath: await chrome.executablePath(),
            headless: chrome.headless,
            ignoreHTTPSErrors: true,
        } as any);

        const page = await browser.newPage();

        // Set a realistic User-Agent (Chromium's default is sometimes detected)
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Navigate to the URL
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Get the full HTML
        const content = await page.content();

        return content;

    } catch (error: any) {
        logger.error('Puppeteer/Chromium failed:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
