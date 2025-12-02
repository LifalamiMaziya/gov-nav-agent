import { NextResponse } from 'next/server';
import { getBrowserSession } from '@/lib/browser-session';

export async function GET() {
    try {
        const session = await getBrowserSession();

        if (!session.page) {
            throw new Error('Failed to initialize browser session');
        }

        const screenshot = await session.page.screenshot({ type: 'jpeg', quality: 50 });

        return NextResponse.json({
            success: true,
            screenshot: screenshot.toString('base64'),
        });
    } catch (error: any) {
        console.error('Init error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to initialize browser' },
            { status: 500 }
        );
    }
}
