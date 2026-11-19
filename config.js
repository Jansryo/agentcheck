/* AgentCheck configuration — the ONLY file you need to edit when the
 * contract is deployed.
 *
 * 1. Deploy AgentCheck (see README.md).
 * 2. Paste the deployed address into the matching network below
 *    (testnet first; mainnet only after an explicit decision to go live).
 * 3. Set `deployedBlock` to the block number the contract was deployed in
 *    (used as the starting point for the leaderboard log scan).
 * 4. Set `active` to "testnet" or "mainnet".
 * 5. Commit and push — GitHub Pages picks the change up automatically.
 *
 * Addresses are `null` until deployed. The site handles that gracefully:
 * it shows "Contract not deployed yet" instead of erroring.
 */

const CONFIG = {
  // Which network the site uses by default. "testnet" until a mainnet
  // address exists. Change to "mainnet" only when mainnet is live.
  active: "testnet",

  // Binance Agent ID (ERC-721, non-transferable). Same address on
  // BSC mainnet and BSC testnet.
  agentId: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",

  networks: {
    testnet: {
      label: "BNB Smart Chain Testnet",
      chainId: 97,
      rpc: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      explorer: "https://testnet.bscscan.com",
      // Paste the deployed AgentCheck address here, e.g.
      // agentCheck: "0xAbC...123",
      agentCheck: null,
      // Block the contract was deployed in (for the leaderboard scan).
      deployedBlock: null,
    },
    mainnet: {
      label: "BNB Smart Chain",
      chainId: 56,
      rpc: "https://bsc-dataseed1.defibit.io",
      explorer: "https://bscscan.com",
      agentCheck: null,
      deployedBlock: null,
    },
  },
};
