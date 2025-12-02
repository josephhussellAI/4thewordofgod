import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_CONTENT_DIR = path.join(__dirname, '../public/public-content/en');

async function standardizeJsonFiles() {
    console.log('Starting JSON standardization...');

    try {
        const books = await fs.promises.readdir(PUBLIC_CONTENT_DIR);
        let modifiedCount = 0;

        for (const book of books) {
            const bookDir = path.join(PUBLIC_CONTENT_DIR, book);
            const stat = await fs.promises.stat(bookDir);

            if (stat.isDirectory()) {
                const jsonDir = path.join(bookDir, 'json');
                if (fs.existsSync(jsonDir)) {
                    const files = await fs.promises.readdir(jsonDir);

                    for (const file of files) {
                        if (file.endsWith('.json')) {
                            const filePath = path.join(jsonDir, file);
                            const content = await fs.promises.readFile(filePath, 'utf-8');
                            let data;

                            try {
                                data = JSON.parse(content);
                            } catch (e) {
                                console.error(`Error parsing JSON in ${filePath}:`, e);
                                continue;
                            }

                            let isModified = false;

                            // Handle og:title
                            if (data.hasOwnProperty('og:title')) {
                                delete data['og:title'];
                                isModified = true;
                            }

                            // Handle og:description and metaDescription
                            const ogDescription = data['og:description'];
                            if (data.hasOwnProperty('og:description')) {
                                delete data['og:description'];
                                isModified = true;
                            }

                            if (!data.hasOwnProperty('metaDescription')) {
                                data.metaDescription = ogDescription || "";
                                isModified = true;
                                console.log(`Added metaDescription to ${file} (from og:description: ${!!ogDescription})`);
                            } else if (!data.metaDescription && ogDescription) {
                                // If metaDescription exists but is empty, and we have og:description, use it
                                data.metaDescription = ogDescription;
                                isModified = true;
                                console.log(`Populated empty metaDescription in ${file} from og:description`);
                            }

                            if (isModified) {
                                await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
                                modifiedCount++;
                                // console.log(`Updated ${book}/${file}`);
                            }
                        }
                    }
                }
            }
        }

        console.log(`Standardization complete. Modified ${modifiedCount} files.`);

    } catch (error) {
        console.error('Error during standardization:', error);
    }
}

standardizeJsonFiles();
