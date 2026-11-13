import { describe, expect, it } from 'vitest';

import {
  EngineError,
  applyAction,
  calculateRowScore,
  createGame,
  getLegalActions,
  type DiceRoll,
  type GameState,
  type PlayerState,
  type RowColor,
} from '../../src/engine/index.js';

const FULL_ROLL: DiceRoll = {
  white1: 6,
  white2: 6,
  colors: { red: 1, yellow: 2, green: 3, blue: 4 },
};

function withMarks(
  state: GameState,
  playerId: string,
  row: RowColor,
  marks: readonly number[],
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, marks: { ...player.marks, [row]: marks } }
        : player,
    ),
  };
}

function player(state: GameState, id: string): PlayerState {
  return state.players.find((candidate) => candidate.id === id)!;
}

function roll(state: GameState, dice: DiceRoll = FULL_ROLL): GameState {
  return applyAction(state, { type: 'ROLL', dice });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('game creation and validation', () => {
  it('accepts 2-5 unique players', () => {
    expect(createGame(['a', 'b']).players).toHaveLength(2);
    expect(createGame(['a', 'b', 'c', 'd', 'e']).players).toHaveLength(5);
  });

  it.each(
    [['a'], ['a', 'a'], ['a', 'b', 'c', 'd', 'e', 'f']].map(
      (ids) => [ids] as const,
    ),
  )(
    'rejects an invalid player list',
    (ids) => expect(() => createGame(ids)).toThrow(EngineError),
  );

  it('requires exactly the dice for open rows', () => {
    const invalid = { ...FULL_ROLL, colors: { red: 1 } } as DiceRoll;
    expect(() => roll(createGame(['a', 'b']), invalid)).toThrow(EngineError);
  });
});

describe('white phase atomicity and row closing', () => {
  function readyToCloseSameRow(): GameState {
    let state = createGame(['a', 'b']);
    state = withMarks(state, 'a', 'red', [0, 1, 2, 3, 4]);
    return withMarks(state, 'b', 'red', [0, 1, 2, 3, 4]);
  }

  function closeInOrder(order: readonly string[]): GameState {
    let state = roll(readyToCloseSameRow());
    state = applyAction(state, { type: 'MARK_WHITE', playerId: order[0]!, row: 'red' });

    expect(player(state, 'a').marks.red).toHaveLength(5);
    expect(player(state, 'b').marks.red).toHaveLength(5);

    return applyAction(state, {
      type: 'MARK_WHITE',
      playerId: order[1]!,
      row: 'red',
    });
  }

  it('lets multiple players close the same row and awards each lock', () => {
    const state = closeInOrder(['b', 'a']);

    expect(state.phase).toBe('colored_decision');
    expect(state.lockedRows).toEqual(['red']);
    for (const id of ['a', 'b']) {
      expect(player(state, id).marks.red).toEqual([0, 1, 2, 3, 4, 10]);
      expect(player(state, id).closedLocks).toEqual(['red']);
      expect(calculateRowScore(player(state, id), 'red')).toBe(28);
    }
  });

  it('produces the same state regardless of submission order', () => {
    expect(closeInOrder(['a', 'b'])).toEqual(closeInOrder(['b', 'a']));
  });

  it('does not offer a color closed in the white phase', () => {
    const state = closeInOrder(['a', 'b']);
    const actions = getLegalActions(state, 'a');
    expect(actions.some((action) => action.type === 'MARK_COLOR' && action.row === 'red')).toBe(false);
  });

  it('requires the closed color die to be absent from the next roll', () => {
    let state = closeInOrder(['a', 'b']);
    state = applyAction(state, { type: 'PASS_COLOR', playerId: 'a' });

    expect(() => roll(state, FULL_ROLL)).toThrow(EngineError);
    expect(() =>
      roll(state, {
        white1: 1,
        white2: 2,
        colors: { yellow: 2, green: 3, blue: 4 },
      }),
    ).not.toThrow();
  });

  it('finishes after a second lock in white phase without color phase or penalty', () => {
    let state = readyToCloseSameRow();
    state = {
      ...state,
      lockedRows: ['blue'],
      players: state.players.map((candidate, index) => ({
        ...candidate,
        penalties: index === 0 ? 3 : candidate.penalties,
        closedLocks: index === 1 ? ['blue'] : candidate.closedLocks,
      })),
    };
    state = roll(state, {
      white1: 6,
      white2: 6,
      colors: { red: 1, yellow: 2, green: 3 },
    });
    state = applyAction(state, { type: 'MARK_WHITE', playerId: 'a', row: 'red' });
    state = applyAction(state, { type: 'MARK_WHITE', playerId: 'b', row: 'red' });

    expect(state.phase).toBe('finished');
    expect(state.lockedRows).toEqual(['red', 'blue']);
    expect(player(state, 'a').closedLocks).toContain('red');
    expect(player(state, 'b').closedLocks).toEqual(['blue', 'red']);
    expect(player(state, 'a').penalties).toBe(3);
    expect(getLegalActions(state, 'a')).toEqual([]);
  });

  it('applies different simultaneous closures before finishing', () => {
    let state = createGame(['a', 'b']);
    state = withMarks(state, 'a', 'red', [0, 1, 2, 3, 4]);
    state = withMarks(state, 'b', 'yellow', [0, 1, 2, 3, 4]);
    state = roll(state);
    state = applyAction(state, { type: 'MARK_WHITE', playerId: 'a', row: 'red' });
    state = applyAction(state, { type: 'MARK_WHITE', playerId: 'b', row: 'yellow' });

    expect(state.phase).toBe('finished');
    expect(state.lockedRows).toEqual(['red', 'yellow']);
    expect(player(state, 'a').closedLocks).toEqual(['red']);
    expect(player(state, 'b').closedLocks).toEqual(['yellow']);
  });
});

describe('turn flow, penalties, and invariants', () => {
  it('offers each white die separately for a colored mark', () => {
    let state = roll(createGame(['a', 'b']), {
      white1: 1,
      white2: 2,
      colors: { red: 1, yellow: 2, green: 3, blue: 4 },
    });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'a' });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'b' });

    const redActions = getLegalActions(state, 'a').filter(
      (action) => action.type === 'MARK_COLOR' && action.row === 'red',
    );
    expect(redActions).toEqual([
      { type: 'MARK_COLOR', playerId: 'a', row: 'red', whiteDie: 1 },
      { type: 'MARK_COLOR', playerId: 'a', row: 'red', whiteDie: 2 },
    ]);
  });

  it('awards exactly one penalty after passing both phases', () => {
    let state = roll(createGame(['a', 'b']));
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'a' });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'b' });
    state = applyAction(state, { type: 'PASS_COLOR', playerId: 'a' });

    expect(player(state, 'a').penalties).toBe(1);
    expect(player(state, 'b').penalties).toBe(0);
    expect(state.activePlayerIndex).toBe(1);
    expect(state.phase).toBe('awaiting_roll');
  });

  it('does not penalize an active player who marked in the white phase', () => {
    let state = roll(createGame(['a', 'b']), {
      white1: 1,
      white2: 1,
      colors: { red: 1, yellow: 2, green: 3, blue: 4 },
    });
    state = applyAction(state, { type: 'MARK_WHITE', playerId: 'a', row: 'red' });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'b' });
    state = applyAction(state, { type: 'PASS_COLOR', playerId: 'a' });

    expect(player(state, 'a').penalties).toBe(0);
  });

  it('does not penalize an active player who marked only in the color phase', () => {
    let state = roll(createGame(['a', 'b']), {
      white1: 1,
      white2: 1,
      colors: { red: 1, yellow: 2, green: 3, blue: 4 },
    });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'a' });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'b' });
    state = applyAction(state, {
      type: 'MARK_COLOR',
      playerId: 'a',
      row: 'red',
      whiteDie: 1,
    });

    expect(player(state, 'a').marks.red).toEqual([0]);
    expect(player(state, 'a').penalties).toBe(0);
  });

  it('applies the white mark before a color mark in the same row', () => {
    let state = roll(createGame(['a', 'b']), {
      white1: 1,
      white2: 1,
      colors: { red: 2, yellow: 2, green: 3, blue: 4 },
    });
    state = applyAction(state, { type: 'MARK_WHITE', playerId: 'a', row: 'red' });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'b' });
    state = applyAction(state, {
      type: 'MARK_COLOR',
      playerId: 'a',
      row: 'red',
      whiteDie: 1,
    });

    expect(player(state, 'a').marks.red).toEqual([0, 1]);
  });

  it('rejects a color decision from a non-active player', () => {
    let state = roll(createGame(['a', 'b']));
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'a' });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'b' });

    expect(() =>
      applyAction(state, { type: 'PASS_COLOR', playerId: 'b' }),
    ).toThrow(EngineError);
  });

  it('finishes when a colored mark closes the second row', () => {
    let state = createGame(['a', 'b']);
    state = withMarks(state, 'a', 'red', [0, 1, 2, 3, 4]);
    state = { ...state, lockedRows: ['blue'] };
    state = roll(state, {
      white1: 6,
      white2: 5,
      colors: { red: 6, yellow: 2, green: 3 },
    });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'a' });
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'b' });
    state = applyAction(state, {
      type: 'MARK_COLOR',
      playerId: 'a',
      row: 'red',
      whiteDie: 1,
    });

    expect(state.phase).toBe('finished');
    expect(state.lockedRows).toEqual(['red', 'blue']);
    expect(player(state, 'a').closedLocks).toEqual(['red']);
  });

  it('plays a complete legal game ending on the fourth penalty', () => {
    let state = createGame(['a', 'b']);
    while (state.phase !== 'finished') {
      const activeId = state.players[state.activePlayerIndex]!.id;
      state = roll(state);
      for (const participant of state.players) {
        state = applyAction(state, {
          type: 'PASS_WHITE',
          playerId: participant.id,
        });
      }
      state = applyAction(state, { type: 'PASS_COLOR', playerId: activeId });
    }

    expect(player(state, 'a').penalties).toBe(4);
    expect(state.turnNumber).toBe(7);
  });

  it('rejects duplicates and actions after game end', () => {
    let state = roll(createGame(['a', 'b']));
    state = applyAction(state, { type: 'PASS_WHITE', playerId: 'a' });
    expect(() =>
      applyAction(state, { type: 'PASS_WHITE', playerId: 'a' }),
    ).toThrow(EngineError);

    let finished = createGame(['a', 'b']);
    finished = {
      ...finished,
      phase: 'finished',
    };
    expect(() => applyAction(finished, { type: 'ROLL', dice: FULL_ROLL })).toThrow(
      EngineError,
    );
  });

  it('does not mutate a deeply frozen input state', () => {
    const state = deepFreeze(createGame(['a', 'b']));
    const next = roll(state);
    expect(state.phase).toBe('awaiting_roll');
    expect(next.phase).toBe('white_decisions');
  });
});
