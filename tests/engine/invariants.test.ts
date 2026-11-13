import { describe, expect, it } from 'vitest';

import {
  ROW_COLORS,
  applyAction,
  createGame,
  getLegalActions,
  type DiceRoll,
  type DieValue,
  type GameState,
  type RowColor,
} from '../../src/engine/index.js';

function seededGame(seed: number): GameState {
  let randomState = seed >>> 0;
  const next = (): number => {
    randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
    return randomState;
  };
  const die = (): DieValue => ((next() % 6) + 1) as DieValue;

  let state = createGame(['a', 'b', 'c']);
  let steps = 0;
  while (state.phase !== 'finished' && steps < 1_000) {
    if (state.phase === 'awaiting_roll') {
      const colors: Partial<Record<RowColor, DieValue>> = {};
      for (const row of ROW_COLORS) {
        if (!state.lockedRows.includes(row)) colors[row] = die();
      }
      const dice: DiceRoll = { white1: die(), white2: die(), colors };
      state = applyAction(state, { type: 'ROLL', dice });
    } else if (state.phase === 'white_decisions') {
      for (const participant of state.players) {
        if (state.phase !== 'white_decisions') break;
        const actions = getLegalActions(state, participant.id);
        state = applyAction(state, actions[next() % actions.length]!);
      }
    } else {
      const activeId = state.players[state.activePlayerIndex]!.id;
      const actions = getLegalActions(state, activeId);
      state = applyAction(state, actions[next() % actions.length]!);
    }

    for (const participant of state.players) {
      expect(participant.penalties).toBeGreaterThanOrEqual(0);
      expect(participant.penalties).toBeLessThanOrEqual(4);
      for (const row of ROW_COLORS) {
        const marks = participant.marks[row];
        expect(new Set(marks).size).toBe(marks.length);
        expect(marks.every((mark, index) => index === 0 || mark > marks[index - 1]!)).toBe(true);
      }
    }
    steps += 1;
  }

  expect(steps).toBeLessThan(1_000);
  expect(state.phase).toBe('finished');
  return state;
}

describe('deterministic legal game sequences', () => {
  it('preserves invariants across many seeded complete games', () => {
    for (let seed = 1; seed <= 50; seed += 1) seededGame(seed);
  });

  it('replays the same seed to the same final state', () => {
    expect(seededGame(42)).toEqual(seededGame(42));
  });
});
