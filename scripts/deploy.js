// Deploy AgentCheck to BSC testnet (chain 97) — or any EVM RPC via --rpc.
// Usage:
//   node scripts/deploy.js [--mock] [--agent-id 0x...] [--rpc URL]
//   --mock      : deploy MockAgentId first, mint 1 to deployer, point AgentCheck at it
//   (default)   : point AgentCheck at the real Agent ID contract
//                 0x60b9262456de011f7d15a54cdd8c48baaa8b022f
// Private key is read programmatically from ~/workspace/agent-wallet/agent-wallet.json
// and NEVER printed.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const REAL_AGENT_ID = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
const TESTNET_RPC = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const useMock = process.argv.includes('--mock');
const agentIdArg = arg('--agent-id');
const rpc = arg('--rpc') || TESTNET_RPC;

(async () => {
  const walletJson = JSON.parse(fs.readFileSync(
    path.join(process.env.HOME, 'workspace/agent-wallet/agent-wallet.json'), 'utf8'));
  const provider = new ethers.JsonRpcProvider(rpc);
  const net = await provider.getNetwork();
  console.log('network chainId:', net.chainId.toString());
  const wallet = new ethers.Wallet(walletJson.privateKey, provider);
  console.log('deployer:', wallet.address);
  console.log('deployer balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'BNB/tBNB');
  if ((await provider.getBalance(wallet.address)) === 0n) {
    console.error('BLOCKER: deployer has 0 balance. Claim tBNB first (see README faucet section).');
    process.exit(2);
  }

  const load = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', n + '.json'), 'utf8'));
  const out = { chainId: Number(net.chainId), deployer: wallet.address, rpc };

  let agentId = agentIdArg || REAL_AGENT_ID;
  if (useMock) {
    const mockA = load('MockAgentId');
    const Mock = new ethers.ContractFactory(mockA.abi, mockA.bytecode, wallet);
    const mock = await Mock.deploy();
    const mrc = await mock.deploymentTransaction().wait();
    agentId = await mock.getAddress();
    out.mockAgentId = { address: agentId, txHash: mrc.hash, gasUsed: Number(mrc.gasUsed), blockNumber: mrc.blockNumber };
    console.log('MockAgentId:', agentId, '| tx:', mrc.hash, '| gas:', Number(mrc.gasUsed));
    const mintTx = await mock.mint(wallet.address);
    const mintRc = await mintTx.wait();
    console.log('mint mock Agent ID #1 to deployer | tx:', mintRc.hash, '| gas:', Number(mintRc.gasUsed));
    out.mockAgentId.mintTxHash = mintRc.hash;
    out.mockAgentId.mintGasUsed = Number(mintRc.gasUsed);
  } else {
    const code = await provider.getCode(agentId);
    console.log('Agent ID contract code at', agentId, ':', code === '0x' ? 'NONE (not deployed on this chain)' : 'present');
  }

  const acA = load('AgentCheck');
  const AC = new ethers.ContractFactory(acA.abi, acA.bytecode, wallet);
  const ac = await AC.deploy(agentId);
  const rc = await ac.deploymentTransaction().wait();
  const acAddr = await ac.getAddress();
  out.agentCheck = {
    address: acAddr, agentId, txHash: rc.hash,
    gasUsed: Number(rc.gasUsed), blockNumber: rc.blockNumber,
    gasPriceWei: rc.gasPrice ? rc.gasPrice.toString() : null,
  };
  console.log('AgentCheck:', acAddr, '| tx:', rc.hash, '| gas:', Number(rc.gasUsed));
  console.log('agentId:', await ac.agentId(), '| owner:', await ac.owner(), '| paused:', await ac.paused());

  const depDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(depDir, { recursive: true });
  const name = useMock ? `testnet-mock-${Date.now()}.json` : `testnet-${Date.now()}.json`;
  fs.writeFileSync(path.join(depDir, name), JSON.stringify(out, null, 2));
  console.log('saved deployments/' + name);
})().catch(e => { console.error('DEPLOY ERR:', e.message); process.exit(1); });
