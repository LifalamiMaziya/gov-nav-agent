import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { Desktop } from '@e2b/desktop';

interface BrowserSession {
    sandbox: Desktop | null;
    browser: Browser | null;
    context: BrowserContext | null;
    page: Page | null;
}

const globalForBrowser = global as unknown as { browserSession: BrowserSession };

export const browserSession = globalForBrowser.browserSession || {
    sandbox: null,
    browser: null,
    context: null,
    page: null,
};

if (process.env.NODE_ENV !== 'production') globalForBrowser.browserSession = browserSession;

export async function getBrowserSession() {
    if (!browserSession.sandbox) {
        console.log('Creating E2B Sandbox...');
        browserSession.sandbox = await Desktop.create({
            apiKey: process.env.E2B_API_KEY,
        });
        console.log('Sandbox created:', browserSession.sandbox.id);
    }

    if (!browserSession.browser) {
        console.log('Connecting to remote browser...');
        // Connect Playwright to the remote browser in the sandbox via CDP
        // Note: Desktop sandbox usually exposes CDP on a specific port or via a method
        // For @e2b/desktop, we might need to start the browser first or use a specific connection string.
        // Assuming standard CDP connection:
        // We can use the sandbox's host to connect.
        // Actually, @e2b/desktop might not expose CDP directly to the internet without a tunnel?
        // Wait, E2B SDK handles the connection usually?
        // Let's check if we can just use the sandbox to run code?
        // No, we want to control it from here.

        // Alternative: Use the sandbox to start chromium with debugging port, then connect.
        // Or better: The E2B Desktop template usually has a browser running?

        // Let's try to launch chromium inside the sandbox and connect to it.
        // But connecting from outside requires the port to be exposed.

        // For now, let's assume we can use the standard playwright connect if we tunnel?
        // E2B doesn't auto-tunnel CDP.

        // Actually, maybe it's better to run the *agent* inside the sandbox?
        // The user said "expose the browser to the ui".

        // Let's stick to the plan: Local Agent -> Remote Browser.
        // To connect to remote browser, we need the CDP endpoint.
        // sandbox.getHostname(port) gives us the public URL.

        // Let's start chromium in the sandbox
        // await browserSession.sandbox.commands.run('chromium --remote-debugging-port=9222 --headless=false &');
        // const cdpUrl = `ws://${browserSession.sandbox.getHostname(9222)}`;

        // Wait, getHostname returns a public HTTPS url, but CDP needs WS.
        // E2B supports WSS on the exposed ports.

        // Let's try this approach.

        // Start browser in sandbox
        // We'll use a simple command to start chrome in background
        // Note: The desktop template might already have a desktop env.

        // Let's try to just use the sandbox for now and see if we can connect.
        // If not, I'll have to adjust.

        // BETTER APPROACH for "Desktop":
        // The Desktop sandbox has a VNC server running.
        // We can just open a browser window in the desktop environment.
        // And we can control it via Playwright if we connect to it.

        // Let's try to connect to an existing browser or launch one.
        // I'll assume I need to launch it.

        // Launch Chrome in remote sandbox with remote debugging
        await browserSession.sandbox.commands.run('google-chrome-stable --remote-debugging-port=9222 --start-maximized --no-sandbox --disable-dev-shm-usage &');

        // Give it a moment to start
        await new Promise(r => setTimeout(r, 2000));

        const cdpDomain = browserSession.sandbox.getHost(9222);
        const cdpUrl = `wss://${cdpDomain}`;

        console.log('Connecting to CDP:', cdpUrl);

        browserSession.browser = await chromium.connect(cdpUrl);
        browserSession.context = browserSession.browser.contexts()[0] || await browserSession.browser.newContext();
        browserSession.page = browserSession.context.pages()[0] || await browserSession.context.newPage();

        await browserSession.page.goto('https://google.com');
    }

    return browserSession;
}

export async function closeBrowserSession() {
    if (browserSession.browser) await browserSession.browser.close();
    if (browserSession.sandbox) await browserSession.sandbox.kill();

    browserSession.page = null;
    browserSession.context = null;
    browserSession.browser = null;
    browserSession.sandbox = null;
}
