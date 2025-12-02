import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const AUDIO_DIR = 'c:\\Users\\josep\\Desktop\\Vibe Code Projects\\EXTRACTED_BOOKSv6\\English Audio';
const TARGET_DIR = 'c:\\Users\\josep\\Desktop\\Vibe Code Projects\\EXTRACTED_BOOKSv6\\bible-commentary-app';

async function uploadAudio() {
    try {
        const files = await fs.readdir(AUDIO_DIR);
        const mp3Files = files.filter(file => file.endsWith('.mp3'));

        for (const file of mp3Files) {
            // Parse filename: Daniel-01.mp3 -> book: daniel, chapter: 1
            const namePart = file.replace('.mp3', '');
            const parts = namePart.split('-');

            if (parts.length < 2) {
                console.warn(`Skipping invalid filename: ${file}`);
                continue;
            }

            const chapterStr = parts.pop(); // Last part is chapter
            const bookName = parts.join('-'); // Rest is book name
            const chapterNum = parseInt(chapterStr, 10);
            const bookSlug = bookName.toLowerCase();

            console.log(`Processing ${file} -> Book: ${bookSlug}, Chapter: ${chapterNum}`);

            const r2Path = `public-content/en/audio/${file}`;
            const localFilePath = path.join(AUDIO_DIR, file);

            // 1. Upload to R2
            try {
                console.log(`Uploading ${file} to R2...`);
                await execAsync(`npx wrangler r2 object put bible-commentary-assets/${r2Path} --local --file="${localFilePath}"`, { cwd: TARGET_DIR });
            } catch (e) {
                console.error(`Failed to upload R2 object for ${file}:`, e.message);
                continue; // Skip DB update if upload fails
            }

            // 2. Update D1 - REMOVED
            // D1 integration has been removed.
        }

        console.log('Audio upload complete!');

    } catch (error) {
        console.error('Audio upload failed:', error);
    }
}

uploadAudio();
