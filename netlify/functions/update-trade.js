const { json, validatePassword, getSupabaseAdmin, normalizeTrade, validateTrade } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    if (!validatePassword(body.password)) return json(401, { error: 'Invalid admin password' });
    if (!body.id) return json(400, { error: 'Trade id is required' });

    const trade = normalizeTrade(body.trade);
    const validationError = validateTrade(trade);
    if (validationError) return json(400, { error: validationError });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('trades').update(trade).eq('id', body.id).select('*').single();
    if (error) return json(400, { error: error.message });

    return json(200, { ok: true, trade: data });
  } catch (error) {
    return json(500, { error: error.message || 'Internal server error' });
  }
};
