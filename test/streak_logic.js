// Pure-JS unit test of the day/streak logic, mirroring AgentCheck.checkIn()
// exactly (same arithmetic, same order of checks). Run: node test/streak_logic.js
// No chain needed — verifies the algorithm independently of the EVM.
const assert = require('assert');
const DAY = 86400;

function simulateCheckIn(state, timestamp) {
  const day = Math.floor(timestamp / DAY);
  if (state.lastDay === day) return { error: 'AlreadyCheckedIn' };
  const streak = (state.lastDay === day - 1) ? state.streak + 1 : 1;
  state.lastDay = day; state.streak = streak; state.total += 1;
  return { day, streak, total: state.total };
}
function fresh() { return { lastDay: 0, streak: 0, total: 0 }; }

let n = 0;
function t(name, fn) { fn(); n++; console.log('  PASS', name); }

// Day number: Unix epoch day (UTC). 2026-11-19 00:00 UTC = day 20776.
const d0 = 20776 * DAY; // 2026-11-19 00:00:00 UTC
t('first ever check-in: streak=1 total=1', () => {
  const s = fresh();
  assert.deepStrictEqual(simulateCheckIn(s, d0 + 3600), { day: 20776, streak: 1, total: 1 });
});
t('same-day second check-in rejected', () => {
  const s = fresh();
  simulateCheckIn(s, d0 + 3600);
  assert.deepStrictEqual(simulateCheckIn(s, d0 + 7200), { error: 'AlreadyCheckedIn' });
});
t('next-day check-in: streak=2', () => {
  const s = fresh();
  simulateCheckIn(s, d0 + 3600);
  assert.deepStrictEqual(simulateCheckIn(s, d0 + DAY + 3600), { day: 20777, streak: 2, total: 2 });
});
t('3 consecutive days: streak=3', () => {
  const s = fresh();
  simulateCheckIn(s, d0); simulateCheckIn(s, d0 + DAY);
  assert.deepStrictEqual(simulateCheckIn(s, d0 + 2 * DAY), { day: 20778, streak: 3, total: 3 });
});
t('miss one day: streak resets to 1, total keeps counting', () => {
  const s = fresh();
  simulateCheckIn(s, d0); simulateCheckIn(s, d0 + DAY);
  assert.deepStrictEqual(simulateCheckIn(s, d0 + 3 * DAY), { day: 20779, streak: 1, total: 3 });
});
t('miss many days: streak resets to 1', () => {
  const s = fresh();
  simulateCheckIn(s, d0);
  assert.deepStrictEqual(simulateCheckIn(s, d0 + 30 * DAY), { day: 20806, streak: 1, total: 2 });
});
t('midnight boundary: 23:59:59 and 00:00:01 are different days', () => {
  const s = fresh();
  simulateCheckIn(s, d0 + DAY - 1); // 23:59:59 day 20776
  assert.deepStrictEqual(simulateCheckIn(s, d0 + DAY), { day: 20777, streak: 2, total: 2 });
});
t('check-in exactly at midnight belongs to the new day', () => {
  const s = fresh();
  assert.deepStrictEqual(simulateCheckIn(s, d0 + DAY), { day: 20777, streak: 1, total: 1 });
});
t('canCheckInToday logic: false after check-in, true next day', () => {
  const s = fresh();
  const can = (ts) => s.lastDay !== Math.floor(ts / DAY);
  assert.strictEqual(can(d0 + 100), true);
  simulateCheckIn(s, d0 + 100);
  assert.strictEqual(can(d0 + 200), false);
  assert.strictEqual(can(d0 + DAY + 100), true);
});
console.log(`\nRESULT: ${n} passed, 0 failed`);
