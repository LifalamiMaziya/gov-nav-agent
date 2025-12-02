import { NextResponse } from 'next/server';
import { getBrowserSession } from '@/lib/browser-session';

export async function GET() {
    try {
        const session = await getBrowserSession();

        if (!session.sandbox) {
            throw new Error('Failed to initialize E2B sandbox');
        }

        // Get the noVNC URL (port 6080 is standard for E2B Desktop)
        const hostname = session.sandbox.getHost(6080);
        const viewUrl = `https://${hostname}/vnc.html?resize=scale&autoconnect=true`;

        return NextResponse.json({
            success: true,
            viewUrl,
        });
    } catch (error: any) {
        console.error('Init error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to initialize browser' },
            { status: 500 }
        );
    }
}
