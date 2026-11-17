<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  import GameBoard from '#lib/components/GameBoard.svelte';
  import { getLegalActions, getScores, getWinners, type GameState, type PlayerAction } from '../../../engine/index.js';
  import { playerActionId } from '#lib/game/session.js';
  import type { ActionData, PageData } from './$types.js';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let selectedAction = $state<PlayerAction | null>(null);
  let submittedAction = $state<PlayerAction | null>(null);
  let feedback = $state<string | null>(null);
  let sending = $state(false);
  let copied = $state(false);

  const names = $derived(Object.fromEntries(data.view?.participants.map((player) => [player.id, player.nickname]) ?? []));
  const gameState = $derived.by((): GameState | null => {
    if (!data.view?.game) return null;
    const { respondedPlayerIds, ...state } = data.view.game.state;
    return {
      ...state,
      pendingWhiteDecisions: Object.fromEntries(respondedPlayerIds.map((id) => [id, { type: 'PASS_WHITE' as const }])),
    };
  });
  const legalActions = $derived(gameState && data.view ? getLegalActions(gameState, data.view.participantId) : []);
  const currentSelection = $derived(selectedAction && legalActions.some((candidate) => playerActionId(candidate) === playerActionId(selectedAction!)) ? selectedAction : null);
  const pendingAction = $derived(
    submittedAction?.type === 'MARK_WHITE' && gameState?.pendingWhiteDecisions[data.view?.participantId ?? '']
      ? submittedAction
      : null,
  );
  const scores = $derived(gameState ? getScores(gameState) : {});

  $effect(() => {
    if (!data.view) return;
    const interval = window.setInterval(() => void invalidateAll(), 2_000);
    return () => window.clearInterval(interval);
  });

  async function copyLink(): Promise<void> {
    await navigator.clipboard.writeText(window.location.href.split('?')[0]!);
    copied = true;
    window.setTimeout(() => copied = false, 1600);
  }

  async function submit(action: PlayerAction | null): Promise<void> {
    if (!action || sending) return;
    sending = true;
    feedback = null;
    const { playerId: _, ...clientAction } = action;
    const response = await fetch(`/room/${data.code}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(clientAction),
    });
    if (!response.ok) feedback = (await response.json()).message ?? 'Nie udało się zatwierdzić ruchu.';
    else submittedAction = action;
    selectedAction = null;
    sending = false;
    await invalidateAll();
  }
</script>

<svelte:head><title>Pokój {data.code} | Qwixx Online</title></svelte:head>

{#if !data.view}
  <main class="join-page">
    <a href="/" class="brand">Qwixx Online</a>
    <form method="POST" action="?/join" class="join-card">
      <p class="eyebrow">Zaproszenie do pokoju</p><h1>{data.code}</h1>
      <p>Wybierz nick, pod którym zobaczą Cię pozostali gracze.</p>
      <label>Twój nick<input name="nickname" maxlength="24" required value={form?.operation === 'join' ? form.nickname : data.suggestedNickname} /></label>
      {#if form?.operation === 'join'}<p class="error" role="alert">{form.message}</p>{/if}
      <button>Dołącz do stołu</button>
    </form>
  </main>
{:else}
  <main class="room-page">
    <header class="room-header">
      <a href="/" class="brand">Qwixx Online</a>
      <div class="room-code"><span>Kod pokoju</span><strong>{data.view.code}</strong></div>
      <button class="copy" onclick={copyLink}>{copied ? 'Skopiowano' : 'Kopiuj link'}</button>
    </header>

    <div class="layout">
      <aside>
        <p class="eyebrow">Przy stole · {data.view.participants.length}/5</p>
        <div class="players">
          {#each data.view.participants as player, index}
            <div class:active={gameState?.activePlayerIndex === index} class:me={player.id === data.view.participantId}>
              <span class="avatar">{player.nickname.slice(0, 1).toUpperCase()}</span>
              <span>{player.nickname}{player.id === data.view.participantId ? ' (Ty)' : ''}</span>
              {#if gameState}<strong>{scores[player.id] ?? 0}</strong>{/if}
            </div>
          {/each}
        </div>
      </aside>

      {#if data.view.status === 'lobby'}
        <section class="lobby">
          <p class="eyebrow">Poczekalnia</p><h1>Zbieramy skład.</h1>
          <p>Wyślij link znajomym. Gospodarz rozpocznie grę, gdy przy stole będą co najmniej dwie osoby.</p>
          {#if data.view.isHost}
            <form method="POST" action="?/start">
              <button disabled={data.view.participants.length < 2}>Rozpocznij grę</button>
            </form>
          {:else}<p class="waiting">Czekamy na gospodarza…</p>{/if}
          {#if form?.operation === 'start'}<p class="error" role="alert">{form.message}</p>{/if}
        </section>
      {:else if gameState}
        <section class="game">
          <div class="status">
            <div><p class="eyebrow">Tura {gameState.turnNumber}</p>
              {#if gameState.phase === 'white_decisions'}
                <h2>Wspólna decyzja</h2><p>{gameState.pendingWhiteDecisions[data.view.participantId] ? 'Twoja decyzja jest zapisana. Czekamy na pozostałych.' : 'Wybierz legalne pole albo spasuj.'}</p>
              {:else if gameState.phase === 'colored_decision'}
                <h2>Decyzja aktywnego gracza</h2><p>{gameState.players[gameState.activePlayerIndex]?.id === data.view.participantId ? 'Wybierz pole albo spasuj.' : `Ruch: ${names[gameState.players[gameState.activePlayerIndex]?.id ?? ''] ?? 'gracz'}`}</p>
              {:else}<h2>Koniec gry</h2><p>Wygrywa: {getWinners(gameState).map((player) => names[player.id]).join(', ')}</p>{/if}
            </div>
            {#if legalActions.length > 0}
              <div class="actions"><button class="pass" disabled={sending} onclick={() => submit(legalActions.find((action) => action.type.startsWith('PASS')) ?? null)}>Pasuję</button><button disabled={!currentSelection || sending} onclick={() => submit(currentSelection)}>Zatwierdź</button></div>
            {/if}
          </div>
          {#if feedback}<p class="error" role="alert">{feedback}</p>{/if}
          <div class="dice" aria-label="Aktualny rzut">
            <span class="die white">{gameState.dice?.white1}</span><span class="die white">{gameState.dice?.white2}</span>
            {#each Object.entries(gameState.dice?.colors ?? {}) as [color, value]}<span class={`die ${color}`}>{value}</span>{/each}
          </div>
          <GameBoard state={gameState} playerId={data.view.participantId} displayName={names[data.view.participantId]} {legalActions} {selectedAction} {pendingAction} onSelect={(action) => selectedAction = action} />
        </section>
      {/if}
    </div>
  </main>
{/if}

<style>
  :global(*) { box-sizing: border-box; } :global(html) { background: #080b0a; color: #eef3f0; color-scheme: dark; } :global(body) { margin: 0; min-height: 100vh; font-family: "Avenir Next", "Trebuchet MS", sans-serif; background: radial-gradient(circle at 80% 0, #263c31, transparent 34rem), #080b0a; } :global(button) { font: inherit; }
  .brand { color: #f2c735; font-size: .8rem; font-weight: 900; letter-spacing: .12em; text-decoration: none; text-transform: uppercase; }
  .join-page { display: grid; min-height: 100vh; padding: 2rem; place-items: center; } .join-page > .brand { left: 2rem; position: absolute; top: 2rem; }
  .join-card { background: #f4efe3; box-shadow: 12px 12px 0 #e34b43; color: #17211d; max-width: 460px; padding: 2.5rem; width: 100%; } .join-card h1 { font: 900 4rem ui-monospace, monospace; letter-spacing: .15em; margin: .3rem 0; } label { display: grid; font-size: .7rem; font-weight: 900; gap: .4rem; letter-spacing: .1em; margin-top: 1.5rem; text-transform: uppercase; } input { background: white; border: 1px solid #928b7b; color: #17211d; font: inherit; padding: .9rem; }
  button { background: #f2c735; border: 0; color: #171500; cursor: pointer; font-weight: 900; padding: .85rem 1rem; } button:disabled { cursor: not-allowed; opacity: .45; } .join-card button { margin-top: 1rem; width: 100%; }
  .room-page { margin: auto; max-width: 1500px; padding: clamp(1rem, 3vw, 2.8rem); } .room-header { align-items: center; border-bottom: 1px solid #303835; display: flex; gap: 1rem; padding-bottom: 1rem; } .room-code { display: grid; margin-left: auto; } .room-code span, .eyebrow { color: #84918b; font-size: .68rem; font-weight: 900; letter-spacing: .12em; margin: 0 0 .3rem; text-transform: uppercase; } .room-code strong { font: 900 1.25rem ui-monospace, monospace; letter-spacing: .16em; } .copy, .pass { background: transparent; border: 1px solid #65706b; color: #e0e6e3; }
  .layout { display: grid; gap: 1.2rem; grid-template-columns: 240px minmax(0, 1fr); margin-top: 1.3rem; } aside, .lobby, .status, .dice { background: #151a18e8; border: 1px solid #303835; border-radius: 15px; padding: 1.1rem; } aside { align-self: start; } .players { display: grid; gap: .45rem; } .players > div { align-items: center; border-radius: 9px; display: grid; gap: .55rem; grid-template-columns: auto 1fr auto; padding: .55rem; } .players > div.active { background: #285143; } .players > div.me { outline: 1px dashed #77837e; } .avatar { background: #e7eeeb; border-radius: 50%; color: #193025; display: grid; height: 1.8rem; place-items: center; width: 1.8rem; } .players strong { font-size: .75rem; }
  .lobby { min-height: 430px; padding: clamp(2rem, 7vw, 6rem); } .lobby h1 { font-size: clamp(3rem, 8vw, 7rem); letter-spacing: -.07em; margin: .5rem 0; } .lobby > p:not(.eyebrow) { color: #9ba6a1; line-height: 1.6; max-width: 570px; } .lobby form { margin-top: 2rem; } .waiting { border-left: 3px solid #f2c735; padding-left: .8rem; }
  .game { min-width: 0; } .status { align-items: center; display: flex; justify-content: space-between; margin-bottom: .8rem; } .status h2 { margin: 0; } .status p:not(.eyebrow) { color: #929d98; margin: .35rem 0 0; } .actions { display: flex; gap: .5rem; } .dice { display: flex; gap: .5rem; margin-bottom: .8rem; } .die { border-radius: 8px; box-shadow: 0 3px 0 #0008; display: grid; font-size: 1.15rem; font-weight: 900; height: 2.2rem; place-items: center; width: 2.2rem; } .white { background: #f2f5f3; color: #111; } .red { background: #ff3441; } .yellow { background: #f4c31e; color: #342800; } .green { background: #00a850; } .blue { background: #2463df; } .error { color: #ff7d82; font-weight: 800; }
  @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } .status { align-items: stretch; flex-direction: column; gap: 1rem; } .room-header { flex-wrap: wrap; } }
</style>
