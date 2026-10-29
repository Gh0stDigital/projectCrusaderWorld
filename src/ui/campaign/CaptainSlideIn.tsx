import type { MatchState } from '../../engine/state';
import { SlideInCard } from '../components/SlideInCard';
import { KnightDetails } from '../components/KnightDetails';
import { CaptainDetails } from './CaptainIcon';

/** Keep the card above the bottom bar (canvas 1080, bottom bar 182, card about 330 tall). */
const CAPTAIN_MAX_TOP = 1080 - 182 - 330;
/** Keep the Knight card above the Undo placement button beside the board. */
const KNIGHT_MAX_TOP = 400;

/** The selected Captain's details, slid out beside Player 1's panel. */
export function CaptainSlideIn({ match, captainId }: { match: MatchState; captainId: string | null }) {
  return (
    <SlideInCard
      id={captainId}
      anchorSelector={(id) => `[data-captain-id="${id}"]`}
      maxTop={CAPTAIN_MAX_TOP}
      render={(id, at, className) => {
        const captain = match.captains[id];
        return captain ? <CaptainDetails key={id} match={match} captain={captain} at={at} className={className} /> : null;
      }}
    />
  );
}

/** The selected Knight's details, slid out beside Player 1's panel, level with its token. */
export function KnightSlideIn({ match, knightId }: { match: MatchState; knightId: string | null }) {
  return (
    <SlideInCard
      id={knightId}
      anchorSelector={(id) => `[data-knight-id="${id}"]`}
      maxTop={KNIGHT_MAX_TOP}
      render={(id, at, className) => {
        const knight = match.knights[id];
        return knight ? <KnightDetails key={id} match={match} knight={knight} at={at} className={className} inline /> : null;
      }}
    />
  );
}
