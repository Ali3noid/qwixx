import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createGame } from '../../src/engine/index.js';
import { MemoryRoomRepository } from '../../src/lib/server/rooms/memory-repository.js';
import { RoomError, RoomService } from '../../src/lib/server/rooms/service.js';
import { SupabaseRoomRepository } from '../../src/lib/server/rooms/supabase-repository.js';

async function roomWithGuest(service: RoomService, host: string, guest: string) {
  const created = await service.createRoom(host);
  const guestCredential = await service.joinRoom(created.code, guest);
  return { ...created, guestCredential };
}

describe('multiplayer rooms', () => {
  it('sends a sanitized public state to Supabase when starting and updating a game', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: 2, error: null });
    const repository = new SupabaseRoomRepository({ rpc } as unknown as SupabaseClient);
    const state = createGame(['host', 'guest']);

    await repository.startGame('room-id', 'host', state);
    await repository.commitGame('room-id', 1, state, 'in_game');

    expect(rpc).toHaveBeenNthCalledWith(1, 'start_room_game', expect.objectContaining({
      p_state: state,
      p_public_state: expect.not.objectContaining({ pendingWhiteDecisions: expect.anything() }),
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, 'commit_room_game', expect.objectContaining({
      p_state: state,
      p_public_state: expect.not.objectContaining({ pendingWhiteDecisions: expect.anything() }),
    }));
  });

  it('creates unique six-character codes and restores a participant from its credential', async () => {
    const repository = new MemoryRoomRepository();
    const service = new RoomService(repository);
    const first = await service.createRoom('Ada');
    const second = await service.createRoom('Bruno');

    expect(first.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(second.code).not.toBe(first.code);
    const getSnapshot = vi.spyOn(repository, 'getSnapshot');
    const restored = await service.getView(first.code, first.credential);
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(restored.participants).toEqual([
      expect.objectContaining({ id: first.credential.participantId, nickname: 'Ada', seat: 0 }),
    ]);

    await expect(service.getView(first.code, { ...first.credential, secret: 'forged' }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('allows 2-5 players, rejects late joins, and only lets the host start', async () => {
    const service = new RoomService(new MemoryRoomRepository());
    const room = await roomWithGuest(service, 'Host', 'Guest 1');
    const guest2 = await service.joinRoom(room.code, 'Guest 2');
    await service.joinRoom(room.code, 'Guest 3');
    await service.joinRoom(room.code, 'Guest 4');

    await expect(service.joinRoom(room.code, 'Too many')).rejects.toMatchObject({ code: 'ROOM_FULL' });
    await expect(service.startGame(room.code, guest2)).rejects.toMatchObject({ code: 'NOT_HOST' });
    await service.startGame(room.code, room.credential);
    await expect(service.joinRoom(room.code, 'Late')).rejects.toMatchObject({ code: 'ROOM_STARTED' });
  });

  it('exposes response status but never another player decision payload', async () => {
    const repository = new MemoryRoomRepository();
    const service = new RoomService(repository);
    const room = await roomWithGuest(service, 'Ada', 'Bruno');
    await service.startGame(room.code, room.credential);
    await service.submitAction(room.code, room.credential, { type: 'PASS_WHITE' });

    const guestView = await service.getView(room.code, room.guestCredential);
    expect(guestView.game?.state.respondedPlayerIds).toEqual([room.credential.participantId]);
    expect(guestView.game?.state).not.toHaveProperty('pendingWhiteDecisions');
    expect(JSON.stringify(guestView.game?.state)).not.toContain('PASS_WHITE');
  });

  it('accepts only one of two simultaneous decisions from the same player', async () => {
    const service = new RoomService(new MemoryRoomRepository());
    const room = await roomWithGuest(service, 'Ada', 'Bruno');
    await service.startGame(room.code, room.credential);

    const results = await Promise.allSettled([
      service.submitAction(room.code, room.credential, { type: 'PASS_WHITE' }),
      service.submitAction(room.code, room.credential, { type: 'PASS_WHITE' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const view = await service.getView(room.code, room.credential);
    expect(view.game?.state.respondedPlayerIds).toEqual([room.credential.participantId]);
    expect(view.game?.version).toBe(2);
  });

  it('plays concurrent turns in two rooms without state leaking between them', async () => {
    const repository = new MemoryRoomRepository();
    const service = new RoomService(repository);
    const redRoom = await roomWithGuest(service, 'Red host', 'Red guest');
    const blueRoom = await roomWithGuest(service, 'Blue host', 'Blue guest');
    await Promise.all([
      service.startGame(redRoom.code, redRoom.credential),
      service.startGame(blueRoom.code, blueRoom.credential),
    ]);

    await Promise.all([
      service.submitAction(redRoom.code, redRoom.credential, { type: 'PASS_WHITE' }),
      service.submitAction(redRoom.code, redRoom.guestCredential, { type: 'PASS_WHITE' }),
      service.submitAction(blueRoom.code, blueRoom.credential, { type: 'PASS_WHITE' }),
      service.submitAction(blueRoom.code, blueRoom.guestCredential, { type: 'PASS_WHITE' }),
    ]);

    const [redColored, blueColored] = await Promise.all([
      service.getView(redRoom.code, redRoom.credential),
      service.getView(blueRoom.code, blueRoom.credential),
    ]);
    expect(redColored.game?.state.phase).toBe('colored_decision');
    expect(blueColored.game?.state.phase).toBe('colored_decision');
    expect(redColored.participants.map((player) => player.nickname)).toEqual(['Red host', 'Red guest']);
    expect(blueColored.participants.map((player) => player.nickname)).toEqual(['Blue host', 'Blue guest']);

    await Promise.all([
      service.submitAction(redRoom.code, redRoom.credential, { type: 'PASS_COLOR' }),
      service.submitAction(blueRoom.code, blueRoom.credential, { type: 'PASS_COLOR' }),
    ]);

    const [redNextTurn, blueNextTurn] = await Promise.all([
      service.getView(redRoom.code, redRoom.guestCredential),
      service.getView(blueRoom.code, blueRoom.guestCredential),
    ]);
    for (const view of [redNextTurn, blueNextTurn]) {
      expect(view.game?.version).toBe(4);
      expect(view.game?.state.turnNumber).toBe(2);
      expect(view.game?.state.phase).toBe('white_decisions');
      expect(view.game?.state.activePlayerIndex).toBe(1);
      expect(view.game?.state.players[0]?.penalties).toBe(1);
    }
    expect(redNextTurn.roomId).not.toBe(blueNextTurn.roomId);
    expect(redNextTurn.game?.state.players.map((player) => player.id)).not.toEqual(
      blueNextTurn.game?.state.players.map((player) => player.id),
    );
  });

  it('requires two players before starting', async () => {
    const service = new RoomService(new MemoryRoomRepository());
    const room = await service.createRoom('Solo');
    await expect(service.startGame(room.code, room.credential)).rejects.toEqual(
      expect.objectContaining<Partial<RoomError>>({ code: 'NOT_ENOUGH_PLAYERS' }),
    );
  });
});
