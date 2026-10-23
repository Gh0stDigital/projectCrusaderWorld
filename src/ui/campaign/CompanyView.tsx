import { captainInRegion, captainMilitia, knightsOf, reserveKnights } from '../../engine/queries';
import type { Knight, MatchState, PlayerId, RegionIndex } from '../../engine/state';
import { REGION_NAMES, captainArt, captainName, formatMilitia, lordPersona } from '../../data/names';
import { Card } from '../components/Card';
import './companyView.css';

interface CompanyViewProps {
  match: MatchState;
  player: PlayerId;
  region: RegionIndex;
  selectedKnightId: string | null;
  onSelectKnight: (id: string) => void;
}

const SLOT_LABEL: Record<Knight['status'], (k: Knight) => string> = {
  ready: (k) => `Knight ${k.number}`,
  fielded: () => 'Fielded',
  unmanned: () => 'Unmanned',
  dead: () => 'Fallen',
};

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
        <Card art={captainArt(player)} size="roster" owner={player} alt={captainName(captain)} />
        <div className="company__captain-info">
          <h3 className="company__captain-name">{captainName(captain)}</h3>
          <p className="company__captain-lord">Serves {lordPersona(player, captain.lord).name}</p>
          {acting && <span className="company__badge">{picking ? 'Choose a Knight' : 'Orders given'}</span>}
          <p className="company__count">
            {formatMilitia(captainMilitia(match, captain.id))} militia
            <br />
            <span className="company__dim">{formatMilitia(captain.reserve)} in reserve</span>
            <br />
            <span className="company__dim">{waiting} Knights waiting</span>
          </p>
        </div>
      </div>

      <ul className="company__knights">
        {knightsOf(match, captain.id).map((knight) => {
          const pickable = picking && knight.status === 'ready';
          const classes = [
            'knight-slot',
            `knight-slot--${knight.status}`,
            pickable && 'knight-slot--pickable',
            selectedKnightId === knight.id && 'knight-slot--selected',
          ]
            .filter(Boolean)
            .join(' ');
          const alive = knight.status === 'ready' || knight.status === 'fielded';
          return (
            <li key={knight.id}>
              <button
                className={classes}
                disabled={!pickable}
                onClick={() => onSelectKnight(knight.id)}
                aria-label={`Knight ${knight.number}: ${SLOT_LABEL[knight.status](knight)}${alive ? `, ${knight.hp} HP` : ''}`}
              >
                <Card art="militia" size="company" owner={player}>
                  {alive && <span className="hp-badge">{knight.hp}</span>}
                  <span className="knight-slot__label">{SLOT_LABEL[knight.status](knight)}</span>
                </Card>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
