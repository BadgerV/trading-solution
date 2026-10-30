const { json, authenticateRequest } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.id) return json(400, { error: 'Trade id is required' });

    const { supabase, auth } = await authenticateRequest(body, { requirePasswordChangeCompleted: true });
    const { data: existing, error: existingError } = await supabase
      .from('trades')
      .select('id, trader_id')
      .eq('id', body.id)
      .single();
    if (existingError || !existing) return json(404, { error: 'Trade not found' });
    if (auth.role !== 'admin' && existing.trader_id !== auth.trader_id) {
      return json(403, { error: 'You can only delete your own trades' });
    }

    const { error } = await supabase.from('trades').delete().eq('id', body.id);
    if (error) return json(400, { error: error.message });

    return json(200, { ok: true, deletedId: body.id });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};
