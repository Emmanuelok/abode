import {queryCatalog} from '@/lib/catalog';
export function GET(req:Request){return Response.json(queryCatalog(new URL(req.url).searchParams),{headers:{'Cache-Control':'public, max-age=300'}})}
