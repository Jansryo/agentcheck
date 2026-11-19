// One-off testnet check-in test for AgentCheck (mock Agent ID).
// Usage: node scripts/checkin_test.js <agentCheckAddress> <mockAgentIdAddress>
// Reads the private key programmatically from ~/workspace/agent-wallet/agent-wallet.json
// and NEVER prints it.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const AC_ADDR = process.argv[2];
const MOCK_ADDR = process.argv[3];
const RPC = 'https://bsc-testnet.publicnode.com';
const DEPLOYER = '0x47C2054E40557aB52F0DCE699A2a50D7d798E3FE';

(async () => {
  if (!AC_ADDR || !MOCK_ADDR) { console.error('usage: node scripts/checkin_test.js <agentCheck> <mockAgentId>'); process.exit(2); }
  const walletJson = JSON.parse(fs.readFileSync(
    path.join(process.env.HOME, 'workspace/agent-wallet/agent-wallet.json'), 'utf8'));
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(walletJson.privateKey, provider);
  console.log('deployer:', wallet.address, '| balance tBNB:', ethers.formatEther(await provider.getBalance(wallet.address)));
  const acA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'AgentCheck.json'), 'utf8'));
  const mockA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'MockAgentId.json'), 'utf8'));
  const mock = new ethers.Contract(MOCK_ADDR, mockA.abi, provider);
  const ac = new ethers.Contract(AC_ADDR, acA.abi, wallet);
  console.log('mock balanceOf deployer:', (await mock.balanceOf(DEPLOYER)).toString());
  console.log('AgentCheck.agentId():', await ac.agentId());
  console.log('canCheckInToday:', await ac.canCheckInToday(DEPLOYER));
  console.log('pre  streak:', (await ac.getStreak(DEPLOYER)).toString(), '| total:', (await ac.getTotal(DEPLOYER)).toString());
  const tx = await ac.checkIn();
  console.log('checkIn tx sent:', tx.hash);
  const rc = await tx.wait();
  console.log('checkIn mined | block:', rc.blockNumber, '| gasUsed:', Number(rc.gasUsed), '| status:', rc.status);
  const info = await ac.getInfo(DEPLOYER);
  console.log('post getInfo: streak =', info[0].toString(), '| total =', info[1].toString(), '| lastDay =', info[2].toString(), '| canCheckInToday =', info[3]);
  console.log('post getStreak:', (await ac.getStreak(DEPLOYER)).toString(), '| getTotal:', (await ac.getTotal(DEPLOYER)).toString());
  console.log('canCheckInToday now:', await ac.canCheckInToday(DEPLOYER));
  const events = await ac.queryFilter(ac.filters.CheckIn, rc.blockNumber, rc.blockNumber);
  console.log('CheckIn events in block:', events.length, events.length ? JSON.stringify({ user: events[0].args[0], day: events[0].args[1].toString(), streak: events[0].args[2].toString(), total: events[0].args[3].toString() }) : '');
})().catch(e => { console.error('CHECKIN ERR:', e.message); process.exit(1); });
