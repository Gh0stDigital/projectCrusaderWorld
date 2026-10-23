import { captainInRegion, knightsOf, reserveKnights } from '../../engine/queries';
import type { MatchState, PlayerId, RegionIndex } from '../../engine/state';
import { LORD_TITLES, REGION_NAMES, captainName } from '../../data/names';
import { Card } from '../components/Card';
import './companyView.css';

interface CompanyViewProps {
  match: MatchState;
  player: PlayerId;
  region: RegionIndex;
  selectedKnightId: string | null;
  onSelectKnight: (id: string) => void;
}

/**
 * Shown in a player's side panel while zoomed into a Region: their Captain
 * stationed there, with that Captain's six Knights underneath in two columns.
 */
export function CompanyView({ match, player, region, selectedKnightId, onSelectKnight }: CompanyViewProps) {
  const captain = captainInRegion(match, region, player);
  const turn = match.turn;

  if (!captain) {
    return (
      <div className="company company--empty">
        <p className="company__where">In {REGION_NAMES[region]}</p>
        <div className={`company__vacant company__vacant--${player}`}>No Captain stationed here</div>
      </div>
    );
  }

  const acting = turn?.captainId === captain.id;
  const picking = acting && turn?.step === 'placement';
  const waiting = reserveKnights(match, captain.id).length;

  return (
    <div className="company">
      <p className="company__where">In {REGION_NAMES[region]}</p>

      <div className={`company__captain${acting ? ' company__captain--acting' : ''}`}>
        <Card art="militia" size="roster" owner={player} alt={captainName(captain.lord, captain.rank)} />
        <div className="company__captain-info">
          <h3 className="company__captain-name">{captainName(captain.lord, captain.rank)}</h3>
          <p className="company__captain-lord">{LORD_TITLES[captain.lord]}</p>
          {acting && <span className="company__badge">{picking ? 'Choose a Knight' : 'Orders given'}</span>}
          <p className="company__count">
            {waiting} of 6 Knights waiting
          </p>
        </div>
      </div>

      <ul className="company__knights">
        {knightsOf(match, captain.id).map((knight) => {
          const isWaiting = knight.position === null;
          const pickable = picking && isWaiting;
          const classes = [
            'knight-slot',
            !isWaiting && 'knight-slot--fielded',
            pickable && 'knight-slot--pickable',
            selectedKnightId === knight.id && 'knight-slot--selected',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li key={knight.id}>
              <button
                className={classes}
                disabled={!pickable}
                onClick={() => onSelectKnight(knight.id)}
                aria-label={`Knight ${knight.number}${isWaiting ? '' : ', on the field'}`}
              >
                <Card art="militia" size="company" owner={player}>
                  <span className="knight-slot__label">{isWaiting ? `Knight ${knight.number}` : 'Fielded'}</span>
                </Card>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
