import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_CONTENT_DIR = path.join(__dirname, '../public/public-content/en');
const OUTPUT_FILE = path.join(PUBLIC_CONTENT_DIR, 'homepage.json');
const EXCLUDED_DIRS = ['Ezras'];

async function generateHomepage() {
    try {
        const items = await fs.promises.readdir(PUBLIC_CONTENT_DIR, { withFileTypes: true });
        const books = items
            .filter(item => item.isDirectory() && item.name !== 'articles')
            .map(item => item.name);

        const commentaries = [];
        const articles = [];

        // Process Commentaries
        for (const book of books) {
            const bookDir = path.join(PUBLIC_CONTENT_DIR, book);

            if (EXCLUDED_DIRS.includes(book)) {
                continue;
            }

            const jsonDir = path.join(bookDir, 'json');
            if (fs.existsSync(jsonDir)) {
                const files = await fs.promises.readdir(jsonDir);
                const jsonFiles = files.filter(f => f.endsWith('.json'));

                if (jsonFiles.length > 0) {
                    let introFile = jsonFiles.find(f => f.endsWith('_00.json'));
                    if (!introFile) {
                        introFile = jsonFiles[0];
                    }

                    const introPath = path.join(jsonDir, introFile);
                    const content = await fs.promises.readFile(introPath, 'utf-8');
                    let data;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {
                        console.error(`Error parsing JSON for ${book}:`, e);
                        continue;
                    }

                    let title = data.title;
                    if (title && (title.startsWith('"') && title.endsWith('"'))) {
                        title = title.slice(1, -1);
                    }

                    const bookName = book.replace(/_/g, ' ');
                    title = `A commentary on ${bookName}`;

                    const entry = {
                        book_name: book,
                        chapter_number: data.chapter_number || "00",
                        title: title,
                        metaDescription: data.metaDescription || "",
                        type: 'commentary',
                        date: data.date || "2024-01-01"
                    };

                    commentaries.push(entry);
                }
            }
        }

        // Process Articles
        const articlesDir = path.join(PUBLIC_CONTENT_DIR, 'articles');
        if (fs.existsSync(articlesDir)) {
            const articleItems = await fs.promises.readdir(articlesDir, { withFileTypes: true });
            const articleFolders = articleItems
                .filter(item => item.isDirectory())
                .map(item => item.name);

            for (const articleFolder of articleFolders) {
                const articlePath = path.join(articlesDir, articleFolder);
                const jsonDir = path.join(articlePath, 'json');

                if (fs.existsSync(jsonDir)) {
                    const files = await fs.promises.readdir(jsonDir);
                    const jsonFiles = files.filter(f => f.endsWith('.json'));

                    if (jsonFiles.length > 0) {
                        const jsonFile = jsonFiles[0];
                        const filePath = path.join(jsonDir, jsonFile);
                        const content = await fs.promises.readFile(filePath, 'utf-8');
                        let data;
                        try {
                            data = JSON.parse(content);
                        } catch (e) {
                            console.error(`Error parsing JSON for article ${articleFolder}:`, e);
                            continue;
                        }

                        const entry = {
                            book_name: articleFolder,
                            chapter_number: "00",
                            title: data.title,
                            metaDescription: data.metaDescription || "",
                            type: 'article',
                            date: data.date || "2024-01-01"
                        };

                        articles.push(entry);
                    }
                }
            }
        }

        // Sort articles by date descending
        articles.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Sort commentaries alphabetically
        commentaries.sort((a, b) => a.book_name.localeCompare(b.book_name));

        const homepageData = {
            site_title: "Bible Commentary",
            tagline: "Verse by Verse",
            commentaries_section_title: "Commentaries",
            articles_section_title: "Articles",
            commentaries: commentaries,
            articles: articles
        };

        await fs.promises.writeFile(OUTPUT_FILE, JSON.stringify(homepageData, null, 2));
        console.log(`Generated homepage.json with ${commentaries.length} commentaries and ${articles.length} articles.`);

    } catch (err) {
        console.error("Error generating homepage JSON:", err);
    }
}

generateHomepage();
