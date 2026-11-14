import * as privateEnv from '$app/env/private';

import { RoomService } from './service.js';
import { SupabaseRoomRepository } from './supabase-repository.js';

let service: RoomService | undefined;

export function getRoomService(): RoomService {
  if (service) return service;
  const configured = privateEnv as Readonly<Record<string, string | undefined>>;
  const url = configured.SUPABASE_URL ?? configured.PUBLIC_SUPABASE_URL
    ?? process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = configured.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  service = new RoomService(SupabaseRoomRepository.connect(url, serviceRoleKey));
  return service;
}
