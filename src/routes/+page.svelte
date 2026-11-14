<script lang="ts">
  import type { ActionData } from './$types.js';
  let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
  <title>Qwixx Online</title>
  <meta name="description" content="Utwórz prywatny pokój Qwixx albo dołącz kodem." />
</svelte:head>

<main>
  <header>
    <p class="kicker">Qwixx Online</p>
    <h1>Twój stół.<br /><em>Wasze tempo.</em></h1>
    <p class="lead">Prywatna rozgrywka Classic dla 2–5 osób. Bez kont, bez instalacji, z jednym linkiem.</p>
  </header>

  <section class="cards">
    <form method="POST" action="?/create">
      <span class="number">01</span><h2>Nowy pokój</h2>
      <p>Zostaniesz gospodarzem i zaprosisz pozostałych graczy.</p>
      <label>Twój nick<input name="nickname" maxlength="24" required autocomplete="nickname" placeholder="np. Ada" value={form?.operation === 'create' ? form.nickname : ''} /></label>
      {#if form?.operation === 'create'}<p class="error" role="alert">{form.message}</p>{/if}
      <button>Utwórz pokój <span>→</span></button>
    </form>

    <form method="POST" action="?/join">
      <span class="number">02</span><h2>Dołącz do gry</h2>
      <p>Wpisz sześci znakowy kod otrzymany od gospodarza.</p>
      <div class="join-fields">
        <label>Kod pokoju<input class="code" name="code" minlength="6" maxlength="6" required autocomplete="off" placeholder="Q7M4RK" value={form?.operation === 'join' ? form.code : ''} /></label>
        <label>Twój nick<input name="nickname" maxlength="24" required autocomplete="nickname" placeholder="np. Bruno" value={form?.operation === 'join' ? form.nickname : ''} /></label>
      </div>
      {#if form?.operation === 'join'}<p class="error" role="alert">{form.message}</p>{/if}
      <button>Wejdź do pokoju <span>→</span></button>
    </form>
  </section>
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { background: #f3efe4; color: #17211d; }
  :global(body) { margin: 0; min-height: 100vh; font-family: "Avenir Next", "Trebuchet MS", sans-serif; background: radial-gradient(circle at 85% 0%, #f7cb38 0 13rem, transparent 13.1rem), linear-gradient(120deg, transparent 0 65%, #e8e1d1 65%); }
  main { margin: auto; max-width: 1220px; padding: clamp(2rem, 7vw, 6rem) clamp(1rem, 5vw, 4rem); }
  header { max-width: 760px; }
  .kicker { color: #c2392f; font-size: .78rem; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; }
  h1 { font-size: clamp(3.7rem, 10vw, 8.3rem); letter-spacing: -.075em; line-height: .78; margin: 1.5rem 0 2rem; }
  h1 em { color: #c2392f; font-style: normal; }
  .lead { font-size: clamp(1rem, 2vw, 1.3rem); line-height: 1.55; max-width: 560px; }
  .cards { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 4rem; }
  form { background: #fffdf6; border: 1px solid #cec6b4; border-radius: 4px; box-shadow: 9px 9px 0 #17211d; padding: clamp(1.4rem, 4vw, 2.5rem); position: relative; }
  .number { color: #c2392f; font-size: .7rem; font-weight: 900; letter-spacing: .15em; }
  h2 { font-size: 2rem; margin: .45rem 0; }
  form > p { color: #657069; line-height: 1.45; }
  label { display: grid; font-size: .72rem; font-weight: 900; gap: .4rem; letter-spacing: .08em; margin-top: 1.3rem; text-transform: uppercase; }
  input { background: #f3efe4; border: 1px solid #aaa28f; border-radius: 2px; font: inherit; font-size: 1rem; padding: .85rem; text-transform: none; }
  input:focus { outline: 3px solid #f7cb38; outline-offset: 1px; }
  input.code { font-family: ui-monospace, monospace; font-size: 1.15rem; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
  .join-fields { display: grid; gap: .7rem; grid-template-columns: .8fr 1.2fr; }
  button { align-items: center; background: #17211d; border: 0; color: white; cursor: pointer; display: flex; font: inherit; font-weight: 900; justify-content: space-between; margin-top: 1.5rem; padding: 1rem; width: 100%; }
  button span { color: #f7cb38; font-size: 1.4rem; }
  form > .error { color: #b72d26; font-size: .85rem; font-weight: 800; }
  @media (max-width: 720px) { .cards { grid-template-columns: 1fr; } .join-fields { grid-template-columns: 1fr; } }
</style>
