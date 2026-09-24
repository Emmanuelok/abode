'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { Download, Share2, WifiOff, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
const DISMISSED_KEY = 'abode-install-dismissed-at';
const DISMISS_FOR = 30 * 24 * 60 * 60 * 1000;
const IOS = 1;
const DISMISSED = 2;
const OFFLINE = 4;

// Primitive snapshots stay stable between browser events and match SSR initially.
function browserSnapshot() {
  const standalone = matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?: boolean}).standalone);
  let dismissed = standalone;
  try {dismissed ||= Date.now() - Number(localStorage.getItem(DISMISSED_KEY) || 0) < DISMISS_FOR;} catch {/* Storage is optional. */}
  const ios = !standalone && /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
  return (ios ? IOS : 0) | (dismissed ? DISMISSED : 0) | (!navigator.onLine ? OFFLINE : 0);
}
const serverSnapshot = () => DISMISSED;
function subscribeBrowser(listener: () => void) {
  const displayMode = matchMedia('(display-mode: standalone)');
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  window.addEventListener('storage', listener);
  displayMode.addEventListener('change', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
    window.removeEventListener('storage', listener);
    displayMode.removeEventListener('change', listener);
  };
}

export function PwaExperience() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const browser = useSyncExternalStore(subscribeBrowser, browserSnapshot, serverSnapshot);
  const ios = Boolean(browser & IOS);
  const offline = Boolean(browser & OFFLINE);
  const [ready, setReady] = useState(false);
  const [manuallyDismissed, setDismissed] = useState(false);
  const dismissed = manuallyDismissed || Boolean(browser & DISMISSED);
  const [instructions, setInstructions] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
        // Browsing remains available when a browser disables service workers.
      });
    }
    const timer = window.setTimeout(() => setReady(true), 12000);
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const onInstalled = () => { setPrompt(null); setDismissed(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* Storage may be disabled. */ }
  };
  const install = async () => {
    if (!prompt) { setInstructions(true); return; }
    setInstalling(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
      dismiss();
    } catch {
      setPrompt(null);
    } finally { setInstalling(false); }
  };

  return <>
    {offline && <div className="abode-offline-status" role="status"><WifiOff size={16} aria-hidden="true"/><span>You’re offline. Reconnect to browse and save changes.</span></div>}
    {ready && !dismissed && !offline && (prompt || ios) && <aside className="abode-install" aria-label="Install the Abode app">
      <button className="abode-install-close" aria-label="Dismiss app invitation" onClick={dismiss}><X size={17}/></button>
      <Image src="/icons/icon-192.png" width={48} height={48} alt="" unoptimized/>
      <div className="abode-install-copy">
        <p className="abode-install-kicker">A little closer to home</p>
        <h2>Make room for Abode.</h2>
        {instructions
          ? <p className="abode-install-instructions">Tap <Share2 size={14} aria-label="Share"/> Share in Safari, then <strong>Add to Home Screen</strong>.</p>
          : <><p>Your next home idea, one tap away.</p><button className="abode-install-action" disabled={installing} onClick={install}><Download size={14} aria-hidden="true"/>{installing ? 'Opening…' : 'Add to your home screen'}</button></>}
      </div>
    </aside>}
  </>;
}
