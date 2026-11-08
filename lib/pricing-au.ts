import type {Product} from './types';
export const PRICING_VERSION='au-benchmarks-2026-11-07';
// These are comparable-category planning estimates, never identical-SKU retail offers.
// Source catalogue prices are deliberately retained in catalog-packed.txt as historical GHS.
export const benchmarks={
 fabricChaise:{low:949,high:1799,source:'https://www.templeandwebster.com.au/Modular-Sofas-C1851412.html',basis:'Thea 3-seater / Quinn 4-seater upholstered chaise sofas; different brands, sizes and construction.'},
 leatherChaise:{low:3099,high:3299,source:'https://www.templeandwebster.com.au/Modular-Sofas-C1851412.html',basis:'Massey 5-seater / Terry 4-seater genuine-leather chaise sets; different dimensions and construction.'},
 slipcoverChaise:{low:1599,high:1899,source:'https://www.templeandwebster.com.au/Modular-Sofas-C1851412.html',basis:'Jude / Softy slipcover chaise comparables; different dimensions and construction.'},
 swivelChenille:{low:299,high:299,source:'https://www.templeandwebster.com.au/Armchairs-C1813539.html',basis:'Eloise chenille swivel armchair; comparable material/function, not identical SKU.'},
 woodCoffee:{low:152.10,high:219,source:'https://www.ikea.com/au/en/rooms/living-room/',source2:'https://www.templeandwebster.com.au/Temple-and-Websters-Raphael-Collection-X1045150.html',basis:'BORGEBY / Raphael wooden coffee-table comparables; dimensions and wood species differ.'},
 bedsideDrawer:{low:99,high:99,source:'https://www.templeandwebster.com.au/Temple-and-Websters-Raphael-Collection-X1045150.html',basis:'Raphael one-/two-drawer bedside tables; single item, different construction.'},
 writingDesk:{low:269,high:269,source:'https://www.templeandwebster.com.au/Temple-and-Websters-Raphael-Collection-X1045150.html',basis:'Raphael writing desk; not a sit-stand, corner or gaming desk.'},
 cornerDesk:{low:329,high:399,source:'https://www.templeandwebster.com.au/Temple-and-Websters-Raphael-Collection-X1045150.html',basis:'Raphael corner desk variants; different sizes and construction.'},
 woodTV:{low:159,high:269,source:'https://www.templeandwebster.com.au/Temple-and-Websters-Raphael-Collection-X1045150.html',basis:'Raphael TV unit variants; different dimensions and drawer/door configuration.'},
 woodSideboard:{low:349,high:349,source:'https://www.templeandwebster.com.au/Temple-and-Websters-Raphael-Collection-X1045150.html',basis:'Raphael three-door sideboard; single item, different construction.'},
 woodChest:{low:309,high:399,source:'https://www.templeandwebster.com.au/Temple-and-Websters-Raphael-Collection-X1045150.html',basis:'Raphael six-/nine-drawer chests; different sizes and construction.'},
 tableLamp:{low:49.95,high:169,source:'https://www.templeandwebster.com.au/Temple-and-Webster-C1955647.html',basis:'Jamie ceramic / Sabi terracotta table lamps; single lamp, different shade and dimensions.'},
 linenLamp:{low:109,high:109,source:'https://www.templeandwebster.com.au/Temple-and-Webster-C1955647.html',basis:'Sutton linen table lamp; single lamp, different dimensions.'},
 linenFloor:{low:229,high:229,source:'https://www.templeandwebster.com.au/Temple-and-Webster-C1955647.html',basis:'Sutton linen floor lamp; single lamp, different dimensions.'},
 framedCanvas:{low:119,high:179,source:'https://www.templeandwebster.com.au/Temple-and-Webster-C1955647.html',basis:'Lotus / Sangria framed canvas examples; different artwork and size, not original paintings.'},
 storageOttoman:{low:219,high:279,source:'https://www.templeandwebster.com.au/Temple-and-Webster-C1955647.html',basis:'Milo / Rupert upholstered storage ottoman benches; different size and fabric.'},
};
export function priceAustralianCatalogue(p:Product):Product{
 const n=p.name.toLowerCase(), text=(p.name+' '+p.material).toLowerCase();let key:keyof typeof benchmarks|undefined;
 // Sets, multipacks, components and conspicuously premium finishes are not silently matched to single-item comparables.
 const single=!/set of|pack of|\b\d+[- ]pack\b|replacement|cover only|\bmarble\b|\btravertine\b/.test(n);
 if(single){
 if(p.subcategory==='Sofas & Sectionals'&&/chaise|sectional/.test(n)&&!/reclin|faux|bonded|loveseat/.test(n))key=/leather/.test(text)?'leatherChaise':/slipcover/.test(n)?'slipcoverChaise':'fabricChaise';
 if(p.subcategory==='Armchairs & Accent Chairs'&&/swivel/.test(n)&&/chenille/.test(text))key='swivelChenille';
 const wood=/wood|oak|pine|walnut|acacia|timber|mdf|particle|veneer/.test(text)&&!/glass|metal|steel|iron|leather/.test(p.material.toLowerCase());
 if(wood&&p.subcategory==='Coffee Tables'&&!/nesting|lift.top|set/.test(n))key='woodCoffee';
 if(wood&&p.subcategory==='Nightstands'&&/[12][- ]drawer|one.drawer|two.drawer/.test(n))key='bedsideDrawer';
 if(wood&&p.subcategory==='Desks'&&/writing/.test(n)&&!/standing|adjustable|gaming/.test(n))key='writingDesk';
 if(wood&&p.subcategory==='Desks'&&/corner|l.shaped/.test(n))key='cornerDesk';
 if(wood&&p.subcategory==='TV Stands')key='woodTV';
 if(wood&&p.subcategory==='Sideboards & Buffets'&&/3.door|three.door/.test(n))key='woodSideboard';
 if(wood&&p.subcategory==='Dressers'&&/[69][- ]drawer|six.drawer|nine.drawer/.test(n))key='woodChest';
 if(p.subcategory==='Table Lamps'&&/ceramic|terracotta/.test(text))key='tableLamp';
 if(p.subcategory==='Table Lamps'&&/linen/.test(text))key='linenLamp';
 if(p.subcategory==='Floor Lamps'&&/linen/.test(text))key='linenFloor';
 if(p.subcategory==='Wall Art'&&/framed/.test(n)&&/canvas/.test(text))key='framedCanvas';
 if(['Ottomans & Poufs','Benches','Bedroom Benches'].includes(p.subcategory)&&/storage/.test(n)&&/bench/.test(n)&&!/leather|plastic/.test(text))key='storageOttoman';
 }
 if(!key)return {...p,price:null,priceCurrency:'AUD',pricingStatus:'quote-required'};
 const b=benchmarks[key];return {...p,price:Math.round((b.low+b.high)/2*100)/100,priceRangeAUD:[b.low,b.high],priceCurrency:'AUD',pricingStatus:'indicative',pricingBenchmark:key};
}
