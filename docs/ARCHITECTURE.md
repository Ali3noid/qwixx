# Qwixx AI — architektura MVP

**Status:** projekt techniczny v0.1  
**Pierwszy ruleset:** `classic`  
**Cel długoterminowy:** gra online + laboratorium AI (heurystyki, Monte Carlo, reinforcement learning, porównywanie agentów).

## 1. Decyzje architektoniczne

1. **Najpierw silnik bez UI i sieci.** Musi umieć rozegrać kompletną partię oraz uruchamiać wiele symulacji w pamięci.
2. **Jedno źródło reguł.** UI, backend i agenci nie implementują zasad niezależnie; wywołują silnik.
3. **Deterministyczne przejścia.** Losowość jest zewnętrzna wobec reduktora stanu; seed pozwala odtworzyć eksperyment.
4. **Małe API, brak mikroserwisów.** TypeScript na start; SvelteKit i Supabase dopiero w etapie multiplayer.
5. **Classic jako wersjonowany ruleset.** Przyszłe dodatki nie są teraz implementowane ani abstrakcyjnie modelowane na zapas.
6. **Oddzielenie treningu od gry online.** Symulacje i trening nie obciążają serwera obsługującego rozgrywki znajomych.
7. **Uczciwe obserwacje AI.** Agent widzi tylko dane dostępne graczowi; nie widzi przyszłych rzutów ani prywatnych stanów ukrytych przez reguły.

## 2. Moduły

```text
qwixx-ai/
├── src/
│   ├── engine/
│   │   ├── types.ts            # stan, akcje, identyfikatory
│   │   ├── classic-rules.ts    # legalność, fazy, zamykanie
│   │   ├── scoring.ts          # czysta punktacja
│   │   ├── reducer.ts          # applyAction(state, action)
│   │   ├── dice.ts             # losowanie i seedy
│   │   └── selectors.ts        # legalActions, gameOver, scores
│   ├── agents/
│   │   ├── agent.ts            # interfejs polityki
│   │   └── random-agent.ts
│   ├── simulation/
│   │   ├── run-game.ts         # rozgrywanie partii
│   │   └── benchmark.ts        # turnieje i metryki
│   └── rl/
│       ├── environment.ts      # reset / step / legal actions
│       ├── observations.ts     # stan -> obserwacja
│       └── rewards.ts          # nagrody i cele
├── tests/
│   ├── engine/
│   ├── simulation/
│   └── rl/
├── docs/
│   ├── GAME_RULES.md
│   └── ARCHITECTURE.md
├── AGENTS.md
└── package.json
```

Na etapie UI można dodać aplikację SvelteKit w tym samym repozytorium, bez przenoszenia logiki silnika do komponentów. Struktura katalogów jest propozycją, nie kontraktem wymagającym wszystkich plików od pierwszego dnia.

## 3. Kontrakty domenowe (szkic)

```ts
type RowColor = 'red' | 'yellow' | 'green' | 'blue';
type RulesetId = 'classic';
type Phase = 'awaiting_roll' | 'white_decisions' | 'colored_decision' | 'finished';

type DiceRoll = {
  white1: number;
  white2: number;
  colors: Partial<Record<RowColor, number>>; // brak kości zamkniętych rzędów
};

type PlayerState = {
  id: string;
  marks: Record<RowColor, number[]>; // indeksy pól 0..10, od lewej
  closedLocks: RowColor[];           // kłódki zdobyte przez gracza
  penalties: number;
};

type PendingWhiteDecision =
  | { type: 'MARK_WHITE'; row: RowColor }
  | { type: 'PASS_WHITE' };

type GameState = {
  rulesetId: RulesetId;
  rulesetVersion: number;
  players: PlayerState[];
  activePlayerIndex: number;
  phase: Phase;
  dice: DiceRoll | null;
  lockedRows: RowColor[];
  pendingWhiteDecisions: Partial<Record<string, PendingWhiteDecision>>;
  turnNumber: number;
};

type Action =
  | { type: 'ROLL'; dice: DiceRoll }
  | { type: 'MARK_WHITE'; playerId: string; row: RowColor }
  | { type: 'PASS_WHITE'; playerId: string }
  | { type: 'MARK_COLOR'; playerId: string; row: RowColor; whiteDie: 1 | 2 }
  | { type: 'PASS_COLOR'; playerId: string };
```

**Uwaga:** w fazie wspólnej pełne deklaracje graczy są zapisywane w `pendingWhiteDecisions`, a następnie rozpatrywane atomowo względem stanu z początku fazy, niezależnie od kolejności nadejścia requestów. Arkusze graczy i globalne zamknięcia nie zmieniają się przed zebraniem wszystkich wymaganych deklaracji. Kilku uprawnionych graczy może zamknąć ten sam rząd; każdy otrzymuje ostatnią liczbę i własną kłódkę, a punktacja każdego uwzględnia oba zaznaczenia. Globalne zamknięcia są stosowane dopiero po rozliczeniu wszystkich decyzji tej fazy.

Kolor zamknięty w fazie białej jest niedostępny w fazie kolorowej tej samej tury. Jeżeli atomowe rozliczenie fazy białej zamknie drugi kolor, `applyAction` przechodzi bezpośrednio do fazy `finished`: faza kolorowa jest pomijana, a aktywny gracz nie otrzymuje kary za jej niewykonanie.

Przejście fazy następuje automatycznie po zapisaniu ostatniej wymaganej decyzji. Publiczny model akcji nie zawiera `ADVANCE`; reduktor nie pozostawia kompletnej fazy w stanie oczekującym na techniczną akcję sterującą.

Przykładowe czyste funkcje:

```ts
function getLegalActions(state: GameState, playerId: string): Action[];
function applyAction(state: GameState, action: Action): GameState;
function calculateScore(player: PlayerState): number;
function isGameOver(state: GameState): boolean;
function getObservation(state: GameState, playerId: string): Observation;
```

Błędna akcja musi dawać jawny, typowany błąd domenowy lub wynik `Result`, nie cichą korektę stanu. Silnik nie powinien modyfikować wejściowego `state`.

## 4. RNG i powtarzalność

- `ROLL` jest tworzone przez warstwę symulacji lub autorytatywny serwer na podstawie generatora losowego.
- `applyAction` nie wywołuje `Math.random()`.
- Dla benchmarków przechowujemy seed, wersję silnika, wersję rulesetu i wersje agentów.
- Ten sam seed nie musi gwarantować identycznych rzutów pomiędzy różnymi przebiegami, jeżeli agenci zużywają różną liczbę rzutów; do uczciwych porównań można przygotować **zewnętrzny strumień rzutów** indeksowany turą i aktywnymi kośćmi lub stosować parowane seedy i zamianę miejsc. W raporcie opisujemy wybraną metodę.

## 5. Agenci

```ts
interface Agent {
  id: string;
  chooseAction(observation: Observation, legalActions: Action[]): Action | Promise<Action>;
}
```

Pierwszy agent: `RandomAgent` — losuje z legalnych akcji, włącznie z pasowaniem. To baseline, nie silny przeciwnik.

Kolejne implementacje:
- `HeuristicAgent` — ocena ryzyka utraty pól, potencjału rzędów, kar i zamknięć.
- `MonteCarloAgent` — porównuje legalne akcje przez symulowanie kontynuacji z ustalonymi politykami przeciwników.
- `RLAgent` — polityka uczona na symulowanych partiach.

Wszystkie korzystają z tego samego kontraktu obserwacji i legalnych akcji; nie mają dostępu do wewnętrznego generatora przyszłych rzutów.

## 6. Środowisko RL

```ts
interface StepResult {
  observation: Observation;
  reward: number;
  terminated: boolean;
  truncated: boolean;
  info: { legalActions: Action[] };
}

interface QwixxEnvironment {
  reset(seed?: number): { observation: Observation; info: { legalActions: Action[] } };
  step(action: Action): StepResult;
}
```

**Pierwszy cel:** maksymalizacja wyniku własnego gracza w pełnej partii z pozostałymi graczami obsługiwanymi przez ustalone polityki (np. RandomAgent). Nie tworzymy niekanonicznej jednoosobowej odmiany Qwixx.

**Obserwacja:** własne pola i kary, dostępne kości, zamknięte rzędy, aktywny gracz, faza, informacje o przeciwnikach widoczne w normalnej grze, legalne akcje. Przyszłe rzuty są ukryte.

**Akcje:** tylko legalne decyzje bieżącego agenta. `PASS` jest prawdziwą opcją strategiczną. W treningu stosujemy maskę legalnych akcji; stałe indeksowanie akcji dla sieci neuronowej opracujemy dopiero przed wyborem algorytmu.

**Nagroda MVP:** końcowy wynik punktowy (`terminal reward`); w eksperymencie porównawczym można zastosować różnicę wyniku pomiędzy stanami, o ile suma nagród odpowiada temu samemu celowi. Później: wynik względny lub zwycięstwo w grze wieloosobowej.

**Ważna własność:** `step()` powinien wykonywać także ruchy pozostałych agentów aż do następnej decyzji trenowanego gracza lub końca gry; w `info` należy zachować diagnostykę. Zabezpieczamy się przed nieskończonymi pętlami w symulatorze.

Nie zakładamy od razu PyTorch. Najpierw sprawdzamy szybkość symulacji w TypeScript i projektujemy eksport danych / adapter Python dopiero wtedy, gdy trening tego wymaga.

## 7. Benchmark i metryki

Każdy eksperyment zapisuje: `experimentId`, seed(y), ruleset i wersję, konfigurację agentów, liczbę partii, czas wykonania oraz wyniki.

Metryki:
- średnia, mediana i odchylenie standardowe punktów;
- win rate z jawną polityką liczenia remisów;
- liczba kar, zamkniętych rzędów i tur;
- czas decyzji agenta oraz przepustowość symulacji (partie/s);
- krzywa uczenia dla RL, oceniana na oddzielnych seedach i przeciwko stałym przeciwnikom.

Porównania powinny obejmować różne miejsca przy stole oraz, gdzie możliwe, sparowane warunki losowe. Nie ogłaszamy przewagi na podstawie pojedynczych partii.

## 8. Testowanie i workflow AI

**Vitest:** testy jednostkowe reguł, punktacji, zamykania rzędów, kolejności faz, powtarzalności. Muszą obejmować atomowe równoczesne zamknięcie tego samego rzędu przez kilku graczy (ostatnia liczba i kłódka dla każdego), niezależność stanu i punktacji od kolejności zgłoszeń, niedostępność zamkniętego koloru w fazie kolorowej tej samej tury oraz zakończenie gry po drugim zamknięciu w fazie białej bez fazy kolorowej i bez dodatkowej kary. Test zakończenia musi również potwierdzić, że wszystkie legalne decyzje wspólnej fazy zostały zastosowane przed przejściem do `finished`. Dodatkowo testy własnościowe na losowych legalnych sekwencjach (opcjonalnie `fast-check`).

**Testy symulacyjne:** tysiące pełnych partii bez wyjątków, bez zablokowanych faz, bez nielegalnych stanów i bez niekończących się gier.

**Code review:** Codex implementuje, niezależny Gemini recenzuje diff w JetBrains Air, człowiek akceptuje. Nie zakładamy automatyzacji przycisku review bez sprawdzenia możliwości Air.

**Playwright:** dopiero gdy istnieje UI. Verification Skills P-Stack dodajemy dla rzeczywistych przepływów użytkownika, a nie dla pustego projektu.

**Zasada:** brak przechodzących testów nie jest powodem do osłabienia asercji. Zmiana reguł wymaga jawnej aktualizacji `GAME_RULES.md` i testów.

## 9. Multiplayer — późniejszy etap

SvelteKit odpowiada za UI, Supabase może przechowywać pokoje i historię oraz synchronizować zdarzenia. **Serwer jest autorytetem:** generuje rzuty, weryfikuje akcje silnikiem i zapisuje przejścia atomowo (wersjonowanie stanu / kontrola współbieżności). Klient może korzystać z `getLegalActions` do podświetleń, ale nie decyduje o legalności.

Nie dodajemy bazy ani połączeń sieciowych do `engine` i `simulation`. Trening AI działa osobno od serwera multiplayer.

## 10. Warianty i dodatki

Stan partii i zapis eksperymentu zawierają `rulesetId` i `rulesetVersion`. MVP implementuje tylko `classic`. Gdy pojawi się pierwszy konkretny dodatek, ocenimy, czy wystarczy parametryzacja, czy potrzebny jest nowy moduł reguł. **Nie projektujemy systemu pluginów bez wymagań.** Agent RL wytrenowany na Classic może wymagać zmiany reprezentacji akcji lub ponownego treningu dla dodatków.

## 11. Milestones i kryteria akceptacji

### M1 — Engine (pierwszy milestone)
- Pełny Classic Qwixx zgodny z zatwierdzonym `GAME_RULES.md`.
- Wszystkie akcje walidowane; punktacja poprawna; deterministyczne przejścia.
- Testy jednostkowe i brzegowe przechodzą.
- Da się programowo rozegrać kompletną legalną partię bez UI.

### M2 — Simulator + Random Agent
- Automatyczne pełne partie 2–5 graczy.
- Powtarzalne seedy i raport metryk.
- Benchmark co najmniej 10 000 partii; brak nielegalnych stanów i zawieszeń.

### M3 — Heuristic / Monte Carlo
- Porównania agentów w tych samych warunkach.
- Mierzenie jakości strategii i kosztu obliczeniowego.

### M4 — RL
- Środowisko `reset/step` i maska legalnych akcji.
- Pierwszy eksperyment z nagrodą końcową, następnie porównanie z różnicową.
- Oddzielne zbiory seedów do treningu i ewaluacji.

### M5 — UI / multiplayer
- SvelteKit, podświetlanie legalnych ruchów, pokoje online, synchronizacja, punktacja i Playwright E2E.

Kolejność M3–M5 można zmienić, jeśli priorytetem stanie się wcześniejsza gra ze znajomymi.

## 12. Ryzyka i otwarte decyzje

- Potwierdzić przypadki brzegowe z instrukcją wybranego wydania Classic Qwixx przed zamrożeniem testów.
- Wydajność TS może wystarczyć do pierwszych symulacji, ale intensywne RL może wymagać adaptera Python lub szybszego silnika.
- Jedna przestrzeń obserwacji/akcji może nie pasować do wszystkich przyszłych dodatków.
- Losowość kości i różne miejsca przy stole utrudniają porównywanie agentów; potrzebna metodyka eksperymentalna.
- Nazwa, ilustracje i materiały wydawcy mogą podlegać ochronie; nie kopiować oryginalnych grafik przy publicznym wydaniu.
