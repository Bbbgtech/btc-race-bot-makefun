# btc-race-bot-makefun

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/Bbbgtech/btc-race-bot-makefun/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/Bbbgtech/btc-race-bot-makefun/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

A BTC trading bot that races Coinbase Wrapped BTC (cbBTC) against USDC minute by minute on 1-minute on-chain prices, starting with $1,000 of paper money. It buys with all its cash on the first tradable bar and holds, with a 250 bps trailing stop: if the close falls 2.5% or more below the highest close since entry, it sells everything, and it only buys back in when the close makes a new high above the peak it sold from. On the published dev window it makes +$32.17 net PnL with 2 trades and a 1.98% max drawdown.

## Run it

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

The bot itself is `main.ts`, run by the harness as `node /bot/main.ts`. It speaks agent-fun/bars-replay/v1: one JSON line per minute on stdin, one reply per batch on stdout. Standard library only; the wire shim is vendored unchanged in `vendor/`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fpbb2zn4&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
