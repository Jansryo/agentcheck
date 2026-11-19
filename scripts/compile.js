// Compile AgentCheck.sol + MockAgentId.sol with solc 0.8.38 (offline).
// Writes build/AgentCheck.json and build/MockAgentId.json (ABI + bytecode).
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractsDir = path.join(__dirname, '..', 'contracts');
const buildDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(buildDir, { recursive: true });

const sources = {};
for (const f of fs.readdirSync(contractsDir).filter(f => f.endsWith('.sol'))) {
  sources[f] = { content: fs.readFileSync(path.join(contractsDir, f), 'utf8') };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris', // max compatibility: no PUSH0; works on BSC + any EVM
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) {
  for (const e of output.errors) {
    console.log(e.severity.toUpperCase() + ': ' + e.formattedMessage);
    if (e.severity === 'error') process.exitCode = 1;
  }
}
if (process.exitCode) process.exit(process.exitCode);

for (const [file, contracts] of Object.entries(output.contracts)) {
  for (const [name, c] of Object.entries(contracts)) {
    const artifact = {
      contractName: name,
      sourceName: file,
      abi: c.abi,
      bytecode: '0x' + c.evm.bytecode.object,
      deployedBytecode: '0x' + c.evm.deployedBytecode.object,
      compiler: 'solc 0.8.38, optimizer 200 runs',
    };
    fs.writeFileSync(path.join(buildDir, name + '.json'), JSON.stringify(artifact, null, 2));
    console.log('OK', name, '| bytecode bytes:', (c.evm.bytecode.object.length / 2) | 0);
  }
}
