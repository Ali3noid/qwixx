import { createHmac } from 'node:crypto';
import {
  PUBLIC_SUPABASE_ANON_KEY,
  PUBLIC_SUPABASE_URL,
  SUPABASE_JWT_SECRET,
  SUPABASE_URL,
} from '$app/env/private';
import type { Cookies } from '@sveltejs/kit';

import type { ParticipantCredential } from './types.js';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function cookieName(code: string): string {
  return `qwixx_${code.toLowerCase()}`;
}

export function readCredential(cookies: Cookies, code: string): ParticipantCredential | null {
  const raw = cookies.get(cookieName(code));
  if (!raw) return null;
  const separator = raw.indexOf('.');
  if (separator < 1) return null;
  return { participantId: raw.slice(0, separator), secret: raw.slice(separator + 1) };
}

export function writeCredential(cookies: Cookies, code: string, credential: ParticipantCredential, secure: boolean): void {
  cookies.set(cookieName(code), `${credential.participantId}.${credential.secret}`, {
    path: `/room/${code}`,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: COOKIE_MAX_AGE,
  });
}

function base64url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

export function realtimeConfig(participantId: string): { url: string; anonKey: string; accessToken: string } | null {
  const url = PUBLIC_SUPABASE_URL || SUPABASE_URL;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ aud: 'authenticated', exp: now + 60 * 60 * 24, iat: now, role: 'authenticated', sub: participantId }));
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', SUPABASE_JWT_SECRET).update(unsigned).digest('base64url');
  return { url, anonKey: PUBLIC_SUPABASE_ANON_KEY, accessToken: `${unsigned}.${signature}` };
}
