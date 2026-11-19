// Full functional test of AgentCheck + MockAgentId on a local Ganache chain.
// Covers: deploy gas, negative holder gate, positive check-in, same-day
// double check-in, streak across consecutive days, streak reset after a
// missed day, pause/unpause + onlyOwner, all views, and the behaviour of
// AgentCheck pointed at the real Agent ID address (no code on testnet).
// Run: node scripts/test_local.js
const fs = require('fs');
const path = require('path');
const ganache = require('ganache');
const { ethers } = require('ethers');

const REAL_AGENT_ID = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
const DAY = 86400;

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log('  PASS', name, extra); }
  else { fail++; console.log('  FAIL', name, extra); }
}
async function expectTxRevert(contract, method, args, errorName, label) {
  let name = null;
  try { await contract[method].staticCall(...args); }
  catch (e) {
    name = (e.revert && e.revert.name)
      || (e.message.match(/reverted with custom error '(\w+)'/) || [])[1]
      || (e.message.includes('no data present') ? 'no-data' : null);
  }
  let status = null;
  try {
    const tx = await contract[method](...args, { gasLimit: 500000 });
    status = (await tx.wait()).status;
  } catch (e) {
    // Ganache rejects reverting txs at submission (simulation) — the tx never
    // mines. The staticCall above already proved the exact custom error.
    status = 'send-failed';
  }
  check(label, name === errorName && (status === 0 || status === 'send-failed'), `(revert: ${name}, mined status: ${status})`);
}

(async () => {
  const server = ganache.server({ chain: { chainId: 97, hardfork: 'shanghai' }, logging: { quiet: true } });
  await server.listen(0);
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:' + server.address().port);
  const [deployer, holder, stranger] = await Promise.all([0, 1, 2].map(i => provider.getSigner(i)));
  const dAddr = await deployer.getAddress(), hAddr = await holder.getAddress(), sAddr = await stranger.getAddress();
  const load = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', n + '.json'), 'utf8'));
  const results = { deployGas: {}, txGas: {} };

  console.log('== 1. Deploy MockAgentId ==');
  const mockA = load('MockAgentId');
  const Mock = new ethers.ContractFactory(mockA.abi, mockA.bytecode, deployer);
  const mock = await Mock.deploy();
  const mrc = await mock.deploymentTransaction().wait();
  results.deployGas.MockAgentId = Number(mrc.gasUsed);
  console.log('  MockAgentId at', await mock.getAddress(), '| gas', Number(mrc.gasUsed));

  console.log('== 2. Deploy AgentCheck -> mock ==');
  const acA = load('AgentCheck');
  const AC = new ethers.ContractFactory(acA.abi, acA.bytecode, deployer);
  const ac = await AC.deploy(await mock.getAddress());
  const rc = await ac.deploymentTransaction().wait();
  results.deployGas.AgentCheck = Number(rc.gasUsed);
  console.log('  AgentCheck at', await ac.getAddress(), '| gas', Number(rc.gasUsed));
  check('owner == deployer', (await ac.owner()).toLowerCase() === dAddr.toLowerCase());
  check('agentId == mock', (await ac.agentId()).toLowerCase() === (await mock.getAddress()).toLowerCase());
  check('paused == false', (await ac.paused()) === false);

  console.log('== 3. Negative gate: non-holder checkIn reverts NotAgentIdHolder ==');
  const acStranger = ac.connect(stranger);
  check('canCheckInToday(stranger) == false', (await ac.canCheckInToday(sAddr)) === false);
  await expectTxRevert(acStranger, 'checkIn', [], 'NotAgentIdHolder', 'stranger checkIn reverts NotAgentIdHolder');
  check('getStreak(stranger) == 0', (await ac.getStreak(sAddr)) === 0n);
  check('getTotal(stranger) == 0', (await ac.getTotal(sAddr)) === 0n);

  console.log('== 4. Mint mock Agent ID to holder; positive check-in ==');
  const mintTx = await mock.mint(hAddr);
  const mintRc = await mintTx.wait();
  results.txGas.mockMint = Number(mintRc.gasUsed);
  check('holder balanceOf == 1', (await mock.balanceOf(hAddr)) === 1n);
  check('canCheckInToday(holder) == true', (await ac.canCheckInToday(hAddr)) === true);
  const acHolder = ac.connect(holder);
  const day0 = Math.floor(Date.now() / 1000 / DAY);
  const tx1 = await acHolder.checkIn();
  const r1 = await tx1.wait();
  results.txGas.checkIn1 = Number(r1.gasUsed);
  const ev = r1.logs.map(l => { try { return ac.interface.parseLog(l); } catch { return null; } }).find(Boolean);
  check('checkIn tx mined', r1.status === 1, '| gas ' + Number(r1.gasUsed));
  check('event CheckIn(user, day, streak=1, total=1)',
    ev && ev.name === 'CheckIn' && ev.args.user.toLowerCase() === hAddr.toLowerCase()
    && Number(ev.args.day) === day0 && ev.args.streak === 1n && ev.args.total === 1n,
    ev ? `day=${ev.args.day} streak=${ev.args.streak} total=${ev.args.total}` : '(no event)');
  const info1 = await ac.getInfo(hAddr);
  check('getInfo after day1: streak=1 total=1 lastDay=day0 canCheckIn=false',
    info1[0] === 1n && info1[1] === 1n && Number(info1[2]) === day0 && info1[3] === false);
  check('canCheckInToday(holder) == false after check-in', (await ac.canCheckInToday(hAddr)) === false);

  console.log('== 5. Same-day second check-in reverts AlreadyCheckedIn ==');
  await expectTxRevert(acHolder, 'checkIn', [], 'AlreadyCheckedIn', 'holder 2nd checkIn same day');

  console.log('== 6. Next day: streak -> 2 ==');
  await provider.send('evm_increaseTime', [DAY]);
  await provider.send('evm_mine', []);
  check('canCheckInToday(holder) == true next day', (await ac.canCheckInToday(hAddr)) === true);
  const tx2 = await acHolder.checkIn();
  const r2 = await tx2.wait();
  results.txGas.checkIn2 = Number(r2.gasUsed);
  const info2 = await ac.getInfo(hAddr);
  check('getInfo day2: streak=2 total=2 canCheckIn=false',
    info2[0] === 2n && info2[1] === 2n && info2[3] === false, '| gas ' + Number(r2.gasUsed));

  console.log('== 7. Skip a day: streak resets to 1 ==');
  await provider.send('evm_increaseTime', [2 * DAY]); // jump 2 days: miss one full day
  await provider.send('evm_mine', []);
  const tx3 = await acHolder.checkIn();
  const r3 = await tx3.wait();
  results.txGas.checkIn3 = Number(r3.gasUsed);
  const info3 = await ac.getInfo(hAddr);
  check('getInfo after missed day: streak=1 total=3',
    info3[0] === 1n && info3[1] === 3n, `streak=${info3[0]} total=${info3[1]}`);

  console.log('== 8. Pause: onlyOwner, Paused revert, unpause resumes ==');
  await expectTxRevert(ac.connect(stranger), 'pause', [], 'NotOwner', 'stranger pause reverts NotOwner');
  const pTx = await ac.pause();
  await pTx.wait();
  check('paused == true after owner pause', (await ac.paused()) === true);
  check('canCheckInToday(holder) == false while paused', (await ac.canCheckInToday(hAddr)) === false);
  await expectTxRevert(acHolder, 'checkIn', [], 'Paused', 'holder checkIn while paused reverts Paused');
  await expectTxRevert(ac.connect(stranger), 'unpause', [], 'NotOwner', 'stranger unpause reverts NotOwner');
  await (await ac.unpause()).wait();
  check('paused == false after unpause', (await ac.paused()) === false);
  // holder already checked in today (step 7) so AlreadyCheckedIn proves pause is lifted
  await expectTxRevert(acHolder, 'checkIn', [], 'AlreadyCheckedIn', 'after unpause: gate reaches AlreadyCheckedIn (pause lifted)');

  console.log('== 9. AgentCheck -> REAL Agent ID address (no code on testnet) ==');
  const acReal = await AC.deploy(REAL_AGENT_ID);
  const rr = await acReal.deploymentTransaction().wait();
  results.deployGas.AgentCheckReal = Number(rr.gasUsed);
  console.log('  AgentCheck(real) at', await acReal.getAddress());
  // balanceOf on an address with no code: low-level call succeeds with empty
  // returndata, Solidity ABI-decode reverts. Expect a revert (NOT NotAgentIdHolder).
  let realName = null;
  try { await acReal.connect(holder).checkIn.staticCall(); }
  catch (e) {
    realName = (e.revert && e.revert.name)
      || (e.message.includes('no data present') ? 'no-data' : null)
      || (e.message.match(/reverted with custom error '(\w+)'/) || [])[1];
  }
  check('real-address checkIn reverts (decode error, not NotAgentIdHolder)',
    realName !== 'NotAgentIdHolder' && realName !== null, `(revert: ${realName})`);
  try {
    await acReal.canCheckInToday(hAddr);
    check('real-address canCheckInToday reverts', false, '(did NOT revert)');
  } catch (e) {
    check('real-address canCheckInToday reverts (no code at Agent ID)', true, `(${String(e.message).slice(0, 70)})`);
  }

  console.log('== 10. Views ==');
  check('getStreak(holder) == 1', (await ac.getStreak(hAddr)) === 1n);
  check('getTotal(holder) == 3', (await ac.getTotal(hAddr)) === 3n);
  const chainDay = Math.floor(Number((await provider.getBlock('latest')).timestamp) / DAY);
  check('getLastDay(holder) == current chain day', Number(await ac.getLastDay(hAddr)) === chainDay, `(lastDay=${await ac.getLastDay(hAddr)} chainDay=${chainDay})`);

  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
  console.log('GAS:', JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'local-test-results.json'), JSON.stringify({ pass, fail, ...results }, null, 2));
  await server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST ERR:', e); process.exit(1); });
