import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import GameBoard from '../../src/lib/components/GameBoard.svelte';
import { applyAction, createGame, getLegalActions, type DiceRoll, type GameState } from '../../src/engine/index.js';

const ROLL: DiceRoll = { white1: 1, white2: 1, colors: { red: 1, yellow: 2, green: 3, blue: 4 } };

afterEach(cleanup);

describe('GameBoard', () => {
  it('only enables fields backed by a legal engine action', () => {
    const state = applyAction(createGame(['a', 'b']), { type: 'ROLL', dice: ROLL });
    const select = vi.fn();

    render(GameBoard, {
      state,
      playerId: 'a',
      legalActions: getLegalActions(state, 'a'),
      selectedAction: null,
      onSelect: select,
    });

    expect((screen.getByRole('button', { name: 'Czerwony 2' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Czerwony 3' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('0 pkt')).not.toBeNull();
  });

  it('shows the engine-calculated score for every row', () => {
    const initial = createGame(['a', 'b']);
    const state: GameState = {
      ...initial,
      players: initial.players.map((player) => player.id === 'a'
        ? { ...player, marks: { ...player.marks, red: [0, 1] } }
        : player),
    };

    render(GameBoard, {
      state,
      playerId: 'a',
      legalActions: [],
      selectedAction: null,
      onSelect: vi.fn(),
    });

    expect(screen.getByLabelText('Czerwony: 3 pkt')).not.toBeNull();
    expect(screen.getByLabelText('Żółty: 0 pkt')).not.toBeNull();
    expect(screen.getByLabelText('Zielony: 0 pkt')).not.toBeNull();
    expect(screen.getByLabelText('Niebieski: 0 pkt')).not.toBeNull();
  });

  it('asks which white die to use when both actions target one cell', async () => {
    let state = applyAction(createGame(['a', 'b']), { type: 'ROLL', dice: ROLL });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'a' });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'b' });
    const select = vi.fn();

    render(GameBoard, {
      state,
      playerId: 'a',
      legalActions: getLegalActions(state, 'a'),
      selectedAction: null,
      onSelect: select,
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Czerwony 2' }));

    expect(select).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Biała kość 1' })).not.toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Biała kość 2' }));
    expect(select).toHaveBeenCalledWith({
      type: 'MARK_COLOR', playerId: 'a', row: 'red', whiteDie: 2,
    });
  });
});
