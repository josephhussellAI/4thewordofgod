const fs = require('fs');
const path = require('path');
const glob = require('glob');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3-pro-preview';
const DELAY_MS = 5000; // Rate limiting delay

if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY not found in .env file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
        responseMimeType: "application/json"
    }
});

// --- Helper Functions ---

async function generateWithRetry(prompt, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result;
        } catch (error) {
            if (error.message && (error.message.includes('429') || error.message.includes('Too Many Requests'))) {
                const waitTime = DELAY_MS * Math.pow(2, i + 1); // Exponential backoff
                console.warn(`Rate limit hit. Retrying in ${waitTime}ms...`);
                await sleep(waitTime);
                continue;
            }
            throw error;
        }
    }
    throw new Error("Max retries exceeded");
}

function cleanContent(content) {
    if (!content) return "";
    let clean = content.replace(/ style="[^"]*"/g, "");
    clean = clean.replace(/ dir="ltr"/g, "");
    clean = clean.replace(/<span[^>]*>/g, "").replace(/<\/span>/g, "");
    return clean;
}

function buildPrompt(bookName, chapterNumber, thematicTitle, content) {
    return `You are an Expert SEO Editor and HTML Formatter for a Bible Commentary website.

YOUR GOAL:
Format the provided commentary into structured, Semantic HTML, generate rich metadata, and create an FAQ section.

INPUT DATA:
BOOK: ${bookName}
CHAPTER: ${chapterNumber}
THEME_TITLE: ${thematicTitle}
CONTENT: ${content}

TASK 1: METADATA
1. SEO Title:
   - Generate a compelling SEO Title based on the THEME_TITLE.
   - CRITICAL RULE: Do NOT include the "Book Name" or "Chapter Number" in this title. Focus solely on the theological theme (e.g., use "The Tree of Life Restored" instead of "Revelation 22: Tree of Life").
2. Meta Description:
   - Write a 160-character summary.
   - TONE RULE: Match the user's specific vocabulary and writing style.
3. Entities: Extract the 3-5 most significant People, Places, or Concepts (Entity Salience).

TASK 2: HTML FORMATTING
1. Headers: Wrap verse blocks in <h3> and sections in <h2>.
2. Lists: Convert definitions into <dl> or <ul>.
3. Emphasis: Use <strong> for key theological terms.
4. No Internal Links: Do not generate any internal links.

TASK 3: Q&A GENERATION (NEW)
1. Generate 3-5 Questions and Answers based strictly on the provided commentary text.
2. Focus: Target specific theological interpretations found in the text.
3. Format: Output as a list of objects in the JSON.

OUTPUT JSON FORMAT:
{
  "title": "Final Thematic Title",
  "metaDescription": "Final Meta in User's Voice",
  "formatted_html": "HTML String...",
  "entities": [
    { "@type": "Thing", "name": "Tree of Life", "description": "Symbol of eternal life" }
  ],
  "faq": [
    {
      "question": "What is the significance of the 180-day feast?",
      "answer": "According to the commentary, it represents a period of excessive celebration..."
    }
  ]
}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Main Logic ---

async function processFile(filePath) {
    console.log(`Processing: ${filePath}`);

    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(rawData);

        // Skip if already processed (check for 'structuredData' or similar field if we were overwriting, 
        // but here we might be creating a new file or just overwriting. 
        // Let's assume we overwrite but check if it looks like a raw file first?)
        // For now, we process everything that matches the glob.

        const cleanedContent = cleanContent(jsonData.content);

        // If content is empty or very short, maybe skip?
        if (!cleanedContent || cleanedContent.length < 50) {
            console.warn(`Skipping ${filePath}: Content too short.`);
            return;
        }

        const prompt = buildPrompt(
            jsonData.book_name,
            jsonData.chapter_number,
            jsonData.title, // thematic_title seems to map to 'title' in source
            cleanedContent
        );

        const result = await generateWithRetry(prompt);
        const response = await result.response;
        const text = response.text();

        let aiData;
        try {
            // Clean up markdown code blocks if present (Gemini sometimes adds them even with JSON mode)
            const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
            aiData = JSON.parse(jsonString);
        } catch (e) {
            console.error(`Failed to parse AI response for ${filePath}:`, text);
            return;
        }

        // --- Schema Builder Logic ---
        const entities = Array.isArray(aiData.entities) ? aiData.entities : [];
        const faqList = Array.isArray(aiData.faq) ? aiData.faq : [];

        const articleSchema = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": aiData.title,
            "description": aiData.metaDescription,
            "author": {
                "@type": "Person",
                "name": "Lewis P. Hussell"
            },
            "about": [
                ...entities,
                { "@type": "CreativeWork", "name": jsonData.book_name },
                { "@type": "CreativeWork", "name": "Chapter " + jsonData.chapter_number }
            ]
        };

        let faqSchema = null;
        if (faqList.length > 0) {
            faqSchema = {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": faqList.map(item => ({
                    "@type": "Question",
                    "name": item.question,
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": item.answer
                    }
                }))
            };
        }

        const finalOutput = {
            ...jsonData, // Keep original fields
            title: aiData.title, // Overwrite title with SEO title
            original_title: jsonData.title, // Keep original title just in case
            metaDescription: aiData.metaDescription,
            content: aiData.formatted_html, // Overwrite content with formatted HTML
            original_content: jsonData.content, // Keep original content
            faq: faqList,
            structuredData: faqSchema ? [articleSchema, faqSchema] : articleSchema
        };

        // Write back to file (or new file)
        // For safety, let's write to a new file first or just overwrite if user is confident.
        // The plan said "Save: Write the final JSON to the file".
        fs.writeFileSync(filePath, JSON.stringify(finalOutput, null, 2));
        console.log(`Success: ${filePath}`);
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
    }
}

async function main() {
    // Check for command line argument
    const specificFile = process.argv[2];

    let files = [];
    if (specificFile) {
        files = [specificFile];
        console.log(`Processing single file: ${specificFile}`);
    } else {
        // Find all JSON files in subdirectories
        // Exclude node_modules, package.json, etc.
        files = glob.sync('a_commentary_on_*/*.json');
        console.log(`Found ${files.length} files to process.`);
    }

    for (const file of files) {
        await processFile(file);
        await sleep(DELAY_MS); // Rate limiting
    }
}

main();
