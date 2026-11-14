import { fail, redirect } from '@sveltejs/kit';

import { getRoomService } from '#lib/server/rooms/runtime.js';
import { RoomError } from '#lib/server/rooms/service.js';
import { writeCredential } from '#lib/server/rooms/session.js';
import type { Actions } from './$types.js';

function message(error: unknown): string {
  return error instanceof RoomError ? error.message : 'Nie udało się wykonać operacji.';
}

export const actions: Actions = {
  create: async ({ request, cookies, url }) => {
    const nickname = String((await request.formData()).get('nickname') ?? '');
    let result;
    try {
      result = await getRoomService().createRoom(nickname);
      writeCredential(cookies, result.code, result.credential, url.protocol === 'https:');
    } catch (error) {
      console.error('Failed to create room', error);
      return fail(400, { operation: 'create', message: message(error), nickname });
    }
    redirect(303, `/room/${result.code}`);
  },
  join: async ({ request }) => {
    const data = await request.formData();
    const code = String(data.get('code') ?? '').trim().toUpperCase();
    const nickname = String(data.get('nickname') ?? '');
    if (!code) return fail(400, { operation: 'join', message: 'Podaj kod pokoju.', nickname, code });
    redirect(303, `/room/${encodeURIComponent(code)}?nickname=${encodeURIComponent(nickname)}`);
  },
};
