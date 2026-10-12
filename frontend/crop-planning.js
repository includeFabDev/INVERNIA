const BED_COUNT = 6;
const ZONES = ['A', 'B', 'C'];
const MILLISECONDS_PER_DAY = 86400000;

export function getAcceleratedTimestamp(baseMs, elapsedRealMs, daysPerSecond, endMs) {
  if (![baseMs, elapsedRealMs, daysPerSecond, endMs].every(Number.isFinite)
    || elapsedRealMs < 0
    || daysPerSecond <= 0
    || endMs < baseMs) {
    throw new TypeError('Valid clock values are required');
  }
  return Math.min(endMs, baseMs + elapsedRealMs * daysPerSecond * 86400);
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
  for (const stage of crop.phenology) {
    currentStage = stage;
    if (daysElapsed <= cumulativeDays + stage.durationDays) break;
    cumulativeDays += stage.durationDays;
  }

  const stageDurationDays = Number(currentStage.durationDays) || 1;
  const stageElapsed = Math.max(0, daysElapsed - cumulativeDays);
  return {
    stage: currentStage.name,
    stageCode: currentStage.code,
    daysElapsed,
    totalDuration,
    stageDurationDays,
    stageStartDay: cumulativeDays,
    percentage: Number(Math.min(100, (stageElapsed / stageDurationDays) * 100).toFixed(1)),
    stageEvidenceStatus: currentStage.durationEvidenceStatus || 'pending_verification'
  };
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
