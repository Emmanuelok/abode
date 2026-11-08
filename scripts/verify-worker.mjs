import {createRequire} from 'node:module';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {betterAuth} from 'better-auth';
import {makeSignature} from 'better-auth/crypto';
const require=createRequire(import.meta.url);const wreq=createRequire(require.resolve('wrangler/package.json'));const {Miniflare}=wreq('miniflare');
const authSettings={AUTH_URL:'http://qa.local',BETTER_AUTH_SECRET:randomBytes(48).toString('base64url'),GOOGLE_CLIENT_ID:'worker-fixture.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'fixture-only-not-a-live-google-secret'};
const configSource=ts.transpileModule(await readFile('lib/auth-config.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {authOptions}=await import('data:text/javascript;base64,'+Buffer.from(configSource).toString('base64'));
const files=(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0);
const modules=await Promise.all(files.map(async p=>({type:'ESModule',path:resolve('dist/server',p),contents:await readFile('dist/server/'+p,'utf8')})));
const mf=new Miniflare({modules,modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{...authSettings,ADMIN_EMAILS:'owner@example.test'},d1Databases:{DB:'qa-abode'},r2Buckets:{GALLERY:'qa-abode-gallery'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true}},cf:false,inspectorPort:0});
const catalog=JSON.parse(await readFile('lib/catalog-data.json','utf8'));
const departments=JSON.parse(await readFile('lib/departments.json','utf8'));
const slugify=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
let checks=[];
try{
 const db=await mf.getD1Database('DB');const migrations=(await readdir('drizzle')).filter(name=>/^\d+_.+\.sql$/.test(name)).sort();for(const name of migrations){const schema=await readFile('drizzle/'+name,'utf8');for(const s of schema.replaceAll('--> statement-breakpoint','').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(s).run()}checks.push(`all ${migrations.length} numbered database migrations applied`);
 const owners=new Map();
 const call=async(path,body,cookie='',headers={})=>{
  const mutation=body!==undefined;
  const guarded=path==='/api/state'||path==='/api/requests'||path.startsWith('/api/admin/');
  const res=await mf.dispatchFetch('http://qa.local'+path,{method:mutation?'POST':'GET',headers:{'cf-connecting-ip':'192.0.2.40',...(mutation?{'Content-Type':'application/json','Origin':'http://qa.local'}:{}),...(mutation&&guarded&&owners.has(cookie)?{'X-Abode-Owner':owners.get(cookie)}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:mutation?JSON.stringify(body):undefined});
  const text=await res.text();let data;try{data=JSON.parse(text)}catch{data=text}
  if(!mutation&&path==='/api/state'&&res.status===200&&typeof data.owner==='string'){
   owners.set(cookie,data.owner);
   for(const value of res.headers.getSetCookie?.()||[res.headers.get('set-cookie')||'']){
    const pair=value.split(';')[0];if(/^abode_guest=.+$/.test(pair))owners.set(pair,data.owner);
   }
  }
  return {res,data};
 };
 const bucket=await mf.getR2Bucket('GALLERY');const imageKey='0'.repeat(32)+'.jpg';await bucket.put('gallery/'+imageKey,new Uint8Array([255,216,255,217]),{httpMetadata:{contentType:'image/jpeg'}});const imageResponse=await mf.dispatchFetch('http://qa.local/catalog/gallery/'+imageKey);assert.equal(imageResponse.status,200);assert.equal(imageResponse.headers.get('content-type'),'image/jpeg');assert.equal((await imageResponse.arrayBuffer()).byteLength,4);checks.push('same-origin R2 gallery reads');
 let r=await call('/api/catalog?limit=4');assert.equal(r.res.status,200);assert.equal(r.data.catalogTotal,catalog.length);assert.equal(r.data.items.length,4);const product=r.data.items[0];const unpriced=r.data.items.find(p=>p.price===null);assert.ok(unpriced);checks.push(`catalog: ${catalog.length} products, 4-item pagination`);
 let categoryCount=0;for(const d of departments){const dr=await call('/api/catalog?department='+d.slug+'&limit=1');assert(dr.data.total>0,'Empty department: '+d.slug);for(const g of d.groups)for(const label of g.items){const route=d.slug+'/'+slugify(label);const cr=await call('/api/catalog?department='+d.slug+'&subcategory='+slugify(label)+'&limit=1');assert.equal(cr.res.status,200,route);assert(cr.data.total>0,'Empty collection: '+route);assert(cr.data.items.length===1,route);categoryCount++}}checks.push(`${departments.length} departments and ${categoryCount} submenu collections: all populated`);
 const page2=await call('/api/catalog?page=2&limit=4');assert(!page2.data.items.some(p=>r.data.items.some(first=>first.id===p.id)));checks.push('page navigation returns distinct products');
 r=await call('/api/catalog?ids=');assert.deepEqual(r.data.items,[]);checks.push('empty selections do not load unrelated products');
 r=await call('/api/catalog?q=sofa&sort=price-low&max=10000');assert(r.data.total>0);assert(r.data.items.every(p=>p.price<=10000));assert(r.data.items.every((p,i,a)=>!i||p.price>=a[i-1].price));checks.push('search, price filter and sorting');
 r=await call('/api/state');assert.equal(r.res.status,200);const cookie=r.res.headers.get('set-cookie').split(';')[0];assert.deepEqual(r.data.state.cart,[]);
 r=await call('/api/state',{key:'cart',value:[{id:product.id,quantity:2}]},cookie);assert.equal(r.res.status,200);
 r=await call('/api/state',{key:'wishlist',value:[product.id]},cookie);assert.equal(r.res.status,200);
 r=await call('/api/state',undefined,cookie);assert.equal(r.data.state.cart[0].quantity,2);assert.equal(r.data.state.wishlist[0],product.id);checks.push('durable cart and wishlist state');
 r=await call('/api/state');assert.deepEqual(r.data.state.cart,[]);checks.push('guest-session data isolation');
 const forged=await mf.dispatchFetch('http://qa.local/api/state',{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'}});const forgedData=await forged.json();assert.equal(forgedData.user.signedIn,false);assert.deepEqual(forgedData.state.cart,[]);checks.push('untrusted ChatGPT identity headers ignored');
 const crossOrigin=await mf.dispatchFetch('http://qa.local/api/state',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({key:'wishlist',value:[]})});assert.notEqual(crossOrigin.status,200);checks.push('cross-origin state write rejected');
 r=await call('/api/state',{key:'cart',value:[{id:product.id,quantity:-1}]},cookie);assert.equal(r.res.status,400);checks.push('invalid quantity rejected');
 r=await call('/api/requests',{kind:'order-quote',payload:{name:'QA Shopper',email:'qa@example.com',phone:'0241234567',address:'QA test address',gps:'WS-350-10592',items:[{id:product.id,quantity:2,guidePrice:1},{id:unpriced.id,quantity:1,guidePrice:1}],guideSubtotal:1}},cookie);assert.equal(r.res.status,201);assert.equal(r.data.status,'new');const quoteId=r.data.id;
 r=await call('/api/requests',undefined,cookie);assert.equal(r.data.requests.length,1);const payload=JSON.parse(r.data.requests[0].payload);assert.equal(payload.priceCurrency,'AUD');assert.equal(payload.guideSubtotal,payload.items[0].guidePrice*2);assert.equal(payload.items[0].guidePrice,product.price);assert.equal(payload.incompletePricing,true);assert.equal(payload.items[1].guidePrice,null);assert.equal(payload.paymentStatus,'not-collected');checks.push('quote persistence and server-side price calculation');
 r=await call('/api/requests');assert.equal(r.data.requests.length,0);checks.push('quote records scoped to their session');

 // Seed users and sessions through Better Auth's actual native D1 adapter,
 // then exercise identity, authorization and cookies through the built Worker.
 const fixtureAuth=betterAuth({...authOptions(authSettings),database:db,logger:{level:'error'}});
 const authContext=await fixtureAuth.$context;
 const fixtureUser=await authContext.internalAdapter.createUser({name:'Worker Customer',email:'customer@example.test',emailVerified:true});
 const fixtureOwner=await authContext.internalAdapter.createUser({name:'Worker Owner',email:'owner@example.test',emailVerified:false});
 const fixtureSession=await authContext.internalAdapter.createSession(fixtureUser.id,false);
 const ownerSession=await authContext.internalAdapter.createSession(fixtureOwner.id,false);
 const signedCookie=async token=>authContext.authCookies.sessionToken.name+'='+encodeURIComponent(token+'.'+await makeSignature(token,authSettings.BETTER_AUTH_SECRET));
 const userCookie=await signedCookie(fixtureSession.token);const ownerCookie=await signedCookie(ownerSession.token);
 r=await call('/api/state',undefined,userCookie);assert.equal(r.res.status,200);assert.equal(r.data.user.signedIn,true);assert.equal(r.data.user.email,'customer@example.test');assert.equal(r.data.user.staff,false);assert.equal(r.res.headers.get('cache-control'),'no-store');
 r=await call('/api/state',undefined,ownerCookie);assert.equal(r.data.user.signedIn,true);assert.equal(r.data.user.staff,false);
 assert.equal((await call('/api/admin/requests',undefined,userCookie)).res.status,403);
 assert.equal((await call('/api/admin/requests',undefined,ownerCookie)).res.status,403);
 assert.equal((await call('/api/admin/requests')).res.status,401);
 await db.prepare('UPDATE auth_user SET emailVerified=1 WHERE id=?').bind(fixtureOwner.id).run();
 r=await call('/api/state',undefined,ownerCookie);assert.equal(r.data.user.staff,true);
 await call('/api/state',{key:'profile',value:{name:'Customer',email:'owner@example.test',phone:'',address:'',gps:''}},userCookie);
 r=await call('/api/state',undefined,userCookie);assert.equal(r.data.user.staff,false);assert.equal(r.data.user.email,'customer@example.test');
 const forgedAdmin=await call('/api/admin/requests',undefined,'',{'oai-authenticated-user-id':fixtureOwner.id,'oai-authenticated-user-email':'owner@example.test','x-user-role':'admin'});assert.equal(forgedAdmin.res.status,401);
 const tamperedCookie=userCookie.slice(0,-4)+'AAAA';r=await call('/api/state',undefined,tamperedCookie);assert.equal(r.data.user.signedIn,false);assert.equal(r.data.user.staff,false);
 checks.push('compiled Worker validates native sessions and grants staff only to verified allowlisted identity, never profile data or forged headers/cookies');

 r=await call('/api/state',undefined,userCookie+'; '+cookie);assert.equal(r.res.status,200);assert.equal(r.data.user.signedIn,true);assert.equal(r.data.state.cart[0].quantity,2);assert.deepEqual(r.data.state.wishlist,[product.id]);assert(r.res.headers.get('set-cookie')?.includes('abode_guest='),'guest cookie should be cleared after claim');
 const guestId='guest:'+cookie.split('=')[1];
 assert.equal((await db.prepare('SELECT user_id FROM guest_claims WHERE guest_id=?').bind(guestId).first()).user_id,'user:'+fixtureUser.id);
 assert.equal(await db.prepare('SELECT state FROM shopper_state WHERE user_id=?').bind(guestId).first(),null);
 r=await call('/api/requests',undefined,userCookie);assert.equal(r.data.requests.length,1);assert.equal(r.data.requests[0].id,quoteId);
 r=await call('/api/state',undefined,userCookie+'; '+cookie);assert.equal(r.data.state.cart[0].quantity,2);
 r=await call('/api/state',undefined,cookie);assert.equal(r.data.user.signedIn,false);assert.deepEqual(r.data.state.cart,[]);const rotatedCookie=r.res.headers.get('set-cookie')?.split(';')[0];assert(rotatedCookie?.startsWith('abode_guest='));assert.notEqual(rotatedCookie,cookie);
 r=await call('/api/requests',undefined,cookie);assert.deepEqual(r.data.requests,[]);
 r=await call('/api/state',undefined,ownerCookie+'; '+cookie);assert.deepEqual(r.data.state.cart,[]);
 assert.equal((await db.prepare('SELECT user_id FROM requests WHERE id=?').bind(quoteId).first()).user_id,'user:'+fixtureUser.id);
 checks.push('HTTP sign-in claim transfers cart/wishlist/enquiry exactly once, rotates old guest cookies and blocks reuse by another account');

 const previousOwner='user:'+fixtureUser.id;
 const accountBBefore=await call('/api/state',undefined,ownerCookie);
 const staleProfile={name:'Private account A name',email:'private-a@example.test',phone:'0241234567',address:'Private account A address',gps:'GA-123-4567'};
 r=await call('/api/state',{key:'profile',value:staleProfile},ownerCookie,{'X-Abode-Owner':previousOwner});assert.equal(r.res.status,409);assert.equal(r.data.code,'IDENTITY_CHANGED');
 const accountBAfter=await call('/api/state',undefined,ownerCookie);assert.deepEqual(accountBAfter.data.state,accountBBefore.data.state);
 r=await call('/api/requests',{kind:'order-quote',payload:{name:'Stale account A',email:'private-a@example.test',phone:'0241234567',address:'Private account A address',gps:'GA-123-4567',items:[{id:product.id,quantity:1}]}},ownerCookie,{'X-Abode-Owner':previousOwner});assert.equal(r.res.status,409);assert.equal(r.data.code,'IDENTITY_CHANGED');
 assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM requests').first()).total,1);
 checks.push('stale account-A tab cannot write private state or enquiries under account-B cookies; B remains unchanged');

 r=await call('/api/admin/requests',undefined,ownerCookie);assert.equal(r.res.status,200);assert.equal(r.res.headers.get('cache-control'),'no-store, private');assert.equal(r.data.total,1);assert.equal(r.data.requests[0].id,quoteId);
 r=await call('/api/admin/requests',{id:quoteId,status:'in-review',expectedStatus:'new'},userCookie);assert.equal(r.res.status,403);
 r=await call('/api/admin/requests',{id:quoteId,status:'in-review',expectedStatus:'new'},ownerCookie,{Origin:'https://attacker.example'});assert.equal(r.res.status,403);
 r=await call('/api/admin/requests',{id:quoteId,status:'in-review',expectedStatus:'new'},ownerCookie,{'X-Abode-Owner':previousOwner});assert.equal(r.res.status,409);assert.equal(r.data.code,'IDENTITY_CHANGED');
 r=await call('/api/admin/requests',{id:quoteId,status:'in-review',expectedStatus:'new'},ownerCookie);assert.equal(r.res.status,200);assert.equal(r.data.status,'in-review');
 r=await call('/api/admin/requests?id='+quoteId,undefined,ownerCookie);assert.equal(r.data.request.status,'in-review');assert.equal(r.data.history.length,1);assert.equal(r.data.history[0].actorEmail,'owner@example.test');assert.equal(r.data.history[0].oldStatus,'new');
 r=await call('/api/admin/requests',{id:quoteId,status:'in-review',expectedStatus:'new'},ownerCookie);assert.equal(r.res.status,409);
 r=await call('/api/requests',undefined,userCookie);assert.equal(r.data.requests[0].status,'in-review');
 checks.push('verified staff list and update enquiries with an audit record; customers, foreign origins and stale writes are denied');

 r=await call('/api/auth/get-session',undefined,userCookie);assert.equal(r.res.status,200);assert.equal(r.data.user.id,fixtureUser.id);assert.equal(r.res.headers.get('cache-control'),'no-store');assert.equal(r.res.headers.get('pragma'),'no-cache');
 r=await call('/api/auth/sign-in/social',{provider:'google',callbackURL:'http://qa.local/account'},'',{Origin:'https://attacker.example'});assert.equal(r.res.status,403);assert.equal(r.res.headers.get('cache-control'),'no-store');
 r=await call('/api/auth/sign-in/social',{provider:'google',callbackURL:'http://qa.local/account'},userCookie,{Origin:'https://attacker.example'});assert.equal(r.res.status,403);assert.equal(r.res.headers.get('cache-control'),'no-store');
 r=await call('/api/auth/sign-in/social',{provider:'google',callbackURL:'https://attacker.example/account'});assert.equal(r.res.status,403);
 r=await call('/api/auth/sign-in/social',{provider:'google',callbackURL:'http://qa.local/account'});assert.equal(r.res.status,200);assert.equal(r.res.headers.get('cache-control'),'no-store');const oauthUrl=new URL(r.data.url);assert.equal(oauthUrl.hostname,'accounts.google.com');assert.equal(oauthUrl.searchParams.get('redirect_uri'),'http://qa.local/api/auth/callback/google');assert(oauthUrl.searchParams.get('state'));assert(oauthUrl.searchParams.get('code_challenge'));assert.equal(oauthUrl.searchParams.get('code_challenge_method'),'S256');
 checks.push('compiled OAuth routes enforce same-origin callbacks, emit no-store responses, and initiate Google with state and PKCE');
 r=await call('/api/auth/sign-out',{},userCookie,{Origin:'https://attacker.example'});assert.equal(r.res.status,403);assert(await db.prepare('SELECT id FROM auth_session WHERE token=?').bind(fixtureSession.token).first());
 r=await call('/api/auth/sign-out',{},userCookie);assert.equal(r.res.status,200);assert.equal(r.res.headers.get('cache-control'),'no-store');assert(r.res.headers.get('set-cookie')?.includes('Max-Age=0'));assert.equal(await db.prepare('SELECT id FROM auth_session WHERE token=?').bind(fixtureSession.token).first(),null);
 const stateRowsBefore=(await db.prepare('SELECT user_id,state FROM shopper_state ORDER BY user_id').all()).results;
 r=await call('/api/state',{key:'profile',value:staleProfile},userCookie,{'X-Abode-Owner':previousOwner});assert.equal(r.res.status,409);assert.equal(r.data.code,'IDENTITY_CHANGED');
 const revokedGuestCookie=(r.res.headers.getSetCookie?.()||[]).map(value=>value.split(';')[0]).find(value=>/^abode_guest=.+$/.test(value));assert(revokedGuestCookie,'revoked session should receive a fresh guest identity');
 assert.deepEqual((await db.prepare('SELECT user_id,state FROM shopper_state ORDER BY user_id').all()).results,stateRowsBefore);
 r=await call('/api/state',undefined,revokedGuestCookie);assert.equal(r.data.user.signedIn,false);assert.equal(r.data.state.profile.name,'');assert.equal(r.data.state.profile.address,'');assert.deepEqual(r.data.state.cart,[]);
 checks.push('revoked-session stale writes return IDENTITY_CHANGED without copying private account data into any guest row');
 r=await call('/api/state',undefined,userCookie);assert.equal(r.data.user.signedIn,false);assert.deepEqual(r.data.state.cart,[]);
 r=await call('/api/admin/requests',undefined,ownerCookie);assert.equal(r.res.status,200);
 checks.push('compiled sign-out rejects CSRF, deletes the real session and prevents cookie replay without ending another user’s session');

 r=await call('/api/catalog/export');assert.equal(r.data.count,catalog.length);checks.push('complete catalog export');
 r=await call('/');assert.equal(r.res.status,200);assert(r.data.includes('Australian.'));checks.push('homepage server response');
 r=await call('/shop/living-room');assert.equal(r.res.status,200);assert(r.data.includes('Living Room'));checks.push('category route server response');
 for(const slug of ['window-treatments','cleaning','cooling','fitness','tools','entryway','garden']){const page=await call('/shop/'+slug);assert.equal(page.res.status,200,slug);assert(page.data.includes('collection-hero'),slug)}checks.push('all seven new department pages render');
 r=await call('/departments');assert.equal(r.res.status,200);assert(r.data.includes('Find your'));checks.push('complete department directory renders');
 r=await call('/product/'+product.id);assert.equal(r.res.status,200);assert(!r.data.includes('Australian.'));checks.push('direct product route does not render the homepage');
 await writeFile('docs/worker-verification.json',JSON.stringify({passed:checks,timestamp:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:checks},null,2));
}finally{await mf.dispose()}
