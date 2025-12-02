const fs = require('fs');
const glob = require('glob');
const https = require('https');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-pro';
const DELAY_MS = 5000;

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateWithRetry(prompt, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result;
        } catch (error) {
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

function buildEntityPrompt(entities) {
    return `You are an Expert Knowledge Graph Engineer specializing in Biblical Theology.

YOUR GOAL:
For each entity provided, find the most accurate Wikipedia URL to populate the "sameAs" schema field.

INPUT ENTITIES:
${JSON.stringify(entities, null, 2)}

CRITICAL RULES:
1. **Context Match**: The link MUST refer to the specific BIBLICAL person, place, or concept.
   - BAD: "Four Corners" -> https://en.wikipedia.org/wiki/Four_Corners (US Region)
   - GOOD: "Four Corners" -> https://en.wikipedia.org/wiki/Four_corners_of_the_world
2. **Disambiguation**: If the term is ambiguous, look for "(biblical)", "(prophet)", "(king)", etc.
3. **Accuracy**: If you are not 100% sure the Wikipedia page exists and matches the context, return null.
4. **No Hallucinations**: Do not guess URLs.

OUTPUT JSON FORMAT:
[
  { "@type": "Thing", "name": "Tree of Life", "description": "...", "sameAs": "https://en.wikipedia.org/wiki/Tree_of_life_(biblical)" }
]`;
}

async function validateWikipediaUrl(url) {
    if (!url) return null;
    if (!url.includes('wikipedia.org')) return null;

    return new Promise((resolve) => {
        const options = {
            headers: {
                'User-Agent': 'BiblicalCommentaryEnricher/1.0 (educational research; contact: admin@4thewordofgod.com)'
            }
        };

        https.get(url, options, (res) => {
            // Follow redirects (3xx)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                validateWikipediaUrl(res.headers.location).then(resolve);
                return;
            }

            if (res.statusCode === 200) {
                resolve(url);
            } else {
                console.warn(`[Invalid Link] ${url} returned ${res.statusCode}`);
                resolve(null);
            }
        }).on('error', (e) => {
            console.warn(`[Error Checking Link] ${url}: ${e.message}`);
            resolve(null);
        });
    });
}

// --- Main Logic ---

async function processFile(filePath) {
    console.log(`Enriching: ${filePath}`);

    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(rawData);

        // 1. Open Graph
        jsonData['og:title'] = jsonData.title;
        jsonData['og:description'] = jsonData.metaDescription;
        delete jsonData.og_title;
        delete jsonData.og_description;

        // 2. Breadcrumbs
        const breadcrumbSchema = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://4thewordofgod.com/"
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Commentaries",
                    "item": "https://4thewordofgod.com/commentaries/"
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": jsonData.book_name,
                    "item": `https://4thewordofgod.com/commentaries/${jsonData.book_name.toLowerCase().replace(/ /g, '-')}`
                },
                {
                    "@type": "ListItem",
                    "position": 4,
                    "name": `Chapter ${jsonData.chapter_number}`,
                    "item": `https://4thewordofgod.com/commentaries/${jsonData.book_name.toLowerCase().replace(/ /g, '-')}/${jsonData.chapter_number}`
                }
            ]
        };

        if (!Array.isArray(jsonData.structuredData)) {
            jsonData.structuredData = [jsonData.structuredData];
        }
        jsonData.structuredData = jsonData.structuredData.filter(item => item["@type"] !== "BreadcrumbList");
        jsonData.structuredData.push(breadcrumbSchema);


        // 3. Knowledge Graph (Enrichment + Validation)
        let entities = jsonData.entities || [];

        // Fallback to finding entities in Article schema
        if (entities.length === 0) {
            const article = jsonData.structuredData.find(item => item["@type"] === "Article");
            if (article && article.about) {
                entities = article.about.filter(item => item["@type"] !== "CreativeWork");
            }
        }

        if (entities.length > 0) {
            // Step A: Validate EXISTING links (if any) and remove bad ones
            for (const entity of entities) {
                if (entity.sameAs) {
                    const validUrl = await validateWikipediaUrl(entity.sameAs);
                    if (!validUrl) {
                        console.log(`Removing bad link for ${entity.name}: ${entity.sameAs}`);
                        entity.sameAs = null;
                    }
                }
            }

            // Step B: Identify entities that need links (null sameAs)
            const entitiesToEnrich = entities.filter(e => !e.sameAs);

            if (entitiesToEnrich.length > 0) {
                const prompt = buildEntityPrompt(entitiesToEnrich);
                const result = await generateWithRetry(prompt);
                const response = await result.response;
                const text = response.text();

                try {
                    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
                    const enrichedSubset = JSON.parse(cleanJson);

                    // Step C: Validate NEW links
                    for (const enrichedEntity of enrichedSubset) {
                        if (enrichedEntity.sameAs) {
                            const validUrl = await validateWikipediaUrl(enrichedEntity.sameAs);
                            if (!validUrl) {
                                console.log(`AI suggested bad link for ${enrichedEntity.name}: ${enrichedEntity.sameAs}`);
                                enrichedEntity.sameAs = null;
                            }
                        }

                        // Update original entity list
                        const originalEntity = entities.find(e => e.name === enrichedEntity.name);
                        if (originalEntity) {
                            originalEntity.sameAs = enrichedEntity.sameAs;
                        }
                    }

                } catch (e) {
                    console.error(`Failed to parse AI response for entities in ${filePath}:`, e);
                }
            }

            // Update JSON with final verified entities
            jsonData.entities = entities;

            // Update Article Schema
            const articleIndex = jsonData.structuredData.findIndex(item => item["@type"] === "Article");
            if (articleIndex !== -1) {
                const metadataItems = jsonData.structuredData[articleIndex].about.filter(item => item["@type"] === "CreativeWork");
                jsonData.structuredData[articleIndex].about = [...entities, ...metadataItems];
            }

        } else {
            console.log(`No entities found to enrich for ${filePath}`);
        }

        // Save file
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
        console.log(`Success: ${filePath}`);

    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
    }
}

async function main() {
    const specificFile = process.argv[2];

    if (specificFile) {
        await processFile(specificFile);
    } else {
        const files = glob.sync('a_commentary_on_*/*.json');
        console.log(`Found ${files.length} files to enrich.`);
        for (const file of files) {
            await processFile(file);
            await sleep(DELAY_MS);
        }
    }
}

main();
