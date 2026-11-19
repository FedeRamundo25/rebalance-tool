import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { query } from './db.js';

const allowedEmails = new Set((process.env.ALLOWED_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();

function isAllowed(email: string) {
  if (allowedEmails.size === 0 && !allowedDomain) return process.env.NODE_ENV !== 'production';
  return allowedEmails.has(email.toLowerCase()) || Boolean(allowedDomain && email.toLowerCase().endsWith(`@${allowedDomain}`));
}

export function configureGoogleAuth() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientID || !clientSecret) return false;

  passport.use(new GoogleStrategy({
    clientID,
    clientSecret,
    callbackURL: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:8788/auth/google/callback',
    scope: ['openid', 'email', 'profile'],
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      if (!email || !isAllowed(email)) return done(null, false, { message: 'Esta cuenta no está habilitada para Rebalance.' });

      const result = await query<Express.User>(
        `INSERT INTO app_users (google_sub, email, display_name, avatar_url, last_login_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name,
           avatar_url = EXCLUDED.avatar_url, last_login_at = now()
         RETURNING google_sub AS "googleSub", email, display_name AS "displayName", avatar_url AS "avatarUrl"`,
        [profile.id, email, profile.displayName || email, profile.photos?.[0]?.value ?? null],
      );
      done(null, result.rows[0]);
    } catch (error) {
      done(error as Error);
    }
  }));

  passport.serializeUser((user, done) => done(null, (user as Express.User).googleSub));
  passport.deserializeUser(async (googleSub: string, done) => {
    try {
      const result = await query<Express.User>(
        `SELECT google_sub AS "googleSub", email, display_name AS "displayName", avatar_url AS "avatarUrl"
         FROM app_users WHERE google_sub = $1`, [googleSub],
      );
      done(null, result.rows[0] || false);
    } catch (error) {
      done(error as Error);
    }
  });
  return true;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated?.()) return next();
  res.status(401).json({ error: 'Necesitás iniciar sesión.' });
}
