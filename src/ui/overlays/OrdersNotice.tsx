import type { PlayerId } from '../../engine/state';
import { PLAYER_NAMES } from '../../data/names';
import './ordersNotice.css';

/** Brief confirmation that a player's turn is over, shown before the camera pulls back. */
export function OrdersNotice({ player, detail }: { player: PlayerId; detail: string }) {
  return (
    <div className="orders-notice" role="status">
      <div className={`orders-notice__banner orders-notice__banner--${player}`}>
        <span className="orders-notice__title">{PLAYER_NAMES[player]}’s orders are complete</span>
        <span className="orders-notice__detail">{detail}</span>
      </div>
    </div>
  );
}
