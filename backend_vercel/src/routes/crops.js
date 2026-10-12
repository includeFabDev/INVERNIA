import {
  createAgronomicPlan,
  getCropBySlug,
  getCropCatalog,
  getCropCategories,
  getCropCount,
  estimateCropStage
} from '../services/cropProfiles.js';

export function cropsRoute() {
  return async function cropsHandler(req, res) {
    try {
      const { slug } = req.params;

      if (slug) {
        const crop = getCropBySlug(slug);
        if (!crop) {
          return res.status(404).json({ ok: false, error: 'Crop not found' });
        }

        return res.json({
          ok: true,
          crop,
          source: crop.source,
          validationStatus: crop.validationStatus
        });
      }

      return res.json({
        ok: true,
        source: 'INVERNIA: investigación agronómica corregida para siete cultivos',
        totalCrops: getCropCount(),
        categories: getCropCategories(),
        crops: getCropCatalog()
      });
    } catch (error) {
      console.error('[cropsRoute]', error);
      return res.status(500).json({ ok: false, error: 'Error reading crop profiles' });
    }
  };
}

export function cropStageRoute() {
  return async function cropStageHandler(req, res) {
    try {
      const crop = getCropBySlug(req.params.slug);
      if (!crop) {
        return res.status(404).json({ ok: false, error: 'Crop not found' });
      }

      const result = estimateCropStage(crop.slug, {
        plantDate: req.query.plantDate || req.body?.plantDate,
        transplantDate: req.query.transplantDate || req.body?.transplantDate,
        referenceDate: req.query.referenceDate || req.body?.referenceDate,
        manualStageCode: req.query.manualStageCode || req.body?.manualStageCode || req.body?.manualStage
      });

      return res.json({ ok: true, crop: crop.name, stage: result });
    } catch (error) {
      console.error('[cropStageRoute]', error);
      return res.status(500).json({ ok: false, error: 'Error estimating crop stage' });
    }
  };
}

export function agronomicPlanRoute() {
  return async function agronomicPlanHandler(req, res) {
    try {
      const payload = req.body || {};
      const plan = createAgronomicPlan(payload);
      return res.json({ ok: true, plan });
    } catch (error) {
      console.error('[agronomicPlanRoute]', error);
      return res.status(500).json({ ok: false, error: 'Error generating agronomic plan' });
    }
  };
}
