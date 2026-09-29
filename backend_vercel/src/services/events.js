import { sendTelegramAlert } from './telegramNotifications.js';

export const ALERT_LIMITS = { co2HighPpm: 1200, phMin: 5.5, phMax: 7.5 };

const ALERT_RULES = [
  { type: 'temperature_high', field: 'temperatura_c', active: (value) => value >= 30, threshold: 30, unit: '°C', severity: 'warning' },
  { type: 'soil_moisture_low', field: 'humedad_suelo_pct', active: (value) => value <= 35, threshold: 35, unit: '%', severity: 'warning' },
  { type: 'co2_high', field: 'co2_ppm', active: (value) => value >= ALERT_LIMITS.co2HighPpm, threshold: ALERT_LIMITS.co2HighPpm, unit: 'ppm', severity: 'warning' },
  { type: 'ph_out_of_range', field: 'ph', active: (value) => value < ALERT_LIMITS.phMin || value > ALERT_LIMITS.phMax, threshold: `${ALERT_LIMITS.phMin}-${ALERT_LIMITS.phMax}`, unit: 'pH', severity: 'warning' }
];

async function insertEvent(supabase, event) {
  try {
    const { error } = await supabase.from('events').insert(event);
    if (error) console.warn('[events] event was not persisted', error.code || 'unknown');
  } catch {
    console.warn('[events] event was not persisted');
  }
}

export async function evaluateSystemEvents(supabase, previousState = {}, nextState, mode = 'automatic') {
  const alertStates = { ...(nextState.alertas || {}) };

  for (const [zone, measurements] of Object.entries(nextState.zonas || {})) {
    const zoneAlerts = { ...(alertStates[zone] || {}) };
    for (const rule of ALERT_RULES) {
      const value = measurements[rule.field];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;

      const active = rule.active(value);
      const wasActive = !!zoneAlerts[rule.type];
      if (active === wasActive) continue;

      zoneAlerts[rule.type] = active;
      const message = active
        ? `${rule.type} en zona ${zone}: ${value.toFixed(1)} ${rule.unit} (umbral ${rule.threshold}).`
        : `Recuperación en zona ${zone}: ${rule.type} volvió a normalidad.`;
      const event = {
        event_type: active ? rule.type : 'recovery',
        zone,
        severity: active ? rule.severity : 'info',
        message,
        metadata: { alert_type: rule.type, value, threshold: rule.threshold, source: measurements.fuenteDatos || 'simulation' }
      };
      await insertEvent(supabase, event);
      if (active || wasActive) await sendTelegramAlert(message);
    }
    alertStates[zone] = zoneAlerts;
  }

  if (mode === 'automatic') {
    for (const device of ['riego', 'aire']) {
      const before = !!previousState[device];
      const after = !!nextState[device];
      if (before === after) continue;

      const isIrrigation = device === 'riego';
      const eventType = `${isIrrigation ? 'irrigation' : 'ventilation'}_${after ? 'on' : 'off'}`;
      const message = isIrrigation
        ? `Riego ${after ? 'activado' : 'detenido'} automáticamente.`
        : `Ventilación ${after ? 'activada' : 'detenida'} automáticamente.`;
      await insertEvent(supabase, {
        event_type: eventType,
        zone: null,
        severity: 'info',
        message,
        metadata: { source: 'automatic', temperatura_c: nextState.temperatura_c, humedad_suelo_pct: nextState.humedad_suelo_pct }
      });
      if (after) await sendTelegramAlert(message);
    }
  }

  nextState.alertas = alertStates;
  return nextState;
}