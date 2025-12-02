import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOMEPAGE_PATH = path.join(__dirname, '../public/public-content/en/homepage.json');

try {
    const fileContent = fs.readFileSync(HOMEPAGE_PATH, 'utf-8');
    const data = JSON.parse(fileContent);

    console.log('Commentaries found:', data.commentaries.length);

    data.commentaries.forEach(book => {
        console.log(`Book: ${book.book_name}`);
        if (book.toc) {
            console.log(`  TOC Length: ${book.toc.length}`);
            if (book.toc.length > 0) {
                console.log(`  First Chapter: ${book.toc[0].chapter_number} - ${book.toc[0].title}`);
            }
        } else {
            console.log('  TOC: MISSING');
        }
    });

} catch (error) {
    console.error('Error:', error);
}
