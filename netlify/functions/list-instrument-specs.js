const { json, getSupabaseAdmin, listInstrumentSpecs } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    const specs = await listInstrumentSpecs(supabase, { includeInactive: true });
    return json(200, { ok: true, instrument_specs: specs });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};
