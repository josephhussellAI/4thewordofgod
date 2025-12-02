const fs = require('fs');
const path = require('path');
const glob = require('glob');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-pro'; // User requested model
const DELAY_MS = 2000; // Rate limit buffer

if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY not found in .env file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
let model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
        responseMimeType: "application/json"
    }
});

// --- Helper Functions ---

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateWithRetry(prompt, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result;
        } catch (error) {
            if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
                console.warn(`Model ${MODEL_NAME} not found. Falling back to gemini-1.5-flash...`);
                model = genAI.getGenerativeModel({
                    model: "gemini-1.5-flash",
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });
                // Retry immediately with new model
                const result = await model.generateContent(prompt);
                return result;
            }

            if (error.message && (error.message.includes('429') || error.message.includes('Too Many Requests'))) {
                const waitTime = DELAY_MS * Math.pow(2, i + 1);
                console.warn(`Rate limit hit. Retrying in ${waitTime}ms...`);
                await sleep(waitTime);
                continue;
            }
            throw error;
        }
    }
    throw new Error("Max retries exceeded");
}

async function generateKeywordsWithAI(jsonData) {
    const prompt = `You are an SEO Expert specializing in Biblical Theology.

YOUR GOAL:
Analyze the following Bible commentary chapter and identify 5-8 relevant SEO keywords or short phrases.
These keywords should capture the **writer's specific theological insights**, unique interpretations, key figures, and main topics discussed in the text.
Focus on the **commentary content** itself, not just general biblical themes.

CONTEXT:
Book: ${jsonData.book_name}
Chapter: ${jsonData.chapter_number}
Title: ${jsonData.title}
Content: ${jsonData.content}

CRITICAL RULES:
1. Return ONLY a JSON array of strings.
2. Do not include generic terms like "Chapter 5" unless relevant.
3. Include specific terms used by the writer.
4. Format: ["Keyword 1", "Keyword 2", ...]`;

    try {
        const result = await generateWithRetry(prompt);
        const response = await result.response;
        const text = response.text();
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error(`AI Keyword Generation Failed for ${jsonData.slug}:`, e.message);
        // Fallback to basic keywords
        return [jsonData.book_name, "Bible Commentary", "Christianity"];
    }
}

async function processBookDirectory(dirPath) {
    const pattern = path.join(dirPath, '*.json').replace(/\\/g, '/');
    const files = glob.sync(pattern);

    // Read all files to get chapter numbers and sort them
    const fileData = files.map(filePath => {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(content);
            return {
                path: filePath,
                json: json,
                chapter: parseInt(json.chapter_number, 10)
            };
        } catch (e) {
            console.error(`Error reading ${filePath}:`, e);
            return null;
        }
    }).filter(f => f !== null);

    // Sort by chapter number
    fileData.sort((a, b) => a.chapter - b.chapter);

    // Process each file
    for (let i = 0; i < fileData.length; i++) {
        const item = fileData[i];
        const jsonData = item.json;
        let modified = false;

        // 1. Add Keywords (AI)
        console.log(`Generating keywords for ${jsonData.slug}...`);
        const newKeywords = await generateKeywordsWithAI(jsonData);

        // Always overwrite or update if different
        if (JSON.stringify(jsonData.keywords) !== JSON.stringify(newKeywords)) {
            jsonData.keywords = newKeywords;
            modified = true;
        }

        // 2. Add Navigation
        const prevItem = i > 0 ? fileData[i - 1] : null;
        const nextItem = i < fileData.length - 1 ? fileData[i + 1] : null;

        const prevSlug = prevItem ? prevItem.json.slug : null;
        const nextSlug = nextItem ? nextItem.json.slug : null;

        if (jsonData.previous_chapter !== prevSlug) {
            jsonData.previous_chapter = prevSlug;
            modified = true;
        }
        if (jsonData.next_chapter !== nextSlug) {
            jsonData.next_chapter = nextSlug;
            modified = true;
        }

        // 3. Update Structured Data
        if (jsonData.structuredData) {
            const articleIndex = jsonData.structuredData.findIndex(i => i['@type'] === 'Article');
            if (articleIndex !== -1) {
                const article = jsonData.structuredData[articleIndex];
                if (article.keywords !== jsonData.keywords.join(', ')) {
                    article.keywords = jsonData.keywords.join(', ');
                    modified = true;
                }
            }
        }

        if (modified) {
            fs.writeFileSync(item.path, JSON.stringify(jsonData, null, 2));
            console.log(`Updated: ${path.basename(item.path)}`);
        }

        // Rate limiting pause
        await sleep(1000);
    }
}

async function main() {
    const specificDir = process.argv[2];

    if (specificDir) {
        console.log(`Processing specific directory: ${specificDir}`);
        await processBookDirectory(specificDir);
    } else {
        // Find all book directories
        const bookDirs = glob.sync('a_commentary_on_*');

        console.log(`Found ${bookDirs.length} book directories.`);

        for (const dir of bookDirs) {
            console.log(`Processing directory: ${dir}`);
            await processBookDirectory(dir);
        }
    }
}

main();
