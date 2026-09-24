'use client';

import Image from 'next/image';
import {useEffect, useRef, useState, type CSSProperties, type KeyboardEvent} from 'react';
import {ArrowRight, ArrowUpRight, Check, ChevronDown, Heart, MapPin, Menu, Plus, Search, ShoppingBag, Sparkles, UserRound, X} from 'lucide-react';
import catalogSummary from '@/lib/catalog-summary.json';
import {cities, departments, slugify} from '@/lib/taxonomy';
import {getDepartmentStyle} from '@/lib/department-style';
import {collectionImage, departmentImage} from '@/lib/navigation-images';
import type {Product} from '@/lib/types';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from './ui/dialog';
import {Sheet, SheetContent, SheetDescription, SheetTitle} from './ui/sheet';
import Link, {useRouter} from './navigation';
import {useCatalog, useStore} from './store-context';
import {Choice} from './shop-ui';
import '@/app/navigation-upgrade.css';

const featuredDepartments = ['living-room', 'bedroom', 'dining', 'outdoor', 'lighting', 'rugs', 'decor', 'kitchen'];
const matchesDepartment = (department: typeof departments[number], query: string) =>
  `${department.name} ${department.groups.flatMap(group => group.items).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase());

function NavigationThumbnail({src, className = ''}: {src: string; className?: string}) {
  return <span className={`nav-thumbnail ${className}`}><Image src={src} alt="" width={160} height={160} unoptimized loading="lazy"/></span>;
}

function CollectionLink({department, name}: {department: string; name: string}) {
  const slug = slugify(name);
  const image = collectionImage(department, slug);
  return <Link className="visual-collection-link" href={`/shop/${department}/${slug}`}>
    <NavigationThumbnail src={image.image}/>
    <span><strong>{name}</strong><small>{image.count.toLocaleString('en-GH')} finds</small></span>
    <ArrowUpRight size={15} aria-hidden="true"/>
  </Link>;
}

export default function Header() {
  const {state, save} = useStore();
  const [menu, setMenu] = useState('');
  const [mobile, setMobile] = useState(false);
  const [location, setLocation] = useState(false);
  const [city, setCity] = useState(state.city);
  const [search, setSearch] = useState('');
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [departmentQuery, setDepartmentQuery] = useState('');
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const tabButtons = useRef(new Map<string, HTMLButtonElement>());
  const router = useRouter();

  useEffect(() => {
    const close = () => {setMenu(''); setMobile(false); setSearch(''); setDepartmentQuery('');};
    window.addEventListener('abode:navigate', close);
    window.addEventListener('popstate', close);
    return () => {
      window.removeEventListener('abode:navigate', close);
      window.removeEventListener('popstate', close);
    };
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => setSuggestionQuery(search.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMenu('');
      menuButton.current?.focus();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);

  const {data: suggestions, error: suggestionError} = useCatalog(suggestionQuery.length > 2 ? `q=${encodeURIComponent(suggestionQuery)}&limit=5` : 'limit=0');
  const visibleDepartments = departments.filter(department => matchesDepartment(department, departmentQuery));
  const selected = visibleDepartments.find(department => department.slug === menu) || visibleDepartments[0];
  const selectedStyle = getDepartmentStyle(selected?.slug);
  const searchIsCurrent = suggestionQuery === search.trim();

  function changeTab(event: KeyboardEvent<HTMLButtonElement>, slug: string) {
    const index = visibleDepartments.findIndex(department => department.slug === slug);
    let nextIndex = index;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % visibleDepartments.length;
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + visibleDepartments.length) % visibleDepartments.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = visibleDepartments.length - 1;
    else if (event.key === 'ArrowRight') {
      event.preventDefault();
      menuPanel.current?.querySelector<HTMLAnchorElement>('.visual-mega-content a')?.focus();
      return;
    } else return;
    event.preventDefault();
    const next = visibleDepartments[nextIndex].slug;
    setMenu(next);
    tabButtons.current.get(next)?.focus();
  }

  return <>
    <div className="announcement"><span className="announcement-intro">WELCOME TO A NEW WAY OF LIVING.</span><Link href="/rooms">Explore the room edit <ArrowRight size={14}/></Link></div>
    <header className="header">
      <button className="mobile-menu icon-button" aria-label="Open departments" onClick={() => {setDepartmentQuery(''); setMobile(true);}}><Menu/></button>
      <Link className="wordmark" href="/" aria-label="Abode home">abode<span>.</span></Link>
      <div className="search-wrap">
        <form onSubmit={event => {event.preventDefault(); router.push(`/shop?q=${encodeURIComponent(search.trim())}`); setSearch('');}} className="search" role="search">
          <Search size={20} aria-hidden="true"/>
          <input aria-label="Search products" aria-controls={search.trim().length > 2 ? 'product-search-suggestions' : undefined} value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => {if (event.key === 'Escape') setSearch('');}} placeholder="Search furniture, lighting, home essentials…"/>
          <button type="submit">Search</button>
        </form>
        {search.trim().length > 2 && <div className="search-suggestions" id="product-search-suggestions">
          <div className="suggestion-heading">A few finds for your home <button onClick={() => setSearch('')} aria-label="Close suggestions"><X size={16}/></button></div>
          {searchIsCurrent && suggestions?.items?.map((product: Product) => <Link href={`/product/${product.id}`} onClick={() => setSearch('')} key={product.id}><Image src={product.image} alt="" width={45} height={45} unoptimized/><span>{product.name}</span><ArrowUpRight size={16}/></Link>)}
          <p className="suggestion-status" role="status">{!searchIsCurrent || !suggestions && !suggestionError ? 'Finding your next favourite…' : suggestionError ? 'Suggestions are unavailable. You can still search the collection.' : !suggestions?.items?.length ? 'No close matches yet. Try a room, material or product name.' : ''}</p>
          <Link href={`/shop?q=${encodeURIComponent(search.trim())}`} onClick={() => setSearch('')}>See all results for “{search.trim()}” <ArrowRight size={16}/></Link>
        </div>}
      </div>
      <Link href="/account" aria-label="My account"><UserRound/><span>Account</span></Link>
      <Link href="/wishlist" aria-label="Wishlist"><Heart/><span>Saved</span>{state.wishlist.length > 0 && <b className="count">{state.wishlist.length}</b>}</Link>
      <Link href="/cart" aria-label="Shopping bag" className="bag-link"><ShoppingBag/><span>Bag</span><b className="count">{state.cart.reduce((total, item) => total + item.quantity, 0)}</b></Link>
    </header>
    <div className="nav-wrap visual-nav-wrap" onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setMenu('');
    }}>
      <nav className="navigation visual-navigation" aria-label="Main navigation">
        <button ref={menuButton} aria-expanded={Boolean(menu)} aria-controls="visual-department-menu" onClick={() => {setDepartmentQuery(''); setMenu(menu ? '' : 'living-room');}} onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setMenu(menu || 'living-room');
            requestAnimationFrame(() => tabButtons.current.get(menu || 'living-room')?.focus());
          }
        }}><Menu size={18}/> All departments <ChevronDown size={14}/></button>
        {featuredDepartments.map(slug => {
          const department = departments.find(item => item.slug === slug)!;
          return <Link className="visual-nav-shortcut" key={slug} href={`/shop/${slug}`}><NavigationThumbnail src={departmentImage(slug).image}/><span>{department.short}</span></Link>;
        })}
        <Link href="/rooms">Room ideas</Link>
        <Link className="orange" href="/planner">Plan my room <ArrowUpRight size={15}/></Link>
      </nav>
      {menu && <>
        <button className="menu-backdrop visual-menu-backdrop" aria-label="Close department menu" tabIndex={-1} onClick={() => setMenu('')}/>
        <div className="visual-mega-menu" id="visual-department-menu" ref={menuPanel} aria-label="Shop by department">
          <aside className="visual-mega-sidebar">
            <div className="department-finder"><Search size={16}/><input aria-label="Find a department or collection" placeholder="Find your department…" value={departmentQuery} onChange={event => setDepartmentQuery(event.target.value)}/>{departmentQuery && <button aria-label="Clear department filter" onClick={() => setDepartmentQuery('')}><X size={15}/></button>}</div>
            <div className="visual-department-tabs" role="tablist" aria-label="Departments" aria-orientation="vertical">
              {visibleDepartments.map(department => <button key={department.slug} id={`department-tab-${department.slug}`} role="tab" aria-selected={selected?.slug === department.slug} aria-controls="department-collections-panel" tabIndex={selected?.slug === department.slug ? 0 : -1} ref={element => {if (element) tabButtons.current.set(department.slug, element); else tabButtons.current.delete(department.slug);}} onClick={() => setMenu(department.slug)} onFocus={() => setMenu(department.slug)} onKeyDown={event => changeTab(event, department.slug)}>
                <NavigationThumbnail src={departmentImage(department.slug).image}/><span>{department.name}<small>{departmentImage(department.slug).count.toLocaleString('en-GH')} finds</small></span><ArrowRight size={14}/>
              </button>)}
              {!visibleDepartments.length && <p className="department-finder-empty">No departments match “{departmentQuery}”. <button onClick={() => setDepartmentQuery('')}>Browse all departments</button></p>}
            </div>
            <Link className="visual-all-departments" href="/departments">Discover all departments <ArrowUpRight size={16}/></Link>
          </aside>
          {selected ? <div className="visual-mega-content" role="tabpanel" id="department-collections-panel" aria-labelledby={`department-tab-${selected.slug}`} tabIndex={0} style={{'--department-tone': selectedStyle.tone} as CSSProperties}>
            <div className="visual-mega-heading"><div><span className="eyebrow">FIND YOUR KIND OF HOME</span><Link href={`/shop/${selected.slug}`}>{selected.name}<ArrowUpRight size={25}/></Link><p>{selected.description}</p></div><button className="icon-button" onClick={() => {setMenu(''); menuButton.current?.focus();}} aria-label="Close department menu"><X/></button></div>
            <div className="visual-mega-layout">
              <div className="visual-collection-groups">{selected.groups.map(group => <section key={group.name}><h3>{group.name}</h3>{group.items.map(name => <CollectionLink department={selected.slug} name={name} key={name}/>)}</section>)}</div>
              <aside className="visual-menu-edit"><Link href={`/shop/${selected.slug}`}><div className={`visual-menu-edit-image ${selectedStyle.image ? '' : 'product-edit'}`}><Image src={selectedStyle.image || departmentImage(selected.slug).image} alt={`${selected.name} collection inspiration`} width={600} height={800} unoptimized/><span>THE ABODE EDIT</span></div><h3>Make room for<br/><em>something you love.</em></h3><span className="visual-edit-cta">Explore {selected.short.toLowerCase()} <ArrowUpRight size={18}/></span></Link><Link className="visual-planner-cta" href="/planner"><Sparkles size={18}/><span>Picture it in your space<small>Try the room planner</small></span><ArrowRight size={16}/></Link></aside>
            </div>
          </div> : <div className="visual-menu-empty"><Search size={30}/><h2>A little more inspiration?</h2><p>Try “sofa”, “garden” or “lighting”.</p><button className="button outline" onClick={() => setDepartmentQuery('')}>Show every department</button></div>}
        </div>
      </>}
    </div>
    <div className="local-bar"><button onClick={() => {setCity(state.city); setLocation(true);}}><MapPin size={15}/> Planning for <strong>{state.city}</strong><ChevronDown size={13}/></button><span>{catalogSummary.products.toLocaleString('en-GH')} finds · {departments.length} departments · Your kind of home</span><Link href="/help/about-this-preview">Collection preview <ArrowUpRight size={12}/></Link></div>
    <Dialog open={location} onOpenChange={setLocation}><DialogContent><DialogTitle>Your home, your location</DialogTitle><DialogDescription>Choose your delivery city for planning. Final coverage and delivery charges are confirmed with your quote.</DialogDescription><Choice label="Delivery city" value={city} options={cities} onChange={setCity}/><button className="button" onClick={async () => {if (await save('city', city)) setLocation(false);}}>Save location <Check size={18}/></button></DialogContent></Dialog>
    <Sheet open={mobile} onOpenChange={setMobile}><SheetContent side="left" className="mobile-sheet visual-mobile-sheet"><SheetTitle className="wordmark">abode<span>.</span></SheetTitle><SheetDescription>Every room. Every little detail.</SheetDescription>
      <div className="department-finder mobile-department-finder"><Search size={18}/><input aria-label="Find a mobile department or collection" placeholder="Find a department or collection…" value={departmentQuery} onChange={event => setDepartmentQuery(event.target.value)}/>{departmentQuery && <button aria-label="Clear department filter" onClick={() => setDepartmentQuery('')}><X size={16}/></button>}</div>
      <div className="visual-mobile-scroll"><div className="visual-mobile-departments">
        {visibleDepartments.map(department => <details key={department.slug}><summary><NavigationThumbnail src={departmentImage(department.slug).image}/><span>{department.name}<small>{department.groups.reduce((total, group) => total + group.items.length, 0)} collections to explore</small></span><Plus size={19}/></summary>
          <div className="visual-mobile-collections"><Link className="mobile-explore-department" href={`/shop/${department.slug}`}>Explore all {department.name.toLowerCase()} <ArrowUpRight size={17}/></Link>{department.groups.map(group => <section key={group.name}><h3>{group.name}</h3>{group.items.map(name => <CollectionLink department={department.slug} name={name} key={name}/>)}</section>)}</div>
        </details>)}
        {!visibleDepartments.length && <p className="department-finder-empty">No departments match “{departmentQuery}”. <button onClick={() => setDepartmentQuery('')}>Browse all departments</button></p>}
      </div><div className="visual-mobile-inspiration"><span className="eyebrow">A HOME THAT FEELS LIKE YOU</span><Link href="/account"><UserRound size={18}/> Your Abode account <ArrowRight size={17}/></Link><Link href="/departments">Discover all departments <ArrowUpRight size={17}/></Link><Link href="/planner"><Sparkles size={18}/> Plan your room <ArrowRight size={17}/></Link><Link href="/rooms">The room inspiration edit <ArrowUpRight size={17}/></Link><Link href="/trade">Abode for business <ArrowUpRight size={17}/></Link></div></div>
    </SheetContent></Sheet>
  </>;
}
