import { authReady } from '@/lib/auth';

export function GET() {
  return Response.json({ google: authReady(), emailPassword: false }, { headers: { 'Cache-Control': 'no-store' } });
}
