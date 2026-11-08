import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),esbuild=createRequire(require.resolve('wrangler/package.json'))('esbuild');
const built=esbuild.buildSync({entryPoints:['lib/pricing-au.ts'],bundle:true,platform:'node',format:'cjs',write:false});
const mod={exports:{}};new Function('module','exports',built.outputFiles[0].text)(mod,mod.exports);
const {priceAustralianCatalogue,benchmarks}=mod.exports;
const original=JSON.parse(readFileSync('lib/catalog-data.json','utf8')),copy=JSON.stringify(original),products=original.map(priceAustralianCatalogue);
assert.equal(JSON.stringify(original),copy,'historical catalogue not mutated');assert.equal(products.length,5357);
for(const p of products){assert.equal(p.priceCurrency,'AUD');if(p.price===null){assert.equal(p.pricingStatus,'quote-required')}else{const b=benchmarks[p.pricingBenchmark];assert.ok(b&&b.low>0&&b.high>=b.low);assert.equal(p.price,Math.round((b.low+b.high)/2*100)/100);assert.deepEqual(p.priceRangeAUD,[b.low,b.high]);assert.equal(p.pricingStatus,'indicative')}}
const unknown=products.find(p=>p.price===null),known=products.find(p=>p.price!==null);assert.ok(unknown&&known);
assert.equal(priceAustralianCatalogue({...original[0],name:'Replacement sofa cover only'}).price,null);
const fx=JSON.parse(readFileSync('lib/exchange-rates.json','utf8'));assert.equal(fx.base_code,'AUD');assert.equal(fx.rates.AUD,1);for(const c of ['USD','GBP','CAD','EUR','GHS'])assert.ok(Number.isFinite(fx.rates[c])&&fx.rates[c]>0);
assert.ok(Number.isFinite(Date.parse(fx.time_last_update_utc)));
const validation=readFileSync('lib/request-validation.ts','utf8');assert.match(validation,/incompletePricing/);assert.match(validation,/priceCurrency: 'AUD'/);
const counts={};for(const p of products)counts[p.pricingBenchmark||'quote-required']=(counts[p.pricingBenchmark||'quote-required']||0)+1;
writeFileSync('docs/pricing/coverage.json',JSON.stringify({observed:'2026-11-07',catalogue:products.length,benchmarked:products.filter(p=>p.price!==null).length,quoteRequired:products.filter(p=>p.price===null).length,counts,fxObserved:fx.time_last_update_utc},null,2)+'\n');
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';writeFileSync('docs/pricing/catalogue-pricing-audit.csv',['product_id,name,original_GHS_guide,indicative_AUD,range_low_AUD,range_high_AUD,status,benchmark,source',...products.map((p,i)=>[p.id,p.name,original[i].price,p.price,p.priceRangeAUD?.[0],p.priceRangeAUD?.[1],p.pricingStatus,p.pricingBenchmark,p.pricingBenchmark?benchmarks[p.pricingBenchmark].source:''].map(csv).join(','))].join('\n')+'\n');
console.log('PASS: AUD benchmark coverage, unmatched null prices, historical catalogue preservation, exclusions and AUD FX snapshot');
