# Crusader World

A medieval conquest strategy game: Ultimate Tic-Tac-Toe on a 3×3 campaign map of 3×3 territories, a military command hierarchy, persistent manpower, and rock-paper-scissors Knight duels.

## Read first

- [docs/SPEC.md](docs/SPEC.md): the full design handoff.
- [docs/DECISIONS.md](docs/DECISIONS.md): what has been decided since. It overrides SPEC.md. Rules marked **Proposed** are not approved yet; ask before building on them.

## Working rules

- The owner builds this step by step. Don't build ahead of the current step or invent rules the docs leave open. Flag gaps and suggest options instead.
- Keep the rules engine (`src/engine`) free of UI code. The UI sends actions and plays back engine events.
- Record every new decision in docs/DECISIONS.md.
- The owner may also work from the phone through the GitHub repo, so pull before starting and push finished work.
