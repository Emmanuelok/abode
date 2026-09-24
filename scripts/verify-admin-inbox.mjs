import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const {Miniflare} = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const compile = source => ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText;
const helperSource = compile(await readFile('lib/request-status.ts', 'utf8'));
const routeSource = compile((await readFile('app/api/admin/requests/route.ts', 'utf8')).replace(/^import .*?;\n/gm, ''));
// Test the real route and SQL against an ephemeral D1 database. Identity is a
// deterministic fixture: session cryptography is covered by the auth tests.
const harness = `import {env} from 'cloudflare:workers';
import {AsyncLocalStorage} from 'node:async_hooks';
const context = new AsyncLocalStorage();
const database = () => env.DB;
async function identity() {const role = context.getStore().headers.get('x-test-role');return {id:role === 'staff' ? 'owner-fixture' : 'customer-fixture',email:'staff@example.test',signedIn:role !== null,staff:role === 'staff'};}
function assertOwner(request,userId) {if(request.headers.get('x-abode-owner')!==userId) throw Object.assign(new Error('Identity changed'),{status:409,code:'IDENTITY_CHANGED'});}
function sameOrigin(request) {if (request.headers.get('origin') !== new URL(request.url).origin) throw Object.assign(new Error('Origin not permitted'),{status:403});}
function fail(error) {return Response.json({error:error.message,code:error.code},{status:error.status || 503});}
${helperSource}
${routeSource}
export default {fetch(request) {return context.run(request,()=>request.method === 'GET' ? GET(request) : POST(request));}};`;
const mf = new Miniflare({script: harness, modules: true, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: {DB: 'inbox-tests'}, cf: false, inspectorPort: 0});
const checks = [];
try {
  const db = await mf.getD1Database('DB');
  for (const name of ['0000_confused_madame_web.sql', '0002_staff_inbox.sql']) {
    const sql = await readFile('drizzle/' + name, 'utf8');
    for (const statement of sql.replaceAll('--> statement-breakpoint', '').split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  const call = async (path = '', body, role = 'staff', origin = 'http://inbox.test', owner = 'owner-fixture') => {
    const response = await mf.dispatchFetch('http://inbox.test/api/admin/requests' + path, {method: body === undefined ? 'GET' : 'POST', headers: {...(role === null ? {} : {'x-test-role': role}), Origin: origin, 'x-abode-owner':owner, 'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
    return {status: response.status, data: await response.json(), cache: response.headers.get('cache-control')};
  };
  assert.equal((await call('', undefined, null)).status, 401);
  assert.equal((await call('', undefined, 'customer')).status, 403);
  assert.equal((await call('', {staff: true}, 'customer')).status, 403);
  checks.push('anonymous, customer and forged staff body denied');
  await db.batch(Array.from({length: 27}, (_, index) => db.prepare('INSERT INTO requests(id,user_id,kind,status,payload,created_at) VALUES(?,?,?,?,?,?)').bind('AB-TEST-' + index, 'customer-' + index, index % 2 ? 'design' : 'order-quote', 'saved-preview', JSON.stringify({name: index === 0 ? '100% Homes' : 'Customer ' + index, email: 'customer' + index + '@example.test', message: 'A private customer brief.'}), new Date(Date.UTC(2026, 8, 24, 12, 0, index)).toISOString())));
  const first = await call(); const second = await call('?page=2');
  assert.equal(first.status, 200); assert.equal(first.data.total, 27); assert.equal(first.data.requests.length, 25); assert.equal(second.data.requests.length, 2);
  assert(!first.data.requests.some(record => second.data.requests.some(other => other.id === record.id)));
  assert.equal(first.cache, 'no-store, private');
  assert.equal((await call('?limit=51')).status, 400); assert.equal((await call('?status=administrator')).status, 400);
  assert.equal((await call('?q=%25')).data.total, 1);
  assert.equal((await call('?q=' + encodeURIComponent("' OR 1=1 --"))).data.total, 0);
  checks.push('bounded, private pagination and parameterized literal search');
  const id = 'AB-TEST-0';
  const detail = await call('?id=' + id); assert.equal(detail.data.request.id, id); assert.equal(detail.data.history.length, 0);
  const update = {id, status: 'in-review', expectedStatus: 'saved-preview'};
  assert.equal(detail.data.owner, 'owner-fixture');
  const switched = await call('', update, 'staff', 'http://inbox.test', 'another-account');
  assert.equal(switched.status, 409); assert.equal(switched.data.code, 'IDENTITY_CHANGED');
  assert.equal((await call('?id=' + id)).data.history.length, 0);
  assert.equal((await call('', update, 'staff', 'https://attacker.test')).status, 403);
  assert.equal((await call('', {...update, status: 'paid'})).status, 400);
  assert.equal((await call('', update)).status, 200);
  const changed = await call('?id=' + id);
  assert.equal(changed.data.request.status, 'in-review'); assert.equal(changed.data.history.length, 1);
  assert.equal(changed.data.history[0].oldStatus, 'saved-preview'); assert.equal(changed.data.history[0].actorEmail, 'staff@example.test');
  assert.equal((await call('', update)).status, 409);
  assert.equal((await call('?id=' + id)).data.history.length, 1);
  checks.push('owner/origin validation, allowed status updates and stale-write conflict');
  await db.prepare("CREATE TRIGGER refuse_test_audit BEFORE INSERT ON request_audit WHEN NEW.new_status='closed' BEGIN SELECT RAISE(ABORT, 'test audit failure'); END").run();
  assert.equal((await call('', {id, status: 'closed', expectedStatus: 'in-review'})).status, 503);
  assert.equal((await call('?id=' + id)).data.request.status, 'in-review');
  checks.push('status and audit rollback together on a database failure');
  const helper = await import('data:text/javascript;base64,' + Buffer.from(helperSource).toString('base64'));
  for (const value of ['=1+1', '+CMD', '-10+20', '@SUM(A1)', '  =SUM(A1)', '\t=HYPERLINK("evil")', '\n=1']) assert(helper.csvCell(value).startsWith('"\''));
  assert.equal(helper.csvCell('a,"b"'), '"a,""b"""');
  checks.push('CSV export neutralizes formulas and quotes field separators');
  console.log(JSON.stringify({passed: checks}, null, 2));
} finally {await mf.dispose();}
