
import { getAllCommentary } from './src/lib/content';

async function test() {
    try {
        console.log("Starting test...");
        const entries = await getAllCommentary();
        console.log(`Found ${entries.length} entries.`);
        if (entries.length > 0) {
            console.log("First entry:", JSON.stringify(entries[0], null, 2));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
