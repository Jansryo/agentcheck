// Verify AgentCheck on Etherscan API V2 (works for BSC via chainid=56).
// BscScan's own API dashboard now redirects to Etherscan API V2, so one
// Etherscan API key verifies the BSC contract too.
//
// Usage:
//   node scripts/verify_etherscan_v2.js [--chainid 56] [--address 0x...]
//       [--apikey KEY] [--dry-run]
//   API key default: env ETHERSCAN_API_KEY (set from the user's stored
//   connector credential once supplied; never print the key).
//   --dry-run prints the full payload (key masked) and exits without
//   calling the Etherscan API. It still cross-checks the constructor args
//   against the on-chain deploy tx input via public RPC (read-only).
//
// Verification inputs (must match the deploy exactly):
//   solc v0.8.38+commit.1835d247, optimizer 200 runs, evmVersion paris,
//   license MIT (licenseType 3), contract AgentCheck.sol:AgentCheck,
//   constructor arg = agentId address, ABI-encoded as one 32-byte word.
//   stdJson is rebuilt exactly as scripts/compile.js does (all .sol files
//   in contracts/), the same input Sourcify already accepted (exact_match).
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const deploymentFile = path.join(root, 'deployments', 'mainnet-1795071242998.json');

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const dryRun = process.argv.includes('--dry-run');
const chainId = arg('--chainid', '56');
const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
const address = arg('--address', deployment.agentCheck.address);
const agentId = deployment.agentCheck.agentId;
const deployTx = deployment.agentCheck.txHash;
const apiKey = arg('--apikey', process.env.ETHERSCAN_API_KEY || '');

if (!dryRun && !apiKey) {
  console.error('Missing API key: pass --apikey KEY or set ETHERSCAN_API_KEY.');
  process.exit(2);
}

// ABI-encode a single address constructor arg: 32-byte word, no 0x prefix.
const ctorArgs = '000000000000000000000000' + agentId.replace(/^0x/, '').toLowerCase();

// Rebuild stdJson exactly like scripts/compile.js.
const contractsDir = path.join(root, 'contracts');
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

const form = {
  module: 'contract',
  action: 'verifysourcecode',
  contractaddress: address,
  contractname: 'AgentCheck.sol:AgentCheck',
  compilerversion: 'v0.8.38+commit.1835d247',
  licenseType: '3', // MIT
  sourceCode: JSON.stringify(stdJsonInput),
  optimizationUsed: '1',
  runs: '200',
  evmversion: 'paris',
  constructorArguements: ctorArgs,
  apikey: apiKey,
};

function postForm(host, pathQuery, fields) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(fields).toString();
    const req = https.request(
      { hostname: host, path: pathQuery, method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, text: d }));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request(
      { hostname: 'bsc-dataseed1.defibit.io', path: '/', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('Contract:', address, '| chainId:', chainId);
  console.log('Constructor args (agentId):', ctorArgs);

  // Cross-check ctor args against the on-chain deploy tx input suffix.
  try {
    const tx = await rpc('eth_getTransactionByHash', [deployTx]);
    const input = (tx.result && tx.result.input) || '';
    const suffix = input.slice(-64);
    console.log('Deploy tx input suffix :', suffix);
    console.log('Ctor args match on-chain:', suffix === ctorArgs ? 'YES' : 'MISMATCH — STOP, do not submit');
    if (suffix && suffix !== ctorArgs) process.exit(1);
  } catch (e) {
    console.log('RPC check skipped (unreachable):', e.message, '- proceeding with deployment-record args');
  }

  if (dryRun) {
    const masked = { ...form, apikey: apiKey ? '<key-present>' : '<missing>' };
    console.log('--- DRY RUN: payload that would be POSTed to https://api.etherscan.io/v2/api?chainid=' + chainId + ' ---');
    console.log(JSON.stringify({ ...masked, sourceCode: '<stdJson ' + masked.sourceCode.length + ' chars>' }, null, 2));
    console.log('DRY RUN OK: payload valid, no API call made.');
    return;
  }

  console.log('Submitting verification...');
  const res = await postForm('api.etherscan.io', '/v2/api?chainid=' + encodeURIComponent(chainId), form);
  console.log('HTTP', res.status);
  console.log(res.text.slice(0, 2000));
  let guid;
  try { guid = JSON.parse(res.text).result; } catch (e) { /* fall through */ }
  if (!guid || typeof guid !== 'string' || guid.length < 10) {
    console.error('No GUID returned — verification was not accepted.');
    process.exit(1);
  }
  console.log('GUID:', guid);

  for (let i = 0; i < 30; i++) {
    await sleep(10000);
    const check = await postForm('api.etherscan.io', '/v2/api?chainid=' + encodeURIComponent(chainId), {
      module: 'contract', action: 'checkverifystatus', guid, apikey: apiKey,
    });
    console.log('check', i + 1, ':', check.text.slice(0, 500));
    let j;
    try { j = JSON.parse(check.text); } catch (e) { continue; }
    if (j.result && j.result !== 'Pending in queue') {
      if (/Pass/i.test(j.result) || /verified/i.test(j.result)) {
        console.log('VERIFIED:', j.result);
        return;
      }
      console.error('Verification FAILED:', j.result);
      process.exit(1);
    }
  }
  console.error('Timed out waiting for verification result; check GUID manually:', guid);
  process.exit(1);
})().catch((e) => { console.error('VERIFY ERR:', e.message); process.exit(1); });
