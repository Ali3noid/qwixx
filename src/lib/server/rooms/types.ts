import type { GameState, RowColor } from '../../../engine/index.js';

export type RoomStatus = 'lobby' | 'in_game' | 'finished';

export interface RoomRecord {
  readonly id: string;
  readonly code: string;
  readonly status: RoomStatus;
  readonly hostParticipantId: string;
}

export interface ParticipantRecord {
  readonly id: string;
  readonly roomId: string;
  readonly nickname: string;
  readonly seat: number;
  readonly sessionTokenHash: string;
}

export interface StoredGame {
  readonly roomId: string;
  readonly version: number;
  readonly state: GameState;
}

export interface PublicGameState extends Omit<GameState, 'pendingWhiteDecisions'> {
  readonly respondedPlayerIds: readonly string[];
}

export interface RoomSnapshot {
  readonly room: RoomRecord;
  readonly participants: readonly ParticipantRecord[];
  readonly game: StoredGame | null;
}

export interface NewRoom {
  readonly room: RoomRecord;
  readonly host: ParticipantRecord;
}

export type ClientAction =
  | { readonly type: 'MARK_WHITE'; readonly row: RowColor }
  | { readonly type: 'PASS_WHITE' }
  | { readonly type: 'MARK_COLOR'; readonly row: RowColor; readonly whiteDie: 1 | 2 }
  | { readonly type: 'PASS_COLOR' };

export interface RoomRepository {
  createRoom(input: NewRoom): Promise<boolean>;
  findRoomByCode(code: string): Promise<RoomRecord | null>;
  getSnapshot(roomId: string): Promise<RoomSnapshot | null>;
  addParticipant(participant: ParticipantRecord): Promise<'joined' | 'full' | 'started' | 'nickname_taken'>;
  startGame(roomId: string, hostParticipantId: string, state: GameState): Promise<boolean>;
  commitGame(
    roomId: string,
    expectedVersion: number,
    state: GameState,
    status: RoomStatus,
  ): Promise<number | null>;
}

export interface ParticipantCredential {
  readonly participantId: string;
  readonly secret: string;
}

export interface AuthenticatedRoom {
  readonly room: RoomRecord;
  readonly participant: ParticipantRecord;
  readonly snapshot: RoomSnapshot;
}

export interface RoomView {
  readonly roomId: string;
  readonly code: string;
  readonly status: RoomStatus;
  readonly isHost: boolean;
  readonly participantId: string;
  readonly participants: readonly Pick<ParticipantRecord, 'id' | 'nickname' | 'seat'>[];
  readonly game: { readonly version: number; readonly state: PublicGameState } | null;
}
