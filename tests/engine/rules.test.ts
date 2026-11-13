import { describe, expect, it } from 'vitest';

import {
  CLASSIC_ROW_VALUES,
  EngineError,
  addMark,
  canMarkValue,
  createGame,
  type PlayerState,
} from '../../src/engine/index.js';

function playerWithRedMarks(indices: readonly number[]): PlayerState {
  const player = createGame(['a', 'b']).players[0]!;
  return { ...player, marks: { ...player.marks, red: indices } };
}

describe('Classic row rules', () => {
  it('uses increasing red/yellow and decreasing green/blue rows', () => {
    expect(CLASSIC_ROW_VALUES.red).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(CLASSIC_ROW_VALUES.green).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  });

  it('allows skipping but never returning to an earlier field', () => {
    const player = playerWithRedMarks([2]);
    expect(canMarkValue(player, 'red', 3, [])).toBe(false);
    expect(canMarkValue(player, 'red', 8, [])).toBe(true);
  });

  it('requires five prior marks to close a row', () => {
    expect(canMarkValue(playerWithRedMarks([0, 1, 2, 3]), 'red', 12, [])).toBe(false);
    expect(canMarkValue(playerWithRedMarks([0, 1, 2, 3, 4]), 'red', 12, [])).toBe(true);
  });

  it('rejects every mark in a globally locked row', () => {
    expect(canMarkValue(playerWithRedMarks([]), 'red', 2, ['red'])).toBe(false);
  });

  it('rejects a value outside the row before changing state', () => {
    const player = playerWithRedMarks([]);

    expect(() => addMark(player, 'red', 13)).toThrow(EngineError);
    expect(player.marks.red).toEqual([]);
  });
});
