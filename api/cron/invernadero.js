import { getSupabaseClient } from '../../backend_vercel/src/services/supabaseClient.js';
import { ensureDeviceState, getDefaultState, saveDeviceState } from '../../backend_vercel/src/services/deviceStates.js';
import { averageZoneMeasurements, createZoneMeasurements } from '../../backend_vercel/src/services/zones.js';
import { evaluateSystemEvents } from '../../backend_vercel/src/services/events.js';

const MEASUREMENT_INTERVAL_MS = 60_000;
const PHYSICAL_ZONE_TTL_MS = 5 * 60_000;
let measurementsTableUnavailable = false;
let lastMeasurementsWarningAt = 0;

function parseHHMM(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return { hh: 0, mm: 0 };
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hh: 0, mm: 0 };
  const hh = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return { hh, mm };
}

function toHHMM(hh, mm) {
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function minutesToHHMM(totalMinutes) {
  const wholeMinutes = Math.floor(totalMinutes);
  const m = ((wholeMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return toHHMM(hh, mm);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function persistZoneMeasurements(supabase, state) {
  if (measurementsTableUnavailable) return;

  const now = Date.now();
  if (now - (state.__lastMeasurementMs || 0) < MEASUREMENT_INTERVAL_MS) return;

  const createdAt = new Date(now).toISOString();
  const rows = Object.entries(state.zonas || {}).map(([zone, values]) => ({
    created_at: createdAt,
    zone,
    temperatura_c: values.temperatura_c,
    humedad_pct: values.humedad_pct,
    humedad_suelo_pct: values.humedad_suelo_pct,
    iluminancia_lux: values.iluminancia_lux,
    co2_ppm: values.co2_ppm,
    ph: values.ph
  }));

  const { error } = await supabase.from('measurements').insert(rows);
  if (error) {
    const missingTable = error.code === '42P01' || error.code === 'PGRST205';
    if (missingTable) measurementsTableUnavailable = true;
    if (missingTable || now - lastMeasurementsWarningAt >= MEASUREMENT_INTERVAL_MS) {
      console.warn('[cron/invernadero] measurements snapshot unavailable', error.code || 'unknown');
      lastMeasurementsWarningAt = now;
    }
    return;
  }

  state.__lastMeasurementMs = now;
}

function updateZonesAndAverages(state, previousZones, dtSeconds, timeScale) {
  const alpha = 1 - Math.exp(-Math.min(120, dtSeconds * timeScale) / 30);
  const simulatedZones = createZoneMeasurements(state, previousZones, alpha);
  const now = Date.now();
  state.zonas = {};
  for (const zone of ['A', 'B', 'C']) {
    const previous = previousZones[zone] || {};
    const updatedAt = Date.parse(previous.updated_at || '');
    const physicalIsFresh = previous.fuenteDatos === 'physical'
      && Number.isFinite(updatedAt)
      && now - updatedAt <= PHYSICAL_ZONE_TTL_MS;
    if (physicalIsFresh) {
      state.zonas[zone] = { ...simulatedZones[zone], ...previous, fuenteDatos: 'physical' };
    } else {
      const simulated = { ...simulatedZones[zone], fuenteDatos: 'simulation' };
      delete simulated.device_id;
      delete simulated.updated_at;
      state.zonas[zone] = simulated;
    }
  }
  state.fuenteDatos = Object.values(state.zonas).some((zone) => zone.fuenteDatos === 'physical')
    ? 'physical'
    : 'simulation';
  Object.assign(state, averageZoneMeasurements(state.zonas));
}

// Regla simple de clima (1 tick = 1 minuto virtual)
function computeSolarFactorFromHora(hhmm) {
  // Factor 0..1 con pico alrededor de 13:00 (misma idea de la simulación frontend)
  const { hh, mm } = parseHHMM(hhmm);
  const minutes = hh * 60 + mm;

  const dayMinutes = 24 * 60;
  const peak = 13 * 60;
  const halfWindow = 6 * 60; // ~7:00..19:00

  const dist = Math.abs(minutes - peak);
  const distWrap = Math.min(dist, dayMinutes - dist);
  if (distWrap >= halfWindow) return 0;

  const t = 1 - (distWrap / halfWindow); // 0..1
  return Math.max(0, Math.min(1, Math.sin((Math.PI / 2) * t)));
}

function applyClimateRules(currentState, actuators, dtSeconds, timeScale) {
  const state = { ...(currentState || {}) };

  const luz = !!actuators.luz;
  const aire = !!actuators.aire;
  const riego = !!actuators.riego;
  const modoCalor = !!state.modoCalor;
  const modoSeco = !!state.modoSeco;

  const horaVirtual = typeof state.horaVirtual === 'string' ? state.horaVirtual : '12:00';
  const solarFactor = computeSolarFactorFromHora(horaVirtual);

  // 1) Temperatura base por hora
  const TEMP_MIN = 14;
  const TEMP_MAX = 38;
  let tempTarget = TEMP_MIN + (TEMP_MAX - TEMP_MIN) * solarFactor;

  // 2) Correcciones por actuadores
  if (aire) tempTarget -= 2.5;
  if (luz) tempTarget += 0.5;
  if (modoCalor) tempTarget += 4;

  // 3) Humedad base por hora (inversa del sol)
  const HUM_MAX = 85;
  const HUM_MIN = 45;
  let humTarget = HUM_MAX - (HUM_MAX - HUM_MIN) * solarFactor;

  if (riego) humTarget += 8;
  if (aire) humTarget -= 1.5;
  if (modoCalor) humTarget -= 3;
  if (modoSeco) humTarget -= 12;

  // 4) Acercamiento incremental al target, escalado por dtSeconds + timeScale
  //    para que el cambio sea proporcional al tiempo real pasado, no constante
  //    por tick. Sin esto, un cron de 1min y un ping de 5s darían el mismo
  //    delta de temperatura.
  const prevTemp = typeof state.temperatura_c === 'number' ? state.temperatura_c : 27;
  const prevHum = typeof state.humedad_pct === 'number' ? state.humedad_pct : 68;

  // alpha: factor de "tasa" (1/seg). Multiplicado por dtSeconds da la fracción
  // de la diferencia a cubrir en este tick. A más timeScale, alpha sube (cubre
  // más rápido), pero se clampea para que en x10 el cambio sea visible sin
  // saltos bruscos.
  const baseRate = 0.05;             // 5% de la brecha por segundo en x1
  const alpha = Math.min(0.6, baseRate * timeScale * dtSeconds);
  let temp = prevTemp + (tempTarget - prevTemp) * alpha;
  let hum = prevHum + (humTarget - prevHum) * alpha;

  // 5) DRIFT DINÁMICO afectado por los actuadores, escalado por timeScale
  //    y por dtSeconds (para que sea proporcional al tiempo real, no por tick).
  //
  // - Calor se acumula con el tiempo (drift positivo).
  // - El ventilador (aire) enfría: REVIERTE el drift de temperatura.
  // - El suelo se seca con el tiempo (drift negativo de humedad).
  // - El riego (riego) hidrata: REVIERTE el drift de humedad.
  //
  // Tasas base (por segundo en x1):
  //   0.5 °C/seg subiría demasiado; usamos 0.05 °C/seg (3°C/min) que a x10
  //   se nota en segundos (0.5 °C/seg = 1.5°C en 3s).
  const TEMP_DRIFT_PER_SEC = 0.05;   // °C/seg (x1) sin ventilador
  const HUM_DRIFT_PER_SEC = 0.08;    // %/seg (x1) sin riego

  // Tiempo "virtual" de este tick, escalado por timeScale. dtSeconds*ts es la
  // cantidad de tiempo simulado que este tick representa.
  const virtualDt = dtSeconds * timeScale;

  // Temperatura: aire ON => invierte (enfría), aire OFF => calor acumulado.
  const tempDriftEffect = TEMP_DRIFT_PER_SEC * virtualDt * (aire ? -1 : 1);

  // Humedad: riego ON => invierte (sube), riego OFF => suelo se seca.
  const humDriftEffect = HUM_DRIFT_PER_SEC * virtualDt * (riego ? -1 : 1);

  temp += tempDriftEffect;
  hum += humDriftEffect;

  // LÍMITES LÓGICOS (Clamp) para que no rompa la escala del invernadero
  state.temperatura_c = Math.max(14, Math.min(45, temp));
  state.humedad_pct = Math.max(20, Math.min(95, hum));

  const virtualMinutes = Math.min(30, dtSeconds * timeScale);
  const soil = typeof state.humedad_suelo_pct === 'number' ? state.humedad_suelo_pct : 58;
  const soilRate = riego ? 0.035 : -0.008 * (modoSeco ? 2 : 1);
  state.humedad_suelo_pct = clamp(soil + soilRate * virtualMinutes, 0, 100);

  const previousLux = typeof state.iluminancia_lux === 'number' ? state.iluminancia_lux : 0;
  const targetLux = 55000 * solarFactor;
  const luxAlpha = 1 - Math.exp(-virtualMinutes / 8);
  state.iluminancia_lux = clamp(previousLux + (targetLux - previousLux) * luxAlpha, 0, 60000);

  const previousCo2 = typeof state.co2_ppm === 'number' ? state.co2_ppm : 650;
  const targetCo2 = aire ? 420 : 800 + solarFactor * 120;
  const co2Alpha = 1 - Math.exp(-virtualMinutes / (aire ? 5 : 90));
  state.co2_ppm = clamp(previousCo2 + (targetCo2 - previousCo2) * co2Alpha, 350, 2000);

  const previousPh = typeof state.ph === 'number' ? state.ph : 6.2;
  const targetPh = riego ? 6.15 : 6.25;
  const phAlpha = 1 - Math.exp(-virtualMinutes / 360);
  state.ph = clamp(previousPh + (targetPh - previousPh) * phAlpha, 5.5, 7.5);

  if (state.modoAutomatico !== false) {
    if (state.temperatura_c >= 30) state.aire = true;
    if (state.temperatura_c <= 27) state.aire = false;
    if (state.humedad_suelo_pct <= 35) state.riego = true;
    if (state.humedad_suelo_pct >= 60) state.riego = false;
  }

  return state;
}


// Cron tick: por simplicidad actualiza todos los device_states (o solo uno si prefieres)
export default async function handler(req, res) {
  try {
    // 🔒 ID unificado del proyecto. Ignoramos cualquier chatId dinámico que venga
    // por query string: el sistema completo (frontend, bot de Telegram y cron)
    // opera sobre un único registro fijo en Supabase.
    const FIXED_CHAT_ID = '123456789';

    // Si pasan más de 2 minutos entre ticks (cron atascado, app cerrada, etc.),
    // clampeamos para que un solo tick no salte la simulación 2h adelante.
    const MAX_DT_SEC = 120;
    // Tick "mínimo" cuando no hay updated_at (registro recién creado):
    // usamos 5s para que el primer ciclo tenga efecto visible.
    const DEFAULT_DT_SEC = 5;

    const supabase = getSupabaseClient();

    // Leemos el registro fijo incluyendo updated_at para calcular el dt real.
    const { data, error } = await supabase
      .from('device_states')
      .select('chat_id, state, last_action, updated_at')
      .eq('chat_id', FIXED_CHAT_ID)
      .maybeSingle();

    if (error) throw error;

    let row = data;

    if (!row) {
      // Si por algún motivo el registro fijo aún no existe, lo creamos al vuelo
      // con el estado por defecto. Esto evita que el cron devuelva "updated: 0"
      // y garantiza que la primera ejecución del proyecto ya tenga su fila.
      const seeded = await ensureDeviceState(supabase, FIXED_CHAT_ID);
      row = seeded;
      if (!row) {
        return res.status(200).json({ ok: true, updated: 0, note: 'No device_states found' });
      }
    }

    // Calculamos cuánto tiempo real pasó desde el último write del CRON.
    // Usamos un campo dedicado (__lastCronMs) guardado DENTRO del state
    // para que el próximo tick pueda calcular su dt real sin confundirse
    // con los writes de /api/state (que también actualiza updated_at).
    let dtSeconds = DEFAULT_DT_SEC;
    const persistedState = (row && row.state) ? row.state : {};
    const lastCronMs = typeof persistedState.__lastCronMs === 'number' ? persistedState.__lastCronMs : null;
    if (lastCronMs !== null && lastCronMs > 0) {
      dtSeconds = Math.max(0.5, Math.min(MAX_DT_SEC, (Date.now() - lastCronMs) / 1000));
    }

    const chatId = row.chat_id;
    const state = { ...getDefaultState(), ...persistedState };
    const defaultZones = getDefaultState().zonas;
    const previousZones = Object.fromEntries(['A', 'B', 'C'].map((zone) => [
      zone,
      { ...defaultZones[zone], ...(persistedState.zonas?.[zone] || {}) }
    ]));
    state.zonas = createZoneMeasurements(state, previousZones, 1);

    // Hora virtual (fuente de verdad = cron)
    // Retrocompatibilidad:
    // - si no existe usarHoraReal => true
    // - si no existe timeScale => 1
    const usarHoraReal = state.usarHoraReal !== false;
    const timeScale = typeof state.timeScale === 'number' && !Number.isNaN(state.timeScale) && state.timeScale > 0
      ? state.timeScale
      : 1;

    if (usarHoraReal) {
      // Hora real (del servidor)
      const now = new Date();
      state.horaVirtual = toHHMM(now.getHours(), now.getMinutes());
    } else {
      // Avanza horaVirtual proporcional al tiempo real pasado × timeScale.
      const { hh, mm } = parseHHMM(state.horaVirtual);
      const totalMinutes = hh * 60 + mm;
      // "1s real = 1 min simulado" como convención original; timeScale
      // multiplica cuántos minutos virtuales corren por segundo real.
      const minutesToAdd = dtSeconds * 1 * timeScale;
      state.horaVirtual = minutesToHHMM(totalMinutes + minutesToAdd);
    }

    // actuadores
    const actuators = {
      luz: !!state.luz,
      aire: !!state.aire,
      riego: !!state.riego
    };

    // El clima sigue evolucionando en manual; solo se omiten umbrales automáticos.
    const modoAutomatico = state.modoAutomatico !== false;
    const nextState = applyClimateRules(state, actuators, dtSeconds, timeScale);
    updateZonesAndAverages(nextState, previousZones, dtSeconds, timeScale);
    await evaluateSystemEvents(supabase, persistedState, nextState, modoAutomatico ? 'automatic' : 'manual');
    if (typeof state.horaVirtual === 'string') nextState.horaVirtual = state.horaVirtual;
    nextState.__lastCronMs = Date.now();

    await persistZoneMeasurements(supabase, nextState);
    await saveDeviceState(supabase, chatId, nextState, modoAutomatico ? 'tick_clima' : 'tick_manual');
    return res.status(200).json({
      ok: true,
      updated: 1,
      dtSeconds: Math.round(dtSeconds * 10) / 10,
      timeScale,
      mode: modoAutomatico ? 'automatic' : 'manual',
      temperatura_c: nextState.temperatura_c,
      humedad_pct: nextState.humedad_pct,
      humedad_suelo_pct: nextState.humedad_suelo_pct,
      iluminancia_lux: nextState.iluminancia_lux,
      co2_ppm: nextState.co2_ppm,
      ph: nextState.ph,
      fuenteDatos: nextState.fuenteDatos,
      zonas: nextState.zonas
    });
  } catch (err) {
    console.error('[cron/invernadero] error:', err);
    return res.status(500).json({ error: 'Cron tick error' });
  }
}

