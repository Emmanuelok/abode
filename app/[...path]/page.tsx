import Storefront from '@/components/storefront';
export default async function Page({params,searchParams}:any){const p=await params;const q=await searchParams;const search=new URLSearchParams();for(const [key,value] of Object.entries(q||{}))if(value!==undefined)search.set(key,String(value));return <Storefront initialPath={'/'+(p?.path||[]).join('/')+(search.size?'?'+search.toString():'')}/>;}
