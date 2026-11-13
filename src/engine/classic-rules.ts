import { EngineError, type PlayerState, type RowColor } from './types.js';

export const CLASSIC_ROW_VALUES: Readonly<Record<RowColor, readonly number[]>> = {
  red: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  yellow: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  green: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  blue: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
};

export const LAST_FIELD_INDEX = 10;
export const REQUIRED_MARKS_TO_CLOSE = 5;

export function fieldIndex(row: RowColor, value: number): number {
  return CLASSIC_ROW_VALUES[row].indexOf(value);
}

export function canMarkValue(
  player: PlayerState,
  row: RowColor,
  value: number,
  lockedRows: readonly RowColor[],
): boolean {
  if (lockedRows.includes(row)) return false;

  const index = fieldIndex(row, value);
  if (index < 0) return false;

  const marks = player.marks[row];
  const lastMark = marks.at(-1) ?? -1;
  if (index <= lastMark) return false;

  return index !== LAST_FIELD_INDEX || marks.length >= REQUIRED_MARKS_TO_CLOSE;
}

export function addMark(
  player: PlayerState,
  row: RowColor,
  value: number,
): { readonly player: PlayerState; readonly closesRow: boolean } {
  const index = fieldIndex(row, value);
  if (index < 0) {
    throw new EngineError(
      'ILLEGAL_MARK',
      `Value ${value} does not exist in the ${row} row.`,
    );
  }
  const closesRow = index === LAST_FIELD_INDEX;

  return {
    player: {
      ...player,
      marks: { ...player.marks, [row]: [...player.marks[row], index] },
      closedLocks: closesRow
        ? [...player.closedLocks, row]
        : player.closedLocks,
    },
    closesRow,
  };
}
