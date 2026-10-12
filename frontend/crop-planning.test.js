import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculatePlantLayout,
  createCropDistribution,
  estimateCropStage,
  getAcceleratedTimestamp,
  getCropStageTransitions,
  getCropVisualStage,
  getLocalCalendarDate,
  getOverallPhenologyProgress
} from './crop-planning.js';
import { CROP_DISTRIBUTION_DEFAULTS } from './greenhouse-model.js';

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

test('estimates a bounded bed layout from configurable dimensions and spacing', () => {
  const layout = calculatePlantLayout({
    bedLength: 8,
    bedWidth: 3,
    plantSpacing: 1.5,
    rowSpacing: 1,
    edgeMargin: 0.1
  });
  assert.equal(layout.plantCount, layout.rows * layout.columns);
  assert.ok(layout.plantCount > 0);
  assert.equal(layout.rows, 2);
  assert.ok(layout.positions.every(({ x, z }) => Math.abs(x) <= 0.5 && Math.abs(z) <= 3));
  for (let first = 0; first < layout.positions.length; first += 1) {
    for (let second = first + 1; second < layout.positions.length; second += 1) {
      const xDistance = layout.positions[first].x - layout.positions[second].x;
      const zDistance = layout.positions[first].z - layout.positions[second].z;
      assert.ok(Math.hypot(xDistance, zDistance) >= 1);
    }
  }
  const denseLayout = calculatePlantLayout({
    bedLength: 8,
    bedWidth: 3,
    plantSpacing: 0.01,
    rowSpacing: 0.01,
    edgeMargin: 0.1
  });
  assert.ok(denseLayout.plantCount > denseLayout.visualPlantCount);
  assert.ok(denseLayout.visualPlantCount <= 500);
  assert.throws(
    () => calculatePlantLayout({
      bedLength: 8,
      bedWidth: 3,
      plantSpacing: 1,
      rowSpacing: 1,
      edgeMargin: 1.5
    }),
    RangeError
  );
});

test('uses the legacy 3D bed footprint and plant count only as an estimated default', () => {
  const layout = calculatePlantLayout(CROP_DISTRIBUTION_DEFAULTS);

  assert.equal(layout.bedLength, 28.4);
  assert.equal(layout.bedWidth, 1.15);
  assert.equal(layout.plantCount, 18);
  assert.equal(layout.visualPlantCount, layout.plantCount);
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
      nextStage: null,
      daysToNextStage: null,
      daysToHarvest: 2,
      estimatedHarvestDate: '2026-10-17',
      percentage: 33.3,
      stageEvidenceStatus: 'pending_verification'
    }
  );
  assert.equal(estimateCropStage(fruitCrop, '2026-10-12', '2026-10-14').stage, 'Germinación');
  assert.equal(estimateCropStage(fruitCrop, '2026-10-12', '2026-10-15').stage, 'Floración');
  assert.equal(estimateCropStage(leafCrop, '2026-10-12', '2026-10-15').stage, 'Emergencia');
  assert.equal(estimateCropStage(leafCrop, '2026-10-12', '2026-10-15').daysToNextStage, 2);
  assert.equal(estimateCropStage(leafCrop, '2026-10-12', '2026-10-15').nextStage, 'Hojas');
  assert.equal(estimateCropStage(leafCrop, '2026-10-12', '2026-10-15').estimatedHarvestDate, '2026-10-22');
  assert.equal(estimateCropStage(leafCrop, '2026-10-12', '2026-10-16').stage, 'Emergencia');
  assert.equal(estimateCropStage(leafCrop, '2026-10-12', '2026-10-16').daysToNextStage, 1);
  assert.equal(estimateCropStage(leafCrop, '2026-10-12', '2026-10-17').stage, 'Hojas');
  assert.throws(() => estimateCropStage(fruitCrop, 'invalid', '2026-10-15'), TypeError);
});

test('reports each configured stage transition once across skipped simulated days', () => {
  const crop = {
    phenology: [
      { code: 'V0', name: 'Emergencia', durationDays: 2 },
      { code: 'V1', name: 'Plántula', durationDays: 3 },
      { code: 'R1', name: 'Cosecha', durationDays: 4 }
    ]
  };

  assert.deepEqual(getCropStageTransitions(crop, 1, 6), [
    { stage: 'Plántula', stageCode: 'V1', day: 3 },
    { stage: 'Cosecha', stageCode: 'R1', day: 6 }
  ]);
  assert.deepEqual(getCropStageTransitions(crop, -1, 3), [
    { stage: 'Emergencia', stageCode: 'V0', day: 0 },
    { stage: 'Plántula', stageCode: 'V1', day: 3 }
  ]);
  assert.deepEqual(getCropStageTransitions(crop, 3, 6), [
    { stage: 'Cosecha', stageCode: 'R1', day: 6 }
  ]);
  assert.throws(() => getCropStageTransitions(crop, 3, 2), TypeError);
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
