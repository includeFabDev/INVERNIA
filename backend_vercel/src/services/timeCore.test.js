import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TIME_POLICY,
  advanceVirtualInstant,
  calculateVirtualElapsedDays,
  deriveVirtualDateISO,
  deriveVirtualHourHH,
  getVirtualDateState,
  isVirtualInstantInitialized,
  minutesToHHMM,
  normalizeDeltaSeconds,
  parseVirtualHHMM,
  validateTimeScale
} from './timeCore.js';

const UTC = 'UTC';
const NO_DELTA_CLAMP = { minSec: 0, maxSec: 120 };

test('preserves the current INVERNIA timeScale formula at requested speeds', () => {
  const baseInstantMs = Date.UTC(2025, 0, 1, 12, 0, 0);
  const cases = [
    { seconds: 1, scale: 1, expectedMinutes: 1 },
    { seconds: 60, scale: 1, expectedMinutes: 60 },
    { seconds: 120, scale: 1, expectedMinutes: 120 },
    { seconds: 1, scale: 2, expectedMinutes: 2 },
    { seconds: 60, scale: 2, expectedMinutes: 120 },
    { seconds: 120, scale: 10, expectedMinutes: 1200 }
  ];

  for (const { seconds, scale, expectedMinutes } of cases) {
    const result = advanceVirtualInstant(baseInstantMs, seconds, scale);
    assert.equal(result.virtualMinutesDelta, seconds * scale);
    assert.equal(result.virtualMillisecondsDelta, seconds * scale * 60_000);
    assert.equal(result.nextVirtualInstantMs, baseInstantMs + (seconds * scale * 60_000));
  }
});

test('reports raw and effective deltas for the cron minimum and maximum policy', () => {
  const cases = [
    { raw: 0, effective: 0.5, clamped: true },
    { raw: 0.1, effective: 0.5, clamped: true },
    { raw: 0.4, effective: 0.5, clamped: true },
    { raw: 0.5, effective: 0.5, clamped: false },
    { raw: 1, effective: 1, clamped: false },
    { raw: 121, effective: 120, clamped: true },
    { raw: -1, effective: 0.5, clamped: true }
  ];

  for (const { raw, effective, clamped } of cases) {
    const result = normalizeDeltaSeconds(raw);
    assert.equal(result.rawSeconds, raw);
    assert.equal(result.effectiveSeconds, effective);
    assert.equal(result.clamped, clamped);
    assert.equal(result.deltaMs, effective * 1000);
  }

  assert.equal(DEFAULT_TIME_POLICY.MIN_DT_SEC, 0.5);
  assert.equal(DEFAULT_TIME_POLICY.MAX_DT_SEC, 120);
});

test('rolls 23:59 forward to 00:00 and advances the calendar date', () => {
  const instantMs = Date.UTC(2025, 0, 1, 23, 59);
  const result = advanceVirtualInstant(instantMs, 1, 1);

  assert.equal(deriveVirtualHourHH(result.nextVirtualInstantMs, UTC), '00:00');
  assert.equal(deriveVirtualDateISO(result.nextVirtualInstantMs, UTC), '2025-01-02');
});

test('rolls from January 31 to February 1', () => {
  const instantMs = Date.UTC(2025, 0, 31, 23, 59);
  const result = advanceVirtualInstant(instantMs, 1, 1);
  assert.equal(deriveVirtualDateISO(result.nextVirtualInstantMs, UTC), '2025-02-01');
});

test('handles February transitions in common and leap years', () => {
  const commonYearEnd = advanceVirtualInstant(Date.UTC(2025, 1, 28, 23, 59), 1, 1);
  const leapYearFeb28 = advanceVirtualInstant(Date.UTC(2024, 1, 28, 23, 59), 1, 1);
  const leapDayEnd = advanceVirtualInstant(Date.UTC(2024, 1, 29, 23, 59), 1, 1);

  assert.equal(deriveVirtualDateISO(commonYearEnd.nextVirtualInstantMs, UTC), '2025-03-01');
  assert.equal(deriveVirtualDateISO(leapYearFeb28.nextVirtualInstantMs, UTC), '2024-02-29');
  assert.equal(deriveVirtualDateISO(leapDayEnd.nextVirtualInstantMs, UTC), '2024-03-01');
});

test('rolls from December 31 to January 1', () => {
  const instantMs = Date.UTC(2025, 11, 31, 23, 59);
  const result = advanceVirtualInstant(instantMs, 1, 1);
  assert.equal(deriveVirtualDateISO(result.nextVirtualInstantMs, UTC), '2026-01-01');
});

test('supports multi-day advances at elevated speed', () => {
  const instantMs = Date.UTC(2025, 0, 1, 0, 0);
  const result = advanceVirtualInstant(instantMs, 120, 25);

  assert.equal(result.virtualMinutesDelta, 3000);
  assert.equal(deriveVirtualDateISO(result.nextVirtualInstantMs, UTC), '2025-01-03');
  assert.equal(deriveVirtualHourHH(result.nextVirtualInstantMs, UTC), '02:00');
});

test('projects canonical instants to HH:MM and ISO date in an explicit timezone', () => {
  const expected = [
    { hh: '00:00', minutes: 0 },
    { hh: '06:30', minutes: 390 },
    { hh: '12:00', minutes: 720 },
    { hh: '18:45', minutes: 1125 },
    { hh: '23:59', minutes: 1439 }
  ];

  for (const { hh, minutes } of expected) {
    const instantMs = Date.UTC(2025, 0, 1) + (minutes * 60_000);
    assert.equal(deriveVirtualHourHH(instantMs, UTC), hh);
    assert.equal(deriveVirtualDateISO(instantMs, UTC), '2025-01-01');
  }

  const utcMidnight = Date.UTC(2025, 0, 1, 0, 30);
  assert.equal(deriveVirtualDateISO(utcMidnight, 'America/La_Paz'), '2024-12-31');
  assert.equal(deriveVirtualHourHH(utcMidnight, 'America/La_Paz'), '20:30');
});

test('handles an absent virtual instant without inventing an initial date', () => {
  for (const absent of [null, undefined]) {
    assert.equal(isVirtualInstantInitialized(absent), false);
    assert.equal(advanceVirtualInstant(absent, 1, 1), null);
    assert.equal(deriveVirtualHourHH(absent, UTC), null);
    assert.equal(deriveVirtualDateISO(absent, UTC), null);
    assert.equal(getVirtualDateState(absent, UTC), null);
    assert.equal(calculateVirtualElapsedDays(absent, Date.UTC(2025, 0, 1)), null);
  }
});

test('rejects invalid instants and non-finite numeric inputs explicitly', () => {
  for (const invalid of [NaN, Infinity, -Infinity, 8.64e15 + 1, -8.64e15 - 1]) {
    assert.equal(isVirtualInstantInitialized(invalid), false);
    assert.throws(() => advanceVirtualInstant(invalid, 1, 1), RangeError);
    assert.throws(() => deriveVirtualDateISO(invalid, UTC), RangeError);
  }

  const baseInstantMs = Date.UTC(2025, 0, 1);
  for (const invalidDelta of [NaN, Infinity, -Infinity]) {
    assert.throws(() => advanceVirtualInstant(baseInstantMs, invalidDelta, 1), RangeError);
    assert.throws(() => normalizeDeltaSeconds(invalidDelta), RangeError);
  }
  for (const invalidScale of [NaN, Infinity, -Infinity, 0, -1, '2']) {
    assert.throws(() => validateTimeScale(invalidScale), RangeError);
    assert.throws(() => advanceVirtualInstant(baseInstantMs, 1, invalidScale), RangeError);
  }
  assert.throws(() => advanceVirtualInstant(8.64e15, 1, 1), RangeError);
});

test('retains fractional milliseconds rather than rounding each tick', () => {
  const first = advanceVirtualInstant(0, 0.00001, 1, NO_DELTA_CLAMP);
  const second = advanceVirtualInstant(first.nextVirtualInstantMs, 0.00001, 1, NO_DELTA_CLAMP);

  assert.ok(Math.abs(first.virtualMillisecondsDelta - 0.6) < Number.EPSILON);
  assert.ok(Math.abs(first.nextVirtualInstantMs - 0.6) < Number.EPSILON);
  assert.ok(Math.abs(second.nextVirtualInstantMs - 1.2) < Number.EPSILON * 2);
});

test('is deterministic and does not mutate the options object', () => {
  const options = { minSec: 0, maxSec: 120 };
  const before = { ...options };
  const args = [Date.UTC(2025, 5, 1, 12), 1.25, 3, options];

  assert.deepEqual(advanceVirtualInstant(...args), advanceVirtualInstant(...args));
  assert.deepEqual(options, before);
});

test('calculates signed elapsed virtual days and reports missing dates', () => {
  const sowingInstantMs = Date.UTC(2025, 0, 1);
  const twoDaysLater = Date.UTC(2025, 0, 3);
  assert.equal(calculateVirtualElapsedDays(sowingInstantMs, twoDaysLater), 2);
  assert.equal(calculateVirtualElapsedDays(twoDaysLater, sowingInstantMs), -2);
  assert.equal(calculateVirtualElapsedDays(null, twoDaysLater), null);
  assert.throws(() => calculateVirtualElapsedDays(NaN, twoDaysLater), RangeError);
});

test('preserves HH:MM conversion behavior and validates parsed input', () => {
  assert.equal(minutesToHHMM(0), '00:00');
  assert.equal(minutesToHHMM(390), '06:30');
  assert.equal(minutesToHHMM(720), '12:00');
  assert.equal(minutesToHHMM(1125), '18:45');
  assert.equal(minutesToHHMM(1439), '23:59');
  assert.equal(minutesToHHMM(1440), '00:00');
  assert.equal(minutesToHHMM(390.9), '06:30');

  assert.deepEqual(parseVirtualHHMM('06:30'), { hh: 6, mm: 30, totalMinutes: 390 });
  assert.deepEqual(parseVirtualHHMM('23:59'), { hh: 23, mm: 59, totalMinutes: 1439 });
  assert.equal(parseVirtualHHMM('99:99'), null);
  assert.throws(() => minutesToHHMM(NaN), RangeError);
  assert.throws(() => minutesToHHMM(Infinity), RangeError);
});
