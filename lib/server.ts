import { env } from 'cloudflare:workers';
import { cookies, headers } from 'next/headers';
import { auth, isStaff } from './auth';
import { claimGuest } from './guest-claim';

export function database() { if (!env.DB) throw new Error('Database unavailable'); return env.DB; }
const validGuest = (token?: string): token is string => Boolean(token && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(token));

export async function identity() {
  const jar = await cookies();
  let token = jar.get('abode_guest')?.value;
  // Neither oai-* headers nor editable profile details can grant identity/roles.
  if (env.BETTER_AUTH_SECRET) {
    const session = await auth().api.getSession({ headers: await headers() });
    if (session?.user) {
      const user = session.user;
      const id = 'user:' + user.id;
      if (validGuest(token)) {
        await claimGuest(database(),'guest:' + token,id);
        jar.delete('abode_guest');
      }
      return { id, email:user.email, name:user.name, signedIn:true, staff:isStaff(user.email,user.emailVerified) };
    }
  }
  if (validGuest(token)) {
    const claimed = await database().prepare('SELECT 1 FROM guest_claims WHERE guest_id=?').bind('guest:' + token).first();
    if (claimed) token=undefined;
  }
  if (!validGuest(token)) {
    token=crypto.randomUUID();
    jar.set('abode_guest',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:60*60*24*365,path:'/'});
  }
  return { id:'guest:'+token, email:'', name:'', signedIn:false, staff:false };
}

export class HttpError extends Error { constructor(public status:number,message:string,public code?:string) { super(message); } }
// A tab must never submit its in-memory customer data under a different
// account's shared cookies after another tab signs in/out or revokes a session.
export function assertOwner(request:Request,userId:string) {
  if(request.headers.get('x-abode-owner')!==userId) throw new HttpError(409,'Your sign-in changed. Reload Abode before saving again.','IDENTITY_CHANGED');
}
export function sameOrigin(request:Request) {
  const origin=request.headers.get('origin');
  if (origin && origin!==new URL(request.url).origin) throw new HttpError(403,'This request must come from Abode.');
  if (request.headers.get('sec-fetch-site')==='cross-site') throw new HttpError(403,'This request must come from Abode.');
}
export function fail(error:unknown) {
  if (error instanceof HttpError) return Response.json({error:error.message,...(error.code?{code:error.code}:{})},{status:error.status,headers:{'Cache-Control':'no-store'}});
  console.error('Abode request failed',error instanceof Error?error.message:'unknown');
  return Response.json({error:'We could not save or load this right now. Please try again. Your form is still here.'},{status:503,headers:{'Cache-Control':'no-store'}});
}
