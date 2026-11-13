import { canMarkValue } from './classic-rules.js';
import { calculateScore } from './scoring.js';
import type {
  GameState,
  PlayerAction,
  PlayerState,
  RowColor,
} from './types.js';
import { ROW_COLORS } from './types.js';

export function getLegalActions(
  state: GameState,
  playerId: string,
): PlayerAction[] {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || state.phase === 'finished' || !state.dice) return [];

  if (state.phase === 'white_decisions') {
    if (state.pendingWhiteDecisions[playerId]) return [];
    const value = state.dice.white1 + state.dice.white2;
    const actions: PlayerAction[] = [];
    for (const row of ROW_COLORS) {
      if (canMarkValue(player, row, value, state.lockedRows)) {
        actions.push({ type: 'MARK_WHITE', playerId, row });
      }
    }
    actions.push({ type: 'PASS_WHITE', playerId });
    return actions;
  }

  if (
    state.phase !== 'colored_decision' ||
    state.players[state.activePlayerIndex]?.id !== playerId
  ) {
    return [];
  }

  const actions: PlayerAction[] = [];
  for (const row of ROW_COLORS) {
    const colorValue = state.dice.colors[row];
    if (colorValue === undefined || state.lockedRows.includes(row)) continue;
    for (const whiteDie of [1, 2] as const) {
      const whiteValue =
        whiteDie === 1 ? state.dice.white1 : state.dice.white2;
      if (canMarkValue(player, row, whiteValue + colorValue, state.lockedRows)) {
        actions.push({ type: 'MARK_COLOR', playerId, row, whiteDie });
      }
    }
  }
  actions.push({ type: 'PASS_COLOR', playerId });
  return actions;
}

export function isGameOver(state: GameState): boolean {
  return state.phase === 'finished';
}

export function getScores(state: GameState): Readonly<Record<string, number>> {
  return Object.fromEntries(
    state.players.map((player) => [player.id, calculateScore(player)]),
  );
}

export function getWinners(state: GameState): readonly PlayerState[] {
  if (!isGameOver(state)) return [];
  const scores = state.players.map(calculateScore);
  const best = Math.max(...scores);
  return state.players.filter((_, index) => scores[index] === best);
}

export function coloredValue(
  state: GameState,
  row: RowColor,
  whiteDie: 1 | 2,
): number | null {
  if (!state.dice) return null;
  const color = state.dice.colors[row];
  if (color === undefined) return null;
  return color + (whiteDie === 1 ? state.dice.white1 : state.dice.white2);
}
