import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import ts from 'typescript';
import { betterAuth } from 'better-auth';
import { makeSignature } from 'better-auth/crypto';

// Real application SQL and auth options, real Better Auth native D1 adapter, and
// an ephemeral Miniflare database. No identity, session, or SQL mocks.
const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { Miniflare } = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const read = name => readFile(resolve(root, name), 'utf8');
async function importTs(name) {
  const source = ts.transpileModule(await read(name), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
const { claimGuest } = await importTs('lib/guest-claim.ts');
const { authOptions } = await importTs('lib/auth-config.ts');
const { EMPTY_STATE } = await importTs('lib/types.ts');
const state = patch => ({ ...structuredClone(EMPTY_STATE), ...patch });
const checks = [];
const mf = new Miniflare({ script: 'export default {fetch(){return new Response("Auth tests");}}', modules: true, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: { DB: 'abode-auth-tests' }, cf: false, inspectorPort: 0 });

try {
  const db = await mf.getD1Database('DB');
  for (const name of ['0000_confused_madame_web.sql', '0001_customer_auth.sql']) {
    for (const statement of (await read('drizzle/' + name)).replaceAll('--> statement-breakpoint', '').split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  const setState = (id, value) => db.prepare('INSERT INTO shopper_state(user_id,state,updated_at) VALUES(?,?,?)').bind(id, JSON.stringify(value), new Date().toISOString()).run();
  const getState = async id => { const row = await db.prepare('SELECT state FROM shopper_state WHERE user_id=?').bind(id).first(); return row ? JSON.parse(row.state) : null; };
  const requestOwner = async id => (await db.prepare('SELECT user_id FROM requests WHERE id=?').bind(id).first())?.user_id;
  const addRequest = (id, owner) => db.prepare('INSERT INTO requests(id,user_id,kind,status,payload,created_at) VALUES(?,?,?,?,?,?)').bind(id, owner, 'design', 'saved-preview', '{"message":"Private fixture"}', new Date().toISOString()).run();
  const claimRow = id => db.prepare('SELECT * FROM guest_claims WHERE guest_id=?').bind(id).first();

  const original = state({ cart: [{ id: 'sofa', quantity: 3 }], wishlist: ['chair'], profile: { name: 'Guest', phone: '0240000000', email: 'guest@example.test', address: 'Accra', gps: 'GA-001' }, city: 'Kumasi' });
  await setState('guest:empty-target', original);
  await addRequest('claim-request', 'guest:empty-target');
  await addRequest('other-request', 'guest:other');
  await claimGuest(db, 'guest:empty-target', 'user:first');
  assert.deepEqual(await getState('user:first'), original);
  assert.equal(await getState('guest:empty-target'), null);
  assert.equal(await requestOwner('claim-request'), 'user:first');
  assert.equal(await requestOwner('other-request'), 'guest:other');
  assert.equal((await claimRow('guest:empty-target')).user_id, 'user:first');
  checks.push('empty-account claim preserves state, transfers only owned requests and removes the old guest row');

  await claimGuest(db, 'guest:empty-target', 'user:first');
  await claimGuest(db, 'guest:empty-target', 'user:second');
  assert.deepEqual(await getState('user:first'), original);
  assert.equal(await getState('user:second'), null);
  assert.equal(await requestOwner('claim-request'), 'user:first');
  checks.push('repeated claims are idempotent and a second user cannot steal an already claimed guest');

  const target = state({
    cart: [{ id: 'shared', quantity: 80 }, { id: 'account-chair', quantity: 1 }],
    wishlist: ['shared', 'account-chair'], compare: ['one', 'two', 'three'], recent: ['recent-account'],
    plans: [{ id: 'shared-plan', name: 'Account plan', room: 'living', products: [], budget: 400, width: 4, length: 4 }],
    profile: { name: 'Account Name', phone: '', email: 'verified@example.test', address: '', gps: 'GA-ACCOUNT' },
    registry: { name: 'Account registry', date: '', items: ['account-gift'] }, city: 'Tema',
  });
  const guest = state({
    cart: [{ id: 'shared', quantity: 50 }, { id: 'guest-chair', quantity: 2 }],
    wishlist: ['shared', 'guest-chair'], compare: ['one', 'four', 'five'], recent: ['recent-guest', 'recent-account'],
    plans: [{ id: 'shared-plan', name: 'Guest replacement', room: 'living', products: [], budget: 1, width: 1, length: 1 }, { id: 'guest-plan', name: 'Guest plan', room: 'bedroom', products: [], budget: 500, width: 5, length: 5 }],
    profile: { name: 'Guest Name', phone: '0551111111', email: 'guest@example.test', address: 'Guest address', gps: '' },
    registry: { name: 'Guest registry', date: '2027-04-05', items: ['account-gift', 'guest-gift'] }, city: 'Kumasi',
  });
  await setState('user:existing', target); await setState('guest:merge', guest);
  await claimGuest(db, 'guest:merge', 'user:existing');
  const merged = await getState('user:existing');
  assert.deepEqual(merged.cart, [{ id: 'shared', quantity: 99 }, { id: 'account-chair', quantity: 1 }, { id: 'guest-chair', quantity: 2 }]);
  assert.deepEqual(merged.wishlist, ['shared', 'account-chair', 'guest-chair']);
  assert.deepEqual(merged.compare, ['one', 'two', 'three', 'four']);
  assert.deepEqual(merged.recent, ['recent-account', 'recent-guest']);
  assert.equal(merged.plans.length, 2); assert.equal(merged.plans[0].name, 'Account plan'); assert.equal(merged.plans[1].id, 'guest-plan');
  assert.deepEqual(merged.profile, { name: 'Account Name', phone: '0551111111', email: 'verified@example.test', address: 'Guest address', gps: 'GA-ACCOUNT' });
  assert.deepEqual(merged.registry, { name: 'Account registry', date: '2027-04-05', items: ['account-gift', 'guest-gift'] });
  assert.equal(merged.city, 'Tema');
  await claimGuest(db, 'guest:merge', 'user:existing');
  assert.deepEqual(await getState('user:existing'), merged);
  checks.push('existing-account merge unions selections, caps quantities, preserves account details/plans and fills blank fields once');

  const largeState = prefix => state({
    cart: Array.from({ length: 100 }, (_, i) => ({ id: prefix + i, quantity: 1 })),
    wishlist: Array.from({ length: 150 }, (_, i) => prefix + i), compare: Array.from({ length: 4 }, (_, i) => prefix + i), recent: Array.from({ length: 30 }, (_, i) => prefix + i),
    plans: Array.from({ length: 30 }, (_, i) => ({ id: prefix + i, name: prefix + i, room: 'living', products: [], budget: 100, width: 4, length: 4 })),
    registry: { name: prefix, date: '', items: Array.from({ length: 150 }, (_, i) => prefix + i) },
  });
  await setState('user:bounded', largeState('account-')); await setState('guest:bounded', largeState('guest-'));
  await claimGuest(db, 'guest:bounded', 'user:bounded');
  const bounded = await getState('user:bounded');
  for (const [key, limit] of Object.entries({ cart: 100, wishlist: 150, compare: 4, recent: 30, plans: 30 })) assert.equal(bounded[key].length, limit, key + ' limit');
  assert.equal(bounded.registry.items.length, 150);
  assert(bounded.cart.every(line => line.id.startsWith('account-')));
  checks.push('all merged arrays remain bounded and retain existing account selections first');

  await setState('user:blank-registry', state({ registry: { name: 'Our new home', date: '', items: [] } }));
  await setState('guest:registry', state({ registry: { name: 'Our wedding', date: '2027-01-01', items: ['gift'] } }));
  await claimGuest(db, 'guest:registry', 'user:blank-registry');
  assert.deepEqual((await getState('user:blank-registry')).registry, { name: 'Our wedding', date: '2027-01-01', items: ['gift'] });
  await addRequest('requests-only', 'guest:requests-only');
  await claimGuest(db, 'guest:requests-only', 'user:requests-only');
  assert.equal(await requestOwner('requests-only'), 'user:requests-only');
  checks.push('empty registry takes the guest label and guests without saved state still transfer their enquiries');

  await setState('guest:concurrent', state({ cart: [{ id: 'one-sofa', quantity: 2 }] }));
  await addRequest('concurrent-request', 'guest:concurrent');
  await Promise.all([claimGuest(db, 'guest:concurrent', 'user:contender-a'), claimGuest(db, 'guest:concurrent', 'user:contender-b')]);
  const winner = (await claimRow('guest:concurrent')).user_id;
  const loser = winner === 'user:contender-a' ? 'user:contender-b' : 'user:contender-a';
  assert.deepEqual((await getState(winner)).cart, [{ id: 'one-sofa', quantity: 2 }]);
  assert.equal(await getState(loser), null); assert.equal(await requestOwner('concurrent-request'), winner);
  checks.push('simultaneous claims by different accounts have exactly one winner');

  await setState('user:shared-target', state({ cart: [{ id: 'shared-sofa', quantity: 1 }] }));
  await setState('guest:tab-a', state({ cart: [{ id: 'shared-sofa', quantity: 2 }], wishlist: ['from-a'] }));
  await setState('guest:tab-b', state({ cart: [{ id: 'shared-sofa', quantity: 3 }], wishlist: ['from-b'] }));
  await Promise.all([claimGuest(db, 'guest:tab-a', 'user:shared-target'), claimGuest(db, 'guest:tab-b', 'user:shared-target')]);
  const sharedTarget = await getState('user:shared-target');
  assert.deepEqual(sharedTarget.cart, [{ id: 'shared-sofa', quantity: 6 }]);
  assert.deepEqual([...sharedTarget.wishlist].sort(), ['from-a', 'from-b']);
  checks.push('simultaneous guests merging into one account preserve both updates without lost quantities or selections');

  await setState('guest:rollback', original); await setState('user:rollback', target); await addRequest('rollback-request', 'guest:rollback');
  await db.prepare("CREATE TRIGGER reject_claim_delete BEFORE DELETE ON shopper_state WHEN OLD.user_id='guest:rollback' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END").run();
  await assert.rejects(claimGuest(db, 'guest:rollback', 'user:rollback'));
  assert.equal(await claimRow('guest:rollback'), null);
  assert.deepEqual(await getState('guest:rollback'), original); assert.deepEqual(await getState('user:rollback'), target);
  assert.equal(await requestOwner('rollback-request'), 'guest:rollback');
  await db.prepare('DROP TRIGGER reject_claim_delete').run();
  await claimGuest(db, 'guest:rollback', 'user:rollback');
  assert.equal(await requestOwner('rollback-request'), 'user:rollback');
  checks.push('failed batch rolls back claim, state merge and request ownership, then can retry safely');

  const origin = 'https://abode-auth.example.test';
  const secret = randomBytes(48).toString('base64url');
  const settings = { AUTH_URL: origin, BETTER_AUTH_SECRET: secret, GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'fixture-only-not-a-live-secret' };
  const createAuth = () => betterAuth({ ...authOptions(settings), database: db, logger: { level: 'error' } });
  const auth = createAuth();
  const context = await auth.$context;
  const account = await context.internalAdapter.createUser({ name: 'Signed-in customer', email: 'customer@example.test', emailVerified: true });
  const session = await context.internalAdapter.createSession(account.id, false);
  assert(session?.token); assert.equal(session.userId, account.id);
  assert(await db.prepare('SELECT id FROM auth_user WHERE id=?').bind(account.id).first());
  assert(await db.prepare('SELECT id FROM auth_session WHERE token=?').bind(session.token).first());
  const cookieName = context.authCookies.sessionToken.name;
  const signedCookie = async (token, signingSecret = secret) => `${cookieName}=${encodeURIComponent(token + '.' + await makeSignature(token, signingSecret))}`;
  const cookie = await signedCookie(session.token);
  const call = (path, { method = 'GET', body, cookie: sentCookie, from = origin, ip = '192.0.2.10', instance = auth } = {}) => instance.handler(new Request(origin + '/api/auth' + path, { method, headers: { Origin: from, 'Content-Type': 'application/json', 'cf-connecting-ip': ip, ...(sentCookie ? { Cookie: sentCookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }));
  const current = await call('/get-session', { cookie });
  assert.equal(current.status, 200); assert.equal((await current.json()).user.id, account.id);
  assert(cookieName.startsWith('__Secure-'));
  assert.equal(context.authCookies.sessionToken.attributes.httpOnly, true);
  assert.equal(context.authCookies.sessionToken.attributes.secure, true);
  assert.equal(context.authCookies.sessionToken.attributes.sameSite, 'lax');
  checks.push('native Better Auth D1 adapter creates users/sessions and validates real signed Secure HttpOnly cookies');

  for (const invalid of [undefined, `${cookieName}=${session.token}`, await signedCookie(session.token, 'wrong-secret-with-enough-length-for-test'), await signedCookie('nonexistent-session-token')]) {
    assert.equal(await (await call('/get-session', { cookie: invalid })).json(), null);
  }
  const forged = await auth.handler(new Request(origin + '/api/auth/get-session', { headers: { 'oai-authenticated-user-id': account.id, 'oai-authenticated-user-email': account.email, 'cf-connecting-ip': '192.0.2.11' } }));
  assert.equal(await forged.json(), null);
  const expired = await context.internalAdapter.createSession(account.id, false, { expiresAt: new Date(Date.now() - 10000) }, true);
  assert.equal(await (await call('/get-session', { cookie: await signedCookie(expired.token) })).json(), null);
  checks.push('unsigned, tampered, unknown, expired cookies and forged identity headers cannot authenticate');

  const deniedSignout = await call('/sign-out', { method: 'POST', body: {}, cookie, from: 'https://attacker.example' });
  assert.equal(deniedSignout.status, 403);
  assert.equal((await (await call('/get-session', { cookie })).json()).user.id, account.id);
  const signout = await call('/sign-out', { method: 'POST', body: {}, cookie });
  assert.equal(signout.status, 200);
  assert.equal(await db.prepare('SELECT id FROM auth_session WHERE token=?').bind(session.token).first(), null);
  assert.equal(await (await call('/get-session', { cookie })).json(), null);
  assert(signout.headers.get('set-cookie')?.includes('Max-Age=0'));
  checks.push('cross-origin sign-out is denied; valid sign-out revokes the database session and clears its cookie');

  const emailSignup = await call('/sign-up/email', { method: 'POST', body: { name: 'Blocked', email: 'blocked@example.test', password: 'NeverCreated123!' }, ip: '192.0.2.12' });
  assert.equal(emailSignup.status, 400);
  assert.equal(await db.prepare('SELECT id FROM auth_user WHERE email=?').bind('blocked@example.test').first(), null);
  const invalidCallback = await call('/sign-in/social', { method: 'POST', body: { provider: 'google', callbackURL: 'https://attacker.example/account' }, ip: '192.0.2.13' });
  assert.equal(invalidCallback.status, 403);
  const start = await call('/sign-in/social', { method: 'POST', body: { provider: 'google', callbackURL: origin + '/account' }, ip: '192.0.2.14' });
  assert.equal(start.status, 200);
  const authorization = new URL((await start.json()).url);
  assert.equal(authorization.hostname, 'accounts.google.com');
  assert.equal(authorization.searchParams.get('redirect_uri'), origin + '/api/auth/callback/google');
  assert(authorization.searchParams.get('state')); assert(authorization.searchParams.get('code_challenge'));
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  checks.push('password registration stays disabled, off-site OAuth callbacks are blocked, and Google initiation uses state and PKCE');

  for (let index = 0; index < 10; index++) {
    const response = await call('/sign-in/social', { method: 'POST', body: { provider: 'google', callbackURL: origin + '/account' }, ip: '192.0.2.99', instance: index < 5 ? auth : createAuth() });
    assert.equal(response.status, 200, 'sign-in ' + (index + 1));
  }
  const limited = await call('/sign-in/social', { method: 'POST', body: { provider: 'google', callbackURL: origin + '/account' }, ip: '192.0.2.99', instance: createAuth() });
  assert.equal(limited.status, 429);
  assert(Number(limited.headers.get('x-retry-after')) > 0);
  assert((await db.prepare('SELECT COUNT(*) AS count FROM auth_rate_limit').first()).count > 0);
  checks.push('social sign-in enforces the configured 10-per-minute database limit across fresh auth instances');
  console.log(JSON.stringify({ passed: checks }, null, 2));
} finally {
  await mf.dispose();
}
