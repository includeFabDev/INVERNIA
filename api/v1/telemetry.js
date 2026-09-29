import { getSupabaseClient } from '../../backend_vercel/src/services/supabaseClient.js';
import { telemetryRoute } from '../../backend_vercel/src/routes/telemetry.js';

export default async function handler(req, res) {
  try {
    return await telemetryRoute(getSupabaseClient())(req, res);
  } catch {
    return res.status(500).json({ error: 'Telemetry endpoint unavailable' });
  }
}