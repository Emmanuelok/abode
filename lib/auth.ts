import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { authOptions } from './auth-config';

export function authReady() {
  return Boolean(env.BETTER_AUTH_SECRET && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function auth() {
  if (!env.DB || !env.BETTER_AUTH_SECRET) throw new Error('Authentication is not configured');
  return betterAuth({ ...authOptions(env), database: env.DB });
}

export function isStaff(email: string, verified: boolean) {
  return verified && (env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}
