import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
const parentEnvPath = path.resolve(process.cwd(), '../.env');

if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else if (existsSync(parentEnvPath)) {
    dotenv.config({ path: parentEnvPath });
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set in .env file or environment variables.');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

const TARGET_DIR = path.resolve(process.cwd(), 'public/public-content/en/json');

const SYSTEM_INSTRUCTION = `
You are an expert Theological Editor and SEO Content Strategist. Normalize the HTML content based on the following rules:

1.  **Introduction Headers (The "Delete Generic" Rule):**
    * **DELETE** headers that are purely navigational or redundant (e.g., "Introduction to Amos Chapter 1").
        * *Action:* Remove the tag entirely.
    * **PRESERVE** headers that describe a specific sub-topic (e.g., "<h2>Introduction to the Letter to Ephesus</h2>").

2.  **Exposition Header (The "SEO Hook" Rule):**
    * **Target:** Find the main exposition header (e.g., "Exposition to Esther Chapter 1", "Exposition on the Letter").
    * **Action:** **REWRITE** the text inside the \`<h2>\` tag. Do not keep the word "Exposition."
    * **Content:** Create a compelling, SEO-friendly headline (5-10 words) based on the provided **Chapter Title**.
        * *Goal:* It should act as a "Call to Action" title that invites the reader to study the verse-by-verse section.
        * *Style:* Active, engaging, and relevant to the specific chapter theme.
        * *Example:* If the title is "The Royal Feast", rewrite the header to: \`<h2>Uncovering the Divine Drama of the Royal Feast</h2>\`.

3.  **Verse Headers:**
    * Convert simple headers like 'Verse 22' or '22' into full references: \`<h3>{Book} {Chapter}:{Verse}</h3>\`.

4.  **Scripture Text:**
    * Wrap the primary Bible verse text in \`<blockquote class="primary-scripture">\`.
    * **CRITICAL:** Remove the leading verse number if it appears at the start of the text block.
        * *Convert:* "22 For he sent..."  --> "For he sent..."
    * Remove <sup> numbers and <strong> tags from within this blockquote.

5.  **Commentary:** Keep standard commentary in <p> tags.

6.  **Cross Refs:** Change headers to \`<h4>Cross References</h4>\`. Use \`<ul><li><strong>Ref:</strong> Text</li></ul>\`.

7.  **Output:** Return ONLY the raw HTML string. Do not include markdown formatting like \`\`\`html.
`;

async function normalizeFile(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const json = JSON.parse(fileContent);

        if (!json.content) {
            console.log(`Skipping ${path.basename(filePath)}: No content field.`);
            return;
        }

        // Check if already normalized
        if (json.content.includes('class="primary-scripture"')) {
            console.log(`Skipping ${path.basename(filePath)}: Already normalized.`);
            return;
        }

        const prompt = `
    **Book Name:** ${json.book_name}
    **Chapter Number:** ${json.chapter_number}
    **Chapter Title:** ${json.title}
    
    **Input HTML:**
    ${json.content}
    `;

        console.log(`Processing ${path.basename(filePath)}...`);

        let retries = 3;
        let success = false;
        let newContent = '';

        while (retries > 0 && !success) {
            try {
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: SYSTEM_INSTRUCTION + "\n\n" + prompt }] }],
                });
                const response = await result.response;
                newContent = response.text();
                success = true;
            } catch (err) {
                console.warn(`Error processing ${path.basename(filePath)}. Retries left: ${retries - 1}. Error: ${err.message}`);
                retries--;
                if (retries > 0) await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
            }
        }

        if (!success) {
            console.error(`Failed to process ${path.basename(filePath)} after multiple attempts.`);
            return;
        }

        // Clean up markdown code blocks if present
        newContent = newContent.replace(/^```html\s*/, '').replace(/\s*```$/, '');

        // Basic validation
        if (newContent.length < json.content.length * 0.5) {
            console.warn(`Warning: New content for ${path.basename(filePath)} is significantly shorter. Skipping save.`);
            return;
        }

        json.content = newContent;
        await fs.writeFile(filePath, JSON.stringify(json, null, 2));
        console.log(`Successfully updated ${path.basename(filePath)}`);

    } catch (error) {
        console.error(`Error processing ${path.basename(filePath)}:`, error);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const specificFile = args[0];

    if (specificFile) {
        const filePath = path.resolve(TARGET_DIR, specificFile);
        await normalizeFile(filePath);
    } else {
        const files = (await fs.readdir(TARGET_DIR)).filter(f => f.endsWith('.json'));

        const CONCURRENCY = 2;
        const queue = [...files];
        const activeWorkers = [];

        console.log(`Starting processing of ${files.length} files with concurrency ${CONCURRENCY}...`);

        async function worker() {
            while (queue.length > 0) {
                const file = queue.shift();
                if (file) {
                    await normalizeFile(path.join(TARGET_DIR, file));
                    // Small delay to avoid burst rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        for (let i = 0; i < CONCURRENCY; i++) {
            activeWorkers.push(worker());
        }

        await Promise.all(activeWorkers);
        console.log('All files processed.');
    }
}

main();
