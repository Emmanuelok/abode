import type { BetterAuthOptions } from 'better-auth';

export type AuthSettings = {
  AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export function authOptions(settings: AuthSettings): BetterAuthOptions {
  const baseURL = settings.AUTH_URL || 'https://abode.eo-kingsford.workers.dev';
  return {
    appName: 'Abode Ghana',
    baseURL,
    basePath: '/api/auth',
    secret: settings.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(baseURL).origin],
    user: { modelName: 'auth_user' },
    account: {
      modelName: 'auth_account',
      encryptOAuthTokens: true,
      accountLinking: { enabled: true, allowDifferentEmails: false },
    },
    session: {
      modelName: 'auth_session',
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    verification: { modelName: 'auth_verification', storeInDatabase: true },
    // Google verifies the email and handles account recovery. Email/password
    // registration remains disabled until a verified sender is configured.
    emailAndPassword: { enabled: false },
    socialProviders: settings.GOOGLE_CLIENT_ID && settings.GOOGLE_CLIENT_SECRET ? {
      google: {
        clientId: settings.GOOGLE_CLIENT_ID,
        clientSecret: settings.GOOGLE_CLIENT_SECRET,
        prompt: 'select_account',
        accessType: 'online',
      },
    } : {},
    advanced: {
      cookiePrefix: 'abode',
      useSecureCookies: baseURL.startsWith('https:'),
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'auth_rate_limit',
      window: 60,
      max: 60,
      customRules: { '/sign-in/social': { window: 60, max: 10 } },
    },
    telemetry: { enabled: false },
  };
}
