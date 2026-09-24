import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Generate a small browser-safe index from the full server-side catalogue.
// Sharp is already installed by the Cloudflare development runtime.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler'));
const miniflareRequire = createRequire(wranglerRequire.resolve('miniflare'));
const sharp = miniflareRequire('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const readJSON = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const [products, departments, covers] = await Promise.all([
  readJSON('lib/catalog-data.json'), readJSON('lib/departments.json'), readJSON('lib/catalog-covers.json'),
]);
const slugify = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const byId = new Map(products.map(product => [product.id, product]));
const collections = new Map();
for (const product of products) {
  for (const route of new Set([`${product.department}/${slugify(product.subcategory)}`, ...(product.collections || [])])) {
    if (!collections.has(route)) collections.set(route, []);
    collections.get(route).push(product);
  }
}
const index = {departments: {}, collections: {}};
const images = new Map();
for (const department of departments) {
  const departmentProducts = new Set();
  for (const name of department.groups.flatMap(group => group.items)) {
    const route = `${department.slug}/${slugify(name)}`;
    const items = collections.get(route) || [];
    if (!items.length) throw new Error(`Missing products for ${route}`);
    const preferred = byId.get(covers[route]);
    const product = preferred && items.includes(preferred) ? preferred : items[0];
    const image = `/images/navigation/${product.id}.webp`;
    index.collections[route] = {image, count: items.length};
    images.set(image, product.image);
    for (const item of items) departmentProducts.add(item.id);
  }
  const firstRoute = `${department.slug}/${slugify(department.groups[0].items[0])}`;
  index.departments[department.slug] = {image: index.collections[firstRoute].image, count: departmentProducts.size};
}
await mkdir(path.join(root, 'public/images/navigation'), {recursive: true});
for (const [target, source] of images) {
  await sharp(path.join(root, 'public', source)).resize(160, 160, {fit: 'contain', background: '#ffffff'}).webp({quality: 78}).toFile(path.join(root, 'public', target));
}
await writeFile(path.join(root, 'lib/navigation-images.json'), `${JSON.stringify(index, null, 2)}\n`);
let bytes = 0;
for (const image of images.keys()) bytes += (await stat(path.join(root, 'public', image))).size;
console.log(JSON.stringify({departments: Object.keys(index.departments).length, collections: Object.keys(index.collections).length, thumbnails: images.size, bytes}));
