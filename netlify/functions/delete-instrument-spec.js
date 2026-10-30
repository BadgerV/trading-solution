const { json, authenticateRequest } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.id) return json(400, { error: 'Instrument spec id is required' });

    const { supabase } = await authenticateRequest(body, { requireAdmin: true });
    const { error } = await supabase
      .from('instrument_specs')
      .delete()
      .eq('id', body.id);

    if (error) return json(400, { error: error.message });
    return json(200, { ok: true });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};
