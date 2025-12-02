import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOMEPAGE_PATH = path.join(__dirname, '../public/public-content/en/homepage.json');
const CONTENT_BASE_PATH = path.join(__dirname, '../public/public-content/en');

function generateHomepageToc() {
    console.log('Reading homepage.json...');
    let homepageData;
    try {
        const fileContent = fs.readFileSync(HOMEPAGE_PATH, 'utf-8');
        homepageData = JSON.parse(fileContent);
    } catch (error) {
        console.error('Error reading homepage.json:', error);
        return;
    }

    if (!homepageData.commentaries) {
        console.error('No commentaries found in homepage.json');
        return;
    }

    console.log('Processing commentaries...');
    homepageData.commentaries = homepageData.commentaries.map(book => {
        const bookName = book.book_name;
        const bookPath = path.join(CONTENT_BASE_PATH, bookName, 'json');

        console.log(`Processing ${bookName}...`);

        if (!fs.existsSync(bookPath)) {
            console.warn(`Directory not found for ${bookName}: ${bookPath}`);
            return book;
        }

        const files = fs.readdirSync(bookPath).filter(file => file.endsWith('.json'));
        const toc = [];

        files.forEach(file => {
            const filePath = path.join(bookPath, file);
            try {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (content.chapter_number && content.title) {
                    toc.push({
                        chapter_number: content.chapter_number,
                        title: content.title
                    });
                }
            } catch (err) {
                console.warn(`Error reading ${file}:`, err.message);
            }
        });

        // Sort chapters numerically
        toc.sort((a, b) => {
            const numA = parseInt(a.chapter_number, 10);
            const numB = parseInt(b.chapter_number, 10);
            return numA - numB;
        });

        return {
            ...book,
            toc: toc
        };
    });

    console.log('Saving updated homepage.json...');
    fs.writeFileSync(HOMEPAGE_PATH, JSON.stringify(homepageData, null, 2));
    console.log('Done!');
}

generateHomepageToc();
