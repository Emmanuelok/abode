import raw from './catalog-data.json?raw';
import type {Product} from './types';
import {slugify} from './taxonomy';
export const products:Product[]=JSON.parse(raw);
const byId=new Map(products.map(p=>[p.id,p]));
export const productById=(id:string)=>byId.get(id);
const departmentCounts:Record<string,number>={};
const subcategoryCounts:Record<string,number>={};
const departmentImages:Record<string,string>={};
for(const p of products){departmentCounts[p.department]=(departmentCounts[p.department]||0)+1;const key=p.department+'/'+slugify(p.subcategory);subcategoryCounts[key]=(subcategoryCounts[key]||0)+1;if(!departmentImages[p.department])departmentImages[p.department]=p.image;}
export function queryCatalog(params:URLSearchParams){
 const id=params.get('id');if(id)return {product:productById(id)||null,related:products.filter(p=>p.id!==id&&p.subcategory===productById(id)?.subcategory).slice(0,8)};
 const ids=params.get('ids');if(params.has('ids'))return {items:(ids||'').split(',').slice(0,150).map(productById).filter(Boolean)};
 const q=(params.get('q')||'').trim().toLowerCase().slice(0,120);const dept=params.get('department');const sub=params.get('subcategory');
 const synonym:Record<string,string>={couch:'sofa',sofas:'sofa',chairs:'chair',tables:'table',couches:'sofa',lamps:'lamp',rugs:'rug',settee:'sofa',settees:'sofa',centre:'coffee',center:'coffee',duvet:'duvet',fridge:'refrigerator',cupboard:'cabinet',bedside:'nightstand',set:'set'};
 const words=q.split(/\s+/).filter(Boolean).map(w=>synonym[w]||w);
 const categoryMatches=products.filter(p=>(!dept||p.department===dept)&&(!sub||slugify(p.subcategory)===sub));
 const primaryMatches=categoryMatches.filter(p=>!q||words.every(w=>(p.name+' '+p.subcategory+' '+p.color+' '+p.material+' '+p.brand).toLowerCase().includes(w)));
 let found=primaryMatches.length||!q?primaryMatches:categoryMatches.filter(p=>words.every(w=>(p.name+' '+p.description+' '+p.subcategory+' '+p.color+' '+p.material+' '+p.brand).toLowerCase().includes(w)));

 const facets={colors:[...new Set(found.map(p=>p.color).filter(Boolean))].sort().slice(0,50),materials:[...new Set(found.map(p=>p.material).filter(Boolean))].sort().slice(0,45),brands:[...new Set(found.map(p=>p.brand).filter(Boolean))].sort().slice(0,45),subcategories:[...new Set(found.map(p=>p.subcategory))].sort()};
 const min=Number(params.get('min')||0),max=Number(params.get('max')||1000000);
 found=found.filter(p=>p.price>=min&&p.price<=max&&(!params.get('color')||p.color===params.get('color'))&&(!params.get('material')||p.material===params.get('material'))&&(!params.get('brand')||p.brand===params.get('brand')));
 const sort=params.get('sort');if(sort==='price-low')found.sort((a,b)=>a.price-b.price);if(sort==='price-high')found.sort((a,b)=>b.price-a.price);if(sort==='name')found.sort((a,b)=>a.name.localeCompare(b.name));
 const total=found.length;const page=Math.max(1,Number(params.get('page')||1)||1);const limit=Math.min(60,Math.max(1,Number(params.get('limit')||24)||24));
 return {departmentImages,items:found.slice((page-1)*limit,page*limit),total,page,pages:Math.ceil(total/limit),facets,departmentCounts,subcategoryCounts,catalogTotal:products.length};
}
