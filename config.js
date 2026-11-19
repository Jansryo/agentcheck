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
  // Which network the site uses by default. "mainnet" — mainnet is live
  // since 19 Nov 2026 13:54 WIB.
  active: "mainnet",

  // Binance Agent ID (ERC-721, non-transferable) — the real contract on
  // BSC mainnet. It is NOT deployed on BSC testnet, so the testnet
  // network below overrides it with the MockAgentId address.
  agentId: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",

  networks: {
    testnet: {
      label: "BNB Smart Chain Testnet",
      chainId: 97,
      rpc: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      explorer: "https://testnet.bscscan.com",
      // Paste the deployed AgentCheck address here, e.g.
      // agentCheck: "0xAbC...123",
      agentCheck: "0x29111B82004Eb26D78a7443a31eeB946999F6989",
      // Block the contract was deployed in (for the leaderboard scan).
      deployedBlock: 143593591,
      // Mock Agent ID (testnet only): the real Agent ID contract is not
      // deployed on BSC testnet, so the testnet AgentCheck gates on this
      // mock ERC-721 instead. Deployed 19 Nov 2026, tx
      // 0x3890fad9aef1d80977e78eb2b8f51d0df170e4ab63761187dcb36fd160a37a84.
      agentId: "0x8889b14748169A7C6995c5ae6F837Adb65A976A6",
    },
    mainnet: {
      label: "BNB Smart Chain",
      chainId: 56,
      rpc: "https://bsc-dataseed1.defibit.io",
      explorer: "https://bscscan.com",
      agentCheck: "0x8fa6a4b08a6b37169410D8a39E7278D405D52d34",
      deployedBlock: 134475454,
    },
  },
};
