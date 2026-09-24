'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {ArrowRight, Check, ChevronLeft, ChevronRight, Download, FileText, Inbox, LoaderCircle, RefreshCw, Search, ShieldCheck, SlidersHorizontal} from 'lucide-react';
import Link from './navigation';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from './ui/dialog';
import {STAFF_REQUEST_STATUSES, REQUEST_STATUS_LABELS, requestKindLabel, requestStatusLabel, csvCell} from '@/lib/request-status';
import '../app/admin-inbox.css';

type Summary = {id: string; kind: string; status: string; createdAt: string; customerName: string; email: string};
type RecordDetail = Omit<Summary, 'customerName' | 'email'> & {payload: string};
type Audit = {id: string; actorEmail: string; oldStatus: string; newStatus: string; createdAt: string};
type Listing = {requests: Summary[]; total: number; page: number; limit: number; counts: Record<string, number>};
type Detail = {request: RecordDetail; history: Audit[]; owner: string};
type ListingResult = {key: string; data: Listing | null; error: string; denied: number};
type DetailResult = {key: string; data: Detail | null; error: string};
class InboxError extends Error {constructor(message: string, public status: number) {super(message);}}
async function inboxRequest<T>(path: string, body?: unknown, signal?: AbortSignal, owner?: string): Promise<T> {
  const response = await fetch('/api/admin/requests' + path, {method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', signal, headers: {'Accept': 'application/json', ...(body === undefined ? {} : {'Content-Type': 'application/json', 'X-Abode-Owner': owner || ''})}, body: body === undefined ? undefined : JSON.stringify(body)});
  const data = await response.json().catch(() => ({error: 'The inbox could not connect. Please try again.'}));
  if (response.status === 409 && data && typeof data === 'object' && 'code' in data && data.code === 'IDENTITY_CHANGED') {window.location.reload();throw new InboxError('Your sign-in changed. Reloading your workspace…', 409);}
  if (!response.ok) {const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'This request could not be completed.'; throw new InboxError(message, response.status);}
  return data as T;
}
function dateTime(value: string) {return new Date(value).toLocaleString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra'});}
function Status({status}: {status: string}) {return <span className={'inbox-status inbox-status-' + status}><i aria-hidden="true"/>{requestStatusLabel(status)}</span>;}
function exportPage(data: Listing) {
  const headings = ['Reference', 'Enquiry type', 'Customer', 'Email', 'Status', 'Saved at (UTC)'];
  const rows = data.requests.map(record => [record.id, requestKindLabel(record.kind), record.customerName, record.email, requestStatusLabel(record.status), record.createdAt]);
  const csv = '\uFEFF' + [headings, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'abode-enquiries-page-' + data.page + '.csv'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AdminInboxPage() {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [listingResult, setListingResult] = useState<ListingResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailResult, setDetailResult] = useState<DetailResult | null>(null);
  const [saveError, setSaveError] = useState<{key: string; message: string} | null>(null);
  const [detailRevision, setDetailRevision] = useState(0);
  const [nextStatus, setNextStatus] = useState('new');
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const listingKey = JSON.stringify([query, status, page, revision]);
  const currentListing = listingResult?.key === listingKey ? listingResult : null;
  const listing = currentListing?.data || null;
  const busy = !currentListing;
  const error = currentListing?.error || '';
  const denied = currentListing?.denied || 0;
  const detailKey = JSON.stringify([selectedId, detailRevision]);
  const currentDetail = selectedId && detailResult?.key === detailKey ? detailResult : null;
  const detail = currentDetail?.data || null;
  const detailBusy = Boolean(selectedId) && !currentDetail;
  const detailError = currentDetail?.error || (saveError?.key === detailKey ? saveError.message : '');
  const saved = savedKey === detailKey;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({q: query, status, page: String(page), limit: '25'});
    inboxRequest<Listing>('?' + params, undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) setListingResult({key: listingKey, data: result, error: '', denied: 0});
    }).catch(error => {
      if (!controller.signal.aborted) setListingResult({key: listingKey, data: null, error: error.message, denied: error.status === 401 || error.status === 403 ? error.status : 0});
    });
    return () => controller.abort();
  }, [query, status, page, listingKey]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    inboxRequest<Detail>('?id=' + encodeURIComponent(selectedId), undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) {setDetailResult({key: detailKey, data: result, error: ''}); setNextStatus(result.request.status === 'saved-preview' ? 'new' : result.request.status);}
    }).catch(error => {
      if (!controller.signal.aborted) setDetailResult({key: detailKey, data: null, error: error.message});
    });
    return () => controller.abort();
  }, [selectedId, detailKey]);

  function openDetail(id: string) {setSelectedId(id); setDetailRevision(value => value + 1); setSaveError(null); setSavedKey(null);}
  function search(event: FormEvent) {event.preventDefault(); setPage(1); setQuery(draft.trim());}
  async function saveStatus(event: FormEvent) {
    event.preventDefault(); if (!detail || saving) return;
    setSaving(true); setSaveError(null); setSavedKey(null);
    try {
      const updated = await inboxRequest<{status: string}>('', {id: detail.request.id, status: nextStatus, expectedStatus: detail.request.status}, undefined, detail.owner);
      const refreshed = await inboxRequest<Detail>('?id=' + encodeURIComponent(detail.request.id));
      setDetailResult({key: detailKey, data: refreshed, error: ''}); setNextStatus(updated.status); setSavedKey(detailKey); setRevision(value => value + 1);
    } catch (error) {setSaveError({key: detailKey, message: (error as Error).message});} finally {setSaving(false);}
  }
  const counts = listing?.counts || {};
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const unread = (counts.new || 0) + (counts['saved-preview'] || 0);
  const pages = listing ? Math.max(1, Math.ceil(listing.total / listing.limit)) : 1;
  let payload: Record<string, unknown> = {};
  try {if (detail) {const parsed = JSON.parse(detail.request.payload); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed;}} catch {/* An old malformed record remains readable through its reference and history. */}

  return <main className="page-container admin-inbox">
    <header className="inbox-heading">
      <div><span className="inbox-staff-badge"><ShieldCheck size={14}/> ABODE · STAFF STUDIO</span><h1>Every enquiry.<br/><em>A thoughtful next step.</em></h1><p>A considered workspace for your customers’ plans, questions and new beginnings.</p></div>
      <div className="inbox-heading-actions"><Link href="/account" className="text-link">My account <ArrowRight size={16}/></Link><button className="button outline compact" onClick={() => setRevision(value => value + 1)} disabled={busy}><RefreshCw size={16} className={busy ? 'spin' : ''}/>Refresh inbox</button></div>
    </header>
    {denied ? <section className="inbox-locked"><ShieldCheck size={36}/><h2>{denied === 401 ? 'Your staff workspace awaits.' : 'A private space for the Abode team.'}</h2><p>{error}</p><Link href={denied === 401 ? '/signin?next=/admin' : '/account'} className="button">{denied === 401 ? 'Sign in to continue' : 'Return to my account'}<ArrowRight size={17}/></Link></section> : <>
      <div className="inbox-metrics" aria-label="Enquiry overview"><Metric icon={<Inbox size={20}/>} label="All enquiries" value={busy ? '—' : total}/><Metric icon={<FileText size={20}/>} label="Ready for review" value={busy ? '—' : unread}/><Metric icon={<SlidersHorizontal size={20}/>} label="In progress" value={busy ? '—' : (counts['in-review'] || 0) + (counts['awaiting-customer'] || 0)}/><Metric icon={<Check size={20}/>} label="Closed" value={busy ? '—' : counts.closed || 0}/></div>
      <section className="inbox-workspace" aria-label="Customer enquiries">
        <div className="inbox-tools"><form onSubmit={search} className="inbox-search"><Search size={19}/><input aria-label="Search enquiry reference, customer or email" placeholder="Reference, customer or email…" maxLength={120} value={draft} onChange={event => setDraft(event.target.value)}/><button type="submit">Search</button></form><label className="inbox-filter"><span>Status</span><select value={status} onChange={event => {setStatus(event.target.value); setPage(1);}}><option value="all">All statuses</option>{Object.entries(REQUEST_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="inbox-export" disabled={!listing?.requests.length || busy} onClick={() => listing && exportPage(listing)}><Download size={17}/>Export this page</button></div>
        <div className="inbox-list-caption"><h2>The conversation starts here.</h2><span>{listing ? listing.total + ' matching ' + (listing.total === 1 ? 'enquiry' : 'enquiries') : 'Loading your workspace…'}</span></div>
        {error ? <div className="inbox-feedback" role="alert"><p>{error}</p><button className="text-link" onClick={() => setRevision(value => value + 1)}>Try again <RefreshCw size={15}/></button></div> : busy ? <div className="inbox-feedback" role="status"><LoaderCircle size={25} className="spin"/><p>Gathering your enquiries…</p></div> : listing?.requests.length ? <div className="inbox-table-scroll"><table className="inbox-table"><thead><tr><th>Enquiry</th><th>Customer</th><th>Saved · Ghana time</th><th>Status</th><th><span className="sr-only">Open enquiry</span></th></tr></thead><tbody>{listing.requests.map(record => <tr key={record.id}><td><strong>{requestKindLabel(record.kind)}</strong><span className="inbox-reference">{record.id}</span></td><td><strong>{record.customerName || 'Abode customer'}</strong><span>{record.email}</span></td><td><time dateTime={record.createdAt}>{dateTime(record.createdAt)}</time></td><td><Status status={record.status}/></td><td><button className="inbox-open" aria-label={'Open enquiry ' + record.id} onClick={() => openDetail(record.id)}>View <ArrowRight size={16}/></button></td></tr>)}</tbody></table></div> : <div className="inbox-feedback"><Inbox size={32}/><h3>{query || status !== 'all' ? 'A little space to refine your search.' : 'The next good conversation is on its way.'}</h3><p>{query || status !== 'all' ? 'Try another customer, reference or status.' : 'Saved customer enquiries will appear here, ready for your review.'}</p>{(query || status !== 'all') && <button className="text-link" onClick={() => {setDraft(''); setQuery(''); setStatus('all'); setPage(1);}}>Clear filters <ArrowRight size={15}/></button>}</div>}
        <div className="inbox-pagination"><span>Page {page} of {pages}</span><div><button aria-label="Previous page" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={18}/>Previous</button><button aria-label="Next page" disabled={busy || page >= pages} onClick={() => setPage(value => value + 1)}>Next<ChevronRight size={18}/></button></div></div>
      </section>
      <div className="inbox-footnote"><ShieldCheck size={19}/><p>This workspace records internal progress. Status changes do not send messages, issue a binding quote or collect a payment. CSV exports contain customer information; keep them private.</p></div>
    </>}
    <Dialog open={!!selectedId} onOpenChange={open => {if (!open && !saving) setSelectedId(null);}}><DialogContent className="inbox-dialog"><DialogTitle>{selectedId || 'Enquiry details'}</DialogTitle><DialogDescription>Customer enquiry · Internal review</DialogDescription>
      {detailBusy ? <div className="inbox-feedback" role="status"><LoaderCircle className="spin"/><p>Opening enquiry…</p></div> : <>
        {detailError && <div className="inbox-detail-error" role="alert"><p>{detailError}</p><button className="text-link" disabled={saving} onClick={() => setDetailRevision(value => value + 1)}>Refresh details <RefreshCw size={15}/></button></div>}
        {detail && <><div className="inbox-detail-title"><div><p className="eyebrow">{requestKindLabel(detail.request.kind)}</p><h2>{typeof payload.name === 'string' && payload.name || typeof payload.business === 'string' && payload.business || 'A new possibility.'}</h2><time dateTime={detail.request.createdAt}>{dateTime(detail.request.createdAt)} · Ghana time</time></div><Status status={detail.request.status}/></div>
          <dl className="inbox-payload">{Object.entries(payload).filter(([key, value]) => key !== 'items' && value !== '' && value !== null && value !== undefined).map(([key, value]) => <div key={key} className={key === 'message' || key === 'address' || typeof value === 'object' ? 'inbox-payload-full' : ''}><dt>{key.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ')}</dt><dd>{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</dd></div>)}</dl>
          {Array.isArray(payload.items) && payload.items.length > 0 && <section className="inbox-request-items"><h3>Requested pieces</h3>{payload.items.map((item, index) => {const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}; return <div key={index}><span>{String(record.quantity || 1)} × {String(record.name || record.id || 'Reference item')}</span>{typeof record.guidePrice === 'number' && <strong>GH₵ {record.guidePrice.toLocaleString('en-GH')} <small>guide / each</small></strong>}</div>;})}</section>}
          <form className="inbox-status-form" onSubmit={saveStatus}><div><label htmlFor="staff-enquiry-status">Next step</label><p>Record an internal update for the team.</p></div><select id="staff-enquiry-status" value={nextStatus} onChange={event => {setNextStatus(event.target.value); setSavedKey(null);}} disabled={saving}>{STAFF_REQUEST_STATUSES.map(value => <option key={value} value={value}>{REQUEST_STATUS_LABELS[value]}</option>)}</select><button className="button compact" type="submit" disabled={saving || nextStatus === detail.request.status}>{saving ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>}Save status</button>{saved && <span className="inbox-saved" role="status"><Check size={15}/>Status recorded</span>}</form>
          <section className="inbox-history"><h3>A clear trail.</h3>{detail.history.length ? <ol>{detail.history.map(entry => <li key={entry.id}><span className="inbox-history-dot"/><div><strong>{requestStatusLabel(entry.oldStatus)} <ArrowRight size={13}/> {requestStatusLabel(entry.newStatus)}</strong><p>{entry.actorEmail} · {dateTime(entry.createdAt)}</p></div></li>)}</ol> : <p>No status updates yet. The first review starts with you.</p>}</section>
          <p className="inbox-detail-note">Saved as an enquiry. Availability, final prices and fulfilment remain subject to confirmation.</p>
        </>}
      </>}
    </DialogContent></Dialog>
  </main>;
}
function Metric({icon, label, value}: {icon: React.ReactNode; label: string; value: number | string}) {return <div className="inbox-metric"><span>{icon}</span><div><strong>{value}</strong><p>{label}</p></div></div>;}
