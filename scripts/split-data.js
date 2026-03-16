const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../data/thirukkural/allKural.json');
const OUTPUT_DIR = path.join(__dirname, '../frontend/public/data/thirukkural');
const CHUNK_SIZE = 100;

function splitData() {
    console.log(`Reading data from ${INPUT_FILE}...`);

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Error: Input file not found at ${INPUT_FILE}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
    const data = JSON.parse(rawData);
    const allKural = data.allKural;

    if (!allKural || !Array.isArray(allKural)) {
        console.error('Error: Invalid JSON format. Expected "allKural" array.');
        process.exit(1);
    }

    console.log(`Found ${allKural.length} Kurals.`);

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    for (const existingFile of fs.readdirSync(OUTPUT_DIR)) {
        if (existingFile.endsWith('.json')) {
            fs.unlinkSync(path.join(OUTPUT_DIR, existingFile));
        }
    }

    // Create chunks
    const chunks = [];
    for (let i = 0; i < allKural.length; i += CHUNK_SIZE) {
        const chunk = allKural.slice(i, i + CHUNK_SIZE);
        const start = i + 1;
        const end = Math.min(i + CHUNK_SIZE, allKural.length);
        const fileName = `${start}-${end}.json`;

        fs.writeFileSync(path.join(OUTPUT_DIR, fileName), JSON.stringify(chunk));
        console.log(`Created ${fileName}`);
        chunks.push(fileName);
    }

    // Create Search Index
    console.log('Generating search index...');
    const searchIndex = allKural.map(k => ({
        n: k.number,
        l1: k.line1,
        t: k.translation,
        mk: k.mk,
        i: k.iyal_tr,
        p: k.pal_tr,
        a: k.adikaram_tr
    }));

    fs.writeFileSync(path.join(OUTPUT_DIR, 'search-index.json'), JSON.stringify(searchIndex));
    console.log(`Created search-index.json in ${OUTPUT_DIR}`);

    console.log('Done! Commit the dataset source and generated frontend data assets together.');
}

splitData();
