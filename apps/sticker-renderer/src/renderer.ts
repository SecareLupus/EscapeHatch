import { chromium, Browser } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

let browser: Browser | null = null;

export async function initBrowser() {
    if (!browser) {
        browser = await chromium.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    return browser;
}

export async function renderLottieToWebP(animationData: any): Promise<Buffer> {
    const browser = await initBrowser();
    const context = await browser.newContext({
        viewport: { width: 512, height: 512 },
        deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lottie-render-'));
    
    try {
        const templatePath = path.resolve('src/template.html');
        await page.goto(`file://${templatePath}`);

        // Wait for lottie to be available (CDN might take a sec)
        await page.waitForFunction(() => typeof (window as any).lottie !== 'undefined', { timeout: 10000 });

        const info: any = await page.evaluate((data) => (window as any).renderLottie(data), animationData);
        const totalFrames = 60; // Cap at 60 frames (2 seconds at 30fps)
        const fps = 30;
    
        console.log(`[Sticker Renderer] Rendering ${totalFrames} frames at ${fps}fps...`);

        const ffmpeg = spawn('ffmpeg', [
            '-f', 'image2pipe',
            '-vcodec', 'png',
            '-i', '-',
            '-vcodec', 'libwebp',
            '-lossless', '1',
            '-loop', '0',
            '-an',
            '-f', 'webp',
            '-'
        ]);

        const chunks: Buffer[] = [];
        ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
        
        ffmpeg.stderr.on('data', (data) => {
            // Only log ffmpeg errors, not progress
            if (data.toString().includes('Error')) {
                console.error(`[FFmpeg Error] ${data}`);
            }
        });

        const renderFinished = new Promise<Buffer>((resolve, reject) => {
            ffmpeg.on('close', (code) => {
                if (code === 0) resolve(Buffer.concat(chunks));
                else reject(new Error(`FFmpeg exited with code ${code}`));
            });
        });

        for (let i = 0; i < totalFrames; i++) {
            if (i % 10 === 0) console.log(`[Sticker Renderer] Frame ${i}/${totalFrames}...`);
            
            await page.evaluate((f) => {
                if ((window as any).anim) {
                    (window as any).anim.goToAndStop(f, true);
                }
            }, i);
            
            const frameBuffer = await page.screenshot({ 
                type: 'png', 
                omitBackground: true,
                clip: { x: 0, y: 0, width: 160, height: 160 }
            });
            
            ffmpeg.stdin.write(frameBuffer);
        }

        ffmpeg.stdin.end();
        const webpBuffer = await renderFinished;
        console.log(`[Sticker Renderer] Render complete. Size: ${webpBuffer.length} bytes`);
        
        return webpBuffer;
    } finally {
        await context.close();
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}
