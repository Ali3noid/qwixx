import {
  ROW_COLORS,
  applyAction,
  createGame,
  getLegalActions,
  type DiceRoll,
  type GameState,
  type PlayerAction,
  type RowColor,
} from '../../engine';

export type SessionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** A server room will implement this boundary later; the local demo is not multiplayer. */
export interface GameSession {
  readonly state: GameState;
  roll(): void;
  submit(action: PlayerAction): SessionResult;
}

function die(): 1 | 2 | 3 | 4 | 5 | 6 {
  return (Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}

function nextRoll(state: GameState): DiceRoll {
  return {
    white1: die(),
    white2: die(),
    colors: Object.fromEntries(
      ROW_COLORS.filter((row) => !state.lockedRows.includes(row)).map((row) => [row, die()]),
    ) as DiceRoll['colors'],
  };
}

export function createLocalDemoSession(playerIds: readonly string[]): GameSession {
  let gameState = createGame(playerIds);

  return {
    get state() {
      return gameState;
    },
    roll() {
      gameState = applyAction(gameState, { type: 'ROLL', dice: nextRoll(gameState) });
    },
    submit(action) {
      const legalAction = getLegalActions(gameState, action.playerId).find(
        (candidate) => playerActionId(candidate) === playerActionId(action),
      );
      if (!legalAction) {
        return { ok: false, message: 'Ten ruch nie jest już legalny. Odświeżono stan gry.' };
      }

      try {
        gameState = applyAction(gameState, action);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Nie udało się zatwierdzić ruchu.',
        };
      }
    },
  };
}

export function playerActionId(action: PlayerAction): string {
  if (action.type === 'PASS_WHITE' || action.type === 'PASS_COLOR') {
    return `${action.type}:${action.playerId}`;
  }
  if (action.type === 'MARK_WHITE') {
    return `${action.type}:${action.playerId}:${action.row}`;
  }
  return `${action.type}:${action.playerId}:${action.row}:${action.whiteDie}`;
}

export function actionValue(state: GameState, action: PlayerAction): number | null {
  if (!state.dice || action.type === 'PASS_WHITE' || action.type === 'PASS_COLOR') return null;
  if (action.type === 'MARK_WHITE') return state.dice.white1 + state.dice.white2;
  const colorDie = state.dice.colors[action.row];
  if (colorDie === undefined) return null;
  return colorDie + (action.whiteDie === 1 ? state.dice.white1 : state.dice.white2);
}

export function playerName(playerId: string): string {
  return playerId.replace(/^player-/, 'Gracz ');
}

export const rowLabels: Readonly<Record<RowColor, string>> = {
  red: 'Czerwony', yellow: 'Żółty', green: 'Zielony', blue: 'Niebieski',
};
