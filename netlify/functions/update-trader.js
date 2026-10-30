const {
  json,
  authenticateRequest,
  normalizeUsername,
  validateTraderPayload,
  sanitizeTrader
} = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { supabase } = await authenticateRequest(body, { requireAdmin: true });
    if (!body.id) return json(400, { error: 'Trader id is required' });

    const payload = body.trader || {};
    const validationError = validateTraderPayload(payload, { requirePassword: false });
    if (validationError && validationError !== 'temporary password must be at least 6 characters') {
      return json(400, { error: validationError });
    }

    const username = normalizeUsername(payload.username);
    const displayName = String(payload.display_name || '').trim();
    const role = payload.role === 'admin' ? 'admin' : 'trader';
    const active = payload.active !== false;

    const { data: updated, error } = await supabase
      .from('traders')
      .update({
        username,
        display_name: displayName,
        role,
        active
      })
      .eq('id', body.id)
      .select('*')
      .single();
    if (error) return json(400, { error: error.message });

    await supabase.from('trades').update({ trader: displayName, trader_id: updated.id }).eq('trader_id', updated.id);

    return json(200, { ok: true, trader: sanitizeTrader(updated) });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};
