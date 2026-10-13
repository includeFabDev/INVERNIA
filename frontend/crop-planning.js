const BED_COUNT = 6;
const ZONES = ['A', 'B', 'C'];
const MILLISECONDS_PER_DAY = 86400000;
const MAX_VISUALIZED_PLANTS_PER_BED = 500;

export function advanceScenarioCalendar(instantMs, elapsedSeconds, clockSpeed) {
  if (![instantMs, elapsedSeconds, clockSpeed].every(Number.isFinite)
    || elapsedSeconds < 0
    || clockSpeed <= 0) {
    throw new TypeError('Valid scenario calendar values are required');
  }
  return instantMs + elapsedSeconds * 60 * clockSpeed * 60000;
}

export function getAcceleratedTimestamp(baseMs, elapsedRealMs, daysPerSecond, endMs) {
  if (![baseMs, elapsedRealMs, daysPerSecond, endMs].every(Number.isFinite)
    || elapsedRealMs < 0
    || daysPerSecond <= 0
    || endMs < baseMs) {
    throw new TypeError('Valid clock values are required');
  }
  return Math.min(endMs, baseMs + elapsedRealMs * daysPerSecond * 86400);
}

export function getScenarioSynchronizedTimestamp(baseMs, elapsedScenarioMinutes, growthMultiplier, endMs) {
  if (![baseMs, elapsedScenarioMinutes, growthMultiplier, endMs].every(Number.isFinite)
    || elapsedScenarioMinutes < 0
    || growthMultiplier <= 0
    || endMs < baseMs) {
    throw new TypeError('Valid scenario clock values are required');
  }
  return Math.min(endMs, baseMs + elapsedScenarioMinutes * 60000 * growthMultiplier);
}

export function createCropDistribution(selectedSlugs, catalog) {
  if (!Array.isArray(selectedSlugs) || !Array.isArray(catalog)) {
    throw new TypeError('Selected crops and catalog must be arrays');
  }
  if (selectedSlugs.length > BED_COUNT) {
    throw new RangeError(`At most ${BED_COUNT} distinct crops fit the available beds`);
  }
  if (new Set(selectedSlugs).size !== selectedSlugs.length) {
    throw new TypeError('A crop can only be assigned once');
  }

  const cropBySlug = new Map(catalog.map((crop) => [crop.slug, crop]));
  return selectedSlugs.map((slug, index) => {
    const crop = cropBySlug.get(slug);
    if (!crop) throw new RangeError(`Unknown crop: ${slug}`);
    return {
      bed: `C${index + 1}`,
      zones: [...ZONES],
      crop
    };
  });
}

export function calculatePlantLayout({
  bedLength,
  bedWidth,
  plantSpacing,
  rowSpacing,
  edgeMargin
}) {
  const values = [bedLength, bedWidth, plantSpacing, rowSpacing, edgeMargin];
  if (!values.every(Number.isFinite)
    || bedLength <= 0
    || bedWidth <= 0
    || plantSpacing <= 0
    || rowSpacing <= 0
    || edgeMargin < 0) {
    throw new TypeError('Positive bed dimensions and spacing values are required');
  }

  if (bedWidth / 2 <= edgeMargin) {
    throw new RangeError('The edge margin leaves no room for a plant row');
  }
  const horizontalScale = Math.min(
    1,
    plantSpacing / 1.4,
    rowSpacing / 1.4,
    (bedWidth / 2 - edgeMargin) / 0.7
  );
  const canopyClearance = 0.7 * horizontalScale;
  const usableLength = bedLength - 2 * (edgeMargin + canopyClearance);
  const usableWidth = bedWidth - 2 * (edgeMargin + canopyClearance);
  if (usableLength < 0 || usableWidth < 0) {
    throw new RangeError('The edge margin leaves no room for the plant canopy');
  }

  const columns = Math.floor((usableLength + Number.EPSILON) / plantSpacing) + 1;
  const rows = Math.floor((usableWidth + Number.EPSILON) / rowSpacing) + 1;
  const plantCount = rows * columns;
  const visualRows = Math.min(
    rows,
    MAX_VISUALIZED_PLANTS_PER_BED,
    Math.max(1, Math.floor(Math.sqrt(MAX_VISUALIZED_PLANTS_PER_BED * rows / columns)))
  );
  const visualColumns = Math.min(
    columns,
    Math.max(1, Math.floor(MAX_VISUALIZED_PLANTS_PER_BED / visualRows))
  );
  const rowIndexes = Array.from({ length: visualRows }, (_, index) => (
    visualRows === 1
      ? Math.floor((rows - 1) / 2)
      : Math.round(index * (rows - 1) / (visualRows - 1))
  ));
  const columnIndexes = Array.from({ length: visualColumns }, (_, index) => (
    visualColumns === 1
      ? Math.floor((columns - 1) / 2)
      : Math.round(index * (columns - 1) / (visualColumns - 1))
  ));
  const positions = [];
  for (const row of rowIndexes) {
    const x = rows === 1
      ? 0
      : -((rows - 1) * rowSpacing) / 2 + row * rowSpacing;
    for (const column of columnIndexes) {
      const z = columns === 1
        ? 0
        : -((columns - 1) * plantSpacing) / 2 + column * plantSpacing;
      positions.push({ x, z });
    }
  }
  return {
    bedLength,
    bedWidth,
    plantSpacing,
    rowSpacing,
    edgeMargin,
    rows,
    columns,
    plantCount,
    visualPlantCount: positions.length,
    positions
  };
}

export function getOverallPhenologyProgress(crop, stageResult) {
  if (!crop || !Array.isArray(crop.phenology) || !stageResult) return 0;
  const totalDuration = crop.phenology.reduce(
    (total, stage) => total + (Number(stage.durationDays) || 0),
    0
  );
  if (!totalDuration) return 0;
  const elapsed = Math.max(0, Number(stageResult.daysElapsed) || 0);
  return Math.max(0, Math.min(1, elapsed / totalDuration));
}

export function estimateCropStage(crop, plantDate, referenceDate) {
  if (!crop || !Array.isArray(crop.phenology) || crop.phenology.length === 0) {
    throw new TypeError('A crop with phenology stages is required');
  }
  const plantTime = Date.parse(`${plantDate}T00:00:00Z`);
  const referenceTime = Date.parse(`${referenceDate}T00:00:00Z`);
  if (!Number.isFinite(plantTime) || !Number.isFinite(referenceTime)) {
    throw new TypeError('Valid planting and reference dates are required');
  }

  const daysElapsed = Math.max(0, Math.round((referenceTime - plantTime) / MILLISECONDS_PER_DAY));
  const totalDuration = crop.phenology.reduce(
    (total, stage) => total + (Number(stage.durationDays) || 0),
    0
  );
  let cumulativeDays = 0;
  let currentStage = crop.phenology[0];
  let currentStageIndex = 0;
  for (const [index, stage] of crop.phenology.entries()) {
    currentStage = stage;
    currentStageIndex = index;
    if (daysElapsed <= cumulativeDays + stage.durationDays) break;
    cumulativeDays += stage.durationDays;
  }

  const stageDurationDays = Number(currentStage.durationDays) || 1;
  const stageElapsed = Math.max(0, daysElapsed - cumulativeDays);
  const nextStage = crop.phenology[currentStageIndex + 1] || null;
  const daysToNextStage = nextStage
    ? Math.max(0, cumulativeDays + stageDurationDays + 1 - daysElapsed)
    : null;
  return {
    stage: currentStage.name,
    stageCode: currentStage.code,
    daysElapsed,
    totalDuration,
    stageDurationDays,
    stageStartDay: cumulativeDays,
    nextStage: nextStage?.name || null,
    daysToNextStage,
    daysToHarvest: Math.max(0, totalDuration - daysElapsed),
    estimatedHarvestDate: new Date(plantTime + totalDuration * MILLISECONDS_PER_DAY)
      .toISOString()
      .slice(0, 10),
    percentage: Number(Math.min(100, (stageElapsed / stageDurationDays) * 100).toFixed(1)),
    stageEvidenceStatus: currentStage.durationEvidenceStatus || 'pending_verification'
  };
}

export function getCropStageTransitions(crop, fromDay, toDay) {
  if (!crop || !Array.isArray(crop.phenology)
    || !Number.isFinite(fromDay) || !Number.isFinite(toDay)
    || toDay < fromDay) {
    throw new TypeError('A crop and an increasing day interval are required');
  }

  const transitions = [];
  let boundaryDay = 0;
  if (crop.phenology.length > 0 && fromDay < 0 && toDay >= 0) {
    transitions.push({
      stage: crop.phenology[0].name,
      stageCode: crop.phenology[0].code,
      day: 0
    });
  }
  crop.phenology.forEach((stage, index) => {
    const transitionDay = boundaryDay + 1;
    if (index > 0 && fromDay < transitionDay && toDay >= transitionDay) {
      transitions.push({
        stage: stage.name,
        stageCode: stage.code,
        day: transitionDay
      });
    }
    boundaryDay += Number(stage.durationDays) || 0;
  });
  return transitions;
}

export function getCropVisualStage(crop, stageResult) {
  if (!crop || !stageResult || typeof stageResult.stage !== 'string') return 'vegetative';
  const stageName = stageResult.stage.toLowerCase();
  if (/germin|emerg/.test(stageName)) return 'emergence';

  if (crop.category === 'fruit') {
    if (/flor/.test(stageName)) return 'flowering';
    if (/fruct|cuaj|madur|cosech/.test(stageName)) return 'fruiting';
    return 'vegetative';
  }

  if (/cosech|comercial|madur/.test(stageName)) return 'leaf-harvest';
  return 'foliage';
}

export function getLocalCalendarDate(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('A valid date is required');
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
