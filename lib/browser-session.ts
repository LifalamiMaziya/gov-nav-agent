import { chromium, Browser, BrowserContext, Page } from 'playwright';

interface BrowserSession {
    browser: Browser | null;
    context: BrowserContext | null;
    page: Page | null;
}

// Global object to hold the session (prevents garbage collection in dev mode)
const globalForBrowser = global as unknown as { browserSession: BrowserSession };

export const browserSession = globalForBrowser.browserSession || {
    browser: null,
    context: null,
    page: null,
};

if (process.env.NODE_ENV !== 'production') globalForBrowser.browserSession = browserSession;

export async function getBrowserSession() {
    if (!browserSession.browser) {
        browserSession.browser = await chromium.launch({
            headless: true,
        });
        browserSession.context = await browserSession.browser.newContext();
        browserSession.page = await browserSession.context.newPage();

        // Initial navigation
        await browserSession.page.goto('https://google.com', { waitUntil: 'networkidle' });
    }

    // If page was closed but browser exists (edge case), recreate page
    if (browserSession.page?.isClosed()) {
        if (!browserSession.context) browserSession.context = await browserSession.browser.newContext();
        browserSession.page = await browserSession.context.newPage();
        await browserSession.page.goto('https://google.com', { waitUntil: 'networkidle' });
    }

    return browserSession;
}

export async function closeBrowserSession() {
    if (browserSession.page) await browserSession.page.close();
    if (browserSession.context) await browserSession.context.close();
    if (browserSession.browser) await browserSession.browser.close();

    browserSession.page = null;
    browserSession.context = null;
    browserSession.browser = null;
}
