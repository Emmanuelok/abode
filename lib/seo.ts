import type { Metadata } from 'next';
import { productById } from './catalog';
import { departments, slugify } from './taxonomy';

export const SITE_ORIGIN = 'https://abode.eo-kingsford.workers.dev';
export const SITE_TITLE = 'Abode Ghana | A home, beautifully yours';
export const SITE_DESCRIPTION = 'Discover furniture, lighting and thoughtful home essentials in Ghana. Find your style, save your favourites and plan a home that feels like you.';
export const SHARE_IMAGE = {
  url: `${SITE_ORIGIN}/social/abode-og.png`,
  width: 1200,
  height: 630,
  alt: 'Abode Ghana — A home, beautifully yours. Furniture, home and inspiration.',
  type: 'image/png',
};

const pages: Record<string, { title: string; description: string }> = {
  departments: { title: 'Every room, every possibility', description: 'Explore 24 home departments, from living-room furniture and bedroom essentials to lighting, outdoor living and thoughtful finishing touches.' },
  shop: { title: 'Find something beautifully you', description: 'Explore the Abode Ghana catalogue. Discover furniture, compare your favourites and build a thoughtful wishlist for your home.' },
  rooms: { title: 'Room inspiration', description: 'Find a fresh perspective for your living room, bedroom, dining space and home office with Abode Ghana.' },
  design: { title: 'A little help making it home', description: 'Explore interior design support with Abode Ghana. Share your room, your style and the home you have in mind.' },
  trade: { title: 'For spaces with a bigger story', description: 'Explore Abode Ghana for your professional interior, hospitality or property project.' },
  supplier: { title: 'Grow with Abode', description: 'Discover how to express your interest in supplying furniture and home essentials for Abode Ghana.' },
  support: { title: 'How can we help?', description: 'Find help with Abode Ghana, your saved selections and your home furnishing enquiry.' },
  returns: { title: 'Returns & support', description: 'Understand the Abode Ghana reference catalogue and how to get help with a furnishing enquiry.' },
  help: { title: 'A little guidance', description: 'Explore practical answers about Abode Ghana, guide prices, room planning and furnishing enquiries.' },
};
const privatePages = new Set(['account', 'admin', 'auth', 'signin', 'signup', 'login', 'register', 'wishlist', 'compare', 'cart', 'checkout', 'planner', 'registry', 'catalog-studio', 'special-request']);

export function pageMetadata(path: string[], hasQuery = false): Metadata {
  const route = path[0] || '';
  const canonical = `${SITE_ORIGIN}/${path.map(encodeURIComponent).join('/')}`;
  let title = pages[route]?.title || 'A home, beautifully yours';
  let description = pages[route]?.description || SITE_DESCRIPTION;
  let image: typeof SHARE_IMAGE | { url: string; alt: string; type?: string } = SHARE_IMAGE;
  let noindex = privatePages.has(route) || hasQuery;

  if (route === 'product') {
    const product = productById(path[1] || '');
    if (product) {
      title = product.name.length > 90 ? `${product.name.slice(0, 87).trimEnd()}…` : product.name;
      description = `${product.name}. Explore details, save to your wishlist or add to your room plan with Abode Ghana. Availability and pricing are confirmed by quotation.`.slice(0, 300);
      const gallery = product.imageUrls?.find(url => url.startsWith('/catalog/gallery/'));
      image = gallery ? { url: SITE_ORIGIN + gallery, alt: product.name, type: 'image/jpeg' } : { url: SITE_ORIGIN + product.image, alt: product.name };
    } else noindex = true;
  } else if (route === 'shop' && path[1]) {
    const department = departments.find(item => item.slug === path[1]);
    const collection = department?.groups.flatMap(group => group.items).find(item => slugify(item) === path[2]);
    if (department && (!path[2] || collection)) {
      title = collection ? `${collection} for your home` : `${department.name}, thoughtfully chosen`;
      description = collection
        ? `Discover ${collection.toLowerCase()} with Abode Ghana. Explore your favourites, compare options and plan a home that feels like you.`
        : `${department.description} Explore the ${department.name.toLowerCase()} collection at Abode Ghana.`;
    } else noindex = true;
  } else if (!pages[route] && !privatePages.has(route)) noindex = true;

  return {
    title,
    description,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: 'website', locale: 'en_GH', siteName: 'Abode Ghana', title: `${title} | Abode Ghana`, description, url: canonical, images: [image] },
    twitter: { card: 'summary_large_image', title: `${title} | Abode Ghana`, description, images: [image] },
  };
}
