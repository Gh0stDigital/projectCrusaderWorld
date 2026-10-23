import { captainInRegion, captainMilitia, knightsOf } from '../../engine/queries';
import type { Knight, MatchState, PlayerId, RegionIndex } from '../../engine/state';
import {
  REGION_NAMES,
  captainArt,
  captainName,
  captainPersonalName,
  formatMilitia,
  knightName,
  knightPersonalName,
  lordPersona,
} from '../../data/names';
import { Card } from '../components/Card';
import { KnightSprite } from '../components/KnightSprite';
import './companyView.css';

interface CompanyViewProps {
  match: MatchState;
  player: PlayerId;
  region: RegionIndex;
  selectedKnightId: string | null;
  onSelectKnight: (id: string) => void;
}

const STATUS_LABEL: Record<Knight['status'], string> = {
  ready: 'Ready',
  fielded: 'In the field',
  unmanned: 'Unmanned',
  dead: 'Fallen',
};

/**
 * Shown in a player's side panel while zoomed into a Region: their Captain
 * stationed there as a large portrait, and their six Knights as simple tokens.
 * Knight cards only appear on the Region's board itself.
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

  return (
    <div className="company">
      <p className="company__where">In {REGION_NAMES[region]}</p>

      <div className={`company__captain${acting ? ' company__captain--acting' : ''}`}>
        <Card art={captainArt(player)} size="detail" owner={player} alt={captainName(captain)} />
        <div className="company__captain-info">
          <h3 className="company__captain-name">{captainPersonalName(captain)}</h3>
          <p className="company__captain-lord">{lordPersona(player, captain.lord).name}</p>
          {acting && <span className="company__badge">{picking ? 'Choose a Knight' : 'Orders given'}</span>}
          <dl className="company__stats">
            <dt>Militia</dt>
            <dd>{formatMilitia(captainMilitia(match, captain.id))}</dd>
            <dt>Reserve</dt>
            <dd>{formatMilitia(captain.reserve)}</dd>
          </dl>
        </div>
      </div>

      <ul className="company__knights">
        {knightsOf(match, captain.id).map((knight) => {
          const pickable = picking && knight.status === 'ready';
          const alive = knight.status === 'ready' || knight.status === 'fielded';
          const classes = [
            'knight-token',
            `knight-token--${knight.status}`,
            `knight-token--${player}`,
            pickable && 'knight-token--pickable',
            selectedKnightId === knight.id && 'knight-token--selected',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li key={knight.id}>
              <button
                className={classes}
                disabled={!pickable}
                onClick={() => onSelectKnight(knight.id)}
                aria-label={`${knightName(knight)}: ${STATUS_LABEL[knight.status]}${alive ? `, ${knight.hp} HP` : ''}`}
              >
                <span className="knight-token__icon">
                  <KnightSprite owner={player} width={44} />
                  <span className="knight-token__number">{knight.number}</span>
                </span>
                <span className="knight-token__text">
                  <span className="knight-token__name">
                    {knight.status === 'unmanned' ? 'Empty slot' : knightPersonalName(knight)}
                  </span>
                  <span className="knight-token__detail">
                    {alive ? `${knight.hp} HP${knight.status === 'fielded' ? ' · fld' : ''}` : STATUS_LABEL[knight.status]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
