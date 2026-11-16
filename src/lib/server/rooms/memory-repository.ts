import type {
  NewRoom,
  ParticipantRecord,
  RoomRepository,
  RoomSnapshot,
  RoomStatus,
} from './types.js';
import type { GameState } from '../../../engine/index.js';

export class MemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, RoomSnapshot>();

  async createRoom(input: NewRoom): Promise<boolean> {
    if ([...this.rooms.values()].some((snapshot) => snapshot.room.code === input.room.code)) return false;
    this.rooms.set(input.room.id, { room: input.room, participants: [input.host], game: null });
    return true;
  }

  async findRoomByCode(code: string) {
    return [...this.rooms.values()].find((snapshot) => snapshot.room.code === code)?.room ?? null;
  }

  async getSnapshot(roomId: string): Promise<RoomSnapshot | null> {
    const snapshot = this.rooms.get(roomId);
    return snapshot ? structuredClone(snapshot) : null;
  }

  async addParticipant(participant: ParticipantRecord) {
    const snapshot = this.rooms.get(participant.roomId);
    if (!snapshot || snapshot.room.status !== 'lobby') return 'started' as const;
    if (snapshot.participants.length >= 5) return 'full' as const;
    if (snapshot.participants.some((entry) => entry.nickname.toLocaleLowerCase() === participant.nickname.toLocaleLowerCase())) {
      return 'nickname_taken' as const;
    }
    const seated = { ...participant, seat: snapshot.participants.length };
    this.rooms.set(participant.roomId, { ...snapshot, participants: [...snapshot.participants, seated] });
    return 'joined' as const;
  }

  async startGame(
    roomId: string,
    hostParticipantId: string,
    state: GameState,
  ): Promise<boolean> {
    const snapshot = this.rooms.get(roomId);
    if (
      !snapshot ||
      snapshot.room.status !== 'lobby' ||
      snapshot.room.hostParticipantId !== hostParticipantId ||
      snapshot.participants.length < 2
    ) return false;
    this.rooms.set(roomId, {
      ...snapshot,
      room: { ...snapshot.room, status: 'in_game' },
      game: { roomId, version: 1, state: structuredClone(state) },
    });
    return true;
  }

  async commitGame(
    roomId: string,
    expectedVersion: number,
    state: GameState,
    status: RoomStatus,
  ): Promise<number | null> {
    const snapshot = this.rooms.get(roomId);
    if (!snapshot?.game || snapshot.game.version !== expectedVersion) return null;
    const version = expectedVersion + 1;
    this.rooms.set(roomId, {
      ...snapshot,
      room: { ...snapshot.room, status },
      game: { roomId, version, state: structuredClone(state) },
    });
    return version;
  }
}
