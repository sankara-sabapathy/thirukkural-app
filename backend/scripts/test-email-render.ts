import fs from 'fs';
import path from 'path';
import { generateKuralEmail, Kural } from '../src/shared/email-templates';

const datasetPath = path.join(__dirname, '../../sampleThirukkuralDataset.json');
const outputPath = path.join(__dirname, '../../test-email.html');
const iconPath = path.join(__dirname, '../../frontend/src/assets/icons/icon-192x192.png');

try {
    const rawData = fs.readFileSync(datasetPath, 'utf-8');
    const dataset = JSON.parse(rawData);
    const rawKural = dataset.allKural[0];

    if (!rawKural) {
        console.error('No Kural found in dataset');
        process.exit(1);
    }

    // Read icon and convert to base64
    let iconUrl = 'https://thirukkural.site/assets/icons/icon-192x192.png';
    if (fs.existsSync(iconPath)) {
        const iconBuffer = fs.readFileSync(iconPath);
        const base64Icon = iconBuffer.toString('base64');
        iconUrl = `data:image/png;base64,${base64Icon}`;
        console.log('Using local icon as Data URI for preview.');
    } else {
        console.warn('Local icon not found, using production URL (which might be broken if not deployed).');
    }

    // Map dataset fields to Kural interface
    const kural: Kural = {
        kuralId: rawKural.number,
        line1: rawKural.line1,
        line2: rawKural.line2,
        translation: rawKural.translation,
        explanation: rawKural.explanation,
        couplet: rawKural.couplet,
        transliteration: rawKural.transliteration,
        mk: rawKural.mk,
        mv: rawKural.mv,
        sp: rawKural.sp,
        pal: rawKural.pal,
        iyal: rawKural.iyal,
        adikaram: rawKural.adikaram,
        parimela: rawKural.parimela,
        manikudavar: rawKural.manikudavar,
        v_munusami: rawKural.v_munusami,
        mu_varatha: rawKural.mu_varatha,
        mu_karu: rawKural.mu_karu,
        salaman: rawKural.salaman
    };

    console.log(`Generating email for Kural #${kural.kuralId}...`);
    // Pass the base64 icon URL (4th argument)
    const { html } = generateKuralEmail(kural, true, '#', iconUrl);

    fs.writeFileSync(outputPath, html);
    console.log(`Email template generated successfully at: ${outputPath}`);
    console.log('Open this file in your browser to view the template.');

} catch (error) {
    console.error('Error generating email template:', error);
}
