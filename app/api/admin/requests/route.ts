import {database, identity, sameOrigin, fail, assertOwner} from '@/lib/server';
import {STAFF_REQUEST_STATUSES, REQUEST_STATUS_LABELS} from '@/lib/request-status';

const noStore = {'Cache-Control': 'no-store, private'};
const json = (body: unknown, status = 200) => Response.json(body, {status, headers: noStore});
const knownStatus = (value: string) => Object.hasOwn(REQUEST_STATUS_LABELS, value);
const validId = (value: unknown): value is string => typeof value === 'string' && /^AB-[a-zA-Z0-9-]{1,80}$/.test(value);

export async function GET(req: Request) {
  try {
    const user = await identity();
    if (!user.signedIn) return json({error: 'Sign in to access the staff inbox.'}, 401);
    if (!('staff' in user && user.staff)) return json({error: 'This inbox is available to authorised staff only.'}, 403);
    const db = database();
    const params = new URL(req.url).searchParams;
    const id = params.get('id');
    if (id !== null) {
      if (!validId(id)) return json({error: 'Invalid enquiry reference.'}, 400);
      const record = await db.prepare('SELECT id, kind, status, payload, created_at AS createdAt FROM requests WHERE id = ?').bind(id).first();
      if (!record) return json({error: 'This enquiry could not be found.'}, 404);
      const audit = await db.prepare('SELECT id, actor_email AS actorEmail, old_status AS oldStatus, new_status AS newStatus, created_at AS createdAt FROM request_audit WHERE request_id = ? ORDER BY created_at DESC, id DESC LIMIT 50').bind(id).all();
      return json({request: record, history: audit.results, owner: user.id});
    }
    const query = (params.get('q') || '').trim();
    const status = params.get('status') || 'all';
    const page = Number(params.get('page') || '1');
    const limit = Number(params.get('limit') || '25');
    if (query.length > 120 || !Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || (status !== 'all' && !knownStatus(status))) {
      return json({error: 'Check the search, status or page selection.'}, 400);
    }
    const clauses: string[] = [];
    const bindings: string[] = [];
    if (status !== 'all') {clauses.push('status = ?'); bindings.push(status);}
    if (query) {
      const match = '%' + query.replace(/[\\%_]/g, '\\$&') + '%';
      clauses.push("(id LIKE ? ESCAPE '\\' OR kind LIKE ? ESCAPE '\\' OR json_extract(payload, '$.name') LIKE ? ESCAPE '\\' OR json_extract(payload, '$.email') LIKE ? ESCAPE '\\' OR json_extract(payload, '$.business') LIKE ? ESCAPE '\\')");
      bindings.push(match, match, match, match, match);
    }
    const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    const [rows, count, totals] = await Promise.all([
      db.prepare("SELECT id, kind, status, created_at AS createdAt, coalesce(json_extract(payload, '$.name'), json_extract(payload, '$.business'), '') AS customerName, coalesce(json_extract(payload, '$.email'), '') AS email FROM requests" + where + ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?').bind(...bindings, limit, (page - 1) * limit).all(),
      db.prepare('SELECT count(*) AS total FROM requests' + where).bind(...bindings).first<{total: number}>(),
      db.prepare('SELECT status, count(*) AS count FROM requests GROUP BY status').all<{status: string; count: number}>(),
    ]);
    return json({requests: rows.results, total: count?.total || 0, page, limit, counts: Object.fromEntries(totals.results.map(row => [row.status, row.count]))});
  } catch (error) {return fail(error);}
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await identity();
    if (!user.signedIn) return json({error: 'Sign in to access the staff inbox.'}, 401);
    if (!('staff' in user && user.staff)) return json({error: 'This inbox is available to authorised staff only.'}, 403);
    assertOwner(req, user.id);
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({error: 'Send this update as JSON.'}, 415);
    const text = await req.text();
    if (text.length > 2000) return json({error: 'This update is too large.'}, 413);
    let body: {id?: unknown; status?: unknown; expectedStatus?: unknown};
    try {body = JSON.parse(text);} catch {return json({error: 'Invalid update.'}, 400);}
    if (!body || !validId(body.id) || typeof body.status !== 'string' || !STAFF_REQUEST_STATUSES.some(status => status === body.status) || typeof body.expectedStatus !== 'string' || !knownStatus(body.expectedStatus)) return json({error: 'Check the enquiry and selected status.'}, 400);
    if (body.status === body.expectedStatus) return json({error: 'Choose a different status to record an update.'}, 400);
    const db = database();
    const now = new Date().toISOString();
    const auditId = crypto.randomUUID();
    // D1 batch is transactional. Compare-and-set prevents one staff member silently
    // overwriting a newer decision; the audit insert and update succeed together.
    const results = await db.batch([
      db.prepare('INSERT INTO request_audit (id, request_id, actor_id, actor_email, old_status, new_status, created_at) SELECT ?, id, ?, ?, status, ?, ? FROM requests WHERE id = ? AND status = ?').bind(auditId, user.id, user.email, body.status, now, body.id, body.expectedStatus),
      db.prepare('UPDATE requests SET status = ? WHERE id = ? AND status = ?').bind(body.status, body.id, body.expectedStatus),
    ]);
    if (!results[1].meta.changes) {
      const current = await db.prepare('SELECT status FROM requests WHERE id = ?').bind(body.id).first<{status: string}>();
      return current ? json({error: 'This enquiry was updated elsewhere. Refresh its details before saving.', status: current.status}, 409) : json({error: 'This enquiry could not be found.'}, 404);
    }
    return json({ok: true, id: body.id, status: body.status, updatedAt: now});
  } catch (error) {return fail(error);}
}
