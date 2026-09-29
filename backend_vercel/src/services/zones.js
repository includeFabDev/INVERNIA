const ZONE_PROFILES = {
  A: { temperatura_c: 0.6, humedad_pct: -1, humedad_suelo_pct: -2, iluminancia_lux: 1.03, co2_ppm: 20 },
  B: { temperatura_c: 0, humedad_pct: 0, humedad_suelo_pct: 0, iluminancia_lux: 1, co2_ppm: 0 },
  C: { temperatura_c: -0.6, humedad_pct: 1, humedad_suelo_pct: 2, iluminancia_lux: 0.97, co2_ppm: -20 }
};

const SENSOR_FIELDS = [
  'temperatura_c',
  'humedad_pct',
  'humedad_suelo_pct',
  'iluminancia_lux',
  'co2_ppm',
  'ph'
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createZoneMeasurements(baseState, previousZones = null, alpha = 1) {
  const blend = clamp(alpha, 0, 1);
  const zones = {};

  for (const [zone, profile] of Object.entries(ZONE_PROFILES)) {
    const previous = previousZones?.[zone] || {};
    const target = {
      temperatura_c: clamp((baseState.temperatura_c ?? 27) + profile.temperatura_c, 14, 45),
      humedad_pct: clamp((baseState.humedad_pct ?? 68) + profile.humedad_pct, 20, 95),
      humedad_suelo_pct: clamp((baseState.humedad_suelo_pct ?? 58) + profile.humedad_suelo_pct, 0, 100),
      iluminancia_lux: clamp((baseState.iluminancia_lux ?? 0) * profile.iluminancia_lux, 0, 60000),
      co2_ppm: clamp((baseState.co2_ppm ?? 650) + profile.co2_ppm, 350, 2000),
      ph: clamp(baseState.ph ?? 6.2, 5.5, 7.5)
    };

    zones[zone] = {};
    for (const field of SENSOR_FIELDS) {
      const current = previous[field];
      zones[zone][field] = typeof current === 'number'
        ? current + (target[field] - current) * blend
        : target[field];
    }
  }

  return zones;
}

export function averageZoneMeasurements(zones) {
  const entries = Object.values(zones || {});
  if (!entries.length) return {};

  return Object.fromEntries(SENSOR_FIELDS.map((field) => [
    field,
    entries.reduce((total, zone) => total + (Number(zone[field]) || 0), 0) / entries.length
  ]));
}