const { ethers } = require('ethers');
(async () => {
  const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.bnbchain.org:8545');
  const wallet = '0x47C2054E40557aB52F0DCE699A2a50D7d798E3FE';
  const agentId = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
  const bal = await provider.getBalance(wallet);
  console.log('chainId:', await provider.getNetwork().then(n => n.chainId));
  console.log('block:', await provider.getBlockNumber());
  console.log('wallet tBNB:', ethers.formatEther(bal));
  const code = await provider.getCode(agentId);
  console.log('AgentID code on testnet:', code === '0x' ? 'NONE (not deployed)' : code.length + ' chars');
  if (code !== '0x') {
    const abi = ['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)'];
    const c = new ethers.Contract(agentId, abi, provider);
    try { console.log('deployer AgentID balance:', (await c.balanceOf(wallet)).toString()); } catch(e){ console.log('balanceOf err:', e.message.slice(0,120)); }
    try { console.log('totalSupply:', (await c.totalSupply()).toString()); } catch(e){ console.log('totalSupply n/a:', e.message.slice(0,80)); }
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
