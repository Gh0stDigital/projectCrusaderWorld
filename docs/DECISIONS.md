# Decisions

Choices made on top of [SPEC.md](SPEC.md). Where they disagree, this file wins.

Status: **Settled** = agreed. **Proposed** = suggested, waiting for approval. Proposed rules are not to be implemented as final.

## Names — Settled

The game uses these names; SPEC.md uses the older ones.

| Game | SPEC.md |
|---|---|
| Lord | General |
| Captain | Commander |
| Region board | Campaign map / macro board |
| Region | Territory |

Lord classes: Army, Garrison, Raiders. Each player has one Lord of each.

The Lords are characters with their own card art: **Aubrey** (Army), **Nevadius** (Garrison) and **Jermaine** (Raiders). The opponent (Player 2) uses one generic **Enemy Lord** card for all three of their Lords, recolored crimson (shown as "Enemy Lord of the Army" and so on).

Captains have placeholder names, two per Lord (Player 1: Roderic, Godfrey, Edmund, Baldwin, Tancred, Alaric; enemy: Malric, Draven, Mordaunt, Varek, Corvin, Sauvic), set in `src/data/names.ts`. Player 1's Captains share one Captain card; the enemy's share a generic Captain card recolored crimson and mirrored to face inward from the right (the banner lettering is kept unmirrored). Which Lord leads which class is set in `src/data/names.ts` (`LORD_PERSONAS`).

"Campaign" in scope notes means a story mode across several matches. The Region board itself (with Ultimate Tic-Tac-Toe routing) is the core of every match.

## Match start and turns — Settled

- At the start, each player places their three Lords beside the Region board in the order their turns will go. This replaces the fixed Army → Garrison → Raiders rotation. Player 1 orders first, then Player 2.
- Player 1 takes the first turn. Players then alternate.
- Each player's next Lord comes from their own chosen order, and only advances when that player's turn comes back.
- Each Lord has 2 Captains; each Captain has 6 Knights.
- A turn: the current Lord chooses one of their Captains. A Ready Captain deploys to a Region; a Captain already stationed is given new orders (resumed). Then that Captain places one of their Knights on an empty square of their Region's 3×3 board. Then the player presses End Turn.
- A player may have only one Captain per Region; the opponent may share it. A Region whose board is full takes no new Captains.
- One Captain choice and one Knight placement per turn. Knights never move once placed.
- End Turn is manual and is refused until a Knight is placed, unless the current Lord has no Captain who can act (then it can be ended right away).
- Until routing exists, a Ready Captain may deploy to any Region open to that player, and a Lord may resume any of their stationed Captains. **Provisional**: routing will restrict this.
- For now both sides are controlled by the person at the computer (pass-and-play). The computer opponent comes later.

## Region view and turn flow on screen — Settled

- After choosing a Captain, the player is prompted to enter that Captain's Region (button and tile). Entering zooms smoothly from the Region's tile into its 3×3 board.
- In the Region view, the Region's 3×3 board fills the center. Each player's side panel switches from their Lords to their Captain stationed in that Region, with the Captain's 6 Knights below in two columns of three (Player 1 left, Player 2 right; sides never swap). Knights already on the field are greyed.
- On the Region board, each tile shows the stationed Captains as small square face portraits (Player 1 left of the name, Player 2 right) and a large 3×3 map where each occupied square shows that Knight's face ringed in the owner's color.
- The player can zoom out to view the Region board at any time without changing orders, and return to their Region.
- After End Turn: about 1 second of "orders complete" confirmation, zoom out to the Region board, about 1 second pause, then the next turn's announcement.

## Project and platform — Settled

- No prototype exists. Built from scratch, step by step.
- Browser game for now. A desktop wrapper (Tauri or Electron) may come later.
- Stack: TypeScript, Vite, React, Zustand (store), Vitest (rules tests).
- Rules engine is plain TypeScript with no UI code. The UI sends actions and plays back the events the engine returns.
- Code lives in a private GitHub repo so it can be edited from the phone too.

## Screen and layout — Settled

- Fixed 1920×1080 design canvas, scaled evenly to fit the window, with themed bars for leftover space.
- Minimum supported window: 1280×720.
- Zones: top bar 64px; Player 1 panel on the left, 400px; board stage in the center, 1120×856; Player 2 panel on the right, 400px; phase window across the bottom, 160px.
- Player 1 is always on the left and Player 2 always on the right. Sides never swap.
- The battle window (~1100×720), announcements, and notices are overlays on the board stage, so both side panels stay visible.
- Minimum text size about 18px on the canvas.

## Cards — Settled

- Card art is 2:3 portrait (source art is 1024×1536).
- Cards may change size between views but never shape.
- Sizes: territory board 160×240; selected-Knight detail ~200×300; battle window ~320×480; side panels ~80×120 or a head crop; hover inspect ~400×600.
- The territory board uses card-shaped cells (3×3 of 160×240, about 510×750 total), leaving side space in the stage for route preview and info.
- The campaign map shows terrain tiles, banners, and a mini ownership grid, not full cards.
- Frames are used as-is (baked into the art) for now. All cards go through one Card component, so modular frames can replace them later.
- Game info (HP, faction, highlights, states) is drawn as overlays on top of the card, never baked into images.
- Faction is shown with a colored border and a banner pin, because the frame color is baked in.
- Pre-made size variants of the art are used instead of live browser downscaling.

## Scope — Settled

- Milestone 1: exhibition match versus the computer, focused on the core game and combat.
- Later: saving, faction select, Muster screen, dialogue and cutscenes, campaign structure, local two-player.
- The structure keeps room for these from the start (folders and event hooks), but they are not built yet.

## Planned systems (later) — Settled direction

- **Menus:** Title → Main menu (New campaign, Continue, Settings, Credits) → Mode select → Faction select → Muster → match.
- **Factions** are data (name, banner, colors, art, later traits). Whether they differ mechanically is still open.
- **Narrative:** scripts are data files. A director plays scenes in response to engine events, one at a time. Scenes pause the game but never change it except through normal engine actions. Typewriter text: click finishes the line, click again advances, a held key fast-forwards, Esc skips the scene. Reduced motion shows text instantly. No scene during a duel may hint at an uncommitted Sergeant pick.
- **Saves** are a versioned copy of the engine state, taken only between scenes.

## Militia — Settled (test values)

- Each Lord starts with 1,000 militia: 200 in the Lord's reserve, and each of 2 Captains holds 100 in reserve plus 3 staffed Knights.
- A staffed Knight is 50 militia of their own (their HP; Knights hold no reserve) plus 5 Sergeants of 10 men each. 200 + 2 × (100 + 3 × 100) = 1,000.
- A Captain has 6 Knight slots; slots 4–6 start unmanned (no men) and cannot be placed. Staffing them from reserves comes later.
- Militia is shown per player, per Lord (with reserve), per Captain (with reserve), per Knight (HP) and per Sergeant (men). Totals count living men only.

## Battles — Settled

- Sergeant tactics are **Rush, Flank and Counter**. Each Knight's five Sergeants mix them two, two and one, varying by Knight.
- Before attacking, a window shows both Knights (HP, Sergeants, tactics) with Cancel or Commence attack.
- Commencing zooms into a battlefield: the attacker bottom-left, the defender top-right, each with their Sergeants as boxes (tactic icon and men) above them.
- Each clash, both sides secretly choose a Sergeant; the winning tactic deals that Sergeant's men as damage to the other Knight's HP.
- The Knight with less HP at the end loses and is removed from the board. The winner stays on its square and the square becomes empty.
- Clashes are revealed one at a time with pauses (intro, reveal, result) so the information is easy to follow. After the result the player returns to the Region and ends the turn manually.
- Side panels hold their numbers during a battle and update when the player returns, so they never reveal a result early.

## Battles — Provisional (my choices, open to change)

1. Rush beats Flank, Flank beats Counter, Counter beats Rush.
2. The beaten Sergeant is lost with all their men. The winning Sergeant is unharmed.
3. Same tactic: both Sergeants lose half their men (loss rounded up), and no HP damage.
4. Up to 5 clashes; each Sergeant fights once per duel. The duel ends early at 0 HP. If one side runs out of Sergeants, the other's remaining Sergeants strike unopposed.
5. Equal HP at the end: the defender holds and both Knights stay.
6. The losing Knight dies at 0 HP; otherwise it retreats to its Captain with its remaining HP and Sergeants, and can be placed again later.
7. Only the Knight placed this turn may attack, once, and only an enemy directly up, down, left or right of it. Attacking is optional.
8. HP, Sergeant losses and deaths carry over to every later battle. Nothing regenerates.
9. For now the defending side's Sergeant is chosen by the computer at random, committed before the attacker chooses, and never looks at the attacker's pick.

## Other rules — Proposed (not yet approved)

1. A turn may instead be an attack by an already stationed Knight, with no placement. After such a turn, routing comes from the attacking Knight's square.
2. When a territory is secured, the losing Captain's Knights there are captured and that Captain counts as killed.
3. A full board with no line and no legal attack closes as neutral.
4. A player with no legal action skips to the next Lord with one. If none has one, that player loses.
5. Reserves and reinforcement (staffing unmanned Knights, topping up Sergeants) come later. Reserves are only displayed for now.

## Still open

- Army / Garrison / Raiders advantages.
- Ultimate Tic-Tac-Toe routing (where a placement sends the opponent).
- What makes factions differ (cosmetic or mechanical) and how many there are.
- Whether there is a story campaign or only reactive scenes.
- Whether eliminating all three enemy Generals is also a win.
