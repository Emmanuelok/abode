import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const path = new URL('../lib/catalog-data.json',import.meta.url);
const products = JSON.parse(readFileSync(path,'utf8'));
const reuse = new Map(products.filter(p=>p.sourceImage).map(p=>[p.sourceImage,p.image]));
const manifest = {};
for (const product of products) {
  product.imageUrls = product.imageUrls.map(url=>{
    if (!url.startsWith('https://')) return url;
    if (reuse.has(url)) return reuse.get(url);
    const name = createHash('sha256').update(url).digest('hex').slice(0,32)+'.jpg';
    manifest[name] = url;
    return '/catalog/gallery/'+name;
  });
}
if (Object.keys(manifest).length) {
  writeFileSync(new URL('../lib/gallery-sources.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
  writeFileSync(path,JSON.stringify(products)+'\n');
}
console.log(`Localized ${Object.keys(manifest).length} unique gallery images; source links retained for attribution.`);
