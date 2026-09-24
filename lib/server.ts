import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
export function database(){if(!env.DB) throw new Error('Database unavailable');return env.DB}
// Standalone Workers do not have Sites' trusted identity proxy. Never accept
// caller-supplied oai-* headers as authentication on the public deployment.
export async function identity(){const jar=await cookies();let token=jar.get('abode_guest')?.value;if(!token||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(token)){token=crypto.randomUUID();jar.set('abode_guest',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:60*60*24*365,path:'/'});}return {id:'guest:'+token,email:'',signedIn:false}}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');const site=new URL(request.url);if(origin&&new URL(origin).host!==site.host)throw new Error('Origin not permitted')}
export function fail(error:unknown){console.error('Abode request failed',error instanceof Error?error.message:'unknown');return Response.json({error:'We could not save or load this right now. Please try again. Your form is still here.'},{status:503})}
