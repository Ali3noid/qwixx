export const ROW_COLORS = ['red', 'yellow', 'green', 'blue'] as const;

export type RowColor = (typeof ROW_COLORS)[number];
export type RulesetId = 'classic';
export type Phase =
  | 'awaiting_roll'
  | 'white_decisions'
  | 'colored_decision'
  | 'finished';

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface DiceRoll {
  readonly white1: DieValue;
  readonly white2: DieValue;
  readonly colors: Readonly<Partial<Record<RowColor, DieValue>>>;
}

export interface PlayerState {
  readonly id: string;
  readonly marks: Readonly<Record<RowColor, readonly number[]>>;
  readonly closedLocks: readonly RowColor[];
  readonly penalties: number;
}

export type PendingWhiteDecision =
  | { readonly type: 'MARK_WHITE'; readonly row: RowColor }
  | { readonly type: 'PASS_WHITE' };

export interface GameState {
  readonly rulesetId: RulesetId;
  readonly rulesetVersion: 1;
  readonly players: readonly PlayerState[];
  readonly activePlayerIndex: number;
  readonly phase: Phase;
  readonly dice: DiceRoll | null;
  readonly lockedRows: readonly RowColor[];
  readonly pendingWhiteDecisions: Readonly<
    Partial<Record<string, PendingWhiteDecision>>
  >;
  readonly activePlayerMarkedWhite: boolean;
  readonly turnNumber: number;
}

export type Action =
  | { readonly type: 'ROLL'; readonly dice: DiceRoll }
  | {
      readonly type: 'MARK_WHITE';
      readonly playerId: string;
      readonly row: RowColor;
    }
  | { readonly type: 'PASS_WHITE'; readonly playerId: string }
  | {
      readonly type: 'MARK_COLOR';
      readonly playerId: string;
      readonly row: RowColor;
      readonly whiteDie: 1 | 2;
    }
  | { readonly type: 'PASS_COLOR'; readonly playerId: string };

export type PlayerAction = Exclude<Action, { readonly type: 'ROLL' }>;

export type EngineErrorCode =
  | 'INVALID_GAME'
  | 'INVALID_ROLL'
  | 'UNKNOWN_PLAYER'
  | 'WRONG_PHASE'
  | 'DUPLICATE_DECISION'
  | 'NOT_ACTIVE_PLAYER'
  | 'ILLEGAL_MARK'
  | 'GAME_FINISHED';

export class EngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}
