import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useMatchStore } from '../../store/matchStore';
import { deployableCaptains } from '../../engine/queries';
import type { LordClass, RegionIndex } from '../../engine/state';
import { LORD_NAMES, PLAYER_NAMES } from '../../data/names';
import { PlayerPanel } from '../campaign/PlayerPanel';
import { LordColumn } from '../campaign/LordColumn';
import { RegionBoard } from '../campaign/RegionBoard';
import { LordOrderSetup } from '../campaign/LordOrderSetup';
import { PhaseWindow } from '../campaign/PhaseWindow';
import { TurnAnnouncement } from '../overlays/TurnAnnouncement';
import './match.css';

/**
 * Pass-and-play for now: you control both players. The computer opponent
 * comes in a later step.
 */
export function MatchScreen() {
  const goTo = useAppStore((s) => s.goTo);
  const { match, selectedCaptainId, error, announcement, dispatch, selectCaptain, dismissAnnouncement, newMatch } =
    useMatchStore();
  const [draft, setDraft] = useState<LordClass[]>([]);

  const ordering = match.phase === 'lordOrder' ? match.orderingPlayer : null;
  const turn = match.turn;

  const confirmOrder = () => {
    if (ordering && dispatch({ type: 'setLordOrder', player: ordering, order: draft })) setDraft([]);
  };

  const canDeploy = turn !== null && deployableCaptains(match).length > 0 && selectedCaptainId !== null;
  const chooseRegion = canDeploy
    ? (region: RegionIndex) =>
        dispatch({ type: 'deployCaptain', player: turn.player, captainId: selectedCaptainId, region })
    : null;

  const leave = () => {
    newMatch();
    setDraft([]);
    goTo('mainMenu');
  };

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
        <span className="top-bar__turn">{match.turnNumber > 0 ? `Turn ${match.turnNumber}` : 'Setup'}</span>
      </header>

      <PlayerPanel match={match} player="p1" selectedCaptainId={selectedCaptainId} onSelectCaptain={selectCaptain} />

      <main className="match__board-stage">
        <LordColumn
          match={match}
          player="p1"
          draft={ordering === 'p1' ? { order: draft, remove: (l) => setDraft(draft.filter((d) => d !== l)) } : undefined}
        />
        <div className="match__board-center">
          {ordering ? (
            <LordOrderSetup
              player={ordering}
              draft={draft}
              onAdd={(lord) => setDraft([...draft, lord])}
              onReset={() => setDraft([])}
              onConfirm={confirmOrder}
            />
          ) : (
            <RegionBoard match={match} onChooseRegion={chooseRegion} />
          )}
        </div>
        <LordColumn
          match={match}
          player="p2"
          draft={ordering === 'p2' ? { order: draft, remove: (l) => setDraft(draft.filter((d) => d !== l)) } : undefined}
        />
        {announcement && <TurnAnnouncement announcement={announcement} onDone={dismissAnnouncement} />}
      </main>

      <PlayerPanel match={match} player="p2" selectedCaptainId={selectedCaptainId} onSelectCaptain={selectCaptain} />

      <PhaseWindow
        match={match}
        selectedCaptainId={selectedCaptainId}
        error={error}
        onEndTurn={() => turn && dispatch({ type: 'endTurn', player: turn.player })}
      />
    </div>
  );
}
