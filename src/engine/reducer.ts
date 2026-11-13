import { addMark, canMarkValue } from './classic-rules.js';
import { coloredValue, getLegalActions } from './selectors.js';
import {
  EngineError,
  ROW_COLORS,
  type Action,
  type DiceRoll,
  type GameState,
  type PendingWhiteDecision,
  type PlayerState,
  type RowColor,
} from './types.js';

function emptyMarks(): Record<RowColor, readonly number[]> {
  return { red: [], yellow: [], green: [], blue: [] };
}

export function createGame(playerIds: readonly string[]): GameState {
  if (
    playerIds.length < 2 ||
    playerIds.length > 5 ||
    playerIds.some((id) => id.trim().length === 0) ||
    new Set(playerIds).size !== playerIds.length
  ) {
    throw new EngineError(
      'INVALID_GAME',
      'Classic Qwixx requires 2-5 players with unique, non-empty ids.',
    );
  }

  return {
    rulesetId: 'classic',
    rulesetVersion: 1,
    players: playerIds.map((id) => ({
      id,
      marks: emptyMarks(),
      closedLocks: [],
      penalties: 0,
    })),
    activePlayerIndex: 0,
    phase: 'awaiting_roll',
    dice: null,
    lockedRows: [],
    pendingWhiteDecisions: {},
    activePlayerMarkedWhite: false,
    turnNumber: 1,
  };
}

function assertPlayer(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new EngineError('UNKNOWN_PLAYER', `Unknown player: ${playerId}`);
  }
  return player;
}

function assertRoll(state: GameState, dice: DiceRoll): void {
  const values = [dice.white1, dice.white2, ...Object.values(dice.colors)];
  if (values.some((value) => !Number.isInteger(value) || value < 1 || value > 6)) {
    throw new EngineError('INVALID_ROLL', 'Every die must be an integer from 1 to 6.');
  }

  const keys = Object.keys(dice.colors);
  const expected = ROW_COLORS.filter((row) => !state.lockedRows.includes(row));
  if (
    keys.some((key) => !ROW_COLORS.includes(key as RowColor)) ||
    keys.length !== expected.length ||
    expected.some((row) => dice.colors[row] === undefined)
  ) {
    throw new EngineError(
      'INVALID_ROLL',
      'A roll must contain exactly the dice for unlocked rows.',
    );
  }
}

function withPlayer(
  players: readonly PlayerState[],
  player: PlayerState,
): readonly PlayerState[] {
  return players.map((candidate) =>
    candidate.id === player.id ? player : candidate,
  );
}

function appendLockedRows(
  lockedRows: readonly RowColor[],
  additions: readonly RowColor[],
): readonly RowColor[] {
  return ROW_COLORS.filter(
    (row) => lockedRows.includes(row) || additions.includes(row),
  );
}

function resolveWhiteDecisions(
  state: GameState,
  pendingWhiteDecisions: GameState['pendingWhiteDecisions'],
): GameState {
  let players = state.players;
  const closedRows: RowColor[] = [];

  for (const originalPlayer of state.players) {
    const decision = pendingWhiteDecisions[originalPlayer.id];
    if (!decision) {
      throw new EngineError('WRONG_PHASE', 'White phase is incomplete.');
    }
    if (decision.type === 'PASS_WHITE') continue;

    const value = state.dice!.white1 + state.dice!.white2;
    const result = addMark(originalPlayer, decision.row, value);
    players = withPlayer(players, result.player);
    if (result.closesRow) closedRows.push(decision.row);
  }

  const lockedRows = appendLockedRows(state.lockedRows, closedRows);
  const activePlayer = state.players[state.activePlayerIndex]!;
  const activePlayerMarkedWhite =
    pendingWhiteDecisions[activePlayer.id]?.type === 'MARK_WHITE';

  return {
    ...state,
    players,
    lockedRows,
    pendingWhiteDecisions: {},
    activePlayerMarkedWhite,
    phase: lockedRows.length >= 2 ? 'finished' : 'colored_decision',
  };
}

function finishColoredDecision(
  state: GameState,
  players: readonly PlayerState[],
  lockedRows: readonly RowColor[],
  markedColor: boolean,
): GameState {
  if (lockedRows.length >= 2) {
    return { ...state, players, lockedRows, phase: 'finished' };
  }

  let finalPlayers = players;
  const activePlayer = players[state.activePlayerIndex]!;
  if (!state.activePlayerMarkedWhite && !markedColor) {
    finalPlayers = withPlayer(players, {
      ...activePlayer,
      penalties: activePlayer.penalties + 1,
    });
  }

  const penalizedActive = finalPlayers[state.activePlayerIndex]!;
  if (penalizedActive.penalties >= 4) {
    return { ...state, players: finalPlayers, lockedRows, phase: 'finished' };
  }

  return {
    ...state,
    players: finalPlayers,
    lockedRows,
    activePlayerIndex: (state.activePlayerIndex + 1) % state.players.length,
    phase: 'awaiting_roll',
    dice: null,
    pendingWhiteDecisions: {},
    activePlayerMarkedWhite: false,
    turnNumber: state.turnNumber + 1,
  };
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase === 'finished') {
    throw new EngineError('GAME_FINISHED', 'A finished game accepts no actions.');
  }

  if (action.type === 'ROLL') {
    if (state.phase !== 'awaiting_roll') {
      throw new EngineError('WRONG_PHASE', 'A roll is only valid at turn start.');
    }
    assertRoll(state, action.dice);
    return { ...state, dice: action.dice, phase: 'white_decisions' };
  }

  const player = assertPlayer(state, action.playerId);

  if (action.type === 'MARK_WHITE' || action.type === 'PASS_WHITE') {
    if (state.phase !== 'white_decisions' || !state.dice) {
      throw new EngineError('WRONG_PHASE', 'White decisions are not active.');
    }
    if (state.pendingWhiteDecisions[action.playerId]) {
      throw new EngineError(
        'DUPLICATE_DECISION',
        'A player may submit one white decision.',
      );
    }
    if (
      action.type === 'MARK_WHITE' &&
      !canMarkValue(
        player,
        action.row,
        state.dice.white1 + state.dice.white2,
        state.lockedRows,
      )
    ) {
      throw new EngineError('ILLEGAL_MARK', 'Illegal white mark.');
    }

    const decision: PendingWhiteDecision =
      action.type === 'MARK_WHITE'
        ? { type: 'MARK_WHITE', row: action.row }
        : { type: 'PASS_WHITE' };
    const pendingWhiteDecisions = {
      ...state.pendingWhiteDecisions,
      [action.playerId]: decision,
    };
    const pendingState = { ...state, pendingWhiteDecisions };
    return Object.keys(pendingWhiteDecisions).length === state.players.length
      ? resolveWhiteDecisions(pendingState, pendingWhiteDecisions)
      : pendingState;
  }

  if (state.phase !== 'colored_decision' || !state.dice) {
    throw new EngineError('WRONG_PHASE', 'Colored decision is not active.');
  }
  if (state.players[state.activePlayerIndex]?.id !== action.playerId) {
    throw new EngineError(
      'NOT_ACTIVE_PLAYER',
      'Only the active player may make a colored decision.',
    );
  }

  if (action.type === 'PASS_COLOR') {
    return finishColoredDecision(state, state.players, state.lockedRows, false);
  }

  const value = coloredValue(state, action.row, action.whiteDie);
  const isListed = getLegalActions(state, action.playerId).some(
    (candidate) =>
      candidate.type === 'MARK_COLOR' &&
      candidate.row === action.row &&
      candidate.whiteDie === action.whiteDie,
  );
  if (value === null || !isListed) {
    throw new EngineError('ILLEGAL_MARK', 'Illegal colored mark.');
  }

  const result = addMark(player, action.row, value);
  const players = withPlayer(state.players, result.player);
  const lockedRows = result.closesRow
    ? appendLockedRows(state.lockedRows, [action.row])
    : state.lockedRows;
  return finishColoredDecision(state, players, lockedRows, true);
}
