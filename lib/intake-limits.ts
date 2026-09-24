import {isIP} from 'node:net';

const WINDOW_SECONDS = 3600;
export const IDENTITY_INTAKE_LIMIT = 20;
export const IP_INTAKE_LIMIT = 60;
async function digest(value: string) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function consumeIntakeAllowance(db: D1Database, request: Request, userId: string, now = Date.now()) {
  const seconds = Math.floor(now / 1000);
  const window = Math.floor(seconds / WINDOW_SECONDS) * WINDOW_SECONDS;
  const retryAfter = window + WINDOW_SECONDS - seconds;
  // Cloudflare overwrites this header on public Worker requests. Never accept
  // x-forwarded-for or a body-supplied address. Hashes rotate each window.
  const ip = request.headers.get('cf-connecting-ip')?.trim();
  const quotas = [{key: 'identity:' + await digest(window + ':' + userId), limit: IDENTITY_INTAKE_LIMIT}];
  if (ip && isIP(ip)) {
    const family = isIP(ip);
    // Canonicalize IPv6 spellings and share one quota across a /64 subnet.
    const canonical = family === 6 ? canonicalSubnet(ip) : ip;
    quotas.push({key: 'ip:' + await digest(window + ':' + canonical), limit: IP_INTAKE_LIMIT});
  }
  const results = await db.batch([
    db.prepare('DELETE FROM request_intake_limits WHERE window_start < ?').bind(window - WINDOW_SECONDS),
    ...quotas.map(quota => db.prepare('INSERT INTO request_intake_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = MIN(request_intake_limits.count + 1, 1000000) RETURNING count').bind(quota.key, window)),
  ]);
  return {allowed: quotas.every((quota, index) => Number((results[index + 1].results[0] as {count: number}).count) <= quota.limit), retryAfter};
}

function canonicalSubnet(ip: string) {
  const hostname = new URL('http://[' + ip + ']/').hostname.slice(1, -1);
  const [head, tail] = hostname.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = hostname.includes('::') ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  // An IPv4-mapped IPv6 address shares its IPv4 quota.
  if (groups.slice(0, 5).every(group => parseInt(group, 16) === 0) && parseInt(groups[5], 16) === 65535) {
    const high = parseInt(groups[6], 16), low = parseInt(groups[7], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
  }
  return groups.slice(0, 4).map(group => parseInt(group, 16).toString(16)).join(':') + '::/64';
}
