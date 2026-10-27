import { useEffect, useState } from 'react';
import { play } from '../../audio/sound';
import {
  assaultTargets,
  captainMilitia,
  hasFreeSlot,
  knightsOnBoard,
  sendTargets,
  sendableKnights,
  stationCandidates,
} from '../../engine/queries';
import type { Captain, MatchState, PlayerId } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, captainName, knightName } from '../../data/names';
import type { Report } from './reports';
import '../battle/attackPreview.css';
import './stationOrders.css';

const STEP = 10;

/**
 * Orders for a Captain holding a secured Region: send reserve or one Knight to
 * one of your Captains deployed next door, or assault an adjacent enemy-held Region.
 */
export function StationOrders({
  match,
  captain,
  onSendReserve,
  onSendKnight,
  onAssault,
  onCancel,
}: {
  match: MatchState;
  captain: Captain;
  onSendReserve: (toCaptainId: string, amount: number) => void;
  onSendKnight: (knightId: string, toCaptainId: string) => void;
  onAssault: (region: number) => void;
  /** Back out: choose a different Captain this turn. */
  onCancel: () => void;
}) {
  const receivers = sendTargets(match, captain);
  const knights = sendableKnights(match, captain);
  const targets = assaultTargets(match, captain);
  const [to, setTo] = useState(receivers[0]?.id ?? '');
  const [amount, setAmount] = useState(Math.min(STEP, captain.reserve));
  const [knightId, setKnightId] = useState(knights[0]?.id ?? '');
  const where = REGION_NAMES[captain.region!];
  const mine = captainMilitia(match, captain.id);
  // Sending men asks for confirmation first, with the option to cancel.
  const [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(null);
  const toCaptain = receivers.find((c) => c.id === to);
  const toLabel = toCaptain ? `${captainName(toCaptain)} in ${REGION_NAMES[toCaptain.region!]}` : '';
  const roomy = toCaptain ? hasFreeSlot(match, toCaptain.id) : false;

  if (confirm) {
    return (
      <div className="attack-preview" role="dialog" aria-modal="true" aria-labelledby="station-confirm-title">
        <div className="attack-preview__window station station--confirm">
          <h2 id="station-confirm-title" className="attack-preview__title">
            Confirm orders
          </h2>
          <p className="battle-results__verdict">{confirm.text}</p>
          <div className="attack-preview__actions">
            <button className="btn" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={confirm.run} autoFocus>
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="attack-preview" role="dialog" aria-modal="true" aria-labelledby="station-title">
      <div className="attack-preview__window station">
        <h2 id="station-title" className="attack-preview__title">
          {captainName(captain)} holds {where}
        </h2>
        <p className="station__lead">One order this turn: send men to a Captain next door, or assault the enemy.</p>

        {receivers.length > 0 && (
          <section className="station__section">
            <h3 className="station__heading">Send to</h3>
            <div className="station__choices">
              {receivers.map((c) => (
                <button
                  key={c.id}
                  className={`btn station__choice${to === c.id ? ' station__choice--on' : ''}`}
                  onClick={() => setTo(c.id)}
                >
                  {captainName(c)} · {REGION_NAMES[c.region!]}
                </button>
              ))}
            </div>
            <div className="station__row">
              <span className="station__label">Reserve ({captain.reserve})</span>
              <button className="btn reinforce__step" onClick={() => setAmount(Math.max(STEP, amount - STEP))} disabled={amount <= STEP}>
                −{STEP}
              </button>
              <span className="reinforce__amount">
                {amount}
                <span className="reinforce__unit">men</span>
              </span>
              <button
                className="btn reinforce__step"
                onClick={() => setAmount(Math.min(captain.reserve, amount + STEP))}
                disabled={amount >= captain.reserve}
              >
                +{STEP}
              </button>
              <button className="btn reinforce__step" onClick={() => setAmount(captain.reserve)} disabled={amount >= captain.reserve}>
                All
              </button>
              <button
                className="btn btn--primary"
                disabled={!to || amount <= 0 || captain.reserve <= 0}
                onClick={() =>
                  setConfirm({
                    text: `${captainName(captain)} sends ${amount} men from ${where} to ${toLabel}. They join that Captain's reserve.`,
                    run: () => onSendReserve(to, amount),
                  })
                }
              >
                Send reserve
              </button>
            </div>
            {knights.length > 0 && (
              <div className="station__row">
                <span className="station__label">One Knight</span>
                <select className="station__select" value={knightId} onChange={(e) => setKnightId(e.target.value)}>
                  {knights.map((k) => (
                    <option key={k.id} value={k.id}>
                      {knightName(k)} · {k.hp} HP{k.status === 'fielded' ? ' (on the board)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn--primary"
                  disabled={!to || !knightId || !roomy}
                  title={roomy ? undefined : 'That Captain has no free Knight slot'}
                  onClick={() =>
                    setConfirm({
                      text: `${captainName(captain)} sends ${knightName(match.knights[knightId]!)} from ${where} to ${toLabel}. The Knight joins that Captain, waiting to be placed.`,
                      run: () => onSendKnight(knightId, to),
                    })
                  }
                >
                  {roomy ? 'Send Knight' : 'No free slot'}
                </button>
              </div>
            )}
          </section>
        )}

        {targets.length > 0 && (
          <section className="station__section">
            <h3 className="station__heading">Assault</h3>
            {targets.map((r) => {
              const holder = match.captains[match.secured[r]!.captainId]!;
              const enemy = holder.owner as PlayerId;
              return (
                <button key={r} className="btn station__assault" onClick={() => onAssault(r)}>
                  {REGION_NAMES[r]}: {captainName(holder)} ({PLAYER_NAMES[enemy]}) · their {captainMilitia(match, holder.id)} men
                  vs your {mine} · rolls {knightsOnBoard(match, captain.region!, captain.owner).length} v{' '}
                  {knightsOnBoard(match, r, enemy).length}
                </button>
              );
            })}
          </section>
        )}

        <div className="attack-preview__actions">
          <button className="btn" onClick={onCancel}>
            Cancel: choose another Captain
          </button>
        </div>
      </div>
    </div>
  );
}

/** A pop-up report: a Region lost or won, Knights freed, or men the enemy sent. */
export function ReportWindow({ report, onClose }: { report: Report; onClose: () => void }) {
  useEffect(() => play('report'), [report]);
  return (
    <div className="attack-preview" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className={`attack-preview__window battle-results__window battle-results__window--${report.tone} station`}>
        <h2 id="report-title" className="attack-preview__title battle-results__title">
          {report.title}
        </h2>
        {report.lines.map((line) => (
          <p key={line} className="battle-results__verdict">
            {line}
          </p>
        ))}
        <div className="attack-preview__actions">
          <button className="btn btn--primary" onClick={onClose} autoFocus>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/** After winning an assault: pick a Standby Captain (who still has a Knight) to hold the Region. */
export function StationPrompt({
  match,
  onStation,
}: {
  match: MatchState;
  onStation: (captainId: string) => void;
}) {
  const pending = match.pendingStation!;
  const candidates = stationCandidates(match, pending.player);
  return (
    <div className="attack-preview" role="dialog" aria-modal="true" aria-labelledby="station-prompt-title">
      <div className="attack-preview__window station">
        <h2 id="station-prompt-title" className="attack-preview__title">
          {REGION_NAMES[pending.region]} is yours. Station a Captain there.
        </h2>
        <p className="station__lead">Choose a Standby Captain who still has a Knight. They hold the Region from now on.</p>
        <div className="station__choices">
          {candidates.map((c) => (
            <button key={c.id} className="btn btn--primary station__choice" onClick={() => onStation(c.id)}>
              {captainName(c)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The match is over: three secured Regions in a row. */
export function MatchOver({ winner, onMenu }: { winner: PlayerId; onMenu: () => void }) {
  return (
    <div className="attack-preview" role="dialog" aria-modal="true" aria-labelledby="match-over-title">
      <div className={`attack-preview__window battle-results__window battle-results__window--${winner === 'p1' ? 'win' : 'loss'}`}>
        <h2 id="match-over-title" className="attack-preview__title battle-results__title">
          {winner === 'p1' ? 'Victory!' : 'Defeat'}
        </h2>
        <p className="battle-results__verdict">{PLAYER_NAMES[winner]} holds three Regions in a row and wins the match.</p>
        <div className="attack-preview__actions">
          <button className="btn btn--primary" onClick={onMenu} autoFocus>
            Back to the menu
          </button>
        </div>
      </div>
    </div>
  );
}
