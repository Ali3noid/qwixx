import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

import {
  ROW_COLORS,
  applyAction,
  createGame,
  type DiceRoll,
  type GameState,
  type PlayerAction,
} from '../../../engine/index.js';
import type {
  AuthenticatedRoom,
  ClientAction,
  ParticipantCredential,
  ParticipantRecord,
  PublicGameState,
  RoomRepository,
  RoomStatus,
  RoomView,
} from './types.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_COMMIT_ATTEMPTS = 6;

export class RoomError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_CODE'
      | 'INVALID_NICKNAME'
      | 'ROOM_NOT_FOUND'
      | 'UNAUTHORIZED'
      | 'ROOM_FULL'
      | 'ROOM_STARTED'
      | 'NICKNAME_TAKEN'
      | 'NOT_HOST'
      | 'NOT_ENOUGH_PLAYERS'
      | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

function normalizeNickname(nickname: string): string {
  const normalized = nickname.trim().replace(/\s+/g, ' ');
  if (normalized.length < 1 || normalized.length > 24) {
    throw new RoomError('INVALID_NICKNAME', 'Nick musi mieć od 1 do 24 znaków.');
  }
  return normalized;
}

export function normalizeRoomCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!new RegExp(`^[${CODE_ALPHABET}]{6}$`).test(normalized)) {
    throw new RoomError('INVALID_CODE', 'Kod pokoju musi mieć sześć poprawnych znaków.');
  }
  return normalized;
}

function newRoomCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

function tokenHash(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function secretsMatch(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(tokenHash(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function credentialFor(participantId: string): ParticipantCredential {
  return { participantId, secret: randomBytes(32).toString('base64url') };
}

function die(): 1 | 2 | 3 | 4 | 5 | 6 {
  return randomInt(1, 7) as 1 | 2 | 3 | 4 | 5 | 6;
}

function rollFor(state: GameState): DiceRoll {
  return {
    white1: die(),
    white2: die(),
    colors: Object.fromEntries(
      ROW_COLORS.filter((row) => !state.lockedRows.includes(row)).map((row) => [row, die()]),
    ) as DiceRoll['colors'],
  };
}

function rollIfNeeded(state: GameState): GameState {
  return state.phase === 'awaiting_roll'
    ? applyAction(state, { type: 'ROLL', dice: rollFor(state) })
    : state;
}

export function toPublicGameState(state: GameState): PublicGameState {
  const { pendingWhiteDecisions, ...visibleState } = state;
  return {
    ...visibleState,
    respondedPlayerIds: Object.keys(pendingWhiteDecisions),
  };
}

function participantAction(action: ClientAction, playerId: string): PlayerAction {
  if (action.type === 'MARK_WHITE') return { ...action, playerId };
  if (action.type === 'PASS_WHITE') return { ...action, playerId };
  if (action.type === 'MARK_COLOR') return { ...action, playerId };
  return { ...action, playerId };
}

export class RoomService {
  constructor(private readonly repository: RoomRepository) {}

  async createRoom(nicknameInput: string): Promise<{ code: string; credential: ParticipantCredential }> {
    const nickname = normalizeNickname(nicknameInput);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const roomId = randomUUID();
      const participantId = randomUUID();
      const credential = credentialFor(participantId);
      const code = newRoomCode();
      const created = await this.repository.createRoom({
        room: { id: roomId, code, status: 'lobby', hostParticipantId: participantId },
        host: {
          id: participantId,
          roomId,
          nickname,
          seat: 0,
          sessionTokenHash: tokenHash(credential.secret),
        },
      });
      if (created) return { code, credential };
    }
    throw new RoomError('CONFLICT', 'Nie udało się przydzielić unikalnego kodu pokoju.');
  }

  async joinRoom(codeInput: string, nicknameInput: string): Promise<ParticipantCredential> {
    const code = normalizeRoomCode(codeInput);
    const nickname = normalizeNickname(nicknameInput);
    const room = await this.repository.findRoomByCode(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Nie znaleziono pokoju.');

    const participantId = randomUUID();
    const credential = credentialFor(participantId);
    const result = await this.repository.addParticipant({
      id: participantId,
      roomId: room.id,
      nickname,
      seat: -1,
      sessionTokenHash: tokenHash(credential.secret),
    });
    if (result === 'full') throw new RoomError('ROOM_FULL', 'Pokój ma już pięciu graczy.');
    if (result === 'started') throw new RoomError('ROOM_STARTED', 'Ta gra już się rozpoczęła.');
    if (result === 'nickname_taken') throw new RoomError('NICKNAME_TAKEN', 'Ten nick jest już zajęty w pokoju.');
    return credential;
  }

  async authenticate(codeInput: string, credential: ParticipantCredential | null): Promise<AuthenticatedRoom> {
    const code = normalizeRoomCode(codeInput);
    const room = await this.repository.findRoomByCode(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Nie znaleziono pokoju.');
    if (!credential) throw new RoomError('UNAUTHORIZED', 'Dołącz do pokoju, aby kontynuować.');
    const snapshot = await this.repository.getSnapshot(room.id);
    const participant = snapshot?.participants.find((entry) => entry.id === credential.participantId);
    if (!participant || !secretsMatch(credential.secret, participant.sessionTokenHash)) {
      throw new RoomError('UNAUTHORIZED', 'Sesja gracza jest nieprawidłowa lub wygasła.');
    }
    if (!snapshot) throw new RoomError('ROOM_NOT_FOUND', 'Nie znaleziono pokoju.');
    return { room, participant, snapshot };
  }

  async getView(code: string, credential: ParticipantCredential): Promise<RoomView> {
    const { room, participant, snapshot } = await this.authenticate(code, credential);
    return {
      roomId: room.id,
      code: room.code,
      status: room.status,
      isHost: room.hostParticipantId === participant.id,
      participantId: participant.id,
      participants: snapshot.participants
        .slice()
        .sort((left, right) => left.seat - right.seat)
        .map(({ id, nickname, seat }) => ({ id, nickname, seat })),
      game: snapshot.game
        ? { version: snapshot.game.version, state: toPublicGameState(snapshot.game.state) }
        : null,
    };
  }

  async startGame(code: string, credential: ParticipantCredential): Promise<void> {
    const { room, participant } = await this.authenticate(code, credential);
    if (room.hostParticipantId !== participant.id) {
      throw new RoomError('NOT_HOST', 'Tylko gospodarz może rozpocząć grę.');
    }
    for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt += 1) {
      const snapshot = await this.repository.getSnapshot(room.id);
      if (!snapshot || snapshot.room.status !== 'lobby') {
        throw new RoomError('ROOM_STARTED', 'Gra została już rozpoczęta.');
      }
      if (snapshot.participants.length < 2) {
        throw new RoomError('NOT_ENOUGH_PLAYERS', 'Do rozpoczęcia potrzeba co najmniej dwóch graczy.');
      }
      const playerIds = snapshot.participants
        .slice()
        .sort((left, right) => left.seat - right.seat)
        .map((entry) => entry.id);
      const state = rollIfNeeded(createGame(playerIds));
      if (await this.repository.startGame(room.id, participant.id, state)) return;
    }
    throw new RoomError('CONFLICT', 'Skład pokoju zmienia się równocześnie. Spróbuj ponownie.');
  }

  async submitAction(code: string, credential: ParticipantCredential, clientAction: ClientAction): Promise<void> {
    const { room, participant } = await this.authenticate(code, credential);
    for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt += 1) {
      const snapshot = await this.repository.getSnapshot(room.id);
      if (!snapshot?.game) throw new RoomError('ROOM_STARTED', 'Gra jeszcze się nie rozpoczęła.');
      let nextState = applyAction(snapshot.game.state, participantAction(clientAction, participant.id));
      nextState = rollIfNeeded(nextState);
      const status: RoomStatus = nextState.phase === 'finished' ? 'finished' : 'in_game';
      const version = await this.repository.commitGame(
        room.id,
        snapshot.game.version,
        nextState,
        status,
      );
      if (version !== null) return;
    }
    throw new RoomError('CONFLICT', 'Stan gry zmienił się równocześnie. Spróbuj ponownie.');
  }
}
