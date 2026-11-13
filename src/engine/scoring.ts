import type { PlayerState, RowColor } from './types.js';

export const SCORE_TABLE = [
  0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78,
] as const;

export function calculateRowScore(
  player: PlayerState,
  row: RowColor,
): number {
  const markCount =
    player.marks[row].length + (player.closedLocks.includes(row) ? 1 : 0);
  return SCORE_TABLE[markCount] ?? 0;
}

export function calculateScore(player: PlayerState): number {
  return (
    calculateRowScore(player, 'red') +
    calculateRowScore(player, 'yellow') +
    calculateRowScore(player, 'green') +
    calculateRowScore(player, 'blue') -
    player.penalties * 5
  );
}
