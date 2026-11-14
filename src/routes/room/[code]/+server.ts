import { EngineError, ROW_COLORS } from '../../../engine/index.js';
import { getRoomService } from '#lib/server/rooms/runtime.js';
import { RoomError } from '#lib/server/rooms/service.js';
import { readCredential } from '#lib/server/rooms/session.js';
import type { ClientAction } from '#lib/server/rooms/types.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

function isClientAction(value: unknown): value is ClientAction {
  if (!value || typeof value !== 'object' || !('type' in value)) return false;
  const action = value as Record<string, unknown>;
  if (action.type === 'PASS_WHITE' || action.type === 'PASS_COLOR') return true;
  if (action.type === 'MARK_WHITE') return ROW_COLORS.includes(action.row as never);
  return action.type === 'MARK_COLOR'
    && ROW_COLORS.includes(action.row as never)
    && (action.whiteDie === 1 || action.whiteDie === 2);
}

export const POST: RequestHandler = async ({ params, cookies, request }) => {
  const code = params.code.toUpperCase();
  const credential = readCredential(cookies, code);
  if (!credential) return json({ message: 'Brak sesji gracza.' }, { status: 401 });
  const action: unknown = await request.json().catch(() => null);
  if (!isClientAction(action)) return json({ message: 'Nieprawidłowa akcja.' }, { status: 400 });
  try {
    await getRoomService().submitAction(code, credential, action);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof RoomError) return json({ message: error.message }, { status: error.code === 'UNAUTHORIZED' ? 401 : 409 });
    if (error instanceof EngineError) return json({ message: error.message }, { status: 409 });
    throw error;
  }
};
