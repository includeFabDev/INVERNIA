const BED_COUNT = 6;
const ZONES = ['A', 'B', 'C'];

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
