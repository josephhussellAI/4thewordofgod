
import fs from 'fs';
try {
    const env = fs.readFileSync('.env', 'utf-8');
    console.log("Keys in .env:");
    console.log(env.split('\n').map(l => l.split('=')[0].trim()).filter(k => k && !k.startsWith('#')));
} catch (e) {
    console.error("Could not read .env", e);
}
