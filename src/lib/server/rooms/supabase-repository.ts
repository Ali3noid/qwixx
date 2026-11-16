import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { GameState } from '../../../engine/index.js';
import type {
  NewRoom,
  ParticipantRecord,
  RoomRecord,
  RoomRepository,
  RoomSnapshot,
  RoomStatus,
} from './types.js';

interface RoomRow {
  id: string;
  code: string;
  status: RoomStatus;
  host_participant_id: string;
}

interface ParticipantRow {
  id: string;
  room_id: string;
  nickname: string;
  seat: number;
  session_token_hash: string;
}

function roomFromRow(row: RoomRow): RoomRecord {
  return { id: row.id, code: row.code, status: row.status, hostParticipantId: row.host_participant_id };
}

function participantFromRow(row: ParticipantRow): ParticipantRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    nickname: row.nickname,
    seat: row.seat,
    sessionTokenHash: row.session_token_hash,
  };
}

export class SupabaseRoomRepository implements RoomRepository {
  constructor(private readonly client: SupabaseClient) {}

  static connect(url: string, serviceRoleKey: string): SupabaseRoomRepository {
    return new SupabaseRoomRepository(createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }));
  }

  async createRoom(input: NewRoom): Promise<boolean> {
    const { data, error } = await this.client.rpc('create_room_with_host', {
      p_room_id: input.room.id,
      p_code: input.room.code,
      p_host_id: input.host.id,
      p_nickname: input.host.nickname,
      p_token_hash: input.host.sessionTokenHash,
    });
    if (error) {
      if (error.code === '23505') return false;
      throw error;
    }
    return data === true;
  }

  async findRoomByCode(code: string): Promise<RoomRecord | null> {
    const { data, error } = await this.client
      .from('rooms')
      .select('id,code,status,host_participant_id')
      .eq('code', code)
      .maybeSingle<RoomRow>();
    if (error) throw error;
    return data ? roomFromRow(data) : null;
  }

  async getSnapshot(roomId: string): Promise<RoomSnapshot | null> {
    const [roomResult, participantsResult, gameResult] = await Promise.all([
      this.client.from('rooms').select('id,code,status,host_participant_id').eq('id', roomId).maybeSingle<RoomRow>(),
      this.client.from('room_participants').select('id,room_id,nickname,seat,session_token_hash').eq('room_id', roomId).order('seat'),
      this.client.from('room_games').select('room_id,version,state').eq('room_id', roomId).maybeSingle(),
    ]);
    if (roomResult.error) throw roomResult.error;
    if (participantsResult.error) throw participantsResult.error;
    if (gameResult.error) throw gameResult.error;
    if (!roomResult.data) return null;
    return {
      room: roomFromRow(roomResult.data),
      participants: ((participantsResult.data ?? []) as ParticipantRow[]).map(participantFromRow),
      game: gameResult.data
        ? {
            roomId: gameResult.data.room_id as string,
            version: Number(gameResult.data.version),
            state: gameResult.data.state as GameState,
          }
        : null,
    };
  }

  async addParticipant(participant: ParticipantRecord) {
    const { data, error } = await this.client.rpc('join_room', {
      p_room_id: participant.roomId,
      p_participant_id: participant.id,
      p_nickname: participant.nickname,
      p_token_hash: participant.sessionTokenHash,
    });
    if (error) throw error;
    if (!['joined', 'full', 'started', 'nickname_taken'].includes(data as string)) {
      throw new Error(`Unexpected join_room result: ${String(data)}`);
    }
    return data as 'joined' | 'full' | 'started' | 'nickname_taken';
  }

  async startGame(
    roomId: string,
    hostParticipantId: string,
    state: GameState,
  ): Promise<boolean> {
    const { data, error } = await this.client.rpc('start_room_game', {
      p_room_id: roomId,
      p_host_id: hostParticipantId,
      p_state: state,
    });
    if (error) throw error;
    return data === true;
  }

  async commitGame(
    roomId: string,
    expectedVersion: number,
    state: GameState,
    status: RoomStatus,
  ): Promise<number | null> {
    const { data, error } = await this.client.rpc('commit_room_game', {
      p_room_id: roomId,
      p_expected_version: expectedVersion,
      p_state: state,
      p_status: status,
    });
    if (error) throw error;
    return data === null ? null : Number(data);
  }
}
