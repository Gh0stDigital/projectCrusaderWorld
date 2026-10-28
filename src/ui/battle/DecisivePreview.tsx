import { captainMilitia, knightsOnBoard } from '../../engine/queries';
import { DECISIVE_DIVISOR, type DecisiveBattle, type MatchState, type PlayerId, type RegionIndex } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, captainArt, captainName } from '../../data/names';
import { Card } from '../components/Card';
import './attackPreview.css';

/** What the pre-battle window needs, whether the battle has started yet or not. */
export interface DecisiveSetup {
  kind: 'stalemate' | 'assault';
  region: RegionIndex;
  /** Who attacks (assault), or null for a stalemate. */
  attacker: PlayerId | null;
  captains: Record<PlayerId, string>;
  men: Record<PlayerId, number>;
  chances: Record<PlayerId, number>;
}

export function setupFromBattle(d: DecisiveBattle): DecisiveSetup {
  return {
    kind: d.kind,
    region: d.region,
    attacker: d.kind === 'assault' ? d.first : null,
    captains: d.captains,
    men: d.startMen,
    chances: d.chances,
  };
}

/** Preview of an assault Player 1 is about to launch from `fromRegion` on `region`. */
export function assaultSetup(match: MatchState, fromCaptainId: string, region: RegionIndex): DecisiveSetup {
  const from = match.captains[fromCaptainId]!;
  const defender = match.captains[match.secured[region]!.captainId]!;
  const captains = { [from.owner]: from.id, [defender.owner]: defender.id } as Record<PlayerId, string>;
  return {
    kind: 'assault',
    region,
    attacker: from.owner,
    captains,
    men: { [from.owner]: captainMilitia(match, from.id), [defender.owner]: captainMilitia(match, defender.id) } as Record<PlayerId, number>,
    // One roll per Knight on each Captain's own board, plus the Captain.
    chances: {
      [from.owner]: knightsOnBoard(match, from.region!, from.owner).length + 1,
      [defender.owner]: knightsOnBoard(match, region, defender.owner).length + 1,
    } as Record<PlayerId, number>,
  };
}

/**
 * Before a decisive battle or assault: both Captains with their men and rolls.
 * Your Captain always on the left; in an assault an arrow points from attacker to defender.
 */
export function DecisivePreview({
  match,
  setup,
  onBegin,
  onCancel,
}: {
  match: MatchState;
  setup: DecisiveSetup;
  onBegin: () => void;
  /** Only when Player 1 is about to launch the assault themself. */
  onCancel?: () => void;
}) {
  const where = REGION_NAMES[setup.region];
  const title =
    setup.kind === 'stalemate'
      ? `Stalemate in ${where}! Last Stand`
      : setup.attacker === 'p1'
        ? `Decisive battle: assault ${where}?`
        : `Decisive battle! ${PLAYER_NAMES[setup.attacker!]} is assaulting ${where}`;
  const role = (p: PlayerId) =>
    setup.kind === 'stalemate' ? (p === 'p1' ? 'Your Captain' : 'Enemy Captain') : `${p === 'p1' ? 'Your' : 'Enemy'} Captain · ${setup.attacker === p ? 'attacking' : 'defending'}`;

  return (
    <div className="attack-preview" role="dialog" aria-modal="true" aria-labelledby="decisive-preview-title">
      <div className="attack-preview__window">
        <h2 id="decisive-preview-title" className="attack-preview__title">
          {title}
        </h2>

        <div className="attack-preview__sides">
          <CaptainSummary match={match} setup={setup} player="p1" role={role('p1')} />
          {setup.kind === 'assault' ? (
            <span
              className={`attack-preview__arrow attack-preview__arrow--${setup.attacker === 'p1' ? 'right' : 'left'}`}
              aria-label={setup.attacker === 'p1' ? 'You assault the enemy' : 'The enemy assaults you'}
            >
              <svg viewBox="0 0 80 40" aria-hidden="true">
                <path d="M4 14 H52 V4 L76 20 L52 36 V26 H4 Z" />
              </svg>
              <span className="attack-preview__arrow-label">assaults</span>
            </span>
          ) : (
            <span className="attack-preview__versus">vs</span>
          )}
          <CaptainSummary match={match} setup={setup} player="p2" role={role('p2')} />
        </div>

        {onCancel && match.resources && setup.attacker && (
          <p className={`attack-preview__cost${match.resources[setup.attacker] === 0 ? ' attack-preview__cost--out' : ''}`}>
            {match.resources[setup.attacker] > 0
              ? `Costs ${setup.men[setup.attacker]} Resources (${match.resources[setup.attacker]} left)`
              : 'Out of Resources: assaulting costs 1 man'}
          </p>
        )}
        <p className="attack-preview__rules">
          Each Captain fights with every man they have. Sides take turns rolling a die, one roll per Knight of theirs on
          {setup.kind === 'assault' ? ' their own board' : ' this board'} plus one for the Captain; each roll costs the
          other side (your men × die) ÷ {DECISIVE_DIVISOR}. Most men left when the rolls run out wins; at 0 men a Captain falls.
          {setup.kind === 'assault'
            ? ' The loser, if they still have men and a Knight, chooses: hold their ground (only men are lost) or retreat with every living Knight and give up their Region to the winner.'
            : ' The side with fewer men loses: the winner secures the Region and the loser retreats.'}
        </p>

        <div className="attack-preview__actions">
          {onCancel && (
            <button className="btn" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="btn btn--primary" onClick={onBegin} autoFocus>
            {onCancel ? 'Launch assault' : 'Begin the battle'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CaptainSummary({ match, setup, player, role }: { match: MatchState; setup: DecisiveSetup; player: PlayerId; role: string }) {
  const captain = match.captains[setup.captains[player]]!;
  return (
    <div className={`knight-summary knight-summary--${player}`}>
      <span className="knight-summary__role">{role}</span>
      <div className="knight-summary__top">
        <Card art={captainArt(player, captain.lord)} size="roster" owner={player} />
        <div className="knight-summary__info">
          <h3 className="knight-summary__name">{captainName(captain)}</h3>
          <p className="knight-summary__line">{PLAYER_NAMES[player]}</p>
          <p className="knight-summary__hp">
            {setup.men[player]} <span>men</span>
          </p>
          <p className="knight-summary__line">Reserve {captain.reserve}</p>
          <p className="knight-summary__line">
            Rolls: {setup.chances[player]} (one per Knight on the board, plus the Captain)
          </p>
        </div>
      </div>
    </div>
  );
}
