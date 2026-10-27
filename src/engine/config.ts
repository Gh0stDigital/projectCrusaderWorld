/**
 * Optional rules, switched on or off here. Experimental rules live here so they
 * can be tried and swapped out without touching the rest of the game.
 */

/**
 * Resources (experimental): a per-player supply pool that keeps soldiers going.
 * Every action costs 1 Resource per man in the party acting, and each Lord's
 * troops (not reserves) cost 1 per man at the end of that Lord's turn. With
 * the pool empty, each action costs 1 man instead and the Lord's troops lose a
 * share of their men at the end of each of that Lord's turns.
 * Set `enabled: false` to play without them.
 */
export const RESOURCES = {
  enabled: true,
  /** Each player's starting pool. No income yet. */
  startingAmount: 12000,
  /** Out of Resources: share of a Lord's troops (not reserves) lost at the end of each of their turns. */
  attritionShare: 0.1,
  /** Out of Resources: men lost per action instead of Resources. */
  menPerActionWhenOut: 1,
};
