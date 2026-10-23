/**
 * The rules engine contract. Plain TypeScript: no React, no DOM, no timers.
 *
 * Every player input (human or computer) is an action. The engine checks it
 * against the rules and either rejects it or returns the new state plus the
 * events that happened, which the UI then animates.
 *
 * Concrete state, actions and events are added rule by rule in
 * state/, actions/ and rules/.
 */

export type EngineResult<State, Event> =
  | { ok: true; state: State; events: Event[] }
  | { ok: false; reason: string };

export type ApplyAction<State, Action, Event> = (
  state: State,
  action: Action,
) => EngineResult<State, Event>;

export function reject(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}
