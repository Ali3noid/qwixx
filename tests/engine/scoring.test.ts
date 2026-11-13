import { describe, expect, it } from 'vitest';

import {
  SCORE_TABLE,
  calculateRowScore,
  calculateScore,
  createGame,
  type PlayerState,
} from '../../src/engine/index.js';

describe('Classic scoring', () => {
  it.each(SCORE_TABLE.map((score, count) => [count, score]))(
    'scores %i marks as %i points',
    (count, expected) => {
      const base = createGame(['a', 'b']).players[0]!;
      const numberedMarks = Math.min(count, 11);
      const player: PlayerState = {
        ...base,
        marks: {
          ...base.marks,
          red: Array.from({ length: numberedMarks }, (_, index) => index),
        },
        closedLocks: count === 12 ? ['red'] : [],
      };

      expect(calculateRowScore(player, 'red')).toBe(expected);
    },
  );

  it('subtracts five points per penalty', () => {
    const base = createGame(['a', 'b']).players[0]!;
    expect(calculateScore({ ...base, penalties: 4 })).toBe(-20);
  });
});
