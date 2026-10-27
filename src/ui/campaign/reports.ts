import type { MatchEvent } from '../../engine/events';
import type { MatchState, PlayerId } from '../../engine/state';
import { LORD_TITLES, PLAYER_NAMES, REGION_NAMES, captainName, knightName, lordPersona } from '../../data/names';

/** A pop-up summary of what just happened to a Region or to sent men, from Player 1's point of view. */
export interface Report {
  title: string;
  tone: 'win' | 'loss' | 'even';
  lines: string[];
  /** A Captain to show (their card) beside the text. */
  captainId?: string;
  /** Small heading above the title, e.g. "Retreat". */
  kicker?: string;
  /** Short facts shown as plaques, e.g. Knights 2 / Reserve 160. */
  stats?: { label: string; value: string }[];
  /** A closing hint shown under a divider. */
  hint?: string;
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
      case 'resourcesDepleted':
        reports.push({
          kicker: 'Supplies',
          title: e.player === HUMAN ? 'Out of Resources' : `${PLAYER_NAMES[e.player]} is out of Resources`,
          tone: e.player === HUMAN ? 'loss' : 'win',
          lines: [
            e.player === HUMAN
              ? 'Your armies have nothing left to live on.'
              : 'The enemy\u2019s armies have nothing left to live on.',
          ],
          stats: [
            { label: 'Each action', value: '1 man' },
            { label: 'Each Lord\u2019s turn', value: '\u221210% troops' },
          ],
          hint: 'Reserves are spared; Knights in the field and waiting are not.',
        });
        break;
      case 'attrition':
        if (e.player === HUMAN && e.menLost > 0) {
          reports.push({
            kicker: 'Supplies',
            title: 'Troops waste away',
            tone: 'loss',
            lines: [
              `Without Resources, the ${LORD_TITLES[e.lord]}\u2019s troops lost ${e.menLost} men this turn.`,
              ...(e.fallenKnightIds.length ? [`Fallen: ${list(e.fallenKnightIds, knight)}.`] : []),
            ],
          });
        }
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
  // Your own Captains sent home: a notice of their own, so redeploying them isn't missed.
  for (const e of events) {
    if (e.type !== 'regionSecured' && e.type !== 'decisiveEnded') continue;
    for (const id of e.returnedCaptainIds) {
      const c = state.captains[id]!;
      if (c.owner !== HUMAN) continue;
      const knightsLeft = Object.values(state.knights).filter((k) => k.captainId === id && k.status === 'ready').length;
      const lord = lordPersona(c.owner, c.lord).name;
      reports.push({
        kicker: 'Retreat',
        title: captainName(c),
        captainId: id,
        tone: 'even',
        lines: [`Driven from ${REGION_NAMES[e.region]}, they fall back to ${lord} and await new orders.`],
        stats: [
          { label: 'Knights', value: String(knightsLeft) },
          { label: 'Reserve', value: String(c.reserve) },
          { label: 'Lord', value: lord },
        ],
        hint: `Redeploy them on a ${LORD_TITLES[c.lord]} turn.`,
      });
    }
  }
  return reports;
}
