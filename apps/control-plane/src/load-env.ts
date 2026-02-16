import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Robust .env discovery: search parent directories for .env file
function loadEnv() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    let currentDir = __dirname;

    while (currentDir !== path.parse(currentDir).root) {
        const envPath = path.join(currentDir, ".env");
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
            return;
        }
        currentDir = path.dirname(currentDir);
    }
}

loadEnv();
