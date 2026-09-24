import Storefront from '@/components/storefront';
import { pageMetadata } from '@/lib/seo';
type PageProps = { params: Promise<{ path: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params, searchParams }: PageProps) {
  const [p, q] = await Promise.all([params, searchParams]);
  const catalogueFilters = new Set(['q', 'page', 'sort', 'min', 'max', 'color', 'material', 'brand', 'department', 'subcategory']);
  return pageMetadata(p.path, Object.keys(q || {}).some(key => catalogueFilters.has(key)));
}
export default async function Page({params,searchParams}:any){const p=await params;const q=await searchParams;const search=new URLSearchParams();for(const [key,value] of Object.entries(q||{}))if(value!==undefined)search.set(key,String(value));return <Storefront initialPath={'/'+(p?.path||[]).join('/')+(search.size?'?'+search.toString():'')}/>;}
