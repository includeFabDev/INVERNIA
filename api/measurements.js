import { getSupabaseClient } from '../backend_vercel/src/services/supabaseClient.js';
import { measurementsRoute } from '../backend_vercel/src/routes/measurements.js';

export default async function handler(req, res) {
  try {
    return await measurementsRoute(getSupabaseClient())(req, res);
  } catch (error) {
    console.error('[api/measurements] request failed');
    return res.status(500).json({ error: 'No se pudo consultar el historial.' });
  }
}