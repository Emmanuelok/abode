'use client';
import React,{createContext,useContext,useMemo,useSyncExternalStore} from 'react';

const InitialLocation=createContext('/');
const subscribe=(listener:()=>void)=>{window.addEventListener('popstate',listener);window.addEventListener('abode:navigate',listener);return()=>{window.removeEventListener('popstate',listener);window.removeEventListener('abode:navigate',listener)}};
const snapshot=()=>window.location.pathname+window.location.search;
export function NavigationProvider({initialPath,children}:{initialPath:string;children:React.ReactNode}){return <InitialLocation.Provider value={initialPath}>{children}</InitialLocation.Provider>}
function useLocation(){const initial=useContext(InitialLocation);return useSyncExternalStore(subscribe,snapshot,()=>initial)}
export function usePathname(){return useLocation().split('?')[0]||'/'}
export function useSearchParams(){const url=useLocation();return useMemo(()=>new URLSearchParams(url.split('?')[1]||''),[url])}
export function navigate(href:string,replace=false){const url=new URL(href,window.location.href);if(url.origin!==window.location.origin){window.location.assign(url.href);return}const oldPath=window.location.pathname;window.history[replace?'replaceState':'pushState']({},'',url.pathname+url.search+url.hash);window.dispatchEvent(new Event('abode:navigate'));if(oldPath!==url.pathname)window.scrollTo({top:0,behavior:'instant'});if(url.hash)document.getElementById(url.hash.slice(1))?.scrollIntoView({behavior:'smooth'})}
const router={push:(href:string)=>navigate(href),replace:(href:string)=>navigate(href,true),back:()=>window.history.back()};
export function useRouter(){return router}
export default function Link({href,onClick,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||props.target==='_blank'||props.download)return;const url=new URL(href,window.location.href);if(url.origin!==window.location.origin||url.pathname.startsWith('/api/'))return;event.preventDefault();navigate(href)}}>{children}</a>}
