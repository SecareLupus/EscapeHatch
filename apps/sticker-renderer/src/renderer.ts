import { spawn } from 'child_process';
import path from 'path';
import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initBrowser() {
    // No-op for rlottie
    return null;
}

export async function renderLottieToWebP(url: string): Promise<Buffer> {
    console.log(`[Sticker Renderer] Native render starting for ${url}`);
    
    // 1. Fetch the Lottie JSON
    const { data: lottieJson } = await axios.get(url, { 
        responseType: 'text',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
            'Referer': 'https://discord.com/',
            'Accept': 'application/json'
        }
    });
    const lottieString = typeof lottieJson === 'string' ? lottieJson : JSON.stringify(lottieJson);

    // 2. Start FFmpeg to receive raw BGRA frames
    const ffmpeg = spawn('ffmpeg', [
        '-f', 'rawvideo',
        '-pixel_format', 'bgra',
        '-video_size', '160x160',
        '-r', '30', // Assume 30fps for the input pipe
        '-i', 'pipe:0',
        '-c:v', 'libwebp',
        '-lossless', '0',
        '-compression_level', '4',
        '-q:v', '75',
        '-loop', '0',
        '-an',
        '-f', 'webp',
        'pipe:1'
    ]);

    // 3. Start the Native rlottie-python bridge
    // We look for render.py in the same directory as the source, or one level up from dist
    const bridgePath = path.join(__dirname, 'render.py');
    const bridgePathFallback = path.join(__dirname, '..', 'src', 'render.py');
    const bridgePathFallback2 = '/app/apps/sticker-renderer/src/render.py';
    
    let finalBridgePath = bridgePath;
    if (fs.existsSync(bridgePath)) {
        finalBridgePath = bridgePath;
    } else if (fs.existsSync(bridgePathFallback)) {
        finalBridgePath = bridgePathFallback;
    } else {
        finalBridgePath = bridgePathFallback2;
    }

    console.log(`[Sticker Renderer] Using bridge path: ${finalBridgePath} (exists: ${fs.existsSync(finalBridgePath)})`);
    console.log(`[Sticker Renderer] Current __dirname: ${__dirname}`);
    
    const pythonBridge = spawn('python3', [finalBridgePath]);

    const chunks: Buffer[] = [];
    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    
    // Pipe Python output (raw frames) into FFmpeg input
    pythonBridge.stdout.pipe(ffmpeg.stdin);

    // Handle errors
    pythonBridge.stderr.on('data', (data) => console.error(`[rlottie Error] ${data}`));
    
    // Log FFmpeg errors
    ffmpeg.stderr.on('data', (data) => {
        console.error(`[Sticker Renderer] FFmpeg: ${data.toString()}`);
    });

    // Send the Lottie JSON to the bridge
    pythonBridge.stdin.write(lottieString);
    pythonBridge.stdin.end();

    return new Promise((resolve, reject) => {
        let pythonError = '';
        pythonBridge.stderr.on('data', (data) => {
            pythonError += data.toString();
        });

        pythonBridge.on('close', (code) => {
            if (code !== 0) {
                console.error(`[Sticker Renderer] Python bridge failed with code ${code}: ${pythonError}`);
                ffmpeg.kill();
                reject(new Error(`Python bridge failed (${code}): ${pythonError}`));
            }
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                const buffer = Buffer.concat(chunks);
                console.log(`[Sticker Renderer] Native render complete: ${buffer.length} bytes`);
                resolve(buffer);
            } else {
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });
        
        // Timeout safety
        setTimeout(() => {
            pythonBridge.kill();
            ffmpeg.kill();
            reject(new Error('Render timed out'));
        }, 15000);
    });
}
