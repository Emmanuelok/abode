import { auth } from '@/lib/auth';
import { fail, sameOrigin } from '@/lib/server';

async function handle(request: Request) {
  try {
    if (request.method === 'POST') sameOrigin(request);
    const response = await auth().handler(request);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('Pragma', 'no-cache');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers });
  } catch (error) { return fail(error); }
}

export const GET = handle;
export const POST = handle;
