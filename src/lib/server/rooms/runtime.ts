import {
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from '$app/env/private';

import { RoomService } from './service.js';
import { SupabaseRoomRepository } from './supabase-repository.js';

let service: RoomService | undefined;

export function getRoomService(): RoomService {
  if (service) return service;
  service = new RoomService(SupabaseRoomRepository.connect(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  ));
  return service;
}
