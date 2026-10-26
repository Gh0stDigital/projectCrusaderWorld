import type { MatchEvent } from '../../engine/events';
import type { MatchState, PlayerId } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, captainName, knightName } from '../../data/names';

/** A pop-up summary of what just happened to a Region or to sent men, from Player 1's point of view. */
export interface Report {
  title: string;
  tone: 'win' | 'loss' | 'even';
  lines: string[];
}

const HUMAN: PlayerId = 'p1';

function list(ids: string[], name: (id: string) => string): string {
  return ids.map(name).join(', ');
}

/**
 * Reports for the events of one action: a Region lost or won (who was
 * captured, which Captains went home and can be redeployed, who fell), Knights
 * freed, and the enemy sending men between its Captains.
 */
export function reportsFor(state: MatchState, events: MatchEvent[]): Report[] {
  const reports: Report[] = [];
  const knight = (id: string) => knightName(state.knights[id]!);
  const captain = (id: string) => captainName(state.captains[id]!);
  const fates = (captured: string[], returned: string[], fallen: string[]) => [
    ...(captured.length ? [`Captured: ${list(captured, knight)}.`] : []),
    ...returned.map((id) => `${captain(id)} returns to their Lord and can be redeployed.`),
    ...fallen.map((id) => `${captain(id)} has fallen.`),
  ];

  for (const e of events) {
    switch (e.type) {
      case 'regionSecured':
        reports.push({
          title: `${REGION_NAMES[e.region]} secured`,
          tone: e.player === HUMAN ? 'win' : 'loss',
          lines: [
            `${PLAYER_NAMES[e.player]}'s ${captain(e.captainId)} holds ${REGION_NAMES[e.region]} with three in a row.`,
            ...fates(e.capturedKnightIds, e.returnedCaptainIds, e.fallenCaptainIds),
          ],
        });
        break;
      case 'decisiveEnded': {
        const lines = fates(e.capturedKnightIds, e.returnedCaptainIds, e.fallenCaptainIds);
        if (lines.length === 0) break;
        reports.push({
          title: e.winner === null ? `${REGION_NAMES[e.region]}: no winner` : `${REGION_NAMES[e.region]}: ${PLAYER_NAMES[e.winner]} wins`,
          tone: e.winner === null ? 'even' : e.winner === HUMAN ? 'win' : 'loss',
          lines,
        });
        break;
      }
      case 'regionTaken':
        reports.push({
          title: `${REGION_NAMES[e.region]} taken`,
          tone: e.player === HUMAN ? 'win' : 'loss',
          lines: [
            e.captainId
              ? `${PLAYER_NAMES[e.player]}'s ${captain(e.captainId)} now holds ${REGION_NAMES[e.region]}.`
              : `Nobody was free to hold ${REGION_NAMES[e.region]}: it opens up again.`,
            ...(e.rescuedKnightIds.length
              ? [`Freed: ${list(e.rescuedKnightIds, (id) => `${knight(id)} (back with ${captain(state.knights[id]!.captainId)})`)}.`]
              : []),
          ],
        });
        break;
      case 'reserveSent':
        if (e.player !== HUMAN) {
          reports.push({
            title: 'Enemy reinforcements',
            tone: 'loss',
            lines: [`${captain(e.fromCaptainId)} sent ${e.amount} men to ${captain(e.toCaptainId)} in ${REGION_NAMES[state.captains[e.toCaptainId]!.region!]}.`],
          });
        }
        break;
      case 'knightSent':
        if (e.player !== HUMAN) {
          reports.push({
            title: 'Enemy redeployment',
            tone: 'loss',
            lines: [`${captain(e.fromCaptainId)} sent ${knight(e.knightId)} to ${captain(e.toCaptainId)} in ${REGION_NAMES[state.captains[e.toCaptainId]!.region!]}.`],
          });
        }
        break;
    }
  }
  return reports;
}
