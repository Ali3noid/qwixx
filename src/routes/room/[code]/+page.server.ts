import { fail, redirect } from '@sveltejs/kit';

import { getRoomService } from '#lib/server/rooms/runtime.js';
import { RoomError } from '#lib/server/rooms/service.js';
import { readCredential, realtimeConfig, writeCredential } from '#lib/server/rooms/session.js';
import type { Actions, PageServerLoad } from './$types.js';

function message(error: unknown): string {
  return error instanceof RoomError ? error.message : 'Nie udało się wykonać operacji.';
}

export const load: PageServerLoad = async ({ params, cookies, url }) => {
  const code = params.code.toUpperCase();
  const credential = readCredential(cookies, code);
  if (!credential) return { code, suggestedNickname: url.searchParams.get('nickname') ?? '', view: null, realtime: null };
  try {
    const view = await getRoomService().getView(code, credential);
    return { code, suggestedNickname: '', view, realtime: realtimeConfig(view.participantId) };
  } catch (error) {
    if (error instanceof RoomError && error.code === 'UNAUTHORIZED') {
      return { code, suggestedNickname: '', view: null, realtime: null };
    }
    throw error;
  }
};

export const actions: Actions = {
  join: async ({ params, request, cookies, url }) => {
    const code = params.code.toUpperCase();
    const nickname = String((await request.formData()).get('nickname') ?? '');
    try {
      const credential = await getRoomService().joinRoom(code, nickname);
      writeCredential(cookies, code, credential, url.protocol === 'https:');
    } catch (error) {
      return fail(400, { operation: 'join', message: message(error), nickname });
    }
    redirect(303, `/room/${code}`);
  },
  start: async ({ params, cookies }) => {
    const code = params.code.toUpperCase();
    const credential = readCredential(cookies, code);
    if (!credential) return fail(401, { operation: 'start', message: 'Brak sesji gracza.' });
    try {
      await getRoomService().startGame(code, credential);
    } catch (error) {
      return fail(400, { operation: 'start', message: message(error) });
    }
    redirect(303, `/room/${code}`);
  },
};
