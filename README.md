# AgentCheck — Daily check-in dApp for Binance Agent ID holders

Binance Agent ID Hackathon entry (dApp track). Only addresses holding ≥ 1
Agent ID NFT (ERC-721, non-transferable) can check in once per UTC day.
Each check-in extends the consecutive-day streak; missing a day resets it.

**Live site:** https://jansryo.github.io/agentcheck/
**Repo:** https://github.com/Jansryo/agentcheck

- Agent ID contract (mainnet & testnet address): `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`
- Deploy wallet (agent wallet): `0x47C2054E40557aB52F0DCE699A2a50D7d798E3FE`
- Chain for testing: BSC Testnet (chain ID 97)
- **Mainnet: NOT deployed. Do not deploy to mainnet without explicit user order.**

## Contract addresses

| Network | AgentCheck address | Status |
|---|---|---|
| BSC Testnet (97) | TBD | pending testnet deployment (faucet blocked — see below) |
| BSC Mainnet (56) | TBD | not deployed |

When a contract is deployed, paste its address into `config.js`
(`networks.testnet.agentCheck` / `networks.mainnet.agentCheck`) together
with the deployment block — the website picks it up automatically, no
other change needed.

## How to use the dApp

1. Open https://jansryo.github.io/agentcheck/ in a browser with a wallet
   extension (Binance Wallet or MetaMask).
2. Click **Connect Wallet** and approve the connection in your wallet.
   The site only ever asks your wallet to sign/confirm — it never asks for
   a seed phrase or private key, and there is no QR-code login or pairing.
3. The page checks whether your address holds an Agent ID
   (`balanceOf` on the Agent ID contract) and shows **Agent ID: Owned**
   or **Not held — check-in requires an Agent ID**.
4. If you hold an Agent ID and have not checked in today, click
   **Check In** and confirm the transaction in your wallet. The page shows
   the transaction status (pending → confirmed) with a link to the explorer.
5. Your streak, total check-ins, last check-in day, and whether you can
   check in today are read live from the contract. The leaderboard shows
   the top 10 addresses by total check-ins, aggregated from on-chain
   `CheckIn` events.

If your wallet is on the wrong network, the page tells you and offers a
one-click switch to the correct BNB Chain network (testnet 97 by default,
mainnet 56 once mainnet is live).

## Agent ID usage (hackathon submission)

AgentCheck is built around the Binance Agent ID as its identity primitive:

- **Gating:** `checkIn()` calls `agentId.balanceOf(msg.sender)` on the
  official Agent ID contract (`0x60b9…22f`, ERC-721, non-transferable) and
  reverts `NotAgentIdHolder` for non-holders. No Agent ID, no check-in —
  the streak is an Agent ID holder's record, not a free-for-all counter.
- **Frontend:** the dApp reads the same `balanceOf` before enabling the
  Check In button, so non-holders get a clear explanation instead of a
  failed transaction.
- **On-chain identity:** every `CheckIn` event carries the holder's address,
  UTC day, streak, and running total, so any third party can verify a
  holder's streak history from the chain alone.
- **No other identity system:** there is no username, email, or off-chain
  account — the Agent ID NFT is the only credential.

## Owner permissions

The owner is the deployer (`0x47C2…3FE`). The owner can ONLY do two things:

- `pause()` / `unpause()` — an emergency brake on `checkIn()` only.

The owner CANNOT move funds (the contract holds none and has no payable
functions), change any user's streak / total / last check-in day, change
the Agent ID address, mint anything, or upgrade the contract (no proxy).
`pause`/`unpause` revert `NotOwner` for anyone else.

## Files

| Path | What |
|---|---|
| `contracts/AgentCheck.sol` | Main contract (Solidity ^0.8.20, MIT) |
| `contracts/MockAgentId.sol` | Minimal ERC-721 mock — TESTNET TESTING ONLY, never mainnet |
| `build/AgentCheck.json` | ABI + bytecode artifact (solc 0.8.38, optimizer 200 runs, evmVersion paris) |
| `build/MockAgentId.json` | ABI + bytecode artifact for the mock |
| `scripts/compile.js` | Offline compile via solc npm package |
| `scripts/deploy.js` | Deploy to BSC testnet (`--mock` = deploy mock + mint 1 to deployer first) |
| `scripts/test_local.js` | Full functional suite on local Ganache (29 checks) |
| `scripts/check_testnet.js` | Read-only testnet state probe |
| `test/streak_logic.js` | Pure-JS unit test of the day/streak algorithm (9 checks) |
| `build/local-test-results.json` | Gas numbers from the local run |
| `index.html` | Static frontend (single file, ethers v6 via CDN) |
| `config.js` | **The one file to edit when the contract deploys** — network, RPC, explorer, contract address, deployment block |

## Frontend — changing the contract address

Edit `config.js` only:

```js
const CONFIG = {
  active: "testnet",          // "testnet" until a mainnet address exists
  agentId: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",
  networks: {
    testnet: {
      chainId: 97,
      rpc: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      explorer: "https://testnet.bscscan.com",
      agentCheck: "0x…",     // paste the deployed address here
      deployedBlock: 123456,  // block the contract was deployed in
    },
    mainnet: {
      chainId: 56,
      rpc: "https://bsc-dataseed1.defibit.io",
      explorer: "https://bscscan.com",
      agentCheck: null,       // stays null until mainnet is deployed
      deployedBlock: null,
    },
  },
};
```

Commit and push — GitHub Pages serves the new config automatically.
Until an address is set, the site shows "Contract not deployed yet" and
"No check-ins yet" instead of erroring.

Local preview:

```bash
cd agentcheck
python3 -m http.server 8000
# open http://localhost:8000/
```

## Contract spec (AgentCheck)

- `constructor(address agentId)` — stores immutable Agent ID contract + deployer as owner.
- `checkIn()` — reverts `NotAgentIdHolder` if `agentId.balanceOf(msg.sender) == 0`;
  reverts `AlreadyCheckedIn` if already checked in today; reverts `Paused` when paused.
  Day = `block.timestamp / 86400` (UTC day). Streak: `lastCheckInDay == day-1` → +1,
  else 1. `totalCheckIns++`, emits `CheckIn(user, day, streak, total)`.
- Views: `canCheckInToday(address)`, `getStreak(address)`, `getTotal(address)`,
  `getLastDay(address)`, `getInfo(address)` → `(streak, total, lastDay, canCheckIn)`,
  plus public `agentId`, `owner`, `paused`, `lastCheckInDay`, `currentStreak`, `totalCheckIns`.
- Custom errors only (no long require strings). Minimal storage: 3 mappings + 2 immutables + 1 bool.
- No payable functions, no fund handling, no token transfers anywhere.

## Build & test (offline / local — all verified 2026-11-19)

```bash
cd ~/workspace/goals/agent-id-hackathon-dapp-check-in-harian/agentcheck
npm install            # solc 0.8.38, ethers 6, ganache 7
node scripts/compile.js
node test/streak_logic.js   # 9/9 pass (pure JS, no chain)
node scripts/test_local.js  # 29/29 pass (Ganache, chainId 97, incl. time travel)
```

Local suite covers: deploy gas, negative holder gate, positive check-in +
event, same-day double check-in, streak 1→2 next day, streak reset after a
missed day, pause/unpause + onlyOwner, all views, and AgentCheck pointed at
the real Agent ID address (no code → ABI-decode revert, NOT NotAgentIdHolder).

Measured gas (local, deterministic for this bytecode):
- Deploy AgentCheck: **518,993** gas; deploy MockAgentId: 371,776 gas
- check-in #1: 98,090 gas; check-in #2/#3: ~46,900 gas; mock mint: 73,339 gas

## BSC testnet deploy — STATUS: BLOCKED ON FAUCET (tBNB = 0)

Deploy wallet `0x47C2…3FE` has **0 tBNB** on testnet (verified 2026-11-19 12:35 WIB).
Every faucet needs a browser + bot-check the subagent cannot do:

| Faucet | Requirement | Verdict |
|---|---|---|
| Official BNB faucet — https://testnet.bnbchain.org/faucet-smart | hCaptcha (sitekey found in JS bundle) | Needs browser + human captcha solve |
| QuickNode — https://faucet.quicknode.com/binance-smart-chain/bnb-testnet | "small mainnet balance" + bot check, no X post needed | Wallet HAS 0.000145 BNB mainnet — may qualify; still needs browser + bot check |
| Chainstack — https://faucet.chainstack.com/bnb-testnet-faucet | ≥ 0.08 ETH on Ethereum mainnet + holding history | FAILS — wallet ETH balance is exactly 0 (verified via drpc.org) |

**Unblock step (for parent agent / user, ~1 minute):** open the official faucet
(or QuickNode) in a browser, paste `0x47C2054E40557aB52F0DCE699A2a50D7d798E3FE`,
solve the captcha, claim 0.5 tBNB (1x/24h). Then run:

```bash
cd ~/workspace/goals/agent-id-hackathon-dapp-check-in-harian/agentcheck
node scripts/deploy.js --mock   # MockAgentId + AgentCheck(mock), mint 1 to deployer, full positive path
node scripts/deploy.js           # AgentCheck pointed at the REAL Agent ID (negative-gate test)
```

Then run the testnet test sequence (script the deployer runs after funding):
1. Real-address AgentCheck: deployer `checkIn()` must revert (deployer holds no
   Agent ID on testnet; note the real Agent ID contract is NOT deployed on
   testnet at all — `getCode` returns empty — so the call reverts on ABI decode,
   not `NotAgentIdHolder`; the true `NotAgentIdHolder` revert is proven on the
   mock-pointed contract by a non-holder).
2. Mock AgentCheck: deployer (mock holder) `checkIn()` succeeds → streak 1,
   total 1; `canCheckInToday` flips false; 2nd same-day `checkIn()` reverts
   `AlreadyCheckedIn`; a second address (non-holder) reverts `NotAgentIdHolder`.
3. Streak day 2 can only be tested the next UTC day on a public testnet
   (no time travel) — repeat `checkIn()` tomorrow and confirm streak = 2.

## Source verification (after testnet deploy)

- Sourcify supports chain 97 (verified via `https://sourcify.dev/server/chains`).
  Verify with: `curl -X POST https://sourcify.dev/server/verify -F "chain=97" -F "address=<ADDR>" -F "files=@contracts/AgentCheck.sol"` — or the
  standard-json route with compiler settings (solc 0.8.38, optimizer 200 runs,
  evmVersion paris). NOT done yet — no contract deployed.
- BscScan testnet verification needs an API key — NOT created (needs user approval).
  Explorer link once deployed: `https://testnet.bscscan.com/address/<ADDR>`.
- After verification, the contract page on BscScan shows the source, and the
  frontend links every address/transaction to the explorer.

## Mainnet deploy cost estimate (measured 2026-11-19 ~12:40 WIB)

- Deploy gas: 518,993 (measured locally; same bytecode = same gas on mainnet)
- BSC mainnet gas price right now: **0.05 gwei** (eth_gasPrice, confirmed on
  bsc-dataseed1.defibit.io AND bsc-dataseed1.ninicoin.io — both `0x2faf080`)
- BNB price: **$586.82** (CoinGecko) / $585.96 (Coinbase) — used $586.40 avg
- **Deploy cost at current gas price: 0.00002595 BNB ≈ $0.015**
- Conservative at 1 gwei: 0.000519 BNB ≈ $0.30
- Check-in tx at 0.05 gwei: first 0.0000049 BNB (~$0.003), later ~0.00000235 BNB (~$0.0014)
- Testnet gas price now: 0.1 gwei → testnet deploy would cost 0.0000519 tBNB
  (a 0.5 tBNB faucet drip covers ~9,600 deploys).

## Security notes

- Private key is read programmatically from `~/workspace/agent-wallet/agent-wallet.json`
  by `scripts/deploy.js` only; it is never printed, logged, or committed.
- No mainnet deployment, no X posts, no seed/private-key requests — by task rules.

## Compliance red lines

- **No QR-code login, no pairing code, no WalletConnect URI.** The frontend
  connects only through an injected browser wallet (`window.ethereum`).
- **No seed phrase or private key collection** — anywhere, in any form.
  Every transaction is confirmed by the user in their own wallet.
- **No fund custody:** the contract has no payable functions, holds no BNB
  or tokens, and cannot move anyone's funds.
- **No returns or rewards promised:** check-ins build a streak record only.
  The site makes no claim about earnings, passive income, or prizes.
- **No trading:** AgentCheck is not a trading product; there is no trading
  risk warning because there is nothing to trade.
