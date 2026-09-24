/**
 * LOCAL QA ONLY. Never imported by the Worker or emitted to public assets.
 * Uses the compiled application with fresh in-memory D1/R2 and synthetic users.
 * No credentials, data or configuration are read from a deployed account.
 */
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import ts from 'typescript';
import {betterAuth} from 'better-auth';
import {makeSignature} from 'better-auth/crypto';

const ROOT = resolve(import.meta.dirname, '..');
const HOST = '127.0.0.1';
const PORT = 8792;
const ORIGIN = `http://${HOST}:${PORT}`;
const require = createRequire(import.meta.url);
const {Miniflare, Response: LocalResponse} = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const read = name => readFile(resolve(ROOT, name), 'utf8');
async function importTs(name) {
  const source = ts.transpileModule(await read(name), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
const {authOptions} = await importTs('lib/auth-config.ts');
const {EMPTY_STATE} = await importTs('lib/types.ts');
const settings = {AUTH_URL: ORIGIN, BETTER_AUTH_SECRET: randomBytes(48).toString('base64url')};
const ownerEmail = 'owner.qa@example.test';
const files = (await readdir(resolve(ROOT, 'dist/server'), {recursive: true})).filter(path => path.endsWith('.js')).sort((a, b) => a === 'index.js' ? -1 : b === 'index.js' ? 1 : 0);
if (!files.includes('index.js')) throw new Error('Build the application before starting local QA.');
const modules = await Promise.all(files.map(async path => ({type: 'ESModule', path: resolve(ROOT, 'dist/server', path), contents: await read('dist/server/' + path)})));
const mf = new Miniflare({
  modules, modulesRoot: resolve(ROOT, 'dist/server'), compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
  bindings: {...settings, ADMIN_EMAILS: ownerEmail},
  d1Databases: {DB: 'ephemeral-local-auth-qa'}, r2Buckets: {GALLERY: 'ephemeral-local-gallery-qa'},
  assets: {directory: resolve(ROOT, 'dist/client'), binding: 'ASSETS', routerConfig: {has_user_worker: true}},
  // Avoid remote metadata and deny application fetches to the external network.
  cf: false, inspectorPort: 0, outboundService: () => new LocalResponse('External network disabled in LOCAL QA.', {status: 503}),
});
let server;
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  if (server) {server.closeAllConnections();await new Promise(resolve => server.close(resolve));}
  await mf.dispose();
  console.log('LOCAL QA stopped. Ephemeral users, sessions and database discarded.');
}
try {
  const db = await mf.getD1Database('DB');
  for (const name of (await readdir(resolve(ROOT, 'drizzle'))).filter(name => /^\d+_.+\.sql$/.test(name)).sort()) {
    for (const sql of (await read('drizzle/' + name)).replaceAll('--> statement-breakpoint', '').split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(sql).run();
  }
  const auth = betterAuth({...authOptions(settings), database: db, logger: {level: 'error'}});
  const context = await auth.$context;
  const customer = await context.internalAdapter.createUser({name: 'QA · Ama Mensah', email: 'ama.qa@example.test', emailVerified: true});
  const owner = await context.internalAdapter.createUser({name: 'QA · Abode Owner', email: ownerEmail, emailVerified: true});
  const users = {customer, owner};
  const catalog = JSON.parse(await read('lib/catalog-data.json'));
  const picks = catalog.filter(product => ['living-room', 'dining', 'bedroom'].includes(product.department)).slice(0, 4);
  if (!picks.length) picks.push(...catalog.slice(0, 4));
  const state = {...structuredClone(EMPTY_STATE), wishlist: picks.slice(0, 3).map(product => product.id), cart: [{id: picks[0].id, quantity: 2}], profile: {name: customer.name, email: customer.email, phone: '0241234567', address: 'QA fixture only · Example address, Accra', gps: 'GA-123-4567'}};
  await db.prepare('INSERT INTO shopper_state(user_id,state,updated_at) VALUES(?,?,?)').bind('user:' + customer.id, JSON.stringify(state), new Date().toISOString()).run();
  const fixtures = [
    {id: 'AB-QA-DESIGN', kind: 'design', status: 'new', payload: {name: 'QA · Ama Mensah', email: customer.email, phone: '0241234567', city: 'Accra', message: 'LOCAL QA — We are planning a calm living room with warm wood and seating for four. Please review a layout and sourcing brief. This is a synthetic test enquiry.', category: 'Living room', budget: '18000', quantity: '1', date: '2026-12-01'}},
    {id: 'AB-QA-QUOTE', kind: 'order-quote', status: 'in-review', payload: {name: 'QA · Ama Mensah', email: customer.email, phone: '0241234567', address: 'QA fixture only · Example address, Accra', city: 'Accra', items: [{id: picks[0].id, name: picks[0].name, quantity: 2, guidePrice: picks[0].price}], guideSubtotal: picks[0].price * 2, pricing: 'illustrative', paymentStatus: 'not-collected', notes: 'LOCAL QA — Synthetic quote. Do not contact, charge or fulfil.'}},
    {id: 'AB-QA-TRADE', kind: 'trade', status: 'awaiting-customer', payload: {name: 'QA · Kojo Studio', email: 'trade.qa@example.test', business: 'QA Example Guesthouse', city: 'Kumasi', message: 'LOCAL QA — A synthetic furnishing brief for six guest rooms. We are comparing neutral finishes and durable seating. Do not contact or fulfil.', budget: '65000', quantity: '6', category: 'Hospitality furnishing'}},
  ];
  await db.batch(fixtures.map((fixture, index) => db.prepare('INSERT INTO requests(id,user_id,kind,status,payload,created_at) VALUES(?,?,?,?,?,?)').bind(fixture.id, 'user:' + customer.id, fixture.kind, fixture.status, JSON.stringify(fixture.payload), new Date(Date.now() - index * 3600000).toISOString())));
  await db.prepare('INSERT INTO request_audit(id,request_id,actor_id,actor_email,old_status,new_status,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), 'AB-QA-QUOTE', 'user:' + owner.id, owner.email, 'new', 'in-review', new Date().toISOString()).run();
  // A second synthetic device enables the real session-management UI to be tested.
  await context.internalAdapter.createSession(customer.id, false, {userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/128.0 LOCAL-QA-SECOND-DEVICE'});
  const authCookieNames = new Set([context.authCookies.sessionToken.name, ...Object.values(context.authCookies).map(cookie => cookie.name)]);
  function clearedCookies(request) {
    const names = new Set(['abode_guest', ...authCookieNames]);
    for (const part of (request.headers.cookie || '').split(';')) {
      const name = part.split('=')[0].trim();
      if (/^(?:__Secure-|__Host-)?abode[._]/.test(name)) names.add(name);
    }
    return [...names].filter(name => /^[a-zA-Z0-9_.-]+$/.test(name)).map(name => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${name.startsWith('__Secure-') || name.startsWith('__Host-') ? '; Secure' : ''}`);
  }
  const launcher = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Abode · LOCAL QA</title><style>body{background:#f4f5ee;color:#234a39;font:16px system-ui;margin:0;padding:8vh 24px}main{max-width:620px;margin:auto;background:white;border:1px solid #dce3d5;border-radius:16px;padding:36px}small{letter-spacing:2px;font-weight:700;color:#8b5932}h1{font:38px Georgia;margin:20px 0}p{line-height:1.7;color:#6c7865}form{display:inline-block;margin:10px 8px 0 0}button{padding:13px 18px;border:0;border-radius:6px;background:#244e3c;color:#fff;font:600 14px system-ui;cursor:pointer}a{color:#315e45}code{font-size:13px}footer{border-top:1px solid #e4e9de;margin-top:25px;padding-top:18px;font-size:12px;color:#7e896e}</style><main><small>LOCAL QA · EPHEMERAL DATA</small><h1>Choose a test perspective.</h1><p>The real compiled Abode application, isolated on this computer. These accounts and three enquiries are synthetic. Nothing is sent to Cloudflare or Google.</p><form method="post" action="/__qa/session?role=customer"><button>Customer account</button></form><form method="post" action="/__qa/session?role=owner"><button>Owner inbox</button></form><form method="post" action="/__qa/session?role=guest"><button>Guest session</button></form><p><a href="/">Open the storefront</a> · <a href="/signin">Inspect Google sign-in</a></p><footer>Google keys are intentionally absent. The Google button should be unavailable. Return to <code>/__qa/</code> to switch accounts. Restarting discards all QA state.</footer></main></html>`;
  server = createServer(async (request, response) => {
    try {
      if (request.headers.host !== `${HOST}:${PORT}` || !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) {
        response.writeHead(403, {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'});response.end('LOCAL QA accepts loopback requests only.');return;
      }
      const url = new URL(request.url || '/', ORIGIN);
      if (url.origin !== ORIGIN) {response.writeHead(403);response.end('Invalid local origin.');return;}
      if (url.pathname.startsWith('/__qa/')) {
        if (request.headers.origin && request.headers.origin !== ORIGIN || request.headers['sec-fetch-site'] === 'cross-site') {response.writeHead(403);response.end('Cross-site access to LOCAL QA is not allowed.');return;}
        if (url.pathname === '/__qa/' && request.method === 'GET') {response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});response.end(launcher);return;}
        if (url.pathname === '/__qa/session' && request.method === 'POST') {
          const role = url.searchParams.get('role');
          if (!['customer', 'owner', 'guest'].includes(role)) {response.writeHead(400);response.end('Choose a known QA role.');return;}
          const cookies = clearedCookies(request);
          if (role !== 'guest') {
            const session = await context.internalAdapter.createSession(users[role].id, false, {userAgent: request.headers['user-agent'] || 'LOCAL-QA-BROWSER'});
            if (!session?.token) throw new Error('Local fixture session could not be created.');
            const signed = encodeURIComponent(session.token + '.' + await makeSignature(session.token, settings.BETTER_AUTH_SECRET));
            cookies.push(`${context.authCookies.sessionToken.name}=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
          }
          response.writeHead(303, {'Location': role === 'owner' ? '/admin' : '/account', 'Set-Cookie': cookies, 'Cache-Control': 'no-store'});response.end();return;
        }
        response.writeHead(404, {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'});response.end('Unknown LOCAL QA action.');return;
      }
      const forwarded = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (['host', 'connection', 'content-length', 'transfer-encoding', 'cf-connecting-ip'].includes(name) || value === undefined) continue;
        if (Array.isArray(value)) value.forEach(item => forwarded.append(name, item));else forwarded.set(name, value);
      }
      forwarded.set('cf-connecting-ip', HOST);
      forwarded.set('accept-encoding', 'identity');
      let body;
      if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
        const chunks = [];let bytes = 0;
        for await (const chunk of request) {bytes += chunk.length;if (bytes > 2_000_000) {response.writeHead(413);response.end('LOCAL QA request is too large.');return;}chunks.push(chunk);}
        body = Buffer.concat(chunks);
      }
      const result = await mf.dispatchFetch(url.href, {method: request.method || 'GET', headers: forwarded, body});
      response.statusCode = result.status;
      result.headers.forEach((value, name) => {if (name.toLowerCase() !== 'set-cookie' && !['content-encoding', 'content-length', 'transfer-encoding'].includes(name.toLowerCase())) response.setHeader(name, value);});
      const resultCookies = result.headers.getSetCookie();
      if (resultCookies.length) response.setHeader('Set-Cookie', resultCookies);
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
      console.error('LOCAL QA request failed:', error instanceof Error ? error.message : 'Unknown error');
      if (!response.headersSent) response.writeHead(500, {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'});
      response.end('LOCAL QA request failed. Inspect the terminal for the non-secret error.');
    }
  });
  await new Promise((resolve, reject) => {server.once('error', reject);server.listen(PORT, HOST, resolve);});
  console.log(`LOCAL QA ready: ${ORIGIN}/__qa/ — ephemeral D1, synthetic customer/owner, 3 test enquiries; no Google keys or external network.`);
  process.once('SIGINT', () => {void stop().finally(() => process.exit(0));});
  process.once('SIGTERM', () => {void stop().finally(() => process.exit(0));});
} catch (error) {
  await stop();
  throw error;
}
