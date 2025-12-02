import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_ROOT = path.resolve(__dirname, '../public/public-content');

async function main() {
    try {
        const languages = await fs.readdir(CONTENT_ROOT);

        for (const lang of languages) {
            const langDir = path.join(CONTENT_ROOT, lang);
            const stats = await fs.stat(langDir);

            if (!stats.isDirectory()) continue;

            const audioDir = path.join(langDir, 'audio');
            const jsonDir = path.join(langDir, 'json');

            // Remove audio dir
            try {
                await fs.rm(audioDir, { recursive: true, force: true });
                console.log(`Removed ${audioDir}`);
            } catch (err) {
                // Ignore if not exists
            }

            // Remove json dir
            try {
                await fs.rm(jsonDir, { recursive: true, force: true });
                console.log(`Removed ${jsonDir}`);
            } catch (err) {
                // Ignore if not exists
            }
        }
        console.log("Cleanup complete.");

    } catch (error) {
        console.error("Fatal error:", error);
    }
}

main();
