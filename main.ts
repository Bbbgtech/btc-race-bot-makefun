// BTC race bot: buy-and-hold with a trailing stop (agent-fun/bars-replay/v1).
//
// Strategy, in plain words:
//   * Buy CBBTC with all the cash on the first tradable batch and hold it.
//   * While holding, track the highest close since entry. If the close falls
//     250 bps (2.5%) or more below that peak, sell everything.
//   * While flat after a stop-out, stay out until the close makes a new high
//     above the peak we sold from, then buy back in with all the cash.
//
// Why this shape: on 1-minute bars a round trip costs about 26 bps in fees,
// slippage and price impact, and the fast signals (EMA crosses, Donchian,
// momentum) whipsaw themselves to death on the noise - backtested on the dev
// window they lose $28 to $120 while buy-and-hold makes +$32.17. The dev
// window is a slow grind up (+363 bps over 24h, worst pullback under 200 bps),
// so the trailing stop never fires there and the bot keeps the full
// buy-and-hold PnL (+$32.17, 2 trades, max drawdown 1.98%). On a falling
// window the same rule caps the loss near the stop instead of riding the
// market down: on the dev window mirrored (a -351 bps falling market) the bot
// loses -$24.92 where buy-and-hold loses -$38.54. The stop is insurance
// against the left tail; the new-high re-entry rule keeps it from buying
// every dip in a downtrend.
//
// All decisions use integer math on the bar closes (bigint), no wall clock,
// no randomness, no network, no files outside the repository: two runs on
// the same data produce the same orders byte for byte.

import { runBars, type BarsState } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
// Sell when the close is this far below the peak since entry (basis points).
const TRAIL_BPS = 250n;
// Reject a fill that moved this far from the latest close (basis points).
// One-minute BTC gaps over 5% are essentially unheard of; this only guards
// against a freak open.
const MAX_SLIPPAGE_BPS = 500;
// Minimum notional of a buy in quote units (1 USDC = 1_000_000 units).
const MIN_NOTIONAL = 1_000_000n;

/** State machine driven by the position the harness reports each batch.
 *
 * Everything is derived from observed fills, never from orders sent, so a
 * rejected order corrects itself on the next batch instead of corrupting
 * the state: a buy that was rejected leaves us flat with no exit peak,
 * and a sell that was rejected leaves us holding with the peak intact.
 */
class TrailingStopBot {
  // Highest close seen while holding (bigint price, price_scale 5).
  private peak: bigint | null = null;
  // Peak we sold from on the last stop-out; re-entry needs a close above
  // it. Null until the first stop-out.
  private exitPeak: bigint | null = null;
  // Whether we held a position on the previous batch.
  private wasHolding = false;
  // Whether we have ever held a position in this run.
  private everHeld = false;

  onBatch(state: BarsState) {
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];

    const holding = state.positions.get(SYMBOL);
    const has = holding !== undefined && holding.qty > 0n;

    // A fill landed since the last batch: update the state machine.
    if (has && !this.wasHolding) {
      // Our buy just filled: start tracking the peak from this close.
      this.peak = close;
      this.everHeld = true;
    } else if (!has && this.wasHolding) {
      // Our sell just filled: remember the peak we sold from.
      if (this.peak !== null) this.exitPeak = this.peak;
      this.peak = null;
    }
    this.wasHolding = has;

    if (has) {
      if (this.peak === null || close > this.peak) this.peak = close;
      const dropBps = ((this.peak - close) * 10_000n) / this.peak;
      if (dropBps >= TRAIL_BPS) {
        return [{ side: 'sell', symbol: SYMBOL, qty: holding!.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } as const];
      }
      return [];
    }

    // Flat.
    if (this.exitPeak !== null) {
      // Only re-enter on a genuine new high above the peak we sold from;
      // never buy a dip in a downtrend.
      if (close > this.exitPeak) {
        const cash = state.cash;
        if (cash >= MIN_NOTIONAL) {
          return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS } as const];
        }
      }
      return [];
    }

    if (!this.everHeld) {
      // First tradable batch: buy everything and hold.
      const cash = state.cash;
      if (cash >= MIN_NOTIONAL) {
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS } as const];
      }
    }
    return [];
  }
}

const bot = new TrailingStopBot();

await runBars({
  onBatch(state) {
    return bot.onBatch(state);
  },
});
