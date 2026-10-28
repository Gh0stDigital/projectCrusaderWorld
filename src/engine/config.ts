/**
 * Optional rules, switched on or off here. Experimental rules live here so they
 * can be tried and swapped out without touching the rest of the game.
 */

/**
 * Resources (experimental): a per-player supply pool. Every action costs 1
 * Resource per man in the party acting (nothing is charged at the end of a
 * turn). The loser of a battle pays Resources equal to the men they lost into a
 * wager pool that the side still standing collects once the other leaves.
 * With the pool empty, each action costs a share of the acting party's men.
 * Set `enabled: false` to play without them.
 */
export const RESOURCES = {
  enabled: true,
  /** Each player's starting pool. No income yet. */
  startingAmount: 12000,
  /** Out of Resources: share of the acting party's men lost per action (rounded up, at least 1). */
  shareOfMenWhenOut: 0.01,
};
