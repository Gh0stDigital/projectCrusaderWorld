import { useState, type CSSProperties } from 'react';
import { useAppStore } from '../../store/appStore';
import { useMatchStore } from '../../store/matchStore';
import { actingCaptain, commandOptions, commandableRegions } from '../../engine/queries';
import type { LordClass, RegionIndex } from '../../engine/state';
import { LORD_NAMES, PLAYER_NAMES, REGION_NAMES, captainName, knightName } from '../../data/names';
import { PlayerPanel } from '../campaign/PlayerPanel';
import { RegionBoard } from '../campaign/RegionBoard';
import { RegionView } from '../campaign/RegionView';
import { BoardStage } from '../campaign/BoardStage';
import { LordOrderSetup } from '../campaign/LordOrderSetup';
import { PhaseWindow } from '../campaign/PhaseWindow';
import { TurnAnnouncement } from '../overlays/TurnAnnouncement';
import { OrdersNotice } from '../overlays/OrdersNotice';
import { AttackPreview } from '../battle/AttackPreview';
import { BattleView } from '../battle/BattleView';
import { DecisiveView } from '../battle/DecisiveView';
import regionBoardSkin from '../../assets/ui/region-board-skin.webp';
import regionViewSkin from '../../assets/ui/region-view-skin.webp';
import './match.css';
import './skin.css';
import './wireframe.css';

/**
 * Board artwork on/off. Off draws the plain wireframe look in the same layout,
 * for working on adjustments. Set back to true to restore the art.
 */
const USE_BOARD_ART = false;

/**
 * Exhibition against the computer: the human plays Player 1 (blue); the
 * computer plays Player 2 (red) and takes its own turns.
 */
export function MatchScreen() {
  const goTo = useAppStore((s) => s.goTo);
  const store = useMatchStore();
  const { match, selectedCaptainId, selectedKnightId, focusedRegion, busy, notice, error, announcement } = store;
  const { attackPreviewId, battleOpen, battleSnapshot, defensePromptOpen, departure } = store;
  // During a battle the side panels hold still until the battle screen has shown the result.
  const panelMatch = battleOpen && battleSnapshot ? battleSnapshot : match;
  const [draft, setDraft] = useState<LordClass[]>([]);

  const ordering = match.phase === 'lordOrder' ? match.orderingPlayer : null;
  const turn = match.turn;
  const acting = actingCaptain(match);
  // The human only acts on their own turn; the computer plays Player 2.
  const humanTurn = turn?.player === 'p1';
  const locked = busy || !humanTurn || departure !== null;

  // --- Lord order setup ---
  const draftControls = { order: draft, remove: (lord: LordClass) => setDraft(draft.filter((d) => d !== lord)) };
  const confirmOrder = () => {
    if (ordering && store.dispatch({ type: 'setLordOrder', player: ordering, order: draft })) setDraft([]);
  };

  // --- Region board clicks: deploy, resume, or enter ---
  const selected = selectedCaptainId ? match.captains[selectedCaptainId] : undefined;
  const clickable = new Set<RegionIndex>();
  let regionAction = '';
  if (turn && !locked) {
    if (turn.step === 'command' && selected) {
      if (selected.region === null) {
        commandOptions(match).deployRegions.forEach((r) => clickable.add(r));
        regionAction = 'Deploy here';
      } else {
        clickable.add(selected.region);
        regionAction = 'Give orders';
      }
    } else if (turn.step !== 'command' && acting?.region != null) {
      clickable.add(acting.region);
      regionAction = 'Enter';
    }
  }

  const clickRegion = (region: RegionIndex) => {
    if (!turn || locked) return;
    if (turn.step === 'command' && selected) {
      if (selected.region === null) {
        store.dispatch({ type: 'deployCaptain', player: turn.player, captainId: selected.id, region });
      } else {
        store.dispatch({ type: 'resumeCaptain', player: turn.player, captainId: selected.id });
      }
    } else if (acting?.region === region) {
      store.focusRegion(region);
    }
  };

  // While zoomed into a Region, the side panels show each player's Captain and Knights there.
  const companyControls =
    focusedRegion !== null
      ? { region: focusedRegion, selectedKnightId, onSelectKnight: (id: string) => !locked && store.selectKnight(id) }
      : undefined;

  const leave = () => {
    store.newMatch();
    setDraft([]);
    goTo('mainMenu');
  };

  const placedKnight = turn?.placedKnightId ? match.knights[turn.placedKnightId] : undefined;
  const outcome = match.duel?.outcome;
  const battleNote = outcome
    ? outcome.winner === 'attacker'
      ? ' and won the battle'
      : outcome.winner === 'defender'
        ? ' but lost the battle'
        : ', and the battle ended even'
    : '';
  const securedNote =
    acting && acting.region !== null && match.secured[acting.region]?.captainId === acting.id && placedKnight
      ? ` and secured it`
      : '';
  const noticeDetail =
    placedKnight && acting && acting.region !== null
      ? `${captainName(acting)} placed ${knightName(placedKnight)} in ${REGION_NAMES[acting.region]}${securedNote}${battleNote}`
      : turn
        ? `The ${LORD_NAMES[turn.lord]} had no orders to give`
        : '';

  const previewTarget = attackPreviewId ? match.knights[attackPreviewId] : undefined;
  const previewAttacker = selectedKnightId ? match.knights[selectedKnightId] : undefined;
  const attackPreview =
    previewTarget && previewAttacker ? { attacker: previewAttacker, defender: previewTarget } : null;
  const incoming =
    defensePromptOpen && match.duel
      ? { attacker: match.knights[match.duel.attacker.knightId]!, defender: match.knights[match.duel.defender.knightId]! }
      : null;

  return (
    <div
      className={`match${focusedRegion !== null ? ' match--zoomed' : ''}${battleOpen ? ' match--battle' : ''}${
        USE_BOARD_ART ? '' : ' match--wireframe'
      }`}
      style={
        (USE_BOARD_ART
          ? { '--skin': `url(${regionBoardSkin})`, '--skin-zoomed': `url(${regionViewSkin})` }
          : { '--skin': 'none', '--skin-zoomed': 'none' }) as CSSProperties
      }
    >
      <header className="match__top-bar">
        <button className="top-bar__button" onClick={leave}>
          Menu
        </button>
        <span className="top-bar__title">
          {turn
            ? `${PLAYER_NAMES[turn.player]} · ${LORD_NAMES[turn.lord]}`
            : ordering
              ? `${PLAYER_NAMES[ordering]} · Lord order`
              : 'Exhibition'}
        </span>
        <span className="top-bar__right">
          {focusedRegion !== null && !locked && !battleOpen && (
            <button className="top-bar__button" onClick={() => store.focusRegion(null)}>
              View Region board
            </button>
          )}
          <span className="top-bar__turn">{match.turnNumber > 0 ? `Turn ${match.turnNumber}` : 'Setup'}</span>
        </span>
      </header>

      <PlayerPanel
        match={panelMatch}
        player="p1"
        selectedCaptainId={selectedCaptainId}
        onSelectCaptain={(id) => !locked && store.selectCaptain(id)}
        draft={ordering === 'p1' ? draftControls : undefined}
        company={companyControls}
        battleHud={battleOpen}
      />

      <BoardStage
        focusedRegion={focusedRegion}
        regionBoard={
          ordering === 'p2' ? (
            <div className="enemy-ordering">The enemy is placing their Lords…</div>
          ) : ordering ? (
            <LordOrderSetup
              player={ordering}
              draft={draft}
              onAdd={(lord) => setDraft([...draft, lord])}
              onReset={() => setDraft([])}
              onConfirm={confirmOrder}
            />
          ) : (
            <RegionBoard
              match={match}
              clickable={clickable}
              active={acting?.region ?? null}
              required={turn?.step === 'command' && commandOptions(match).mode === 'routed' ? match.route : null}
              playable={new Set(commandableRegions(match))}
              choosing={turn?.step === 'command' && clickable.size > 0}
              onClickRegion={clickRegion}
              labelFor={() => regionAction}
            />
          )
        }
        renderRegion={(region) => (
          <RegionView
            match={match}
            region={region}
            selectedKnightId={selectedKnightId}
            onChooseTarget={(id) => !locked && store.openAttackPreview(id)}
            onSelectAttacker={(id) => !locked && store.selectKnight(id)}
            departure={departure}
            onPlaceKnight={(square) =>
              turn &&
              !locked &&
              selectedKnightId &&
              store.dispatch({ type: 'placeKnight', player: turn.player, knightId: selectedKnightId, square })
            }
          />
        )}
        overlays={
          <>
            {attackPreview && (
              <AttackPreview
                match={match}
                attacker={attackPreview.attacker}
                defender={attackPreview.defender}
                onCancel={() => store.openAttackPreview(null)}
                onCommence={store.commenceAttack}
              />
            )}
            {incoming && (
              <AttackPreview
                match={match}
                attacker={incoming.attacker}
                defender={incoming.defender}
                mode="defend"
                onCommence={store.confirmDefense}
              />
            )}
            {battleOpen && match.duel && turn && (
              <BattleView
                match={match}
                duel={match.duel}
                onCommit={(sergeantId) => store.dispatch({ type: 'commitSergeant', player: 'p1', sergeantId })}
                onClose={store.closeBattle}
                onChooseRetreat={store.chooseRetreat}
              />
            )}
            {store.decisiveOpen && match.decisive && (
              <DecisiveView
                match={match}
                decisive={match.decisive}
                onRoll={store.rollDecisive}
                onReturn={store.closeDecisive}
              />
            )}
            {notice && <OrdersNotice player={notice.player} detail={noticeDetail} />}
            {announcement && <TurnAnnouncement announcement={announcement} onDone={store.dismissAnnouncement} />}
          </>
        }
      />

      <PlayerPanel
        match={panelMatch}
        player="p2"
        selectedCaptainId={selectedCaptainId}
        onSelectCaptain={(id) => !locked && store.selectCaptain(id)}
        draft={undefined}
        company={companyControls}
        battleHud={battleOpen}
      />

      <PhaseWindow
        match={match}
        selectedCaptainId={selectedCaptainId}
        focusedRegion={focusedRegion}
        busy={busy}
        battleOpen={battleOpen || store.decisiveOpen}
        departing={departure !== null}
        error={error}
        onEnterRegion={store.focusRegion}
        onEndTurn={store.requestEndTurn}
      />
    </div>
  );
}
