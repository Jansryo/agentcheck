const { ethers } = require('ethers');
(async () => {
  const wallet = '0x47C2054E40557aB52F0DCE699A2a50D7d798E3FE';
  const bsc = new ethers.JsonRpcProvider('https://bsc-dataseed1.defibit.io');
  const bnb = await bsc.getBalance(wallet);
  console.log('BSC mainnet BNB:', ethers.formatEther(bnb));
  const eth = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  try {
    const e = await eth.getBalance(wallet);
    console.log('ETH mainnet ETH:', ethers.formatEther(e));
  } catch (err) { console.log('ETH RPC err:', err.message.slice(0,100)); }
  const gp = await bsc.getFeeData();
  console.log('BSC mainnet gasPrice gwei:', ethers.formatUnits(gp.gasPrice, 'gwei'));
  console.log('BSC mainnet block:', await bsc.getBlockNumber());
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
