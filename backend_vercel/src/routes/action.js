import { executeAction, toggleDevice } from '../services/executeAction.js';
import { saveDeviceState } from '../services/deviceStates.js';


export function actionRoute(supabase) {
  return async function actionHandler(req, res) {
    try {
      const body = req.body || {};
      const { chatId, device, mode, text } = body;

      if (!chatId && chatId !== 0) {
        return res.status(400).json({ error: 'Missing chatId' });
      }

      if (device === 'automation' && (mode === 'manual' || mode === 'automatic')) {
        const modoAutomatico = mode === 'automatic';
        await saveDeviceState(
          supabase,
          chatId,
          (state) => ({ state: { ...state, modoAutomatico } }),
          `set_mode_${mode}`
        );
        return res.json({ ok: true, modoAutomatico });
      }

      // Control explícito del reloj (usarHoraReal / timeScale)
      // Contrato (simple y extensible):
      // 1) device='time', mode='backend'|'sim' => set usarHoraReal
      // 2) device='time', timeScale=<n> => set timeScale
      if (device === 'time') {
        // timeScale override (x1/x2/x5/x10)
        if (typeof body.timeScale === 'number' && !Number.isNaN(body.timeScale)) {
          const nextTimeScale = Math.max(0, Math.min(1000, body.timeScale));
          await saveDeviceState(
            supabase,
            chatId,
            (state) => ({ state: { ...state, timeScale: nextTimeScale } }),
            'set_timeScale'
          );
          return res.json({ ok: true });
        }

        // backend/sim
        if (mode === 'backend' || mode === 'sim') {
          const usarHoraReal = mode === 'backend';
          await saveDeviceState(
            supabase,
            chatId,
            (state) => ({ state: { ...state, usarHoraReal } }),
            'set_usarHoraReal'
          );
          return res.json({ ok: true });
        }
      }

      // Modo: explícito para toggles rápidos
      if (device && mode) {
        // mode: 'on' | 'off'
        const desiredAction = mode === 'on' ? 'turn_on' : 'turn_off';
        const actionObj = { action: desiredAction, device };
        await executeAction(supabase, actionObj, chatId);
        return res.json({ ok: true });
      }

      // Alternativa: togglear según dispositivo
      if (device && !mode) {
        await toggleDevice(supabase, device, chatId);
        return res.json({ ok: true });
      }

      // Alternativa: pasar texto (para parser)
      if (typeof text === 'string') {
        const actionObj = (await import('../services/interpreterKeywords.js')).parseKeywordsToAction(text);
        await executeAction(supabase, actionObj, chatId);
        return res.json({ ok: true });
      }

      // Caso: body ya trae actionObj
      if (body.actionObj) {
        await executeAction(supabase, body.actionObj, chatId);
        return res.json({ ok: true });
      }

      return res.status(400).json({ error: 'Invalid request body' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error en acción' });
    }
  };
}
