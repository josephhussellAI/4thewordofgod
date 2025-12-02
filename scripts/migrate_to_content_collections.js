
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_CONTENT_DIR = path.join(__dirname, '../public/public-content');
const CONTENT_DIR = path.join(__dirname, '../src/content/commentary');

// Ensure content directory exists
if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
}

async function migrate() {
    console.log('Starting migration...');

    // Iterate through languages
    const languages = fs.readdirSync(PUBLIC_CONTENT_DIR);

    for (const lang of languages) {
        const langDir = path.join(PUBLIC_CONTENT_DIR, lang);
        if (!fs.statSync(langDir).isDirectory()) continue;

        // Iterate through books
        const books = fs.readdirSync(langDir);
        for (const book of books) {
            const bookDir = path.join(langDir, book);
            if (!fs.statSync(bookDir).isDirectory()) continue;

            const jsonDir = path.join(bookDir, 'json');
            if (!fs.existsSync(jsonDir)) continue;

            const jsonFiles = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));

            for (const file of jsonFiles) {
                const filePath = path.join(jsonDir, file);
                const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                // Construct frontmatter
                const bookSlug = book.toLowerCase().replace(/\s+/g, '-');
                const chapterSlug = content.chapter_number; // e.g., "00", "01"

                // Audio path: en/daniel/00.mp3
                const audioPath = `${lang}/${bookSlug}/${chapterSlug}.mp3`;

                const frontmatter = {
                    title: content.title,
                    book: content.book_name,
                    chapter: content.chapter_number,
                    language: lang,
                    audioPath: audioPath,
                    metaDescription: content.metaDescription,
                    keywords: content.keywords,
                    entities: content.entities,
                    faq: content.faq,
                    structuredData: content.structuredData,
                    previous_chapter: content.previous_chapter,
                    next_chapter: content.next_chapter,
                };

                // Create Markdown content
                const yamlFrontmatter = `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n`;
                const fileContent = `${yamlFrontmatter}\n${content.content}`;

                // Target file path
                // src/content/commentary/{lang}/{book}/{chapter}.md
                const targetDir = path.join(CONTENT_DIR, lang, bookSlug);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                const targetFile = path.join(targetDir, `${chapterSlug}.md`);
                fs.writeFileSync(targetFile, fileContent);
                console.log(`Migrated ${file} to ${targetFile}`);
            }
        }
    }

    console.log('Migration complete.');
}

migrate().catch(console.error);
