import * as fs from 'fs';
import * as path from 'path';
import { loadAdhigarams } from './adhigaram-utils';

const DIST_FOLDER = path.join(process.cwd(), 'dist/frontend/browser');
const SITEMAP_PATH = path.join(DIST_FOLDER, 'sitemap.xml');
const BASE_URL = 'https://thirukkural.site';
const ADHIGARAMS = loadAdhigarams();

function generateSitemap() {
    console.log('Generating Sitemap...');

    if (!fs.existsSync(DIST_FOLDER)) {
        console.error(`Dist folder not found at ${DIST_FOLDER}. Run build first.`);
        process.exit(1);
    }

    const today = new Date().toISOString().split('T')[0];

    // Array to hold all URL entries
    const urls: string[] = [
        `<url><loc>${BASE_URL}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
        `<url><loc>${BASE_URL}/kurals</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`,
        `<url><loc>${BASE_URL}/pricing</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
        `<url><loc>${BASE_URL}/about</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
        `<url><loc>${BASE_URL}/contact</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>`,
        `<url><loc>${BASE_URL}/privacy</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.1</priority></url>`,
        `<url><loc>${BASE_URL}/terms</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.1</priority></url>`
    ];

    // Add exactly 1330 Kural Pages
    // Setting priority to 0.8 as these are the primary content pages Google should index
    for (let i = 1; i <= 1330; i++) {
        urls.push(`<url><loc>${BASE_URL}/kural/${i}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`);
    }

    for (const adhigaram of ADHIGARAMS) {
        urls.push(`<url><loc>${BASE_URL}/adhigaram/${adhigaram.id}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>`);
    }

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    fs.writeFileSync(SITEMAP_PATH, sitemapContent, 'utf8');
    console.log(`✅ Sitemap created at: ${SITEMAP_PATH} with ${urls.length} URLs.`);
}

generateSitemap();
