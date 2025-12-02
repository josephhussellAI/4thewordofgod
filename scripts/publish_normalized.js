import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SOURCE_ROOT = path.resolve(process.cwd(), 'public/public-content/en');
const TARGET_DIR = process.cwd(); // Run wrangler commands from project root

async function publish() {
    try {
        const args = process.argv.slice(2);
        const specificFile = args[0];

        let filesToProcess = [];

        if (specificFile) {
            // If argument is provided, use it as the file path
            const filePath = path.resolve(process.cwd(), specificFile);
            filesToProcess.push(filePath);
        } else {
            // Otherwise, find all JSON files in book subdirectories
            console.log(`Scanning ${SOURCE_ROOT} for JSON files...`);
            const bookDirs = await fs.readdir(SOURCE_ROOT, { withFileTypes: true });
            for (const dir of bookDirs) {
                if (dir.isDirectory()) {
                    const jsonDir = path.join(SOURCE_ROOT, dir.name, 'json');
                    try {
                        const files = await fs.readdir(jsonDir);
                        for (const file of files) {
                            if (file.endsWith('.json')) {
                                filesToProcess.push(path.join(jsonDir, file));
                            }
                        }
                    } catch (e) {
                        // Ignore if json dir doesn't exist
                    }
                }
            }
        }

        console.log(`Found ${filesToProcess.length} files to publish.`);

        for (const filePath of filesToProcess) {
            const file = path.basename(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);

            // Parse filename to get slug and chapter
            // Format: book_chapter.json (e.g. amos_01.json)
            const namePart = file.replace('.json', '');
            const match = namePart.match(/^(.+?)[-_](\d+)$/);

            if (!match) {
                console.warn(`Skipping invalid filename: ${file}`);
                continue;
            }

            const bookSlug = match[1].toLowerCase().replace(/_/g, '-');
            const chapterNum = parseInt(match[2], 10);
            const title = data.title || `${data.book_name} Chapter ${chapterNum}`;

            console.log(`Processing ${bookSlug} ${chapterNum}...`);

            // 1. Insert into D1 (master_index) - REMOVED
            // D1 integration has been removed.

            // 4. Upload to R2
            try {
                // Destination: bible-commentary-assets/public-content/en/json/filename
                // Note: The previous script used public-content/en/filename. 
                // But the file structure is public-content/en/json/filename.
                // Let's stick to the structure: public-content/en/json/${file}
                const r2Path = `public-content/en/json/${file}`;
                await execAsync(`npx wrangler r2 object put bible-commentary-assets/${r2Path} --local --file="${filePath}"`, { cwd: TARGET_DIR });
            } catch (e) {
                console.error(`Failed to upload R2 object for ${file}:`, e.message);
            }
        }

        console.log('Publication complete!');

    } catch (error) {
        console.error('Publication failed:', error);
    }
}

publish();
