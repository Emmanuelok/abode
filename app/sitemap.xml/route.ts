import { products } from '@/lib/catalog';
import { SITE_ORIGIN } from '@/lib/seo';
import { departments, slugify } from '@/lib/taxonomy';

const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]!);
export function GET() {
  const paths = new Set(['/', '/departments', '/shop', '/rooms', '/design', '/trade', '/supplier', '/support', '/returns', '/help']);
  for (const department of departments) {
    paths.add(`/shop/${department.slug}`);
    for (const group of department.groups) for (const collection of group.items) paths.add(`/shop/${department.slug}/${slugify(collection)}`);
  }
  for (const product of products) paths.add(`/product/${encodeURIComponent(product.id)}`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...paths].map(path => `<url><loc>${escapeXml(SITE_ORIGIN + path)}</loc></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
