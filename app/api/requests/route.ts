import {ZodError} from 'zod';
import {database, identity, sameOrigin, fail, HttpError, assertOwner} from '@/lib/server';
import {prepareIntake} from '@/lib/request-validation';
import {consumeIntakeAllowance} from '@/lib/intake-limits';

const headers = {'Cache-Control': 'no-store, private'};
const MAX_REQUEST_BYTES = 50000;
async function readBody(request: Request) {
  const length = request.headers.get('content-length');
  if (length && Number(length) > MAX_REQUEST_BYTES) throw new HttpError(413, 'Please shorten your request.');
  if (request.headers.get('content-type')?.toLowerCase().split(';')[0].trim() !== 'application/json') throw new HttpError(415, 'Send your enquiry as JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Your enquiry is empty.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > MAX_REQUEST_BYTES) {await reader.cancel();throw new HttpError(413, 'Please shorten your request.');}
      chunks.push(result.value);
    }
  } finally {reader.releaseLock();}
  const joined = new Uint8Array(size);
  let offset = 0;for (const chunk of chunks) {joined.set(chunk, offset);offset += chunk.byteLength;}
  try {return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(joined));} catch {throw new HttpError(400, 'Your enquiry could not be read. Please check the form and try again.');}
}

export async function GET() {
  try {
    const user = await identity();
    const rows = await database().prepare('SELECT id, kind, status, payload, created_at AS createdAt FROM requests WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100').bind(user.id).all();
    return Response.json({requests: rows.results}, {headers});
  } catch (error) {return fail(error);}
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const data = prepareIntake(await readBody(request));
    const user = await identity();
    assertOwner(request, user.id);
    const db = database();
    const allowance = await consumeIntakeAllowance(db, request, user.id);
    if (!allowance.allowed) return Response.json({error: 'Several enquiries have been saved recently. Please try again later.'}, {status: 429, headers: {...headers, 'Retry-After': String(allowance.retryAfter)}});
    const id = 'AB-' + crypto.randomUUID().toUpperCase();
    const createdAt = new Date().toISOString();
    const inserted = await db.prepare('INSERT INTO requests (id, user_id, kind, status, payload, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM guest_claims WHERE guest_id = ?)').bind(id, user.id, data.kind, 'new', JSON.stringify(data.payload), createdAt, user.id).run();
    if (!inserted.meta.changes) throw new HttpError(409, 'Your sign-in changed. Reload Abode before saving again.', 'IDENTITY_CHANGED');
    return Response.json({ok: true, id, status: 'new', createdAt, message: 'Your enquiry is saved for review. No payment was taken, no order was placed and no external messages were sent.'}, {status: 201, headers});
  } catch (error) {
    if (error instanceof ZodError) return Response.json({error: error.issues[0]?.message || 'Check the details in your enquiry.'}, {status: 400, headers});
    return fail(error);
  }
}
