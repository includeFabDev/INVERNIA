import { timingSafeEqual } from 'node:crypto';
import { ensureDeviceState, getDefaultState, saveDeviceState } from '../services/deviceStates.js';
import { averageZoneMeasurements } from '../services/zones.js';
import { evaluateSystemEvents } from '../services/events.js';
import { env } from '../config/env.js';

const DEVICE_STATE_ID = 123456789;
const TELEMETRY_FIELDS = {
  temperature_c: { field: 'temperatura_c', min: -20, max: 80 },
  humidity_pct: { field: 'humedad_pct', min: 0, max: 100 },
  soil_moisture_pct: { field: 'humedad_suelo_pct', min: 0, max: 100 },
  illuminance_lux: { field: 'iluminancia_lux', min: 0, max: 200000 },
  co2_ppm: { field: 'co2_ppm', min: 0, max: 10000 },
  ph: { field: 'ph', min: 0, max: 14 }
};

function validBearerToken(header, expectedToken) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function telemetryRoute(supabase) {
  return async function telemetryHandler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!env.TELEMETRY_INGESTION_TOKEN) {
      return res.status(503).json({ error: 'Telemetry ingestion is not configured' });
    }
    if (!validBearerToken(req.headers?.authorization, env.TELEMETRY_INGESTION_TOKEN)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Buffer.byteLength(JSON.stringify(body)) > 8192) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    if (typeof body.device_id !== 'string' || !body.device_id.trim() || body.device_id.length > 64) {
      return res.status(400).json({ error: 'device_id is required' });
    }
    if (!['A', 'B', 'C'].includes(body.zone)) {
      return res.status(400).json({ error: 'zone must be A, B, or C' });
    }

    const sample = {};
    for (const [input, { field, min, max }] of Object.entries(TELEMETRY_FIELDS)) {
      const value = body[input];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        return res.status(400).json({ error: `Invalid ${input}` });
      }
      sample[field] = value;
    }

    try {
      const current = await ensureDeviceState(supabase, DEVICE_STATE_ID);
      const previousState = current.state || getDefaultState();
      const state = { ...getDefaultState(), ...previousState };
      const zone = body.zone;
      const receivedAt = new Date().toISOString();
      state.zonas = { ...state.zonas };
      state.zonas[zone] = {
        ...(state.zonas[zone] || {}),
        ...sample,
        device_id: body.device_id.trim(),
        fuenteDatos: 'physical',
        updated_at: receivedAt
      };
      state.fuenteDatos = 'physical';
      Object.assign(state, averageZoneMeasurements(state.zonas));
      await evaluateSystemEvents(supabase, previousState, state, 'telemetry');
      await saveDeviceState(supabase, DEVICE_STATE_ID, state, 'telemetry_received');

      const { error: historyError } = await supabase.from('measurements').insert({
        created_at: receivedAt,
        zone,
        temperatura_c: sample.temperatura_c,
        humedad_pct: sample.humedad_pct,
        humedad_suelo_pct: sample.humedad_suelo_pct,
        iluminancia_lux: sample.iluminancia_lux,
        co2_ppm: sample.co2_ppm,
        ph: sample.ph
      });
      if (historyError) console.warn('[telemetry] history snapshot unavailable', historyError.code || 'unknown');

      return res.status(202).json({ ok: true, zone, fuenteDatos: 'physical', history_saved: !historyError });
    } catch {
      console.error('[telemetry] request could not update state');
      return res.status(500).json({ error: 'Telemetry could not be stored' });
    }
  };
}