
import { getAllCommentary } from '../lib/content';

export async function GET(context) {
    const allCommentary = await getAllCommentary();

    const routes = allCommentary.map(entry => {
        const [lang, book, chapter] = entry.slug.split('/');
        return {
            language_code: lang,
            book_slug: book,
            chapter_number: chapter
        };
    });

    // Group by book and chapter
    const groups = {};
    for (const route of routes) {
        const key = `${route.book_slug}/${route.chapter_number}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(route);
    }

    const origin = 'https://4thewordofgod.com';

    let xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">';

    for (const key in groups) {
        const group = groups[key];
        for (const variant of group) {
            xml += '<url>';
            xml += `<loc>${origin}/${variant.language_code}/${variant.book_slug}/${variant.chapter_number}</loc>`;

            for (const alternate of group) {
                xml += `<xhtml:link rel="alternate" hreflang="${alternate.language_code}" href="${origin}/${alternate.language_code}/${alternate.book_slug}/${alternate.chapter_number}"/>`;
            }

            xml += '</url>';
        }
    }

    xml += '</urlset>';

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml'
        }
    });
}
