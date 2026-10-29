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

Captains have placeholder names, two per Lord (Player 1: Roderic, Godfrey, Edmund, Baldwin, Tancred, Alaric; enemy: Malric, Draven, Mordaunt, Varek, Corvin, Sauvic), set in `src/data/names.ts`. Player 1's Raiders Captains have their own card (masked, wide-brimmed helmet: `raiders-captain.png`) and so do Player 1's Army Captains (bronze helmet and green scarf, mirrored from the source art: `army-captain.png`); each is used for the card and face icons. Player 1's Garrison Captains use the shared Captain card. All enemy Captains share a generic Captain card recolored crimson and mirrored to face inward from the right (the banner lettering is kept unmirrored).

Knights have placeholder names, shown as "Sir Gareth" (36 per side, set in `src/data/names.ts`). Player 1's Knights use the blue Knight card; the enemy's use the same Knight with red armor and a crimson frame, mirrored to face inward. In battle the Knights always face each other. Which Lord leads which class is set in `src/data/names.ts` (`LORD_PERSONAS`).

"Campaign" in scope notes means a story mode across several matches. The Region board itself (with Ultimate Tic-Tac-Toe routing) is the core of every match.

## Match start and turns — Settled

- At the start, each player places their three Lords beside the Region board in the order their turns will go. This replaces the fixed Army → Garrison → Raiders rotation. Player 1 orders first, then Player 2.
- Player 1 takes the first turn. Players then alternate.
- Each player's next Lord comes from their own chosen order, and only advances when that player's turn comes back.
- Each Lord has 2 Captains; each Captain has 6 Knights.
- A turn: the current Lord chooses one of their Captains. A Ready Captain deploys to a Region; a Captain already stationed is given new orders (resumed). Then that Captain places one of their Knights on an empty square of their Region's 3×3 board. Then the player presses End Turn.
- A player may have only one Captain per Region; the opponent may share it. A Region whose board is full takes no new Captains.
- One Captain choice per turn. Then, in either order: one Knight placement and one attack. Knights never move once placed.
- Any of the acting Captain's Knights already on that Region's board may attack (the one just placed included), but only if it has an enemy in reach. A battle can come before or after the placement.
- A stationed Captain with no Knight left to place can still be chosen if one of their Knights on the board has a target.
- End Turn is manual and is refused until a Knight is placed or an attack made, unless the current Lord has no Captain who can act (then it can be ended right away).
- Only a placement (or move) routes the opponent. A turn without one (attack only, or no orders) leaves the opponent a free choice.
- **Undo:** a placement can be taken back (Undo placement) until an attack is made after it or the turn ends. Undo restores everything the placement did, including securing a Region.
- **Moving a Knight:** instead of placing, one of the acting Captain's Knights on that board may step one square up, down, left or right onto an empty square, only if nothing was placed or attacked yet this turn. The move replaces the placement: it routes the opponent from the new square and can secure the Region with three in a row. No attack follows a move. A move can be undone (Undo move) until the turn ends. Clicking one of your Knights on the board shows its step squares in green (and its attack targets, if any). A Captain whose only possible order is a move can still be chosen; the computer moves only when it has nothing else to do.
- Ultimate Tic-Tac-Toe routing (settled):
  - The square a Knight is placed on sends the opponent to the Region in the same position next turn. The first turn of the match is a free choice.
  - While the current Lord has a Ready Captain, they must play in the routed Region: deploy a Ready Captain there. They cannot revisit other Regions.
  - If the routed Region holds the current Lord's own stationed Captain, that Captain must take the turn there.
  - **A routed Region that has been conquered (secured) is no longer mandatory (Oct 2026):** the turn is a Free Choice. A Lord only ever commands their own Captains: this fixed a bug where being routed into a secured Region held by another Lord's Captain let the current Lord command that Captain, and where "nobody can deploy" let any Lord's Captain act.
  - If it holds a Captain of a different Lord, routing is not mandatory: it is a Free Choice, and the current Lord deploys a Ready Captain to any open Region (or commands one of their own deployed Captains). **A Lord never commands another Lord's Captain** (Oct 2026; this used to be allowed here and was reported as a bug). If nothing is open and none of the Lord's own Captains can act, the turn can be ended.
  - Once the current Lord has deployed both Captains: if the routed Region holds one of them who can act, it is a Fated Move and that Captain must take the turn there. Otherwise routing is ignored and the player chooses one of that Lord's deployed Captains. Their placement still routes the opponent.
  - If the routed Region is closed to them (no room, or nobody able to act), they deploy to any open Region; if none is open, any of the current Lord's deployed Captains who can act may.
  - The routed Region is highlighted on the Region board ("Fated Move · play here") and named in the turn banner; each empty square in the Region view shows where it would send the opponent.
- Move types (named in the turn instructions during the command step):
  - **Fated Move:** routing forces where the Lord plays (deploy in the routed Region, or command their own Captain there).
  - **Free Choice:** the Lord chooses where to deploy a Captain or which deployed Captain to command (first turn, routing not mandatory, routed Region closed, or both of the Lord's Captains already deployed).
  - With both of the Lord's Captains deployed, both of their Regions are highlighted green ("Playable") on the Region board.
  - Every choice open this turn is clickable on the Region board, whichever Captain is selected: clicking a Region acts with the Captain who belongs there (a Standby Captain deploys, a deployed one takes orders). The selected Captain's choices get a dashed inner ring, and a deployed selected Captain's Region a "Selected Captain" tag.
  - The selected Captain's icon turns green when it can play this turn.
- Exhibition is against the computer: the human plays Player 1 (blue); the computer plays Player 2 (red).
- Lord hubs (side panels): the Lord playing now is tagged "Taking this turn" (solid gold); each player's next Lord is tagged "Next" (gold outline): for whoever is playing, the Lord after this one; for the other player, the Lord they play on their coming turn.
- Lord hubs show the Lord's Militia and Reserve as two small health bars with the number centered inside each (Oct 29, 2026). Militia is measured against what a Lord starts with (1,000) and turns yellow below half, red below a quarter; Reserve is a blue bar against the starting 200. Lord reserves don't change yet, so that bar stays full.
- Each Captain icon in a Lord hub has the Captain's name beneath it (just the name, e.g. "Tancred"). A name too long for the icon's width shrinks to fit (down to 6px, then cut with an ellipsis), with a little space between icon and name.
- On screen, militia is called "Troops" (Oct 29, 2026): the bottom bar's Troops bar, the Lord hub bar, Captain details, the company panel, battle results ("Troops lost") and the reinforcement prompt. The docs and code still say militia.
- The bottom bar leads with each player's total Troops as the main green health bar (Oct 29, 2026), measured against the 3,000 a player starts with; under it, a gold Resources bar of the same thickness but shorter (about 62% of the length, starting from the same outer end). The bars run along the bottom of the bottom bar, with End turn centered above them; End turn only appears once the turn can end (the End step lights in the turn strip at the same moment). Undo placement / Undo move is a button on the zoomed Region, just left of the board by its bottom row. There is no Enter / Return to Region button: click the Region on the map instead. Either bar turns red and throbs when low. The side panels no longer show the total under the player's name.
- Undo deployment / Choose another Captain is a button over the deployed Region's tile on the map, above its Enter label (Oct 29, 2026). Once the player goes into that Region, the deployment can no longer be undone that turn, even after going back out to the map. This is enforced by the game screen, not the rules engine (entering a Region is a view change, not an action). The tile's Enter / Deploy here label is a little larger.
- Each side of the bottom bar has its god as an avatar behind its end of the Troops and Resources bars, rising a little above the bar's top edge (Oct 29, 2026). Yours is the winged figure (`src/assets/ui/hud-avatar.webp`, from `design/source-art/winged-avatar.png`, mirrored) on the left; the enemy's is the haloed figure with the tree (`src/assets/ui/enemy-hud-avatar.webp`, from `design/source-art/enemy-god-avatar.png`, as drawn, tree toward the screen edge) on the right. The You / Enemy labels have a dark backing so they read over them.
- When Player 1 selects a Captain while choosing on the map, that Captain's details (portrait, Lord, status, where, Troops, Reserve, Knights) slide out as a card from the right edge of the panel, level with the Captain's icon, and slide back once the Captain deploys or the selection clears (Oct 29, 2026). The card lets clicks through to the map underneath. Press and hold still shows any other Captain's details, but not the selected one's. The Captain card lists all six Knight slots, each a diamond (Ready green, Fielded gold, Fallen red, Captured purple, hollow for an empty slot) with the Knight's name and status, plus HP for a living Knight.
- The same for Knights: while Player 1 is in a Region, the selected Knight's details (type and ability, status, HP, Sergeants) slide out beside the panel, level with its token (never lower than the Undo placement button), and slide back when no Knight is selected (Oct 29, 2026). Holding the selected Knight, in the list or on the board, shows nothing extra; any other Knight still shows its pop-up. Each slide-in card (Captain or Knight) has a Hide button on its top edge: the card folds into a small tab on the panel edge with the name on it, and clicking the tab brings it back. Cards start hidden, as the tab; once opened or hidden they stay that way, following whatever is selected, until the player changes it.
- Sergeants have names (Oct 29, 2026): plain common names for Player 1 (Wat, Hob, Piers…), harsher ones for the enemy (Grub, Skell, Vorg…), 30 each in `src/data/names.ts`. A Sergeant keeps its name, and a Knight's Sergeants never share one. The Knight details card lists each Sergeant by name after its tactic icon (the tactic name is no longer written there).
- In a match, the Sound on/off button sits in the top bar next to Menu; on other screens it stays in the corner.
- A turn strip runs across the top of the board (40px, `TurnPhases`): the turn's steps (Command › Placement › Attack › Battle › End, current ones lit; End also ends the turn), then the Fated Move / Free Choice tag and the help text, which wraps to two lines when long and shows a refused action's reason in red. The map (whole board and zoomed Region) is scaled to about 95% to sit under it; battles and other windows still cover the full board area, strip included (Oct 29, 2026).

## Knight sprite — Settled

- Knights on a Region's 3×3 board are a pixel-art Knight sprite (`src/assets/sprites`), not cards: blue for Player 1, red and mirrored for the enemy. It idles between its two frames at 1 frame per second (off with reduced motion).
- The Captain panel's Knight tokens use the same sprite, still and slightly greyed out (darker when in the field, faint when unmanned, sepia when fallen).
- Battles use a pixel Knight bust per Knight type, two frames idling at 1 frame per second; the enemy's is red and mirrored. Army (for now): sword Knight (`knight-battle-anim.webp`) for Infantry, crossbow (`crossbow-battle-anim.webp`) for Archers, lance rider (`lance-battle-anim.webp`) for Cavalry. Garrison: Gatekeeper (spear, `gatekeeper-battle-anim.webp`, drawn smaller since it is a close-up), Watchman (crossbow, `watchman-battle-anim.webp`), Warden (mace and shield, `warden-battle-anim.webp`). Raiders: Skirmisher (sword and buckler, `skirmisher-battle-anim.webp`), Ambusher (bow, `ambusher-battle-anim.webp`), Saboteur (dagger and flail, `saboteur-battle-anim.webp`). The clash winner lunges straight forward and back, its info box moving with it; a Knight that takes damage shakes while a slash sweeps across it.
- Board pieces and the side-panel Knight list use different chibi sprites (Oct 2026): pieces on a Region's board use `knight-board-sprite.png` (the brighter blue Knight; red mirrored for the enemy); the Knight list keeps `knight-sprite.png`. Battles keep their own Knight busts.
- The Knight list icons switched to the plain pixel-art Knight (Oct 28, 2026; source `design/source-art/sprites/knight-chibi-v6.png`, two 176×165 frames). The enemy copy is red and mirrored, with the art's thin green inner outline turned red too. Board pieces and battle busts are unchanged.
- Board pieces switched to the bright pixel-art Knight (Oct 29, 2026; source `design/source-art/sprites/knight-board-chibi-v3.png`, two 492×498 frames cut at the gap between the Knights so the idle bob is kept). The enemy copy is red and mirrored. Knight list icons and battle busts are unchanged.
- Knight tokens in the side panels keep the chibi pixel Knight, still in the hub; the selected Knight plays its idle animation. The full type name shows in a tag colored by Lord (Army gold, Garrison teal, Raiders violet), above its HP.
- Knight cards are still used in the attack preview. The pre-battle window always shows your Knight on the left and the enemy on the right, whoever attacks; an arrow between them points from attacker to defender (blue when you attack, red when you are attacked), and each side is labelled attacking or defending.

## Region board skin — Settled

- The match screen uses the owner's 16:9 artwork `src/assets/ui/region-board-skin.webp` (built over the layout wireframe in `design/templates`). Each area (top bar, side panels, Region board, phase window) shows its own slice of it, so the game's boxes sit on the art's frames; the Region board slice zooms with the camera.
- When zoomed into a Region, the frame, side panels and board switch to the Region view artwork `src/assets/ui/region-view-skin.webp`; its board slice zooms in from the tile. Its board squares are 175×250. The Captain panel shows "In <Region>" on the third header bar, the Captain's name and Lord on the plaques beside the portrait, and militia and reserve on the stats plaque.
- Battles take place on the pixel field artwork `src/assets/ui/battle-field.png` (sky, mountains, grass, banners), scaled to cover the battle area with crisp pixels under a dark wash.
- Styles live in `src/ui/screens/skin.css`.
- The board art can be switched off (`USE_BOARD_ART` in `MatchScreen.tsx`), which draws a plain wireframe look in the same layout (`wireframe.css`). It is currently off while the layout is being adjusted. Any new skin must keep the wireframe's zone positions and sizes.

## Region view and turn flow on screen — Settled

- After choosing a Captain, the player is prompted to enter that Captain's Region (button and tile). Entering zooms smoothly from the Region's tile into its 3×3 board.
- In the Region view, the Region's 3×3 board fills the center. Each player's side panel switches from their Lords to their Captain stationed in that Region: a large Captain portrait with their details, and the Captain's 6 Knights below as simple shield tokens in two columns of three (number, name, HP and Sergeants; distinct looks for ready, in the field, unmanned and fallen). Player 1 left, Player 2 right; sides never swap. Knight cards appear only on the Region's own board.
- On the Region board, each tile shows the stationed Captains as small square face portraits (Player 1 left of the name, Player 2 right) and a large 3×3 map where occupied squares show a blue X (Player 1) or a red O (Player 2).
- The player can zoom out to view the Region board at any time without changing orders, and return to their Region.
- During a turn, every Lord row except the acting Lord is greyed and darkened in both side panels.
- Each Lord's two Captains show as small face icons with a status ribbon: Standby (with their Lord), Deployed (in a contested Region), Stationed (holds a Region they secured), Dead (all their staffed Knights killed or captured). Status text colors: Standby green, Deployed yellow, Stationed blue, Dead dark red (also in the press-and-hold details). The status text stays in full color even in the greyed-out rows of Lords not taking the turn. Click to choose a Captain when allowed; press and hold to see their card, Lord, status, Region, militia, reserve and Knights.
- A Dead Captain cannot act. Press and hold a Knight (token or board piece) to see its card, type, ability description, HP and Sergeants.
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
- Zones: top bar 64px; Player 1 panel on the left, 400px; board stage in the center, 1120×854 (a 40px turn strip on top, then the map scaled to about 95% with a 24px gap above the bottom bar); Player 2 panel on the right, 400px; phase window across the bottom, 162px (Oct 29, 2026).
- Player 1 is always on the left and Player 2 always on the right. Sides never swap.
- The battle window (~1100×720), announcements, and notices are overlays on the board stage, so both side panels stay visible.
- Minimum text size about 18px on the canvas.

## Font — Settled

- The whole game uses **Press Start 2P**, a free 8-bit NES-style pixel font, as the closest legal match to the Dragon Warrior III font (which belongs to Square Enix). Swapping in a licensed font later is a one-line change in `src/ui/theme.css`.
- Text sizes are scaled for the pixel font (mostly 8–14px), letter spacing is off, and labels are shortened where needed so every line stays inside its frame in the art.

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

## Securing Regions — Settled

- A placement that completes three of a player's Knights in a row (row, column or diagonal) in a Region secures it for the placing Captain, permanently.
- Enemy Knights still standing there are captured: out of play, kept distinct from dead and retreated, and no longer counted as militia.
- A secured Region is closed: no deployments or placements. Routing into it becomes a free choice. No attack follows the securing placement.
- On the Region board a secured tile shows the winning Captain's card under a large X (Player 1) or O (Player 2).
- The losing player's Captain stationed there returns to their Lord (Standby) if they still have men (waiting Knights or reserve); their waiting Knights come with them, and their Knights on that board are captured. A Captain with no men left falls (shown as Dead) and cannot act again.
- Still open: the campaign win (three secured Regions in a row).

## Militia — Settled (test values)

- Each Lord starts with 1,000 militia: 200 in the Lord's reserve, and each of 2 Captains holds 100 in reserve plus 3 staffed Knights.
- A staffed Knight is 50 militia of their own (their HP; Knights hold no reserve) plus 5 Sergeants of 10 men each. 200 + 2 × (100 + 3 × 100) = 1,000.
- A Captain has 6 Knight slots; slots 4–6 start unmanned (no men) and cannot be placed. Staffing them from reserves comes later.
- Militia is shown per player, per Lord (with reserve), per Captain (with reserve), per Knight (HP) and per Sergeant (men). Totals count living men only.

## Battles — Settled

- Sergeant tactics are **Rush, Flank and Counter**. Each Knight's five Sergeants mix them two, two and one, varying by Knight.
- Before attacking, a window shows both Knights (HP, Sergeants, tactics) with Cancel or Commence attack.
- Commencing zooms into a battlefield: your blue Knight bottom-left facing right, the red enemy top-right facing left, whichever side attacked, each with their Sergeants as boxes (tactic icon and men) above them. Clash results show in the middle of the field, labeled You and Enemy.
- Each clash, both sides secretly choose a Sergeant; the winning tactic deals that Sergeant's men as damage to the other Knight's HP.
- The Knight with less HP at the end loses and is removed from the board. The winner stays on its square and the square becomes empty.
- Clashes are revealed one at a time with pauses (intro, reveal, result) so the information is easy to follow. After the result the player returns to the Region and ends the turn manually.
- When a battle ends, a results window appears over the battlefield: Victory / Defeat / Stand-off from the human's side, what happened to the loser, and for each Knight HP before → after, Sergeants lost and militia lost. The player confirms with Return.
- Retreating is optional. A losing Knight that survives (after every after-battle ability) stays on its square until its side chooses: **Retreat** (back to its Captain with its remaining HP and Sergeants; it can be placed again later) or **Hold position** (it keeps its square). The human chooses in the battle results window; the computer holds only if its Knight has at least as much HP left as the winner, otherwise it retreats. The turn cannot end until the choice is made.
- Back on the Region board, a loser that retreats or is killed stays on its square for a moment, then retreats (slides off toward its own side and fades) or is destroyed (flashes, a red cross, collapses). End turn, and the computer, wait until it has finished (about 2 seconds).
- Side panels hold their numbers during a battle and update when the player returns, so they never reveal a result early.
- During a battle each side panel shows that player's fighting Knight: card, name, HP, and their Sergeants listed below as slanted blocks. The human picks from the left panel. The field shows the two Knight sprites, HP boxes and clash results.

## Sergeants per Knight type — Settled

| Lord | Type | Sergeants |
|---|---|---|
| Army | Infantry / Cavalry / Archers | 5 / 4 / 3 |
| Garrison | Gatekeeper / Watchman / Warden | 2 / 3 / 3 |
| Raiders | Skirmisher / Ambusher / Saboteur | 4 / 3 / 2 |

Each Sergeant starts with 10 men. Men a Knight type doesn't use (versus 5 Sergeants and 50 HP) sit in its Captain's reserve, so every Lord still totals 1,000. Starting Captain reserves: Army 130, Garrison 170, Raiders 160.

## Knight types: Army — Settled

Each Lord class gives its Knights types. Army effects happen after a battle; Garrison (before) and Raiders (after) come later.

- **Infantry: Regroup.** After a battle the Knight survives (won, tied, or lost but alive), its Sergeants that tied a clash recover the men they lost, back to what they had when the battle began. Automatic.
- **Cavalry: Second Pass.** After winning while the loser is still alive, it strikes the loser for half its remaining HP (rounded down), whether the loser then retreats or holds. This can kill the loser. Automatic.
- **Archers.** Lead 3 Sergeants instead of 5 (the 20 spare militia sit in their Captain's reserve, so each Lord still totals 1,000). Can attack any enemy in the same row or column of the Region, at any distance. **Cover Retreat:** when a friendly Infantry directly next to them loses and survives (whether it then retreats or holds), they block the enemy's Second Pass and strike the victor for their strongest Sergeant's men; this can kill the victor. Automatic.
- Provisional choices: Army Knights cycle Infantry, Cavalry, Archers by slot (1–3 and 4–6); all three abilities trigger automatically rather than by prompt.
- Abilities play out on the battlefield after the last clash ("Second Pass!", "Cover Retreat!", "Regroup") and are listed in the results window. Knight type shows on board pieces, Knight tokens, battle HUD, attack preview and Captain details.

## Knight types: Garrison — Settled

Garrison effects happen before a battle, when a Garrison Knight is attacked.

- **Gatekeeper: Brace.** Starts at 50 HP with 2 Sergeants. Once per game, in its first battle (attacking or defending), Brace doubles its HP before the first clash. No men are added or drawn from anywhere: its men fight with the strength of two, so each man is worth 2 HP. Its militia count is half its HP, rounded up, so every 2 HP lost is one man dead. Men sent to reinforce a braced Gatekeeper also count 2 HP each. The Knight stays braced for the rest of the game.
- **Watchman: Snipe.** 3 Sergeants. When a Gatekeeper it stands directly next to is attacked, or the Watchman itself is attacked while next to a Gatekeeper, it hits the attacker with its strongest Sergeant's men before the first clash. Every Watchman next to an attacked Gatekeeper snipes.
- **Warden: First Strike.** 3 Sergeants. When attacked, hits the attacker with its strongest Sergeant's men before the first clash.
- Snipe and First Strike can kill the attacker; the battle then ends at once and the attacker is destroyed. All trigger automatically.
- Provisional choices: Garrison Knights cycle Gatekeeper, Watchman, Warden by slot. Knight size differences come from or go to the Captain's reserve, so every Lord still totals 1,000 militia.
- Pre-battle strikes play out on the battlefield after the intro ("Watchman · Snipe!", "Warden · First Strike!") and are listed in the results window. If one ends the battle when the computer attacks, the reinforcement prompt is skipped.

## Knight types: Raiders — Settled

Raiders effects happen during a battle, whether the Raider attacks or defends.

- **Skirmisher: Heist.** Wins the first clash it sends a Sergeant into, whatever the tactics. Two Skirmishers' Heists cancel out (that clash resolves normally).
- **Ambusher: Ambush!** 3 Sergeants. Only when it attacks (Oct 29, 2026): at the start of the battle, the target's 2 strongest Sergeants are kept out of this battle only (not harmed; back for later battles). An Ambusher that is attacked does not ambush.
- **Saboteur: Sabotage.** The opponent loses 1 HP after every clash (ties and unopposed blows included). This can finish a Knight off.
- Provisional choices: Raiders Knights cycle Skirmisher, Ambusher, Saboteur by slot; Ambush takes the strongest Sergeants (not random); all trigger automatically.
- Ambush plays out after the battle intro ("Ambusher · Ambush!") and the cut-off Sergeants show dotted and faded; Heist and Sabotage appear in each clash's verdict; all are summarised in the results window.

## Computer opponent — Settled

- The computer sets its own Lord order and plays its whole turn by itself at a watchable pace (about a second per step), zooming into the Region it plays in, and ends its own turns.
- It waits for the human when needed: the reinforcement prompt when it attacks, Sergeant picks, and Return after a battle. The human's controls are locked during its turn.
- It sees only what a human sees (boards, rosters, Regions held), never the human's hidden Sergeant pick, and commits its Sergeant first.
- **Smarter computer (Oct 2026).** Beat the previous computer 187–8 (5 drawn) over 200 simulated games. It:
  - Reads the big board: values Regions by the lines of three Regions they build or block (a Region that would win the match, or the only block of the human's, counts most).
  - Places to secure a Region, block the human's line, make two threats at once, and avoid routing the human into a Region they can win (weighted by what that Region is worth to them).
  - Judges an attack by playing it out several times in its head with the real battle rules, weighing the chance of clearing the square (and what that square means: a blocker of its own line, a piece of the human's) against the chance of losing its own Knight and the men traded. It attacks first when that clears the way to three in a row.
  - Moves a Knight when the step secures a Region, or when it has nothing better.
  - Picks Sergeants by expected trade against the human's remaining Sergeants (weighted, never certain, so it can't be read).
  - Reinforces a defending Knight from its Captain's reserve when the Knight is outmatched or holds an important square, keeping half the reserve back. Before the battle screen opens, an "Enemy reinforcements!" window shows how many men were sent and the Knight's HP before and after (To battle continues); the battle header also shows it.
  - Stationed Captains assault when their men × rolls clearly beat the defender's (or the Region would win the match), otherwise send men or a Knight to the neighbouring Captain with the most at stake, keeping men back when an enemy next door could assault them.
  - Chooses between deploying and giving orders by how promising each Region looks, not just the first option.
  - Spends a little more carefully once its Resources run low.

## Reinforcements — Settled

- When the human is attacked, the pre-battle window says "<Player> is attacking you! Deploy reinforcements?" and offers militia from the defending Knight's Captain reserve, in steps of 10 up to the whole reserve, or none.
- Reinforced men join the Knight's HP and may take it above the normal maximum of 50; the window says so, and battle HP shows the bonus in gold (e.g. 70 / 50 HP (+20)). The extra is permanent for the rest of the game (it can be lost in battle; nothing restores it).
- Only the defender reinforces, only before the first clash, and once per battle (the window only ever offered it once; the rules now enforce it). Attackers cannot reinforce (not requested).

## Last Stand and Decisive battles — Settled

- Two names (Oct 2026): a **Last Stand** is the dice battle when a Region stalemates; a **Decisive battle** is an assault by a stationed Captain on a neighbouring enemy-held Region (see Secured Regions). Both use the dice rules below.
- **Stalemate (Last Stand):** when a turn ends (after any battle that turn), if the Region it was played in can take no more placements (board full, or neither Captain there has a Knight left to place), nobody holds it, and both players have a Captain there, those Captains make a Last Stand before the turn passes. Attacks still possible there do not prevent it.
- **Men:** each side's HP is their Captain's total militia (reserve, waiting Knights, Knights on the board and their Sergeants).
- **Dice:** each side rolls a six-sided die once per Knight of theirs on that board, plus once for the Captain (Oct 2026). The player whose turn just ended rolls first; then they alternate, and a side with rolls left keeps rolling once the other runs out. Each roll costs the other side (roller's current men × die) ÷ 10 men, rounded down.
- **End:** when every roll is used, or a side reaches 0 men. Most men wins.
- **Losses** are spread evenly over each Captain's men: reserve and every Knight in proportion to their men; within a Knight, across HP and Sergeants. A Knight only dies if all its men are gone.
- **Last Stand result:** the side with fewer men loses. The **winner** secures the Region (like three in a row). **Loser at 0 men:** the Captain dies with all their Knights. **Loser alive:** their Knights on that board are captured and the Captain returns to their Lord with the Knights they never deployed (or falls if no men are left off the board).
- **Level:** nobody secures the Region; it closes (no more deployments or placements) and both Captains return to their Lords. Their Knights on the board stay there.
- Before every decisive battle or assault a pre-battle window shows both Captains' cards (yours on the left), their men, reserve and rolls, and the rules; in an assault an arrow points from attacker to defender. When you launch an assault yourself it comes up first with Cancel and Launch assault; otherwise it has Begin the battle. Nobody rolls until it is closed.
- The human rolls with a button; the computer rolls on its own. The screen is a battlefield with each side's group avatar (lance rider, crossbowman and swordsman together), men bars, rolls left, and the die.

## Secured Regions: stationed Captains and winning — Settled

- **Winning the match:** three secured Regions in a row, column or diagonal on the big board. Checked whenever a turn passes; the match then ends with a Victory or Defeat window.
- **Adjacent Regions** are directly up, down, left or right (no diagonals).
- A Captain holding a secured Region (stationed) can be chosen on a Free Choice (not on a Fated Move). Its turn is one order:
  - **Send reserve** (the player picks the amount, in steps of 10) to one of their own Captains (any Lord) deployed in an adjacent, unsecured Region. It joins that Captain's reserve.
  - **Send one Knight** (waiting, or lifted off the secured board) to such a Captain. It joins them, waiting to be placed, and lives or dies under them by the usual rules.
  - **Assault** an adjacent Region held by the enemy (with its Captain there): a Decisive battle between the two Captains with all their men. Each side rolls once per Knight on its own Region's board, plus once for the Captain; the attacker rolls first. Losses spread as in other decisive battles.
- **Losing a Decisive battle is not automatically losing the Region (Oct 2026).** A loser (attacker or defender) left with men and at least one living Knight chooses:
  - **Hold their ground:** their Region stays theirs; only the men killed are lost.
  - **Retreat:** their Captain goes back to Standby with every living Knight (none captured) and gives up their Region (the defender's: the one assaulted; the attacker's: their own). The winner takes it as below, including the chance to station their own Captain there.
  - The human chooses in the results window (Hold your ground / Retreat). The computer holds as a defender while it has at least half the winner's men (otherwise retreats), and as an attacker unless it has under a fifth of the winner's men.
- **Assault won, defender with no choice** (no living Knight): the defender's Knights on that board are captured and their Captain returns to their Lord (or dies at 0 men). The attacker's Knights the enemy had captured there are freed and rejoin their own Captain. If that Captain is alive and on Standby, they take the Region with those Knights. Otherwise the player stations a Standby Captain who still has a Knight (freed Knights whose Captain has fallen join them). With no such Captain, the Region empties and reopens.
- **Assault lost and held, or level:** only men are lost (at 0 men the attacker dies); both Regions stay as they were.
- Each secured Region records the enemy Knights captured there, so they can be freed later.
- Sending reserve or a Knight asks for confirmation (Confirm / Cancel). The orders window also has "Cancel: choose another Captain", which backs out of choosing that Captain before any order is given.
- A Knight that joins another Captain fills one of that Captain's empty (unmanned) slots: the two slots swap, so every Captain keeps six. With no free slot the Knight cannot be sent there.
- **Reports:** whenever a Region falls (three in a row, a decisive battle or an assault) a window lists who was captured, which Captains returned to their Lord and can be redeployed, and who fell; taking a Region back also lists the Knights freed. When the enemy sends reserve or a Knight, a window says what moved where. The computer waits until each report is closed, and Victory/Defeat shows after them.
- A secured Region holding captive Knights shows a lock badge with the count (×N) on its Region board tile, in the captured side's color (blue: yours, red: the enemy's). Freed Knights stop counting.
- Press and hold a secured Region tile for the forces holding it: the Captain's card, total men and reserve, and each of their Knights with HP shown large plus an HP bar, Sergeants and where they are; also the Knights held captive there.
- When one of your Captains retreats to their Lord (their Region fell), a separate "needs redeployment" notice (with the Captain's card) follows the fall report: which Lord they're with, the Knights and reserve they still have, and that they can be deployed again on that Lord's turn.
- After undoing a move, a waiting Knight is selected so placement squares show right away; after undoing a placement, that Knight is selected again.
- During a decisive battle or assault, each side panel shows that side's Captain hub (card, militia, reserve, Knights); in an assault the attacker's hub is their own Region's.
- On the Region board the selected Captain's Regions are marked only by the dashed white frame (no tag).
- (Superseded by the smarter computer below.) The computer assaults when it has at least 1.3× the defender's men; otherwise it sends its reserve (or a Knight) next door. After winning an assault it stations its first eligible Captain.

## Assets, loading and sound — Settled

- **Nothing waits on the network during play.** A loading screen ("Mustering the troops…", with a progress bar) downloads and decodes every image and sound and waits for the font before the title screen appears.
- **Offline:** the built game registers a service worker (`public/sw.js`) that caches every file it loads. Game files have content-hashed names and are served from the cache first; the page itself is fetched fresh when online and from the cache when not. After the first visit the game loads from disk and works without internet. The dev server does not use it.
- **Battle avatars** ship as WebP at twice their on-screen size (each frame 660px wide; the decisive-battle group avatar 840px), about 100–170 KB each instead of 1–1.7 MB. The full-size originals live in `design/source-art/sprites` and are not shipped.
- **Sound** (`src/audio/sound.ts`): Web Audio API. Every effect is decoded into memory at load, so it plays instantly and can overlap itself. Music, when added, streams with `playMusic(url)`. Effects and music have their own volume; a "Sound: On/Off" toggle sits in the bottom-right corner and is remembered between visits. Browsers keep audio locked until the first click or key press, which unlocks it.
- **Sound files** live in `src/assets/sounds`, named after the sound. Real sounds from the owner: `modal.wav` (blip), `hit.wav` (hurt), `heal.wav` (lifepoints), `sabotage.wav` (Saboteur's Sabotage), `zoom.wav` (the camera zooming into or out of a Region, either player), `archer.wav` (Archers' Cover Retreat), `second-pass.wav` (Cavalry's Second Pass). `confirm.wav` plays on the main (gold) buttons that confirm something (Confirm order, Commence attack, Launch assault, Begin the battle, Confirm, Continue, End turn…) instead of the plain click; `captain.wav` plays when a Captain is placed on the board (deployed, or stationed in a Region just taken). `turn-change.wav` (cardin) plays whenever a turn passes to either player; `place.wav` (SYSTEM0_00003) plays when a Knight is placed (or moved). `card-flip.wav` (cardopen) plays when both Sergeant picks flip open in a battle clash; `heist.wav` (effect) plays when a Skirmisher's Heist wins a clash. The rest are simple 8-bit placeholders made by `tools/make_placeholder_sounds.py` (which never overwrites an existing file); replacing a file with a real sound of the same name (.wav, .ogg or .mp3) is all it takes.
- **Starting a match:** the screen fades slowly to black (1.4 s), holds a second, the battle theme starts, holds another second, then fades slowly back in on the match (1.4 s). Input is blocked during the fade. Leaving the match (Menu) stops the music.
- **Music** is decoded into memory at load and loops gaplessly with Web Audio between loop points set per track in `src/audio/sound.ts` (`MUSIC_LOOPS`). The battle theme plays from the top once, then loops 63.04 s → 117.95 s: the rip cuts off mid-phrase in its last second, and its closing phrase at 117.95 s matches the one at 63.04 s almost exactly, so the jump can't be heard. Nothing near the start matched well enough to loop the whole song.
- **Music** lives in `src/assets/music` (currently `battle-theme.mp3`, looping for the whole match) and is **not committed**: the repository is public and the track is a commercial soundtrack. The game plays it when the file is present and stays silent otherwise, so a fresh checkout still builds. The loading screen fetches it ahead of time so it starts at once.
- **What plays:** ui-click (any button), select (deploy or resume a Captain, send men), place (place or move a Knight), clash (a battle starts; a tied clash), slash + hit (a winning clash, Snipe/First Strike, Second Pass, Cover Retreat), kill (a Knight dies), turn (Ambush), heal (a unit gains HP or men: Brace, Regroup, reinforcements), modal (any pop-up window opens), die-roll + die-land (each decisive-battle roll), secure (you secure or take a Region), retreat (the enemy does; a loser retreats from the board), victory and defeat (the match ends). hit is the sound of a unit taking damage (clashes, abilities, dice). Battle and dice sounds follow the on-screen playback, not the instant rules.

## Resources — Experimental (switchable)

- Switched on or off in `src/engine/config.ts` (`RESOURCES.enabled`); the starting amount and the out-of-Resources numbers live there too. With it off the game plays exactly as before.
- One pool per player, **12,000** to start (from 40 simulated games: about 7,300 spent by a player's 10th turn, 12,500 by the 20th, 16,000 by the 30th, so it runs out late in a typical match). No income for now.
- Costs (Oct 2026), 1 Resource per man in the party acting. You are only charged when an action is made; **nothing is charged at the end of a turn** (the old upkeep is gone):
  - Deploying a Captain: their whole company, reserve included.
  - Placing a Knight, moving a Knight, attacking: that Knight's men.
  - Holding ground after losing: a Knight that holds its square pays its men; a Captain that holds after losing a Decisive battle pays the Captain's men.
  - Launching a Decisive battle (assault): the assaulting Captain's whole company. Sending reserve or a Knight from a secured Region, or reinforcing a defender: the men sent.
- An action the pool can't fully cover still happens; the pool goes to 0.
- **Wager pools (Oct 2026):** the loser of a Knight battle, a Last Stand or a Decisive battle pays Resources equal to the men they lost in it (as much as they have). It goes into a pool between the two sides: the two Knights on their squares, or the two Captains in their Regions. Whichever side leaves its spot first (retreats, moves, falls or is captured) forfeits the pool to the other, who collects it at once. If both leave at the same moment, each gets half back. A loser who retreats or dies hands the pool straight to the winner; a loser who holds keeps it in play. Undoing a move puts the pool back.
- Pools show as a gold "Pool N" tag on both Knights' squares in the Region view, and on the Region board for pools between Captains. Battle result windows say what the loser paid in; a report says when a pool is won or lost. The attack window warns that the loser pays per man lost.
- **Out of Resources (Oct 2026):** each action costs 1% of the acting party's men (rounded up, at least 1), from the acting Captain's reserve, or the acting Knight (never its last man: its Captain's reserve or another of its Knights pays instead). Troops no longer waste away each turn. Winning a pool refills the bar.
- Shown as health bars across the top of the bottom bar: yours on the left, the enemy's mirrored on the right, with the number on the bar. Green above half, yellow below half, red and throbbing below a quarter; at 0 the empty bar flashes "OUT OF RESOURCES". Spending leaves a pale stretch that drains away a moment later, with the amount shown in the bar; gains show in green. The bar of whoever's turn it is glows. Costs also show on deploy labels, the attack and assault windows, the send-men confirmations and the Hold buttons. A report window opens when a player runs out.
- The computer spends a little more carefully once its Resources run low. It does not yet weigh wager pools when choosing to hold or retreat.
- Undoing a placement or move refunds what it cost.

## Undoing a Captain choice — Settled

- Until the turn is confirmed, a Captain's deployment can be undone ("Undo deployment"): the Captain goes back to Standby, its Resources are refunded, and the Lord chooses again (another Region, or another Captain). Giving orders to a deployed Captain can be taken back the same way ("Choose another Captain"); a stationed Captain's orders window already had Cancel.
- A placement or move must be undone first. Once that Captain attacks, or a stationed Captain gives its order, the choice is final.

## Sergeant icons — Settled

- Tactics are shown as rock, paper and scissors, matching who beats whom: **Rush = rock** (red), **Flank = scissors** (green), **Counter = paper** (blue) (rock beats scissors, scissors beat paper, paper beats rock). The names stay Rush, Flank and Counter. In battle the icon sits at the right end of each Sergeant button, after the name.
- Each Sergeant row in battle shows a small avatar on the left: the face from the Sergeant card art (greyed out once the Sergeant has fought or been lost).
- Undoing a Captain deployment or choice, cancelling a stationed Captain's orders, and taking a Lord back out of the turn order (or Reset) play the cancel sound.

## Battles — Provisional (my choices, open to change)

1. Rush beats Flank, Flank beats Counter, Counter beats Rush.
2. The beaten Sergeant is lost with all their men. The winning Sergeant is unharmed.
3. Same tactic (Oct 2026): the Sergeant with more men wins, dealing only the difference as damage to the losing Knight; the beaten Sergeant is lost with all their men. Same tactic and same men: a tie, both Sergeants lose half their men (loss rounded up), and no HP damage.
4. Up to 5 clashes; each Sergeant fights once per duel. The duel ends early at 0 HP. If one side runs out of Sergeants, the other's remaining Sergeants strike unopposed.
**Attrition (Oct 2026), a last-resort move like Struggle:** once every one of a Knight's Sergeants is dead, it may use Attrition in place of a Sergeant, once per battle. It can't be beaten: it costs the Knight 10% of its current HP (rounded up, at least 1) and deals the same amount to the enemy Knight. If the enemy sends a Sergeant into the same clash, that Sergeant strikes unopposed as well (full men as damage) and survives. Both sides using it trade 10% each. A Knight whose Sergeants are alive but have already fought this battle does not get it. On the battle screen it appears as a red Attrition button showing its cost and damage, and "Attrition used" afterwards; the computer uses it whenever it is its only move.
5. Equal HP at the end: the defender holds and both Knights stay.
6. The losing Knight dies at 0 HP; otherwise its side chooses to retreat it to its Captain (with its remaining HP and Sergeants, to be placed again later) or hold its square.
7. One attack per turn, by any of the acting Captain's Knights on that board, against an enemy directly up, down, left or right of it (Archers: same row or column). Attacking is optional.
8. HP, Sergeant losses and deaths carry over to every later battle. Nothing regenerates.
9. The human always picks Player 1's (blue) Sergeants and the computer always picks Player 2's (red), whether attacking or defending. The computer commits first and never looks at the human's pick (see Computer opponent for how it chooses).

## Other rules — Proposed (not yet approved)

1. (Settled, see Match start and turns.)
2. When a territory is secured, the losing Captain's Knights there are captured and that Captain counts as killed.
3. (Replaced by Decisive battles.)
4. A player with no legal action skips to the next Lord with one. If none has one, that player loses.
5. Reserves and reinforcement (staffing unmanned Knights, topping up Sergeants) come later. Reserves are only displayed for now.

## Still open

- Army / Garrison / Raiders advantages.
- Ultimate Tic-Tac-Toe routing (where a placement sends the opponent).
- What makes factions differ (cosmetic or mechanical) and how many there are.
- Whether there is a story campaign or only reactive scenes.
- Whether eliminating all three enemy Generals is also a win.
