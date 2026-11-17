<script lang="ts">
  import { CLASSIC_ROW_VALUES, calculateRowScore, getScores, type GameState, type PlayerAction, type RowColor } from '../../engine';
  import { actionValue, playerActionId, rowLabels } from '../game/session';

  interface Props {
    state: GameState;
    playerId: string;
    displayName?: string;
    legalActions: readonly PlayerAction[];
    selectedAction: PlayerAction | null;
    pendingAction?: PlayerAction | null;
    onSelect: (action: PlayerAction) => void;
  }

  let { state: gameState, playerId, displayName = playerId, legalActions, selectedAction, pendingAction = null, onSelect }: Props = $props();
  let choiceActions = $state<PlayerAction[]>([]);

  const colorClass: Record<RowColor, string> = {
    red: 'row-red', yellow: 'row-yellow', green: 'row-green', blue: 'row-blue',
  };

  function actionsForCell(row: RowColor, value: number): PlayerAction[] {
    return legalActions.filter((action) => actionValue(gameState, action) === value && 'row' in action && action.row === row);
  }

  function selectCell(actions: PlayerAction[]): void {
    if (actions.length === 1) {
      choiceActions = [];
      onSelect(actions[0]!);
      return;
    }
    choiceActions = actions;
  }

  function selectChoice(action: PlayerAction): void {
    choiceActions = [];
    onSelect(action);
  }

  function isSelected(action: PlayerAction): boolean {
    return selectedAction !== null && playerActionId(action) === playerActionId(selectedAction);
  }

  const player = $derived(gameState.players.find((candidate) => candidate.id === playerId)!);
  const score = $derived(getScores(gameState)[playerId] ?? 0);
</script>

<section class="board" aria-label={`Arkusz gracza ${displayName}`}>
  <header>
    <div>
      <p class="eyebrow">Arkusz</p>
      <h2>{displayName}</h2>
    </div>
    <strong class="score">{score} pkt</strong>
  </header>

  <div class="rows">
    {#each Object.entries(CLASSIC_ROW_VALUES) as [row, values]}
            {@const color = row as RowColor}
            {@const rowScore = calculateRowScore(player, color)}
      <div class={`score-row ${colorClass[color]} ${gameState.lockedRows.includes(color) ? 'locked' : ''}`}>
        <span class="row-arrow" aria-hidden="true"></span>
        <div class="cells" aria-label={`${rowLabels[color]} rząd`}>
          {#each values as value, index}
            {@const choices = actionsForCell(color, value)}
            {@const pending = pendingAction !== null && 'row' in pendingAction && pendingAction.row === color && actionValue(gameState, pendingAction) === value}
            {@const marked = player.marks[color].includes(index) || pending}
            {@const lastMarkedIndex = Math.max(player.marks[color].at(-1) ?? -1, pending ? index : -1)}
            {@const skipped = !marked && index < lastMarkedIndex}
            <button
              class:marked
              class:skipped
              class:legal={choices.length > 0}
              class:selected={choices.some(isSelected)}
              disabled={choices.length === 0}
              aria-label={`${rowLabels[color]} ${value}`}
              onclick={() => selectCell(choices)}
            >{value}</button>
          {/each}
          <span class:earned={player.closedLocks.includes(color)} class="lock" title="Kłódka" aria-label={`Kłódka: ${rowLabels[color]}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z" />
            </svg>
          </span>
        </div>
        <div class="row-score" aria-label={`${rowLabels[color]}: ${rowScore} pkt`}>
          <strong>{rowScore}</strong>
          <span>pkt</span>
        </div>
      </div>
    {/each}
  </div>

  {#if choiceActions.length > 1}
    <div class="choice-picker" role="group" aria-label="Wybór białej kości">
      <span>Wybierz białą kość używaną w ruchu:</span>
      {#each choiceActions as action}
        {#if action.type === 'MARK_COLOR'}
          <button onclick={() => selectChoice(action)}>Biała kość {action.whiteDie}</button>
        {/if}
      {/each}
    </div>
  {/if}

  <footer aria-label="Kary">
    <span>Kary</span>
    {#each Array(4) as _, index}
      <span class:penalty={index < player.penalties} class="penalty-box">×</span>
    {/each}
  </footer>
</section>

<style>
  .board { background: #0c0e0e; border: 1px solid #272c2b; border-radius: 22px; box-shadow: 0 24px 70px #0008; padding: clamp(.85rem, 2.5vw, 1.5rem); }
  header, footer { align-items: center; display: flex; justify-content: space-between; }
  h2 { color: #f3f6f5; font-size: 1.25rem; margin: 0; }
  .eyebrow { color: #828b88; font-size: .7rem; letter-spacing: .12em; margin: 0 0 .2rem; text-transform: uppercase; }
  .score { color: #f3f6f5; font-size: 1.35rem; }
  .rows { display: grid; gap: .72rem; margin: 1.15rem 0; min-width: 720px; }
  .score-row { align-items: stretch; border-radius: 18px; display: grid; gap: .55rem; grid-template-columns: 2rem minmax(0, 1fr) 2.7rem; padding: .62rem .7rem; }
  .row-red { --row-dark: #b40013; --cell: #ffc3c8; --ink: #b80017; background: #ff2f3c; }
  .row-yellow { --row-dark: #b87800; --cell: #fff6bd; --ink: #aa6500; background: #ffc400; }
  .row-green { --row-dark: #00763e; --cell: #aef0ca; --ink: #00693a; background: #00ae4d; }
  .row-blue { --row-dark: #1747bc; --cell: #b3d1fb; --ink: #1747b8; background: #2463ed; }
  .locked { filter: saturate(.35); opacity: .78; }
  .row-arrow { align-self: center; border-bottom: .85rem solid transparent; border-left: 1.2rem solid var(--row-dark); border-top: .85rem solid transparent; height: 0; justify-self: center; width: 0; }
  .cells { display: grid; gap: .42rem; grid-template-columns: repeat(11, minmax(2.6rem, 1fr)) 2.75rem; }
  .cells button { aspect-ratio: 1.02; background: var(--cell); border: 0; border-radius: 13px; box-shadow: 0 4px 7px #0002; color: var(--ink); font: inherit; font-size: clamp(1.05rem, 1.9vw, 1.32rem); font-weight: 900; min-width: 0; padding: 0; position: relative; transition: transform 120ms ease, box-shadow 120ms ease; }
  .cells button:disabled { cursor: default; }
  .cells button.marked { background: color-mix(in srgb, var(--cell) 55%, var(--row-dark)); color: transparent; position: relative; }
  .cells button.marked::after { color: var(--ink); content: '×'; font-size: 2.05em; left: 50%; position: absolute; top: 46%; transform: translate(-50%, -50%); }
  .cells button.skipped { background: color-mix(in srgb, var(--cell) 52%, #26302c); color: color-mix(in srgb, var(--ink) 48%, #26302c); opacity: .78; }
  .cells button.skipped::after { background: color-mix(in srgb, var(--row-dark) 78%, #101513); border-radius: 999px; content: ''; height: .22rem; left: .38rem; position: absolute; right: .38rem; top: 50%; transform: rotate(-4deg); }
  .cells button.legal { background: color-mix(in srgb, var(--row-dark) 68%, #6b7470); box-shadow: 0 0 0 3px #101513, 0 0 0 6px #fff; color: white; cursor: pointer; outline: 2px solid var(--row-dark); outline-offset: 5px; transform: translateY(-2px); z-index: 1; }
  .cells button.selected { background: var(--row-dark); color: white; outline: 3px solid white; outline-offset: 2px; }
  .lock { align-items: center; background: color-mix(in srgb, var(--cell) 82%, white); border-radius: 50%; color: var(--ink); display: grid; place-items: center; }
  .lock svg { fill: none; height: 1.65rem; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2; width: 1.65rem; }
  .lock.earned { background: var(--row-dark); color: white; }
  .row-score { align-content: center; color: white; display: grid; justify-items: center; line-height: 1; }
  .row-score strong { font-size: 1.25rem; }
  .row-score span { font-size: .58rem; letter-spacing: .06em; margin-top: .25rem; text-transform: uppercase; }
  .choice-picker { align-items: center; background: #1b211f; border: 1px solid #39433f; border-radius: 12px; color: #cbd3d0; display: flex; flex-wrap: wrap; gap: .55rem; margin: -.35rem 0 1rem; padding: .7rem; }
  .choice-picker span { font-size: .78rem; margin-right: auto; }
  .choice-picker button { background: #f0c52f; border: 0; border-radius: 8px; color: #181400; cursor: pointer; font-weight: 900; padding: .5rem .7rem; }
  footer { border-top: 1px solid #2a2f2e; color: #aeb6b3; font-size: .85rem; gap: .55rem; justify-content: flex-start; padding-top: .9rem; }
  .penalty-box { border: 1px solid #555e5b; border-radius: 6px; color: transparent; display: inline-grid; height: 1.5rem; place-items: center; width: 1.5rem; }
  .penalty-box.penalty { background: #ff3442; border-color: #ff3442; color: white; }
  @media (max-width: 900px) { .board { overflow-x: auto; } }
</style>
