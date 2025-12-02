import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SOURCE_DIR = 'c:\\Users\\josep\\Desktop\\Vibe Code Projects\\EXTRACTED_BOOKSv6';
const TARGET_DIR = 'c:\\Users\\josep\\Desktop\\Vibe Code Projects\\EXTRACTED_BOOKSv6\\bible-commentary-app';
const TEMP_DIR = path.join(TARGET_DIR, 'temp_migration');

async function migrate() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });

        const entries = await fs.readdir(SOURCE_DIR, { withFileTypes: true });
        const bookDirs = entries.filter(entry => entry.isDirectory() && entry.name.startsWith('a_commentary_on_'));

        for (const bookDir of bookDirs) {
            const bookPath = path.join(SOURCE_DIR, bookDir.name);
            const files = await fs.readdir(bookPath);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            for (const file of jsonFiles) {
                const filePath = path.join(bookPath, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);

                // Extract and normalize data
                // Normalize book name
                if (data.book_name === "Ezra's") {
                    data.book_name = "Ezra";
                }

                // Safer slug generation: remove non-alphanumeric chars (except spaces/dashes), then replace spaces with dashes
                const bookSlug = data.book_name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
                const chapterNum = parseInt(data.chapter_number, 10);
                const title = data.title || data.original_title || `${data.book_name} Chapter ${chapterNum}`;

                // Prepare content for R2
                // Map all fields according to Data Dictionary
                const r2Content = {
                    book_name: data.book_name,
                    chapter_number: data.chapter_number, // Keep original string or int? Data Dictionary says String/Int.
                    slug: data.slug || `${bookSlug}-${chapterNum.toString().padStart(2, '0')}`,
                    title: title,
                    content: Array.isArray(data.content) ? data.content.join('') : data.content, // Ensure HTML string
                    faq: data.faq || [],
                    structuredData: data.structuredData || [],
                    metaDescription: data.metaDescription || '',
                    "og:title": data["og:title"] || title,
                    "og:description": data["og:description"] || data.metaDescription || '',
                    keywords: data.keywords || [],
                    previous_chapter: data.previous_chapter || null,
                    next_chapter: data.next_chapter || null,
                    original_title: data.original_title || null,
                    original_content: data.original_content || null
                };

                const fileName = `${bookSlug}-${chapterNum.toString().padStart(2, '0')}.json`;
                const tempFilePath = path.join(TEMP_DIR, fileName);
                await fs.writeFile(tempFilePath, JSON.stringify(r2Content, null, 2));

                console.log(`Processing ${bookSlug} ${chapterNum}...`);

                // 1. Insert into D1 - REMOVED
                // D1 integration has been removed.

                // 2. Upload to R2
                try {
                    await execAsync(`npx wrangler r2 object put bible-commentary-assets/public-content/en/${fileName} --local --file="${tempFilePath}"`, { cwd: TARGET_DIR });
                } catch (e) {
                    console.error(`Failed to upload R2 object for ${fileName}:`, e.message);
                }
            }
        }

        // Cleanup
        // await fs.rm(TEMP_DIR, { recursive: true, force: true });
        console.log('Migration complete!');

    } catch (error) {
        console.error('Migration failed:', error);
    }
}

migrate();
