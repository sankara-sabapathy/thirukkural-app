const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../data/thirukkural/allKural.json');
const OUTPUT_DIR = path.join(__dirname, '../frontend/public/data/thirukkural');
const CHUNK_SIZE = 100;
const EXPECTED_ADHIGARAMS = 133;
const EXPECTED_KURAL_COUNT = 1330;
const KURALS_PER_ADHIGARAM = 10;

function validateKuralSequence(allKural) {
    const numbers = allKural.map((kural) => Number(kural.number));

    if (numbers.length !== EXPECTED_KURAL_COUNT) {
        throw new Error(`Expected ${EXPECTED_KURAL_COUNT} Kurals, found ${numbers.length}.`);
    }

    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== EXPECTED_KURAL_COUNT) {
        throw new Error(`Expected ${EXPECTED_KURAL_COUNT} unique Kural numbers, found ${uniqueNumbers.size}.`);
    }

    const sortedNumbers = [...numbers].sort((left, right) => left - right);
    const invalidNumber = sortedNumbers.find((value, index) => value !== index + 1);
    if (invalidNumber !== undefined) {
        throw new Error(
            `Kural numbering is not sequential from 1 to ${EXPECTED_KURAL_COUNT}. ` +
            `Found ${invalidNumber} where ${sortedNumbers.indexOf(invalidNumber) + 1} was expected.`
        );
    }
}

function buildAdhigarams(allKural) {
    const adhigarams = [];
    let currentAdhigaram = null;

    for (const kural of allKural) {
        const isNewAdhigaram =
            currentAdhigaram === null ||
            currentAdhigaram.adikaram_tr !== kural.adikaram_tr ||
            currentAdhigaram.iyal_tr !== kural.iyal_tr ||
            currentAdhigaram.pal_tr !== kural.pal_tr;

        if (isNewAdhigaram) {
            if (currentAdhigaram) {
                adhigarams.push(currentAdhigaram);
            }

            currentAdhigaram = {
                id: adhigarams.length + 1,
                start: kural.number,
                end: kural.number,
                pal: kural.pal,
                pal_tr: kural.pal_tr,
                pal_tl: kural.pal_tl,
                iyal: kural.iyal,
                iyal_tr: kural.iyal_tr,
                iyal_tl: kural.iyal_tl,
                adikaram: kural.adikaram,
                adikaram_tr: kural.adikaram_tr,
                adikaram_tl: kural.adikaram_tl,
                count: 1
            };
            continue;
        }

        currentAdhigaram.end = kural.number;
        currentAdhigaram.count += 1;
    }

    if (currentAdhigaram) {
        adhigarams.push(currentAdhigaram);
    }

    if (adhigarams.length !== EXPECTED_ADHIGARAMS) {
        throw new Error(
            `Expected ${EXPECTED_ADHIGARAMS} adhigarams, found ${adhigarams.length}.`
        );
    }

    const invalidAdhigaram = adhigarams.find(
        (adhigaram) => adhigaram.count !== KURALS_PER_ADHIGARAM
    );

    if (invalidAdhigaram) {
        throw new Error(
            `Adhigaram ${invalidAdhigaram.id} has ${invalidAdhigaram.count} kurals instead of ${KURALS_PER_ADHIGARAM}.`
        );
    }

    return adhigarams.map(({ count, ...adhigaram }) => adhigaram);
}

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

    validateKuralSequence(allKural);
    const adhigarams = buildAdhigarams(allKural);

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

    fs.writeFileSync(path.join(OUTPUT_DIR, 'adhigarams.json'), JSON.stringify(adhigarams));
    console.log(`Created adhigarams.json in ${OUTPUT_DIR}`);

    console.log('Done! Commit the dataset source and generated frontend data assets together.');
}

splitData();
