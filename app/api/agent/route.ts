import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { getBrowserSession } from '@/lib/browser-session';

// Helper to encode data for streaming
const encodeChunk = (type: string, data: any) => {
    return new TextEncoder().encode(JSON.stringify({ type, data }) + '\n');
};

export async function POST(req: NextRequest) {
    const { message } = await req.json();

    if (!message) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const stream = new ReadableStream({
        async start(controller) {
            // Initialize DeepSeek LLM
            const model = new ChatOpenAI({
                modelName: 'deepseek-chat',
                temperature: 0,
                apiKey: process.env.DEEPSEEK_API_KEY,
                configuration: {
                    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
                },
            });

            // Get persistent browser session
            const session = await getBrowserSession();
            const page = session.page;

            if (!page) {
                controller.enqueue(encodeChunk('error', 'Browser session not initialized'));
                controller.close();
                return;
            }

            // Playwright browser tools
            const createPlaywrightTools = (page: any) => {
                const navigateTool = new DynamicStructuredTool({
                    name: 'navigate',
                    description: 'Navigate to a URL in the browser',
                    schema: z.object({
                        url: z.string().describe('The URL to navigate to'),
                    }),
                    func: async ({ url }) => {
                        controller.enqueue(encodeChunk('log', `Navigating to ${url}...`));
                        try {
                            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                        } catch (e: any) {
                            controller.enqueue(encodeChunk('log', `Navigation timeout/error: ${e.message}. Continuing...`));
                        }
                        return `Navigated to ${url}`;
                    },
                });

                const clickTool = new DynamicStructuredTool({
                    name: 'click',
                    description: 'Click on an element by its selector (CSS selector)',
                    schema: z.object({
                        selector: z.string().describe('CSS selector of the element to click'),
                    }),
                    func: async ({ selector }) => {
                        controller.enqueue(encodeChunk('log', `Clicking ${selector}...`));
                        try {
                            await page.click(selector, { timeout: 5000 });
                        } catch (e: any) {
                            return `Failed to click ${selector}: ${e.message}`;
                        }
                        return `Clicked on element: ${selector}`;
                    },
                });

                const typeTool = new DynamicStructuredTool({
                    name: 'type',
                    description: 'Type text into an input field',
                    schema: z.object({
                        selector: z.string().describe('CSS selector of the input field'),
                        text: z.string().describe('Text to type'),
                    }),
                    func: async ({ selector, text }) => {
                        controller.enqueue(encodeChunk('log', `Typing "${text}"...`));
                        try {
                            await page.fill(selector, text, { timeout: 5000 });
                        } catch (e: any) {
                            return `Failed to type into ${selector}: ${e.message}`;
                        }
                        return `Typed "${text}" into ${selector}`;
                    },
                });

                const scrollTool = new DynamicStructuredTool({
                    name: 'scroll',
                    description: 'Scroll down the page',
                    schema: z.object({
                        amount: z.number().optional().describe('Amount to scroll in pixels (default: 500)'),
                    }),
                    func: async ({ amount = 500 }) => {
                        controller.enqueue(encodeChunk('log', `Scrolling down...`));
                        await page.evaluate((y: number) => window.scrollBy(0, y), amount);
                        return `Scrolled down ${amount}px`;
                    },
                });

                const waitTool = new DynamicStructuredTool({
                    name: 'wait',
                    description: 'Wait for an element to appear or for a specific duration',
                    schema: z.object({
                        selector: z.string().optional().describe('CSS selector to wait for'),
                        duration: z.number().optional().describe('Duration to wait in milliseconds (default: 1000)'),
                    }),
                    func: async ({ selector, duration = 1000 }) => {
                        controller.enqueue(encodeChunk('log', selector ? `Waiting for ${selector}...` : `Waiting ${duration}ms...`));
                        if (selector) {
                            try {
                                await page.waitForSelector(selector, { timeout: 5000 });
                                return `Element ${selector} appeared`;
                            } catch (e: any) {
                                return `Element ${selector} did not appear within timeout`;
                            }
                        } else {
                            await page.waitForTimeout(duration);
                            return `Waited ${duration}ms`;
                        }
                    },
                });

                const extractTextTool = new DynamicStructuredTool({
                    name: 'extract_text',
                    description: 'Extract text content from an element or the entire page',
                    schema: z.object({
                        selector: z.string().optional().describe('CSS selector of the element (optional, extracts from body if not provided)'),
                    }),
                    func: async ({ selector }) => {
                        controller.enqueue(encodeChunk('log', `Extracting text...`));
                        const element = selector ? await page.$(selector) : await page.$('body');
                        const text = await element?.textContent();
                        return text || 'No text found';
                    },
                });

                return [navigateTool, clickTool, typeTool, scrollTool, waitTool, extractTextTool];
            };

            try {
                const tools = createPlaywrightTools(page);
                const modelWithTools = model.bindTools(tools);
                const messages = [
                    new HumanMessage(`You are a web browsing assistant. Use the available tools to complete this task: ${message}`)
                ];

                let iterations = 0;
                const maxIterations = 15;

                while (iterations < maxIterations) {
                    iterations++;

                    const response = await modelWithTools.invoke(messages);
                    messages.push(response);

                    if (response.tool_calls && response.tool_calls.length > 0) {
                        for (const toolCall of response.tool_calls) {
                            const tool = tools.find((t) => t.name === toolCall.name);
                            if (tool) {
                                try {
                                    const result = await tool.invoke(toolCall.args);
                                    messages.push({
                                        role: 'tool',
                                        content: result,
                                        tool_call_id: toolCall.id,
                                    } as any);
                                } catch (error: any) {
                                    messages.push({
                                        role: 'tool',
                                        content: `Error: ${error.message}`,
                                        tool_call_id: toolCall.id,
                                    } as any);
                                }
                            }
                        }
                    } else {
                        controller.enqueue(encodeChunk('response', response.content));
                        break;
                    }
                }
            } catch (error: any) {
                controller.enqueue(encodeChunk('error', error.message));
            } finally {
                controller.close();
            }
        },
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
