import {env} from 'cloudflare:workers';
import {cookies,headers} from 'next/headers';
export function database(){if(!env.DB) throw new Error('Database unavailable');return env.DB}
export async function identity(){const h=await headers();const id=h.get('oai-authenticated-user-id');const email=h.get('oai-authenticated-user-email');if(id&&email)return {id:'account:'+id,email,signedIn:true};const jar=await cookies();let token=jar.get('abode_guest')?.value;if(!token||!/^[a-f0-9-]{36}$/.test(token)){token=crypto.randomUUID();jar.set('abode_guest',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:60*60*24*365,path:'/'});}return {id:'guest:'+token,email:'',signedIn:false}}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');const site=new URL(request.url);if(origin&&new URL(origin).host!==site.host)throw new Error('Origin not permitted')}
export function fail(error:unknown){console.error('Abode request failed',error instanceof Error?error.message:'unknown');return Response.json({error:'We could not save or load this right now. Please try again. Your form is still here.'},{status:503})}
