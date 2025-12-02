import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_ROOT = path.resolve(__dirname, '../public/public-content');
const SOURCE_LANG = 'en'; // Use English as the template

const TARGET_LANGUAGES = [
    // Major / Global
    { code: "en", name: "English" },
    { code: "zh-CN", name: "Chinese (Simplified)" },
    { code: "hi", name: "Hindi" },
    { code: "es", name: "Spanish (Latin American)" },
    { code: "ar", name: "Arabic" },
    { code: "bn", name: "Bengali" },
    { code: "fr", name: "French" },
    { code: "pt", name: "Portuguese (Brazilian)" },
    { code: "ru", name: "Russian" },
    { code: "ur", name: "Urdu" },
    { code: "id", name: "Indonesian" },
    { code: "sw", name: "Swahili" },

    // Asia & Pacific
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "vi", name: "Vietnamese" },
    { code: "te", name: "Telugu" },
    { code: "mr", name: "Marathi" },
    { code: "ta", name: "Tamil" },
    { code: "tr", name: "Turkish" },
    { code: "th", name: "Thai" },
    { code: "gu", name: "Gujarati" },
    { code: "kn", name: "Kannada" },
    { code: "fa", name: "Persian (Farsi)" },
    { code: "ml", name: "Malayalam" },
    { code: "pa", name: "Punjabi (Gurmukhi)" },
    { code: "fil", name: "Filipino (Tagalog)" },
    { code: "my", name: "Burmese" },
    { code: "ms", name: "Malay" },
    { code: "jv", name: "Javanese" },
    { code: "su", name: "Sundanese" },

    // Europe
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "pl", name: "Polish" },
    { code: "uk", name: "Ukrainian" },
    { code: "nl", name: "Dutch" },
    { code: "ro", name: "Romanian" },
    { code: "cs", name: "Czech" },
    { code: "el", name: "Greek" },
    { code: "hu", name: "Hungarian" },
    { code: "sv", name: "Swedish" },

    // Africa
    { code: "ha", name: "Hausa" },
    { code: "yo", name: "Yoruba" },
    { code: "am", name: "Amharic" },
    { code: "ig", name: "Igbo" },
    { code: "zu", name: "Zulu" },

    // Middle East & Central Asia
    { code: "he", name: "Hebrew" },
    { code: "uz", name: "Uzbek" },
    { code: "ps", name: "Pashto" },
    { code: "ku", name: "Kurdish (Kurmanji)" },
    { code: "az", name: "Azerbaijani" }
];

async function main() {
    try {
        console.log(`Scanning source structure from: ${path.join(CONTENT_ROOT, SOURCE_LANG)}`);

        // 1. Get list of books from English directory
        const enDir = path.join(CONTENT_ROOT, SOURCE_LANG);

        // Ensure English directory exists
        try {
            await fs.access(enDir);
        } catch {
            console.error(`Error: Source directory ${enDir} does not exist.`);
            return;
        }

        const enItems = await fs.readdir(enDir, { withFileTypes: true });

        const books = enItems
            .filter(item => item.isDirectory())
            .map(item => item.name)
            .filter(name => name !== 'audio' && name !== 'json' && name !== 'downloads'); // Exclude utility folders if any

        console.log(`Found ${books.length} books in ${SOURCE_LANG}:`, books);

        // 2. Create structure for all languages
        for (const lang of TARGET_LANGUAGES) {
            const langCode = lang.code;

            // Skip processing English if we only want to mirror it, but the loop logic handles it fine.
            // However, we might want to ensure base folders exist for English too if they are missing.

            const langDir = path.join(CONTENT_ROOT, langCode);

            // Create language root directory
            await fs.mkdir(langDir, { recursive: true });

            // Create base utility folders for the language (from create_local_structure.js)
            await fs.mkdir(path.join(langDir, 'json'), { recursive: true });
            await fs.mkdir(path.join(langDir, 'audio'), { recursive: true });

            if (langCode === SOURCE_LANG) continue; // Don't recreate book folders inside English based on English

            console.log(`Creating structure for language: ${lang.name} (${langCode})...`);

            for (const book of books) {
                const bookDir = path.join(langDir, book);

                // Create subdirectories
                await fs.mkdir(path.join(bookDir, 'audio'), { recursive: true });
                await fs.mkdir(path.join(bookDir, 'json'), { recursive: true });
                await fs.mkdir(path.join(bookDir, 'downloads'), { recursive: true });
            }
        }

        console.log("Structure creation complete.");

    } catch (error) {
        console.error("Fatal error:", error);
    }
}

main();
