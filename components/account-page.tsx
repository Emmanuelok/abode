'use client';

import {useCallback, useEffect, useState, type FormEvent} from 'react';
import {ArrowRight, ArrowUpRight, Armchair, Check, Download, FileText, Heart, LoaderCircle, Save, Search, ShieldCheck, ShoppingBag} from 'lucide-react';
import {toast} from 'sonner';
import type {RequestRecord, SavedState} from '@/lib/types';
import {money} from '@/lib/taxonomy';
import {requestKindLabel, requestStatusLabel} from '@/lib/request-status';
import Link from './navigation';
import {api, useStore} from './store-context';
import {AccountSecurity, GuestAccountInvitation} from './auth-panel';
import {PageHeading, EmptyState} from './shop-ui';
import {Tabs, TabsContent, TabsList, TabsTrigger} from './ui/tabs';
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from './ui/table';
import {Dialog, DialogContent, DialogTitle, DialogDescription} from './ui/dialog';
import {downloadText} from './planner';

function ContactDetails({profile, accountEmail}: {profile: SavedState['profile']; accountEmail: string}) {
  const {save} = useStore();
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {if (await save('profile', draft)) toast.success('Contact details saved');} finally {setBusy(false);}
  }
  return <form className="profile-form" onSubmit={submit}><h2>Your details.</h2><p className="account-contact-note">Use the contact details you would like included with your enquiries.{accountEmail ? <> Your sign-in email is <strong>{accountEmail}</strong>; changing this form does not change your Google account.</> : ' These details do not create a sign-in account.'}</p><div className="form-grid">{([['name', 'Full name'], ['email', 'Contact email'], ['phone', 'Phone'], ['gps', 'GhanaPostGPS']] as const).map(([key, label]) => <label key={key}>{label}<input type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} autoComplete={key === 'name' ? 'name' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : undefined} value={draft[key]} onChange={event => setDraft(previous => ({...previous, [key]: event.target.value}))}/></label>)}<label className="full">Delivery address<textarea autoComplete="street-address" value={draft.address} onChange={event => setDraft(previous => ({...previous, address: event.target.value}))}/></label></div><button className="button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <Save size={18}/>}Save details</button></form>;
}

type RequestPayload = {name?: string; business?: string; email?: string; message?: string; items?: Array<{id: string; name: string; quantity: number; guidePrice: number}>};
function payloadOf(record: RequestRecord): RequestPayload {
  try {const parsed: unknown = JSON.parse(record.payload); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as RequestPayload : {};} catch {return {};}
}

export function AccountPage() {
  const {state, user, ready, flush, current} = useStore();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<RequestRecord | null>(null);
  const [filter, setFilter] = useState('');
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const loadRequests = useCallback(() => {setRequestsLoading(true); setRevision(value => value + 1);}, []);

  useEffect(() => {
    const controller = new AbortController();
    api('/api/requests', undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) {setRequests(data.requests); setError('');}
    }).catch(cause => {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Your enquiries could not be loaded.');}).finally(() => {if (!controller.signal.aborted) setRequestsLoading(false);});
    return () => controller.abort();
  }, [revision]);

  const name = (state.profile.name || user.name).trim().split(' ')[0];
  const filtered = requests.filter(record => `${record.id} ${record.kind} ${requestKindLabel(record.kind)} ${requestStatusLabel(record.status)}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const payload = selected ? payloadOf(selected) : null;

  async function exportAccount() {
    try {await flush(); downloadText('abode-my-data.json', JSON.stringify({account: user.signedIn ? {name: user.name, email: user.email} : null, state: current.current, requests}, null, 2), 'application/json');} catch {toast.error('Your latest changes could not be synchronized. Please retry your export.');}
  }

  return <main className="page-container account">
    <PageHeading eyebrow="YOUR LITTLE CORNER OF ABODE" title={name ? `Hello, ${name}.` : 'Make yourself at home.'} text={user.signedIn ? 'Your favourites, plans and enquiries, together wherever you feel at home.' : 'A place for your favourites, room plans and enquiries. Your guest selections are saved for this browser.'}/>
    {ready && !user.signedIn && <GuestAccountInvitation/>}
    {ready && user.signedIn && <div className="account-signed-in"><span><CloudCheck/>Signed in as <strong>{user.email}</strong></span>{user.staff && <Link href="/admin">Staff studio <ArrowUpRight size={16}/></Link>}</div>}
    <div className="account-stats"><Link href="/wishlist"><Heart/><strong>{state.wishlist.length}</strong><span>Saved favourites</span></Link><Link href="/planner"><Armchair/><strong>{state.plans.length}</strong><span>Room plans</span></Link><div><FileText/><strong>{requestsLoading ? '—' : requests.length}</strong><span>Saved enquiries</span></div><Link href="/cart"><ShoppingBag/><strong>{state.cart.reduce((total, item) => total + item.quantity, 0)}</strong><span>Items in your bag</span></Link></div>
    <Tabs defaultValue="requests"><TabsList><TabsTrigger value="requests">My enquiries</TabsTrigger><TabsTrigger value="address">Contact & address</TabsTrigger><TabsTrigger value="plans">Room plans</TabsTrigger>{user.signedIn && <TabsTrigger value="security">Sign-in & security</TabsTrigger>}<TabsTrigger value="privacy">Privacy & preferences</TabsTrigger></TabsList>
      <TabsContent value="requests"><div className="account-subheading"><h2>Your next chapter.</h2><button className="button outline compact" onClick={loadRequests} disabled={requestsLoading}>{requestsLoading ? 'Loading…' : 'Refresh enquiries'}</button><div className="inline-search"><Search size={16}/><input placeholder="Search reference, type or status" aria-label="Search saved enquiries" value={filter} onChange={event => setFilter(event.target.value)}/></div></div>
        {error ? <div className="error-banner">{error}<button onClick={loadRequests}>Try again</button></div> : requestsLoading ? <div className="request-loading" role="status">Loading your saved enquiries…</div> : !requests.length ? <EmptyState title="Good things are still to come." text="Saved quote requests and enquiries will appear here. No paid orders have been placed."/> : !filtered.length ? <div className="account-no-results"><p>No enquiries match “{filter}”.</p><button className="text-link" onClick={() => setFilter('')}>Show all enquiries</button></div> : <Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Enquiry</TableHead><TableHead>Saved on</TableHead><TableHead>Status</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{filtered.map(record => <TableRow key={record.id}><TableCell className="reference">{record.id}</TableCell><TableCell>{requestKindLabel(record.kind)}</TableCell><TableCell>{new Date(record.createdAt).toLocaleDateString('en-GB')}</TableCell><TableCell><span className={`status-pill customer-status-${record.status}`}>{requestStatusLabel(record.status)}</span></TableCell><TableCell><button className="text-link" onClick={() => setSelected(record)}>View <ArrowUpRight size={15}/></button></TableCell></TableRow>)}</TableBody></Table>}
        <div className="notice"><ShieldCheck size={22}/><p>Enquiries are saved privately and can be reviewed by authorised Abode staff. The status above reflects the saved record. No payment has been collected; automatic email, SMS and supplier notifications are not connected.</p></div>
      </TabsContent>
      <TabsContent value="address">{ready ? <ContactDetails key={user.email || 'guest'} profile={state.profile} accountEmail={user.signedIn ? user.email : ''}/> : <p role="status">Loading your saved details…</p>}</TabsContent>
      <TabsContent value="plans"><h2>Rooms in the making.</h2><div className="saved-plans-grid">{state.plans.map(plan => <div key={plan.id}><Armchair/><h3>{plan.name}</h3><p>{plan.width} × {plan.length} m · {plan.products.length} pieces</p><p>Guide budget {money(plan.budget)}</p><Link href="/planner" className="text-link">Open my plans <ArrowRight size={16}/></Link></div>)}</div>{!state.plans.length && <EmptyState title="Every good room starts with an idea." text="Create and save your first room plan." href="/planner" action="Plan my room"/>}</TabsContent>
      {user.signedIn && <TabsContent value="security"><AccountSecurity/></TabsContent>}
      <TabsContent value="privacy"><h2>Your information, your choices.</h2><p>Use the support form to record an access, correction or deletion request for the Abode team to review. There are no marketing emails, SMS notifications or third-party advertising trackers connected.</p><div className="form-actions"><button className="button outline" onClick={exportAccount}><Download size={17}/>Export my saved data</button><Link className="button" href="/support">Privacy support <ArrowRight size={17}/></Link></div><p className="small-note">Exports include the saved items and enquiries shown in this account, and may contain contact and address details. Keep them somewhere private.</p><Link className="text-link" href="/help/privacy">Read the privacy notice <ArrowUpRight size={16}/></Link></TabsContent>
    </Tabs>
    <Dialog open={Boolean(selected)} onOpenChange={open => {if (!open) setSelected(null);}}><DialogContent className="request-dialog"><DialogTitle>{selected?.id}</DialogTitle><DialogDescription>{selected ? requestStatusLabel(selected.status) : 'Saved enquiry'} · No payment collected</DialogDescription>{selected && payload && <div className="request-details"><h3>{requestKindLabel(selected.kind)}</h3><p>{payload.name || payload.business || payload.email}</p>{payload.message && <p>{payload.message}</p>}{Array.isArray(payload.items) && payload.items.map(item => <div key={item.id} className="summary-row"><span>{item.quantity} × {item.name}</span><strong>{money(item.guidePrice * item.quantity)}</strong></div>)}<div className="customer-request-progress"><span><Check size={17}/>Saved {new Date(selected.createdAt).toLocaleDateString('en-GB')}</span><strong>{requestStatusLabel(selected.status)}</strong><p>{selected.status === 'quoted' ? 'A staff member has marked this enquiry as quote prepared. Confirm the actual quote, availability and terms with Abode before proceeding.' : selected.status === 'awaiting-customer' ? 'A staff member has marked this enquiry as awaiting customer information. Use the support form and include this reference to add details.' : selected.status === 'closed' ? 'This enquiry has been marked closed by the Abode team. This does not confirm payment or delivery.' : 'This is a saved enquiry. Supplier availability, final prices and delivery arrangements still need to be confirmed.'}</p></div><button className="button outline" onClick={() => downloadText(`abode-${selected.id}.json`, JSON.stringify({...selected, payload}, null, 2), 'application/json')}><Download size={17}/>Download enquiry</button></div>}</DialogContent></Dialog>
  </main>;
}

function CloudCheck() {return <ShieldCheck size={16}/>;}
