const EVENT_TYPES = new Set([
  'test_started', 'test_completed', 'test_failed', 'scenario_started', 'scenario_warning',
  'scenario_info', 'temperature_high', 'temperature_low', 'soil_moisture_low',
  'humidity_high', 'low_light', 'recovery', 'ventilation_on', 'ventilation_off',
  'irrigation_on', 'irrigation_off'
]);

export function eventsRoute(supabase) {
  return async function eventsHandler(req, res) {
    if (req.method === 'GET') {
      const runId = typeof req.query?.runId === 'string' ? req.query.runId : '';
      const requestedLimit = Number(req.query?.limit);
      const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 200)
        : 100;
      let query = supabase.from('events')
        .select('id, created_at, event_type, zone, severity, message, metadata')
        .order('created_at', { ascending: true })
        .limit(limit);
      if (runId) query = query.contains('metadata', { run_id: runId });

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: 'Events could not be read' });
      return res.json({ events: data || [] });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Buffer.byteLength(JSON.stringify(body)) > 4096) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    if (typeof body.runId !== 'string' || !/^[\w-]{1,64}$/.test(body.runId)
      || !EVENT_TYPES.has(body.eventType)
      || typeof body.message !== 'string' || body.message.length > 240) {
      return res.status(400).json({ error: 'Invalid event' });
    }
    if (body.zone !== null && !['A', 'B', 'C'].includes(body.zone)) {
      return res.status(400).json({ error: 'Invalid zone' });
    }
    const severity = body.severity || 'info';
    if (!['info', 'warning', 'critical'].includes(severity)) {
      return res.status(400).json({ error: 'Invalid severity' });
    }
    const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : {};
    const { data, error } = await supabase.from('events').insert({
      event_type: body.eventType,
      zone: body.zone,
      severity,
      message: body.message,
      metadata: { ...metadata, run_id: body.runId }
    }).select('id, created_at, event_type, zone, severity, message, metadata').single();
    if (error) return res.status(500).json({ error: 'Event could not be stored' });
    return res.status(201).json({ event: data });
  };
}