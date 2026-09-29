const SENSOR_FIELDS = new Set([
  'temperatura_c',
  'humedad_pct',
  'humedad_suelo_pct',
  'iluminancia_lux',
  'co2_ppm',
  'ph'
]);

const SELECT_FIELDS = [
  'created_at',
  'zone',
  ...SENSOR_FIELDS
].join(', ');

export function measurementsRoute(supabase) {
  return async function measurementsHandler(req, res) {
    try {
      const zone = String(req.query?.zone || 'GENERAL').toUpperCase();
      const variable = String(req.query?.variable || 'temperatura_c');
      const limitValue = Number.parseInt(req.query?.limit, 10);
      const limit = Number.isFinite(limitValue) ? Math.max(10, Math.min(500, limitValue)) : 120;

      if (!['GENERAL', 'A', 'B', 'C'].includes(zone)) {
        return res.status(400).json({ error: 'Zona inválida' });
      }
      if (!SENSOR_FIELDS.has(variable)) {
        return res.status(400).json({ error: 'Variable inválida' });
      }

      let query = supabase
        .from('measurements')
        .select(SELECT_FIELDS)
        .order('created_at', { ascending: false })
        .limit(zone === 'GENERAL' ? limit * 3 : limit);

      query = zone === 'GENERAL'
        ? query.in('zone', ['A', 'B', 'C'])
        : query.eq('zone', zone);

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          return res.status(503).json({ error: 'La tabla measurements requiere la migración SQL.' });
        }
        return res.status(500).json({ error: 'No se pudo consultar el historial.' });
      }

      let measurements;
      if (zone === 'GENERAL') {
        const grouped = new Map();
        for (const row of data || []) {
          const group = grouped.get(row.created_at) || { created_at: row.created_at, total: 0, count: 0 };
          const value = Number(row[variable]);
          if (Number.isFinite(value)) {
            group.total += value;
            group.count += 1;
          }
          grouped.set(row.created_at, group);
        }
        measurements = [...grouped.values()]
          .filter((sample) => sample.count > 0)
          .map((sample) => ({ created_at: sample.created_at, value: sample.total / sample.count }))
          .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
          .slice(-limit);
      } else {
        measurements = (data || [])
          .filter((row) => Number.isFinite(Number(row[variable])))
          .map((row) => ({ created_at: row.created_at, value: Number(row[variable]) }))
          .reverse();
      }

      return res.json({ zone, variable, measurements });
    } catch (error) {
      console.error('[measurements] query failed');
      return res.status(500).json({ error: 'No se pudo consultar el historial.' });
    }
  };
}