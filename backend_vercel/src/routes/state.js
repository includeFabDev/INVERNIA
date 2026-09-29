import { getDefaultState } from '../services/deviceStates.js';
import { averageZoneMeasurements, createZoneMeasurements } from '../services/zones.js';

export function stateRoute(supabase) {
  return async function stateHandler(req, res) {
    try {
      const chatId = req.params.chatId;

      const { data, error } = await supabase
        .from('device_states')
        .select('chat_id, state, last_action, updated_at')
        .eq('chat_id', chatId)
        .maybeSingle();

      if (error) throw error;

      const storedState = data?.state || {};
      const merged = { ...getDefaultState(), ...storedState };
      merged.zonas = createZoneMeasurements(merged, storedState.zonas, storedState.zonas ? 0 : 1);
      Object.assign(merged, averageZoneMeasurements(merged.zonas));

      return res.json({
        devices: {
          luz: !!merged.luz,
          aire: !!merged.aire,
          riego: !!merged.riego,
          temperatura_c: merged.temperatura_c,
          humedad_pct: merged.humedad_pct,
          humedad_suelo_pct: merged.humedad_suelo_pct,
          iluminancia_lux: merged.iluminancia_lux,
          co2_ppm: merged.co2_ppm,
          ph: merged.ph,
          zonas: merged.zonas,
          modoCalor: !!merged.modoCalor,
          modoSeco: !!merged.modoSeco,
          modoAutomatico: !!merged.modoAutomatico,
          fuenteDatos: merged.fuenteDatos || 'simulation',
          horaVirtual: merged.horaVirtual,
          usarHoraReal: merged.usarHoraReal,
          timeScale: merged.timeScale
        },
        lastAction: data?.last_action || 'init',
        updatedAt: data?.updated_at || null
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error leyendo estado' });
    }
  };
}

