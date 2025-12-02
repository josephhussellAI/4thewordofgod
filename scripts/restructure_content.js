import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_ROOT = path.resolve(__dirname, '../public/public-content');

// Helper to convert snake_case to Title Case (e.g., "1_john" -> "1 John", "amos" -> "Amos")
function toTitleCase(str) {
    return str.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

async function restructureLanguage(lang) {
    const langDir = path.join(CONTENT_ROOT, lang);
    const jsonDir = path.join(langDir, 'json');
    const audioDir = path.join(langDir, 'audio');

    // Check if json dir exists
    try {
        await fs.access(jsonDir);
    } catch {
        console.log(`No json directory found for language: ${lang}, skipping.`);
        return;
    }

    console.log(`Restructuring language: ${lang}...`);

    const files = await fs.readdir(jsonDir);

    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        // Determine Book Name
        // Patterns: {book}_{chapter}.json or {book}_intro.json
        let bookSlug = '';
        if (file.endsWith('_intro.json')) {
            bookSlug = file.replace('_intro.json', '');
        } else {
            // Assume format {book}_{chapter}.json
            // We need to be careful with books that have underscores (e.g. 1_john_01.json)
            // The chapter is usually the last part after the last underscore
            const parts = file.replace('.json', '').split('_');
            if (parts.length > 1) {
                // Remove the last part (chapter number)
                parts.pop();
                bookSlug = parts.join('_');
            } else {
                console.warn(`Skipping file with unexpected format: ${file}`);
                continue;
            }
        }

        const bookName = toTitleCase(bookSlug);
        const bookDir = path.join(langDir, bookName);

        // Create Book Directory and Subdirectories
        await fs.mkdir(path.join(bookDir, 'json'), { recursive: true });
        await fs.mkdir(path.join(bookDir, 'audio'), { recursive: true });
        await fs.mkdir(path.join(bookDir, 'downloads'), { recursive: true });

        // Move JSON file
        const oldPath = path.join(jsonDir, file);
        const newPath = path.join(bookDir, 'json', file);
        await fs.rename(oldPath, newPath);
        console.log(`Moved ${file} -> ${bookName}/json/${file}`);

        // Check for matching Audio file (if any)
        // Assuming audio files might be named similarly e.g. amos_01.mp3
        // This is speculative based on user request, but good to have logic ready
        if (await fs.stat(audioDir).catch(() => false)) {
            const audioFiles = await fs.readdir(audioDir);
            // Simple matching logic: if audio file starts with the same slug
            // This might need refinement if audio naming is different
            // For now, I won't move audio blindly to avoid errors, 
            // unless I see a clear pattern. The user said "each book is going to have audio", 
            // implying it might not be there yet or needs to be organized.
            // I'll leave audio moving for now unless I see files.
        }
    }

    // Clean up old json dir if empty
    const remainingFiles = await fs.readdir(jsonDir);
    if (remainingFiles.length === 0) {
        await fs.rmdir(jsonDir);
        console.log(`Removed empty directory: ${jsonDir}`);
    } else {
        console.log(`Directory ${jsonDir} not empty, keeping it.`);
    }
}

async function main() {
    try {
        const languages = await fs.readdir(CONTENT_ROOT);

        for (const lang of languages) {
            const langPath = path.join(CONTENT_ROOT, lang);
            const stats = await fs.stat(langPath);

            if (stats.isDirectory()) {
                await restructureLanguage(lang);
            }
        }
        console.log("Restructuring complete.");
    } catch (error) {
        console.error("Fatal error:", error);
    }
}

main();
