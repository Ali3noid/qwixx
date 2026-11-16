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
