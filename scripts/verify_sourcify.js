// Verify AgentCheck on Sourcify (v2 API, JSON body — multipart is rejected).
// Usage: node scripts/verify_sourcify.js <chainId> <address>
// Reconstructs stdJsonInput exactly as scripts/compile.js does so the
// recompiled bytecode matches the deployed artifact.
const fs = require('fs');
const path = require('path');

const chainId = process.argv[2];
const address = process.argv[3];
if (!chainId || !address) {
  console.error('Usage: node scripts/verify_sourcify.js <chainId> <address>');
  process.exit(2);
}

const contractsDir = path.join(__dirname, '..', 'contracts');
const sources = {};
for (const f of fs.readdirSync(contractsDir).filter(f => f.endsWith('.sol'))) {
  sources[f] = { content: fs.readFileSync(path.join(contractsDir, f), 'utf8') };
}
const stdJsonInput = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
};

const body = {
  stdJsonInput,
  compilerVersion: 'v0.8.38+commit.1835d247',
  contractIdentifier: 'AgentCheck.sol:AgentCheck',
};

(async () => {
  const url = `https://sourcify.dev/server/v2/verify/${chainId}/${address}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log('HTTP', res.status);
  console.log(text.slice(0, 2000));
  if (!res.ok) process.exit(1);
})().catch(e => { console.error('VERIFY ERR:', e.message); process.exit(1); });
