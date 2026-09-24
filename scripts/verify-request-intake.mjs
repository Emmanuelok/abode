import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const {Miniflare} = wranglerRequire('miniflare');
const esbuild = wranglerRequire('esbuild');
const product = JSON.parse(await readFile('lib/catalog-data.json', 'utf8'))[0];
const serverFixture = `import {env} from 'cloudflare:workers';import {AsyncLocalStorage} from 'node:async_hooks';
export const context=new AsyncLocalStorage();export const database=()=>({prepare:env.DB.prepare.bind(env.DB),batch:async statements=>{const request=context.getStore();if(request.headers.get('x-test-claim-during-quota')==='yes') await env.DB.prepare('INSERT INTO guest_claims(guest_id,user_id,claim_id,created_at) VALUES(?,?,?,?)').bind(request.headers.get('x-test-user'),'user:claim-owner','fixture-claim',new Date().toISOString()).run();return env.DB.batch(statements);}});
export async function identity(){return {id:context.getStore().headers.get('x-test-user')||'guest-fixture',email:'',signedIn:false,staff:false};}
export class HttpError extends Error{constructor(status,message,code){super(message);this.status=status;this.code=code;}}
export function assertOwner(request,userId){if(request.headers.get('x-abode-owner')!==userId)throw new HttpError(409,'Identity changed','IDENTITY_CHANGED');}
export function sameOrigin(request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new HttpError(403,'Origin not permitted');}
export function fail(error){return Response.json({error:error.message,code:error.code},{status:error.status||503});}`;
const build = await esbuild.build({stdin: {contents: "import {GET,POST} from './app/api/requests/route.ts';import {context} from '@/lib/server';export default {fetch(request){return context.run(request,()=>request.method==='GET'?GET():POST(request));}}", resolveDir: process.cwd(), sourcefile: 'intake-test.ts'}, bundle: true, write: false, format: 'esm', platform: 'neutral', target: 'es2022', mainFields: ['module', 'main'], conditions: ['workerd', 'import'], external: ['cloudflare:workers', 'node:*'], plugins: [{name: 'isolated-fixtures', setup(build) {
  build.onResolve({filter: /^@\/lib\/server$/}, () => ({path: 'server-fixture', namespace: 'fixture'}));
  build.onLoad({filter: /^server-fixture$/, namespace: 'fixture'}, () => ({contents: serverFixture, loader: 'js'}));
  build.onResolve({filter: /^\.\/catalog$/}, args => args.importer.endsWith('request-validation.ts') ? {path: 'catalog-fixture', namespace: 'fixture'} : undefined);
  build.onLoad({filter: /^catalog-fixture$/, namespace: 'fixture'}, () => ({contents: 'const product=' + JSON.stringify(product) + ';export const productById=id=>id===product.id?product:undefined;', loader: 'js'}));
  build.onResolve({filter: /^@\//}, args => ({path: resolve(args.path.slice(2) + '.ts')}));
}}]});
const mf = new Miniflare({script: build.outputFiles[0].text, modules: true, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: {DB: 'intake-tests'}, cf: false, inspectorPort: 0});
const checks = [];
try {
  const db = await mf.getD1Database('DB');
  for (const name of ['0000_confused_madame_web.sql', '0001_customer_auth.sql', '0003_intake_limits.sql']) {
    for (const sql of (await readFile('drizzle/' + name, 'utf8')).replaceAll('--> statement-breakpoint', '').split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(sql).run();
  }
  const call = async (body, user = 'customer', ip = '192.0.2.1', extra = {}) => {
    const response = await mf.dispatchFetch('http://intake.test/api/requests', {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Origin: 'http://intake.test', 'x-test-user': user, 'x-abode-owner':user, ...(ip ? {'cf-connecting-ip': ip} : {}), ...extra}, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)});
    return {status: response.status, data: await response.json(), retryAfter: response.headers.get('retry-after')};
  };
  const service = {name: 'Ama Mensah', email: 'ama@example.test', phone: '', business: '', category: '', budget: '', quantity: '', city: 'Accra', message: 'Please help me plan a living room.', website: '', reference: '', date: ''};
  for (const kind of ['design', 'trade', 'supplier', 'support', 'return', 'special-request']) {
    const result = await call({kind, payload: {...service, business: ['trade', 'supplier'].includes(kind) ? 'Ama Interiors' : ''}}, 'valid-' + kind);
    assert.equal(result.status, 201, kind); assert.equal(result.data.status, 'new');
  }
  assert.equal((await call({kind: 'price-alert', payload: {email: service.email, productId: product.id, productName: 'Spoofed name'}}, 'valid-alert')).status, 201);
  assert.equal((await call({kind: 'newsletter', payload: {email: service.email}}, 'valid-newsletter')).status, 201);
  const quote = {kind: 'order-quote', payload: {name: 'Ama Mensah', email: service.email, phone: '024 123 4567', address: 'Sample address', gps: 'GA-123-4567', landmark: '', region: 'Greater Accra', city: 'Accra', access: '', method: 'MTN MoMo', delivery: 'Standard delivery', assembly: false, notes: '', items: [{id: product.id, quantity: 2, guidePrice: 1}], guideSubtotal: 1, paymentStatus: 'paid', role: 'staff'}};
  const saved = await call(quote, 'valid-quote'); assert.equal(saved.status, 201); assert.match(saved.data.id, /^AB-[A-F0-9-]{36}$/);
  const privateRecords = await call(undefined, 'valid-quote');
  const payload = JSON.parse(privateRecords.data.requests[0].payload);
  assert.equal(payload.items[0].guidePrice, product.price); assert.equal(payload.guideSubtotal, product.price * 2); assert.equal(payload.paymentStatus, 'not-collected'); assert.equal(payload.role, undefined);
  assert.equal((await call(undefined, 'different-user')).data.requests.length, 0);
  checks.push('all nine client payloads accepted; private ownership and server-authoritative prices');
  const badCases = [
    {kind: 'support', payload: {...service, message: 'short'}},
    {kind: 'supplier', payload: service},
    {kind: 'design', payload: {...service, budget: '-1'}},
    {kind: 'design', payload: {...service, quantity: '1.5'}},
    {kind: 'trade', payload: {...service, business: 'Team', website: 'javascript:alert(1)'}},
    {kind: 'design', payload: {...service, date: '2026-02-30'}},
    {kind: 'support', payload: {...service, name: 'x'.repeat(121)}},
    {kind: 'price-alert', payload: {email: service.email, productId: 'invented'}},
    {...quote, payload: {...quote.payload, items: [{id: product.id, quantity: -1}]}},
    {...quote, payload: {...quote.payload, items: [{id: product.id, quantity: 1}, {id: product.id, quantity: 1}]}},
    {kind: 'newsletter', payload: {email: 'invalid'}}, null, [], '{broken',
  ];
  for (const body of badCases) assert.equal((await call(body, 'invalid')).status, 400, JSON.stringify(body).slice(0, 100));
  assert.equal((await call(JSON.stringify({kind: 'newsletter', payload: {email: 'x'.repeat(51000)}}))).status, 413);
  assert.equal((await call({kind: 'newsletter', payload: {email: service.email}}, 'origin', '192.0.2.5', {Origin: 'https://attacker.test'})).status, 403);
  assert.equal((await call(quote, 'mime', '192.0.2.5', {'Content-Type': 'text/plain'})).status, 415);
  checks.push('bounded fields, URLs, dates, products, quantities, JSON and origin validated');
  const newsletter = {kind: 'newsletter', payload: {email: service.email}};
  const switched = await call(newsletter, 'new-account', '192.0.2.8', {'x-abode-owner':'old-account'});
  assert.equal(switched.status, 409); assert.equal(switched.data.code, 'IDENTITY_CHANGED');
  const lateGuest = await call(newsletter, 'guest:claimed', '192.0.2.8', {'x-test-claim-during-quota':'yes'});
  assert.equal(lateGuest.status, 409); assert.equal(lateGuest.data.code, 'IDENTITY_CHANGED');
  assert.equal((await call(undefined,'guest:claimed')).data.requests.length,0);
  checks.push('changed account and guest claimed after identity resolution cannot create orphan enquiries');
  const simultaneous = await Promise.all(Array.from({length: 21}, () => call(newsletter, 'concurrent', '192.0.2.20')));
  assert.equal(simultaneous.filter(result => result.status === 201).length, 20);
  assert.equal(simultaneous.filter(result => result.status === 429).length, 1);
  assert(Number(simultaneous.find(result => result.status === 429).retryAfter) > 0);
  assert.equal((await call(undefined, 'concurrent')).data.requests.length, 20);
  checks.push('atomic identity quota survives 21 simultaneous submissions');
  for (let index = 0; index < 60; index++) assert.equal((await call(newsletter, 'rotated-' + index, '192.0.2.30')).status, 201);
  assert.equal((await call(newsletter, 'rotated-again', '192.0.2.30', {'x-forwarded-for': '198.51.100.99'})).status, 429);
  assert.equal((await call(newsletter, 'other-network', '192.0.2.31')).status, 201);
  for (let index = 0; index < 60; index++) assert.equal((await call(newsletter, 'v6-' + index, '2001:db8:abcd:1::' + (index + 1).toString(16))).status, 201);
  assert.equal((await call(newsletter, 'v6-another', '2001:0db8:abcd:0001::ff')).status, 429);
  const keys = await db.prepare('SELECT key FROM request_intake_limits').all();
  assert(keys.results.every(row => /^(identity|ip):[a-f0-9]{64}$/.test(row.key)));
  checks.push('trusted IP quota survives guest/header rotation and IPv6 /64 changes; raw identifiers not stored');
  console.log(JSON.stringify({passed: checks}, null, 2));
} finally {await mf.dispose();}
