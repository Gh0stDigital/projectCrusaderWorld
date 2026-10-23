import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useMatchStore } from '../../store/matchStore';
import { actingCaptain, regionsOpenTo } from '../../engine/queries';
import type { LordClass, RegionIndex } from '../../engine/state';
import { LORD_NAMES, PLAYER_NAMES, REGION_NAMES, captainName } from '../../data/names';
import { PlayerPanel } from '../campaign/PlayerPanel';
import { RegionBoard } from '../campaign/RegionBoard';
import { RegionView } from '../campaign/RegionView';
import { BoardStage } from '../campaign/BoardStage';
import { LordOrderSetup } from '../campaign/LordOrderSetup';
import { PhaseWindow } from '../campaign/PhaseWindow';
import { TurnAnnouncement } from '../overlays/TurnAnnouncement';
import { OrdersNotice } from '../overlays/OrdersNotice';
import './match.css';

/**
 * Pass-and-play for now: you control both players. The computer opponent
 * comes in a later step.
 */
export function MatchScreen() {
  const goTo = useAppStore((s) => s.goTo);
  const store = useMatchStore();
  const { match, selectedCaptainId, selectedKnightId, focusedRegion, busy, notice, error, announcement } = store;
  const [draft, setDraft] = useState<LordClass[]>([]);

  const ordering = match.phase === 'lordOrder' ? match.orderingPlayer : null;
  const turn = match.turn;
  const acting = actingCaptain(match);

  // --- Lord order setup ---
  const draftControls = { order: draft, remove: (lord: LordClass) => setDraft(draft.filter((d) => d !== lord)) };
  const confirmOrder = () => {
    if (ordering && store.dispatch({ type: 'setLordOrder', player: ordering, order: draft })) setDraft([]);
  };

  // --- Region board clicks: deploy, resume, or enter ---
  const selected = selectedCaptainId ? match.captains[selectedCaptainId] : undefined;
  const clickable = new Set<RegionIndex>();
  let regionAction = '';
  if (turn && !busy) {
    if (turn.step === 'command' && selected) {
      if (selected.region === null) {
        regionsOpenTo(match, turn.player).forEach((r) => clickable.add(r));
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
    if (!turn || busy) return;
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
      ? { region: focusedRegion, selectedKnightId, onSelectKnight: (id: string) => !busy && store.selectKnight(id) }
      : undefined;

  const leave = () => {
    store.newMatch();
    setDraft([]);
    goTo('mainMenu');
  };

  const placedKnight = turn?.placedKnightId ? match.knights[turn.placedKnightId] : undefined;
  const noticeDetail =
    placedKnight && acting && acting.region !== null
      ? `${captainName(acting.lord, acting.rank)} placed Knight ${placedKnight.number} in ${REGION_NAMES[acting.region]}`
      : turn
        ? `The ${LORD_NAMES[turn.lord]} had no orders to give`
        : '';

  return (
    <div className="match">
      <header className="match__top-bar">
        <button className="top-bar__button" onClick={leave}>
          Menu
        </button>
        <span className="top-bar__title">
          {turn
            ? `${PLAYER_NAMES[turn.player]} · ${LORD_NAMES[turn.lord]}`
            : ordering
              ? `${PLAYER_NAMES[ordering]} is ordering their Lords`
              : 'Exhibition'}
        </span>
        <span className="top-bar__right">
          {focusedRegion !== null && !busy && (
            <button className="top-bar__button" onClick={() => store.focusRegion(null)}>
              View Region board
            </button>
          )}
          <span className="top-bar__turn">{match.turnNumber > 0 ? `Turn ${match.turnNumber}` : 'Setup'}</span>
        </span>
      </header>

      <PlayerPanel
        match={match}
        player="p1"
        selectedCaptainId={selectedCaptainId}
        onSelectCaptain={(id) => !busy && store.selectCaptain(id)}
        draft={ordering === 'p1' ? draftControls : undefined}
        company={companyControls}
      />

      <BoardStage
        focusedRegion={focusedRegion}
        regionBoard={
          ordering ? (
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
            onPlaceKnight={(square) =>
              turn &&
              !busy &&
              selectedKnightId &&
              store.dispatch({ type: 'placeKnight', player: turn.player, knightId: selectedKnightId, square })
            }
          />
        )}
        overlays={
          <>
            {notice && <OrdersNotice player={notice.player} detail={noticeDetail} />}
            {announcement && <TurnAnnouncement announcement={announcement} onDone={store.dismissAnnouncement} />}
          </>
        }
      />

      <PlayerPanel
        match={match}
        player="p2"
        selectedCaptainId={selectedCaptainId}
        onSelectCaptain={(id) => !busy && store.selectCaptain(id)}
        draft={ordering === 'p2' ? draftControls : undefined}
        company={companyControls}
      />

      <PhaseWindow
        match={match}
        selectedCaptainId={selectedCaptainId}
        focusedRegion={focusedRegion}
        busy={busy}
        error={error}
        onEnterRegion={store.focusRegion}
        onEndTurn={store.requestEndTurn}
      />
    </div>
  );
}
