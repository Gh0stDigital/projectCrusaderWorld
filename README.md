# Crusader World

A medieval conquest strategy game built around Ultimate Tic-Tac-Toe, a military command hierarchy, persistent manpower, and rock-paper-scissors duels between Knights.

Status: scaffold. Title screen, menu, and the match screen layout exist; the rules are not built yet.

- Design: [docs/SPEC.md](docs/SPEC.md)
- Decisions so far: [docs/DECISIONS.md](docs/DECISIONS.md)

## Running it

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

Other commands:

- `npm test`: run the rules tests
- `npm run typecheck`: check types
- `npm run build`: production build into `dist/`

## Code layout

```
src/
  engine/       rules only, no UI (state, actions, rules, phases, queries)
  ai/           computer player
  data/         content: art catalog, later factions and balance numbers
  persistence/  save and load (later)
  narrative/    dialogue and cutscenes (later)
  store/        connects engine and UI
  ui/           React: stage, screens, campaign, battle, overlays, components
  assets/       card art
tests/          rules tests
```

All UI is laid out on a fixed 1920×1080 canvas (`src/ui/stage`) that scales to fit the window.
