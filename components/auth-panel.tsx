'use client';

import Image from 'next/image';
import {createAuthClient} from 'better-auth/react';
import {useEffect, useState} from 'react';
import {ArrowRight, ArrowUpRight, Check, Cloud, Heart, Laptop, LoaderCircle, LogOut, RefreshCw, ShieldCheck, Smartphone, Sparkles} from 'lucide-react';
import Link, {usePathname, useSearchParams} from './navigation';
import {api, notifyAccountChange, useStore} from './store-context';
import '@/app/auth.css';

const authClient = createAuthClient({basePath: '/api/auth'});
type AuthAvailability = {google: boolean; emailPassword: false};
type SessionSummary = {id: string; userAgent: string | null; createdAt: Date; expiresAt: Date; current: boolean};

function GoogleMark() {
  return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>;
}

export function GuestAccountInvitation() {
  return <section className="account-invitation"><div className="account-invitation-icon"><Cloud size={27}/></div><div><span className="eyebrow">MAKE IT YOURS, EVERYWHERE</span><h2>Your home ideas. All together.</h2><p>Sign in with Google to keep your saved pieces, room plans and enquiries with you across devices. Your selections from this browser come with you.</p></div><Link className="button" href="/signin">Sign in or create an account <ArrowRight size={17}/></Link></section>;
}

export function AuthPage() {
  const pathname = usePathname();
  const params = useSearchParams();
  const creating = pathname === '/signup';
  const destination = params.get('next') === '/admin' ? '/admin' : '/account';
  const {user, ready, flush} = useStore();
  const [availability, setAvailability] = useState<AuthAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    api('/api/auth-options', undefined, controller.signal)
      .then(options => {if (!controller.signal.aborted) {setAvailability(options); setAvailabilityError(false);}})
      .catch(() => {if (!controller.signal.aborted) {setAvailability(null); setAvailabilityError(true);}});
    return () => controller.abort();
  }, [revision]);

  async function continueWithGoogle() {
    if (busy || !availability?.google) return;
    setBusy(true); setError('');
    try {
      await flush();
      const result = await authClient.signIn.social({provider: 'google', callbackURL: destination, newUserCallbackURL: destination, errorCallbackURL: `/signin?error=oauth&next=${encodeURIComponent(destination)}`, disableRedirect: true});
      if (result.error || !result.data?.url) throw new Error('Google sign-in could not start. Please try again in a moment.');
      const url = new URL(result.data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') throw new Error('The secure sign-in connection could not be verified. Please try again.');
      window.location.assign(url.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not connect to Google. Please try again.');
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-editorial" aria-label="A home, beautifully yours">
      <Image src="/images/living-room.webp" alt="A warm living room with sculptural furniture and natural textures" width={1000} height={1200} unoptimized loading="eager"/>
      <span className="auth-editorial-kicker">ABODE AUSTRALIA · YOUR KIND OF HOME</span>
      <div className="auth-editorial-copy"><p className="eyebrow">GOOD THINGS BEGIN AT HOME</p><h1>A home,<br/><em>beautifully yours.</em></h1><p>A favourite chair. A softer landing.<br/>A little space to dream.</p></div>
      <div className="auth-editorial-note"><Heart size={19}/><span>Save the things that feel like you.</span></div>
    </section>
    <section className="auth-form-panel">
      <Link className="auth-back-link" href="/">Back to the collection <ArrowUpRight size={16}/></Link>
      <div className="auth-form-content">
        <span className="auth-house-icon"><Sparkles size={24}/></span><p className="eyebrow">YOUR LITTLE CORNER OF ABODE</p>
        {ready && user.signedIn ? <><h2>You’re home.</h2><p className="auth-intro">You’re signed in as <strong>{user.email}</strong>. Your next great room is waiting.</p><Link href={destination} className="button auth-continue-link">{destination === '/admin' ? 'Continue to the staff studio' : 'Go to my account'}<ArrowRight size={18}/></Link></> : <>
          <h2>{creating ? 'Make yourself at home.' : 'Welcome home.'}</h2>
          <p className="auth-intro">{creating ? 'One account for all your home ideas. Start your Abode story with Google.' : 'Pick up where you left off. Sign in or create your account with Google.'}</p>
          {params.get('signedOut') === '1' && <div className="auth-notice auth-success" role="status"><Check size={18}/><span>You’re signed out of Abode on this device.</span></div>}
          {(error || params.has('error')) && <div className="auth-notice auth-error" role="alert"><ShieldCheck size={19}/><span>{error || 'Sign-in wasn’t completed. Your account and saved items are unchanged. Please try again.'}</span></div>}
          <button className="google-signin-button" disabled={busy || !ready || !availability?.google} onClick={continueWithGoogle}>{busy ? <LoaderCircle size={20} className="spin"/> : <GoogleMark/>}<span>{busy ? 'Connecting securely…' : 'Continue with Google'}</span>{!busy && <ArrowRight size={18}/>}</button>
          {!availability && !availabilityError && <p className="auth-provider-note" role="status">Checking secure sign-in…</p>}
          {(availabilityError || availability && !availability.google) && <div className="auth-unavailable" role="status"><p>Google sign-in is temporarily unavailable. You can keep exploring and saving on this browser.</p><button onClick={() => {setAvailabilityError(false); setRevision(value => value + 1);}}><RefreshCw size={14}/>Check again</button></div>}
          <p className="auth-google-note">New here? Continuing creates your Abode account.<br/>Your Google password stays with Google.</p>
          <div className="auth-benefits"><div><Heart size={18}/><span>Keep your favourites<small>Your wishlist, ready whenever inspiration strikes.</small></span></div><div><Cloud size={19}/><span>Feel at home on any device<small>Bring your bag, room plans and gift list with you.</small></span></div><div><ShieldCheck size={19}/><span>Your own private space<small>Find your saved enquiries and manage your sessions.</small></span></div></div>
          <p className="auth-consent">By continuing, you agree to the <Link href="/help/terms">Abode terms</Link> and acknowledge the <Link href="/help/privacy">privacy notice</Link>.</p>
          <Link className="auth-guest-link" href="/shop">Keep exploring as a guest <ArrowRight size={15}/></Link>
        </>}
      </div>
      <div className="auth-form-foot"><ShieldCheck size={14}/><span>Secure sign-in · Thoughtfully made for your home</span></div>
    </section>
  </main>;
}

function deviceLabel(userAgent: string | null) {
  const agent = userAgent || '';
  const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Browser';
  const device = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Macintosh|Mac OS X/.test(agent) ? 'Mac' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : 'device';
  return `${browser} on ${device}`;
}

export function AccountSecurity() {
  const {user, flush} = useStore();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([authClient.getSession(), authClient.listSessions()]).then(([current, listing]) => {
      if (!active) return;
      if (current.error || listing.error || !current.data?.user || !listing.data) throw new Error('Your sessions could not be loaded. Please refresh and try again.');
      const currentSession = current.data;
      setVerifiedEmail(currentSession.user.emailVerified);
      setSessions(listing.data.map(session => ({id: session.id, userAgent: session.userAgent || null, createdAt: session.createdAt, expiresAt: session.expiresAt, current: session.id === currentSession.session.id})));
      setError('');
    }).catch(cause => {if (active) setError(cause instanceof Error ? cause.message : 'Your sessions could not be loaded.');}).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [revision]);

  async function signOut() {
    if (busy) return;
    setBusy('signout'); setError('');
    try {
      await flush();
      const result = await authClient.signOut();
      if (result.error) throw new Error('We could not sign you out. Please try again.');
      notifyAccountChange();
      // A full page load clears the previous customer's in-memory store and cache.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/signin?signedOut=1');
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'We could not sign you out. Please try again.'); setBusy('');}
  }

  async function revokeOthers() {
    if (busy) return;
    setBusy('revoke'); setError(''); setNotice('');
    try {
      await flush();
      const result = await authClient.revokeOtherSessions();
      if (result.error) throw new Error('Other sessions could not be ended. Try signing in again, then retry.');
      setSessions(previous => previous?.filter(session => session.current) || []);
      setNotice('You’re now signed out of Abode on your other devices. This session stays open.');
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Other sessions could not be ended.');} finally {setBusy('');}
  }

  return <section className="account-security">
    <div className="security-identity"><span className="security-avatar">{(user.name || user.email).slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">YOUR GOOGLE ACCOUNT</span><h2>{user.name || 'Your Abode account'}</h2><p>{user.email}{verifiedEmail && <span className="verified-email"><ShieldCheck size={13}/>Verified</span>}</p></div>{user.staff && <Link className="button outline compact" href="/admin">Open staff studio <ArrowUpRight size={16}/></Link>}</div>
    <p className="security-intro">Google handles your sign-in and account recovery. Your saved Abode collection stays with your account when you sign out.</p>
    {error && <div className="auth-notice auth-error" role="alert"><ShieldCheck size={18}/><span>{error}</span></div>}{notice && <div className="auth-notice auth-success" role="status"><Check size={18}/><span>{notice}</span></div>}
    <div className="security-session-heading"><div><h3>Your active sessions</h3><p>Review where your Abode account is signed in.</p></div><button className="text-link" disabled={loading || Boolean(busy)} onClick={() => {setLoading(true); setRevision(value => value + 1);}}><RefreshCw size={15}/>Refresh</button></div>
    {loading ? <p className="auth-provider-note" role="status">Loading your sessions…</p> : sessions ? <div className="security-sessions">{sessions.map(session => <div className="security-session" key={session.id}>{/iPhone|iPad|Android/.test(session.userAgent || '') ? <Smartphone size={23}/> : <Laptop size={23}/>}<div><strong>{deviceLabel(session.userAgent)}</strong><span>Signed in {new Date(session.createdAt).toLocaleDateString('en-GB')} · Expires {new Date(session.expiresAt).toLocaleDateString('en-GB')}</span></div>{session.current && <span className="current-session">This device</span>}</div>)}</div> : null}
    <div className="security-actions"><button className="button outline" disabled={Boolean(busy) || !sessions?.some(session => !session.current)} onClick={revokeOthers}>{busy === 'revoke' ? <LoaderCircle size={17} className="spin"/> : <ShieldCheck size={17}/>}Sign out other devices</button><button className="button" disabled={Boolean(busy)} onClick={signOut}>{busy === 'signout' ? <LoaderCircle size={17} className="spin"/> : <LogOut size={17}/>}Sign out of Abode</button></div>
    <p className="small-note">Signing out of Abode does not sign you out of your Google account.</p>
  </section>;
}
