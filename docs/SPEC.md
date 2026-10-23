# Crusader World — Design Specification (handoff)

This is the original design handoff. Rule choices made since then live in [DECISIONS.md](DECISIONS.md); where they disagree, DECISIONS.md wins.

It is a medieval conquest strategy game built around Ultimate Tic-Tac-Toe, a military command hierarchy, persistent manpower, and short rock-paper-scissors battles between Knights.

Preserve existing artwork and the established visual direction when working from my prototype. Compare the code against this specification first: older implementations may contain outdated rules.

## 1. Theme and overall structure

The broader theme is a medieval crusade or campaign toward a Holy Land. Each player commands a King's forces through three Generals and their subordinate units.

The strategic board has two levels:

- Campaign map: a 3×3 macro board containing nine territories.
- Territory map: each territory contains its own 3×3 micro board.

Commanders contest territories by deploying Knights onto their micro boards. Winning a territory places that Commander's banner on the corresponding macro square.

Three captured territories in a macro row, column, or diagonal win the campaign.

## 2. Military hierarchy

Each player has:

- One King, representing the overall faction.
- Three Generals: Army, Garrison, and Raiders.
- Two Commanders per General: six Commanders total.
- Up to six Knights per Commander.
- Up to five Sergeants per Knight.
- Militia men assigned through this hierarchy.

The King does not currently need a separate playable unit or combat system.

Army, Garrison, and Raiders are the three military branches. A three-way relationship between these branches is part of the concept, but exact strategic advantages or damage modifiers are not finalized. Do not invent bonuses.

## 3. General rotation

Players alternate turns.

Each player also has their own General rotation: Army → Garrison → Raiders → Army.

A player's next General becomes active when that player's turn comes back around. Do not visibly advance the inactive player's General immediately after they end their turn.

Example:

1. Player One acts with Army.
2. Player Two acts with Army.
3. Player One returns with Garrison.
4. Player Two returns with Garrison.

The turn announcement must clearly identify the incoming player, active General, and required territory or available return territories.

An existing Commander can take control when routing sends the player back to that Commander's territory. Clearly distinguish the rotating General's scheduled turn from the Commander and General actually controlling an existing deployment.

## 4. Commander deployment

For a new deployment:

1. Select an available Commander belonging to the active General.
2. Choose a legal territory.
3. Deploy that Commander.
4. Enter the territory to command their Knights.

A deployed Commander remains assigned to their territory. They cannot freely move between territories.

Each player can have only one Commander stationed in a given territory, regardless of branch. The opponent can station their own Commander in that same territory to contest it.

If the player already has a Commander in the required territory, resume that Commander's Knights instead of requiring another deployment.

## 5. Ultimate Tic-Tac-Toe routing

A Knight's placement determines the opponent's next required territory.

Examples:

- Top-left micro square → top-left macro territory.
- Center micro square → center macro territory.
- Bottom-right micro square → bottom-right macro territory.

Highlight the required territory clearly. Preview the destination when useful.

If the routed territory is already secured or closed, allow another otherwise legal open territory.

The route comes from the Knight's placement square. Combat must not silently replace that route with the defeated Knight's square.

## 6. Exception when both Commanders are deployed

When the current rotating General has both Commanders deployed, the player's required territory choices become that General's existing deployed territories.

In this situation:

- Ignore the normal mandatory destination from the opponent's previous placement.
- Let the player choose an eligible ongoing command under that General.
- Resume that Commander's territory.
- Do not let the player choose arbitrary territories.
- The Knight placement made during this turn still determines the opponent's next route.

A secured territory is no longer an active battlefront.

If one Commander holds secured territory and the other has an eligible contested territory, use the eligible contested territory.

If both Commanders hold secured territories, skip that General's turn, but show a clear notice before continuing.

Defeated Generals must also be handled explicitly rather than leaving the game stuck.

## 7. Player turn sequence and manual End Turn

The normal sequence is:

1. Announce the player and General.
2. Select or resume a Commander.
3. Enter the territory.
4. Place a Knight or perform the permitted action with a stationed Knight.
5. Optionally fight an eligible adjacent enemy.
6. Reach the End phase.
7. The player presses End Turn in the phase command window.

Manual End Turn is required.

Do not automatically switch players after an uncontested placement.

Do not automatically switch players immediately after a duel ends.

After a duel, show its result, allow the player to return to their orders, and require End Turn in the phase commands.

Keep the outgoing player's board state visible long enough to understand the result. After End Turn, use a brief transition—approximately one second—back to the campaign map and the incoming turn announcement.

Do not allow End Turn to bypass an unfinished duel.

Skipped-General notices and no-legal-action cases need explicit handling. A player should never be left without a valid way to continue.

## 8. Knight placement and movement

Knights are the pieces occupying micro-board squares.

Deploy a Knight into a legal empty square belonging to the acting Commander's territory.

Once stationed, Knights cannot move freely between squares. They remain in place and can attack eligible adjacent enemy Knights.

Do not retain an older prototype's ability to "march" a stationed Knight into another empty square.

A turn must not allow unlimited placements or repeated battles. The basic allowance is one placement and its optional battle, or the permitted action with an already stationed Knight.

The exact action sequence for attacking with an existing Knight without first placing a new Knight needs to be made explicit before implementing that edge case.

Likewise, confirm whether "adjacent" includes diagonals; do not silently change the existing interpretation.

## 9. Knight combat

Combat is Knight versus Knight, resolved through their Sergeants.

- A Knight has up to five Sergeants.
- Each Sergeant has a tactic specialization.
- Each Sergeant has an assigned militia strength.
- That strength determines the damage of their attack.
- Knight militia represents the Knight's HP.

The working tactic names are Attack, Counter, and Maneuver. Some older builds call them Assault, Defend, and Maneuver.

Use one consistent naming scheme and show the rock-paper-scissors relationship clearly. Confirm the exact counter direction if the supplied build and intended design disagree.

Each clash:

1. Both Knights select an available Sergeant.
2. Choices stay hidden until both are committed.
3. Reveal both tactics.
4. Resolve their relationship and casualties.
5. Show the result.
6. Continue to the next clash.

A normal duel has up to five clashes, with early defeat if a Knight reaches zero HP.

## 10. Sergeant availability and persistent losses

Separate "used in this duel" from "survived for later battles."

- Each Sergeant can be selected only once during the current duel.
- A winning Sergeant survives unchanged and can be used again in a future duel.
- A dominated Sergeant is lost.
- A neutral or tied Sergeant loses half their militia, rounded to a whole number, and can survive for future battles.

Do not interpret "reusable" as allowing the same winning Sergeant to attack repeatedly in the same duel.

Persist the appropriate casualties between battles.

The exact rounding direction and how Sergeant losses translate into total Knight HP need a consistent accounting rule. Avoid counting the same casualties twice.

Also define what happens when a Knight begins a duel with fewer than five surviving Sergeants. Do not quietly regenerate lost Sergeants.

## 11. Duel winner and board consequences

The intended winner is the Knight with higher remaining HP at the end of the duel.

Do not substitute "less damage taken during this duel" for remaining HP. Those produce different results when Knights enter combat wounded.

A Knight reaching zero militia dies.

A surviving defeated Knight retreats and may be reassigned under the permitted command rules.

The current intended board rule is:

- The winning Knight stays on its original square.
- The defeated Knight is removed from its square.
- That square becomes empty.
- Claiming the empty square requires a later Knight deployment.

Do not automatically move the victorious Knight into the defeated square. That was an earlier version of the concept.

Equal-HP outcomes need an explicit tie rule. Preserve an existing clearly defined rule provisionally and flag it rather than inventing an advantage.

## 12. Securing a territory

Three friendly Knights in a row, column, or diagonal secure the micro board.

The territory becomes the winning Commander's macro-board piece.

Territory conquest is permanent in the current design. A secured territory cannot be retaken.

Enemy Knights remaining in a conquered territory are captured. Treat capture as distinct from being killed in combat or retreating alive.

The exact future use of prisoners is not finalized. Do not automatically convert captured troops into usable reserves or resources.

A Commander holding a secured territory remains committed to that territory, which affects whether their General still has active commands available.

## 13. Commander and General losses

If a Commander loses all their Knights, that Commander is killed.

If both Commanders under a General are killed, that General is defeated.

Reassignments remain within the same General's organization. Do not allow arbitrary transfers between Army, Garrison, and Raiders.

There is an unresolved case where a Commander loses their territory but still has undeployed Knights. Whether that Commander returns to the General and becomes eligible for redeployment needs a clear rule.

Do not automatically make all defeated Commanders reusable.

Keep these states distinct:

- Commander deployed in an active territory.
- Commander holding a secured territory.
- Commander killed.
- Commander displaced but potentially eligible to return.
- Knight dead.
- Knight captured.
- Knight retreated alive.

## 14. Militia economy

The proposed test economy is:

- 3,000 militia per player.
- 1,000 assigned to each General.
- Commander reserve baseline: 100.
- Knight baseline: 100.
- Sergeant baseline: 10.

Transfers follow the command chain:

- General reserve → Commander.
- Commander reserve → Knight.

Do not allow direct General-to-Knight transfers or cross-General transfers.

These are test values and capacity targets, not permission to create extra militia.

The initial distribution still needs reconciliation: two Commanders with six fully staffed 100-man Knights each already exceed a General's 1,000-man budget.

Therefore, distinguish:

- Unit capacity.
- Starting unit availability.
- Starting assigned manpower.
- Unassigned reserves.
- Whether Sergeant crews are included within Knight HP.

Do not count Sergeant crews as additional men on top of Knight manpower unless that is explicitly decided.

An older prototype displayed 1,200 militia per General because it summed twelve fully staffed Knights. Treat that as a prototype calculation, not confirmation that the proposed 1,000-man General economy was abandoned.

## 15. Militia information in the interface

Make manpower easy to inspect at every level:

- General: total living militia for that individual army.
- Commander: total militia under their command.
- Knight: current militia/HP.
- Sergeant: tactic and current assigned manpower/damage.

Show the Army, Garrison, and Raiders totals individually so the player can understand each force's condition.

If reserves are implemented, distinguish reserve manpower from assigned manpower. Label totals clearly to prevent double-counting.

Casualties must update these displays immediately and persist correctly.

## 16. Interface and animation requirements

Maintain a readable medieval military aesthetic with a centered board and character panels on either side.

Required interface behavior:

- Clear active-player and active-command highlighting.
- Stable faction positioning; avoid confusing side swaps.
- A phase window showing Command, Placement, Attack, Battle, and End.
- End Turn prominently placed in the phase command window.
- Conveniently centered battle continuation controls.
- Turn announcements that slide fully into the center.
- Visible mandatory-territory highlights and route previews.
- A way to survey the campaign map without spending a turn or altering orders.
- A clear way to return to the currently assigned territory.
- Visible militia information.

Map transitions should be smooth and subtle:

- Clean zoom in and out.
- Motion anchored to the relevant territory when practical.
- No heavy blur or abrupt size jumps.
- No repeated zoom animation when merely selecting a Knight or updating a panel.
- Respect reduced-motion preferences.

Knight selection should not use a distracting bounce animation.

## 17. Battle presentation

The central battle window must fit its contents without internal scrolling at supported desktop sizes.

Keep:

- Both Knight portraits proportional.
- Portraits large enough to read.
- HP and casualty information visible.
- Sergeant choices legible.
- Current clash number visible.
- Outcome and continuation controls easy to find.

Do not squash the portraits to fit the layout. Adapt spacing and image size while preserving proportions.

Provide clear placement, removal, defeat, and capture feedback without making the game unnecessarily slow.

## 18. Modes, saving, and computer behavior

Preserve solo play against the computer and local two-player play where present.

For local play, keep each player's selected Sergeant hidden until both choices are committed.

For solo play, the computer must commit its choice without reading the human's hidden selection.

Preserve browser saving and resuming where supported, including:

- Current player and General rotation.
- Commander deployments.
- Board ownership and Knight positions.
- Persistent casualties.
- Current duel and spent Sergeants.
- The End phase while waiting for the player to press End Turn.

The computer should complete its own turns without requiring the human to press End Turn on its behalf. Human turns still require the explicit button.

## 19. Rules that still need a decision

Do not present the following as settled:

- Exact Army/Garrison/Raiders advantages.
- Exact tactic counter direction if conflicting versions exist.
- Orthogonal versus diagonal attack adjacency.
- Exact turn flow for an already stationed Knight attacking without a new deployment.
- Routing after an attack-only turn.
- Equal-HP duel ties.
- Neutral-clash rounding and casualty accounting.
- Duels with fewer than five surviving Sergeants.
- Commander return/redeployment after losing territory.
- Treatment of captured Knights beyond removal from active play.
- Initial distribution of the 3,000-man militia budget.
- Replenishment, recruitment, and transfer timing.
- Full micro-board draws and other no-legal-action conditions.
- Whether military elimination creates a campaign victory condition beyond three macro territories in a line.

Identify these gaps before implementing changes that depend on them.

## 20. How to continue the project

First inspect the latest supplied build and compare it against this handoff.

Report:

1. Which intended mechanics already work.
2. Which implemented rules are outdated.
3. Which missing mechanics can be implemented directly.
4. Which unresolved rules require a decision.

In particular, check for these known sources of mismatch:

- Automatic turn advancement instead of manual End Turn.
- Moving stationed Knights.
- Moving a battle winner into the defeated square.
- Choosing the winner by damage taken instead of remaining HP.
- Losing persistent Sergeant casualties between battles.
- Ignoring the deployed-Commander routing exception.
- Advancing a General visually before that player's turn returns.
- Treating the prototype's militia totals as the finalized economy.

Preserve established features while fixing these mismatches. Do not silently simplify the hierarchy, routing, persistent casualties, or phase flow.
