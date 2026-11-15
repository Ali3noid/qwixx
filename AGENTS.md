# AGENTS.md — Qwixx AI

## Project goal
Build a correct, deterministic Classic Qwixx engine first, then a fast simulation environment for comparing Random, Heuristic, Monte Carlo, and reinforcement-learning agents. A web UI, multiplayer, and additional rulesets come later. Prefer small, maintainable solutions over speculative abstractions.

## Sources of truth
- Read `docs/GAME_RULES.md` before changing gameplay rules, scoring, turn flow, or termination.
- Read `docs/ARCHITECTURE.md` before changing module boundaries, APIs, simulation, or RL design.
- If documents are ambiguous or contradictory, identify the issue and ask for a decision. Do not silently invent a rule.
- Classic Qwixx is the only implemented ruleset in the MVP. Keep a ruleset identifier/version where the architecture requires it; do not implement a generic plugin system or hypothetical expansions.

## Engineering boundaries
- The game engine is pure TypeScript, independent of UI, database, HTTP, and agent implementations.
- The engine owns legal actions, state transitions, scoring, row locks, and game termination. Do not duplicate these rules in UI or AI agents.
- State transitions must be deterministic given a state and an explicit action/dice result. Keep randomness outside the state reducer; support seeded simulations.
- Do not mutate input state. Reject illegal actions explicitly instead of silently fixing them.
- Agents may choose only from legal actions and must not access future dice rolls or otherwise unavailable information.
- Keep the implementation minimal. Avoid premature microservices, databases, frameworks, or generic ruleset abstractions.

## Implementation workflow
1. Inspect relevant code, documentation, and tests before editing.
2. Make the smallest coherent change for the requested task; do not implement unrelated milestones.
3. Add or update Vitest tests for changed engine behavior, including edge cases and invariants.
4. Run relevant tests and TypeScript checks. Report the exact commands and outcomes.
5. If existing verification skills cover the change, run them according to their `SKILL.md`. Do not create new skills without a specific request.
6. If tests fail, diagnose the cause. Never weaken assertions or change game rules merely to obtain a green result.
7. Finish with a concise summary: files changed, behavior implemented, verification performed, unresolved issues, and any skipped checks.

## Verification expectations
- Prioritize unit tests and property/invariant tests for the engine. UI verification with Playwright becomes relevant only after a web interface exists.
- Cover scoring, legal action generation, ordering of marks, row locks, simultaneous white-dice decisions, active-player colored decisions, penalties, and end conditions as applicable to the change.
- For simulations, use fixed seeds and record ruleset/agent versions where practical; ensure runs can be reproduced.
- Do not claim PASS unless checks actually ran. Clearly label unrun checks and blockers.
- Preserve evidence and reports from any existing verification workflow. Never point tests at production services.

## Review and maintenance
- The user may invoke Air's **Review with Gemini** on the diff for independent review. Treat review comments as hypotheses: verify each against code, requirements, and tests before changing anything.
- If a deliberate behavior change makes an existing verification skill stale, use the installed P-Stack `maintain-verification-skill` according to its instructions; do not change skills solely because a test failed.
- Do not automatically commit, push, open a PR, or merge unless explicitly requested.

## First milestone boundaries
- Implement only Classic Qwixx engine types, rules, transitions, scoring, and tests when requested.
- Do not add SvelteKit, Supabase, Playwright, Python, PyTorch, or an RL training pipeline in the first engine milestone unless explicitly asked.
