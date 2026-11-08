import {priceAustralianCatalogue} from './pricing-au';
import covers from './catalog-covers.json';
import packed from './catalog-packed.txt?raw';
import {gunzipSync} from 'node:zlib';
import {Buffer} from 'node:buffer';
import type {Product} from './types';
import {slugify} from './taxonomy';
export const products:Product[]=JSON.parse(gunzipSync(Buffer.from(packed.trim(),'base64')).toString('utf8')).map(priceAustralianCatalogue);
const byId=new Map(products.map(p=>[p.id,p]));
export const productById=(id:string)=>byId.get(id);
const departmentCounts:Record<string,number>={};
const subcategoryCounts:Record<string,number>={};
const departmentImages:Record<string,string>={};
const subcategoryImages:Record<string,string>={};
export const productCollections=(p:Product)=>[...new Set([p.department+'/'+slugify(p.subcategory),...(p.collections||[])])];
const collectionIndex=new Map(products.map(p=>[p.id,productCollections(p)]));
for(const p of products){const routes=collectionIndex.get(p.id)!;for(const dept of new Set(routes.map(r=>r.split('/')[0]))){departmentCounts[dept]=(departmentCounts[dept]||0)+1;if(!departmentImages[dept])departmentImages[dept]=p.image}for(const key of routes){subcategoryCounts[key]=(subcategoryCounts[key]||0)+1;if(!subcategoryImages[key])subcategoryImages[key]=p.image}}
for(const [route,id] of Object.entries(covers)){const product=byId.get(id);if(product&&collectionIndex.get(id)?.includes(route))subcategoryImages[route]=product.image}
export function queryCatalog(params:URLSearchParams){
 const id=params.get('id');if(id)return {product:productById(id)||null,related:products.filter(p=>p.id!==id&&p.subcategory===productById(id)?.subcategory).slice(0,8)};
 const ids=params.get('ids');if(params.has('ids'))return {items:(ids||'').split(',').slice(0,150).map(productById).filter(Boolean)};
 const q=(params.get('q')||'').trim().toLowerCase().slice(0,120);const dept=params.get('department');const sub=params.get('subcategory');
 const synonym:Record<string,string>={couch:'sofa',sofas:'sofa',chairs:'chair',tables:'table',couches:'sofa',lamps:'lamp',rugs:'rug',settee:'sofa',settees:'sofa',centre:'coffee',center:'coffee',duvet:'duvet',fridge:'refrigerator',cupboard:'cabinet',bedside:'nightstand',set:'set'};
 const words=q.split(/\s+/).filter(Boolean).map(w=>synonym[w]||w);
 const categoryMatches=products.filter(p=>(!dept||collectionIndex.get(p.id)!.some(r=>r.startsWith(dept+'/')))&&(!sub||collectionIndex.get(p.id)!.includes(dept+'/'+sub)));
 const primaryMatches=categoryMatches.filter(p=>!q||words.every(w=>(p.name+' '+p.subcategory+' '+p.color+' '+p.material+' '+p.brand).toLowerCase().includes(w)));
 let found=primaryMatches.length||!q?primaryMatches:categoryMatches.filter(p=>words.every(w=>(p.name+' '+p.description+' '+p.subcategory+' '+p.color+' '+p.material+' '+p.brand).toLowerCase().includes(w)));

 const facets={colors:[...new Set(found.map(p=>p.color).filter(Boolean))].sort().slice(0,50),materials:[...new Set(found.map(p=>p.material).filter(Boolean))].sort().slice(0,45),brands:[...new Set(found.map(p=>p.brand).filter(Boolean))].sort().slice(0,45),subcategories:[...new Set(found.map(p=>p.subcategory))].sort()};
 const min=Number(params.get('min')||0),max=Number(params.get('max')||1000000);
 found=found.filter(p=>(p.price===null?(!params.get('min')&&!params.get('max')):p.price>=min&&p.price<=max)&&(!params.get('color')||p.color===params.get('color'))&&(!params.get('material')||p.material===params.get('material'))&&(!params.get('brand')||p.brand===params.get('brand')));
 const sort=params.get('sort');if(sort==='price-low')found.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));if(sort==='price-high')found.sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity));if(sort==='name')found.sort((a,b)=>a.name.localeCompare(b.name));
 const total=found.length;const requestedPage=Math.max(1,Number(params.get('page')||1)||1);const limit=Math.min(60,Math.max(1,Number(params.get('limit')||24)||24));const page=Math.min(requestedPage,Math.max(1,Math.ceil(total/limit)));
 return {departmentImages,subcategoryImages,items:found.slice((page-1)*limit,page*limit),total,page,pages:Math.ceil(total/limit),facets,departmentCounts,subcategoryCounts,catalogTotal:products.length};
}
