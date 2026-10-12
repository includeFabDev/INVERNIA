import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCropDistribution,
  estimateCropStage,
  getAcceleratedTimestamp,
  getCropVisualStage,
  getLocalCalendarDate,
  getOverallPhenologyProgress
} from './crop-planning.js';

const catalog = [
  { slug: 'tomate', name: 'Tomate', phenology: [{ durationDays: 10 }, { durationDays: 20 }] },
  { slug: 'lechuga', name: 'Lechuga', phenology: [{ durationDays: 5 }, { durationDays: 15 }] },
  { slug: 'pepino', name: 'Pepino', phenology: [{ durationDays: 7 }, { durationDays: 23 }] },
  { slug: 'acelga', name: 'Acelga', phenology: [{ durationDays: 30 }] },
  { slug: 'locoto', name: 'Locoto', phenology: [{ durationDays: 30 }] },
  { slug: 'espinaca', name: 'Espinaca', phenology: [{ durationDays: 30 }] },
  { slug: 'pimenton', name: 'Pimentón', phenology: [{ durationDays: 30 }] }
];

test('assigns each selected crop to one distinct longitudinal bed crossing A, B, and C', () => {
  const plan = createCropDistribution(['pepino', 'lechuga'], catalog);

  assert.deepEqual(plan.map(({ bed }) => bed), ['C1', 'C2']);
  assert.deepEqual(plan.map(({ zones }) => zones), [
    ['A', 'B', 'C'],
    ['A', 'B', 'C']
  ]);
  assert.deepEqual(plan.map(({ crop }) => crop.slug), ['pepino', 'lechuga']);
});

test('leaves unselected beds empty and rejects more than six distinct crops', () => {
  assert.equal(createCropDistribution(['tomate'], catalog).length, 1);
  assert.throws(
    () => createCropDistribution(catalog.map((crop) => crop.slug), catalog),
    RangeError
  );
});

test('rejects duplicate and unknown crop selections instead of silently changing the plan', () => {
  assert.throws(() => createCropDistribution(['tomate', 'tomate'], catalog), TypeError);
  assert.throws(() => createCropDistribution(['unknown'], catalog), RangeError);
});

test('calculates overall stage progress using each crop profile duration total', () => {
  assert.equal(getOverallPhenologyProgress(catalog[0], { daysElapsed: 15 }), 0.5);
  assert.equal(getOverallPhenologyProgress(catalog[1], { daysElapsed: 5 }), 0.25);
  assert.equal(getOverallPhenologyProgress(catalog[0], { daysElapsed: 60 }), 1);
});

test('advances and caps the isolated crop clock at its configured virtual-day speed', () => {
  const start = Date.UTC(2026, 9, 12);
  const end = start + 30 * 86400000;

  assert.equal(getAcceleratedTimestamp(start, 1000, 1, end), start + 86400000);
  assert.equal(getAcceleratedTimestamp(start, 2000, 7, end), start + 14 * 86400000);
  assert.equal(getAcceleratedTimestamp(start, 10000, 30, end), end);
  assert.throws(() => getAcceleratedTimestamp(start, 1000, 0, end), TypeError);
});

test('estimates fruit and leaf stages from each profile duration at a simulated date', () => {
  const fruitCrop = {
    phenology: [
      { code: 'V0', name: 'Germinación', durationDays: 2 },
      { code: 'R1', name: 'Floración', durationDays: 3 }
    ]
  };
  const leafCrop = {
    phenology: [
      { code: 'V0', name: 'Emergencia', durationDays: 4 },
      { code: 'V1', name: 'Hojas', durationDays: 6 }
    ]
  };

  assert.deepEqual(
    estimateCropStage(fruitCrop, '2026-10-12', '2026-10-15'),
    {
      stage: 'Floración',
      stageCode: 'R1',
      daysElapsed: 3,
      totalDuration: 5,
      stageDurationDays: 3,
      stageStartDay: 2,
      percentage: 33.3,
      stageEvidenceStatus: 'pending_verification'
    }
  );
  assert.equal(estimateCropStage(leafCrop, '2026-10-12', '2026-10-16').stage, 'Emergencia');
  assert.throws(() => estimateCropStage(fruitCrop, 'invalid', '2026-10-15'), TypeError);
});

test('renders fruiting phenology differently from leafy-crop harvest stages', () => {
  const fruitCrop = { category: 'fruit' };
  const leafCrop = { category: 'leaf' };

  assert.equal(getCropVisualStage(fruitCrop, { stage: 'Floración' }), 'flowering');
  assert.equal(getCropVisualStage(fruitCrop, { stage: 'Fructificación' }), 'fruiting');
  assert.equal(getCropVisualStage(leafCrop, { stage: 'Cosecha' }), 'leaf-harvest');
  assert.equal(getCropVisualStage(leafCrop, { stage: 'Roseta' }), 'foliage');
  assert.equal(getCropVisualStage(fruitCrop, { stage: 'Emergencia' }), 'emergence');
});

test('formats the selected system-local calendar date without UTC day shifts', () => {
  const localDate = new Date(2026, 9, 12, 23, 30);
  assert.equal(getLocalCalendarDate(localDate), '2026-10-12');
  assert.throws(() => getLocalCalendarDate(new Date(Number.NaN)), TypeError);
});
