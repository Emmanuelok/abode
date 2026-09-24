import Storefront from '@/components/storefront';
import type { Metadata } from 'next';
import { SITE_ORIGIN } from '@/lib/seo';
export const metadata: Metadata = { alternates: { canonical: SITE_ORIGIN } };
export default function Home(){return <Storefront initialPath="/"/>}
