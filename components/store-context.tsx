'use client';
import React,{createContext,useContext,useEffect,useRef,useState,useCallback} from 'react';
import {toast} from 'sonner';
import {EMPTY_STATE,Product,SavedState} from '@/lib/types';
export type StoreUser={email:string;name:string;signedIn:boolean;staff:boolean};
let identityReady=false;
let identityOwner:string|null=null;
let identityChanged=false;
let identityRequest:Promise<any>|null=null;
const accountChangeKey='abode:account-change';

function invalidateIdentity():never {
 identityReady=false;identityOwner=null;identityChanged=true;
 if(typeof window!=='undefined'){
  window.dispatchEvent(new Event('abode:identity-changed'));
  window.location.reload();
 }
 throw new Error('Your sign-in changed. Reloading your account to keep saved information separate.');
}
export function notifyAccountChange(){
 try{localStorage.setItem(accountChangeKey,crypto.randomUUID())}catch{/* Focus checks and server owner checks remain active when storage is disabled. */}
}
export async function api(path:string,body?:unknown,signal?:AbortSignal){
 if(identityChanged)throw new Error('Your account is changing. Please wait for the page to reload.');
 if(path==='/api/state'&&body===undefined){
  if(!identityRequest)identityRequest=request(path).then(data=>{
   if(typeof data.owner!=='string'||!data.owner)throw new Error('Your saved items could not be identified. Please refresh and try again.');
   if(identityOwner&&identityOwner!==data.owner)invalidateIdentity();
   if(identityChanged)throw new Error('Your account is changing. Please wait for the page to reload.');
   identityOwner=data.owner;identityReady=true;return data;
  }).finally(()=>{identityRequest=null});
  return identityRequest;
 }
 const privatePath=path==='/api/state'||path.startsWith('/api/requests')||path.startsWith('/api/admin/');
 if(privatePath){
  if(identityRequest)await identityRequest;
  if(!identityReady)await api('/api/state');
  if(identityChanged)throw new Error('Your account is changing. Please wait for the page to reload.');
 }
 return request(path,body,signal,privatePath&&body!==undefined?identityOwner:undefined);
}
async function request(path:string,body?:unknown,signal?:AbortSignal,owner?:string|null){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 try{const r=await fetch(path,{method:body!==undefined?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Accept':'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(owner?{'X-Abode-Owner':owner}:{})},body:body!==undefined?JSON.stringify(body):undefined});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw new Error('The connection was interrupted. Please retry; your entries are unchanged.')}
 if(r.status===409&&data.code==='IDENTITY_CHANGED')invalidateIdentity();
 if(!r.ok)throw new Error(data.error||'This request could not be completed. Please retry.');return data;
 }catch(error){if(controller.signal.aborted&&!signal?.aborted)throw new Error('The connection took too long. Please try again.');throw error}finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort)}
}
const catalogCache=new Map<string,any>();
export function useCatalog(query:string){const [result,setResult]=useState<{query:string;data:any}>({query,data:catalogCache.get(query)||null});const [error,setError]=useState('');const [revision,setRevision]=useState(0);useEffect(()=>{if(query==='limit=0'){setResult({query,data:{items:[]}});return}const c=new AbortController();setError('');const cached=catalogCache.get(query);if(cached){setResult({query,data:cached});return}setResult({query,data:null});api('/api/catalog?'+query,undefined,c.signal).then(data=>{if(c.signal.aborted)return;if(!data||(!Array.isArray(data.items)&&!Object.hasOwn(data,'product')))throw new Error('The collection response was incomplete. Please retry.');if(catalogCache.size>180)catalogCache.clear();catalogCache.set(query,data);setResult({query,data})}).catch(e=>{if(!c.signal.aborted)setError(e.message||'The collection could not load. Please retry.')});return()=>c.abort()},[query,revision]);return {data:result.query===query?result.data:catalogCache.get(query)||null,error,retry:()=>{catalogCache.delete(query);setRevision(x=>x+1)}}}
const Context=createContext<any>(null);
export function StoreProvider({children}:{children:React.ReactNode}){
 const [state,setState]=useState<SavedState>(EMPTY_STATE),[ready,setReady]=useState(false),[error,setError]=useState(''),[user,setUser]=useState<StoreUser>({email:'',name:'',signedIn:false,staff:false}),[lastAdded,setLastAdded]=useState<Product|null>(null);const current=useRef(state);const confirmed=useRef(state);const queue=useRef(Promise.resolve());const revisions=useRef<Record<string,number>>({});const loaded=useRef(false);const loading=useRef<Promise<boolean>|null>(null);
 const reload=useCallback(async()=>{if(loading.current)return loading.current;loading.current=(async()=>{try{const r=await api('/api/state');if(!r.state||!Array.isArray(r.state.cart))throw new Error('Saved selections could not be read. Please retry.');current.current={...EMPTY_STATE,...r.state};confirmed.current=current.current;setState(current.current);setUser(r.user);loaded.current=true;setError('');return true}catch(e){setError((e as Error).message);return false}finally{setReady(true);loading.current=null}})();return loading.current},[]);useEffect(()=>{reload()},[reload]);
 useEffect(()=>{
  const check=()=>{if(document.visibilityState==='visible'&&!identityChanged)void api('/api/state').catch(()=>{/* Mutations still enforce the last established owner on the server. */})};
  const clear=()=>{loaded.current=false;current.current=EMPTY_STATE;confirmed.current=EMPTY_STATE;setState(EMPTY_STATE);setUser({email:'',name:'',signedIn:false,staff:false});setError('Your sign-in changed. Reloading your account…')};
  const changed=(event:StorageEvent)=>{if(event.key===accountChangeKey){try{invalidateIdentity()}catch{/* The full reload is already in progress. */}}};
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);window.addEventListener('storage',changed);window.addEventListener('abode:identity-changed',clear);
  return()=>{window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);window.removeEventListener('storage',changed);window.removeEventListener('abode:identity-changed',clear)};
 },[]);
 const save=useCallback(async(key:keyof SavedState,value:any)=>{if(!loaded.current&&!await reload()){toast.error('Could not connect to your saved items',{description:'Use Retry connection above. Your current form stays open.'});return false}const previous=current.current[key];const next=typeof value==='function'?value(previous):value;const rev=(revisions.current[key]||0)+1;revisions.current[key]=rev;current.current={...current.current,[key]:next};setState(current.current);let ok=true;queue.current=queue.current.catch(()=>{}).then(async()=>{try{const r=await api('/api/state',{key,value:next});confirmed.current={...confirmed.current,[key]:r.value};if(revisions.current[key]===rev){current.current={...current.current,[key]:r.value};setState(current.current)}setError('')}catch(e){if(revisions.current[key]===rev){current.current={...current.current,[key]:confirmed.current[key]};setState(current.current)}setError((e as Error).message);toast.error('This change was not saved',{description:(e as Error).message});ok=false}});await queue.current;return ok},[reload]);
 const flush=useCallback(async()=>{if(loading.current)await loading.current;if(!loaded.current&&!await reload())throw new Error('Your saved items could not be synchronized. Please retry before signing in or out.');await api('/api/state');let pending:Promise<void>;do{pending=queue.current;await pending}while(pending!==queue.current)},[reload]);
 const add=useCallback(async(p:Product,quantity=1)=>{const ok=await save('cart',(cart:SavedState['cart'])=>{const list=cart.map(x=>({...x}));const line=list.find(x=>x.id===p.id);if(line)line.quantity=Math.min(99,line.quantity+quantity);else list.push({id:p.id,quantity});return list});if(ok){setLastAdded(p);toast.success('Added to your bag',{description:p.name.slice(0,75)})}return ok},[save]);
 const toggle=useCallback(async(key:'wishlist'|'compare',id:string)=>{if(!loaded.current&&!await reload())return;const old=current.current[key];if(key==='compare'&&!old.includes(id)&&old.length>=4){toast.error('Compare up to four items. Remove one to add another.');return}const removing=old.includes(id);if(await save(key,removing?old.filter(x=>x!==id):[...old,id]))toast.success(removing?'Item removed':key==='wishlist'?'Saved to your wishlist':'Added to comparison')},[save,reload]);
 useEffect(()=>{const context=(document as any).modelContext;if(!context?.registerTool||!ready)return;const lifecycle=new AbortController();const register=(tool:any)=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}};
 register({name:'search_abode_products',title:'Search Abode products',description:'Search the illustrated home collection. Prices are planning guides, not supplier quotes.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async(input:any)=>{if(typeof input.query!=='string'||input.query.length>120)throw new Error('Provide a search query under 120 characters');const r=await api('/api/catalog?q='+encodeURIComponent(input.query)+'&limit=8');return {total:r.total,items:r.items.map((p:Product)=>({id:p.id,name:p.name,guidePriceAUD:p.price,pricingStatus:p.pricingStatus,url:'/product/'+p.id}))}}});
 register({name:'add_abode_item_to_bag',title:'Add an item to the bag',description:'Save a catalog item in the shopping bag. Does not place an order or make a payment.',inputSchema:{type:'object',properties:{productId:{type:'string'},quantity:{type:'integer',minimum:1,maximum:99}},required:['productId','quantity'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:any)=>{if(typeof input.productId!=='string'||!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>99)throw new Error('Invalid product or quantity');const r=await api('/api/catalog?id='+encodeURIComponent(input.productId));if(!r.product)throw new Error('Product not found');await add(r.product,input.quantity);return {cart:current.current.cart}}});return()=>lifecycle.abort()},[ready,add]);
 return <Context.Provider value={{state,save,add,toggle,ready,error,user,reload,flush,current,lastAdded,setLastAdded}}>{children}</Context.Provider>
}
export const useStore=()=>useContext(Context) as {state:SavedState;save:(key:keyof SavedState,value:any)=>Promise<boolean>;add:(p:Product,q?:number)=>Promise<boolean>;toggle:(key:'wishlist'|'compare',id:string)=>Promise<void>;ready:boolean;error:string;user:StoreUser;reload:()=>Promise<boolean>;flush:()=>Promise<void>;current:React.RefObject<SavedState>;lastAdded:Product|null;setLastAdded:(p:Product|null)=>void};
