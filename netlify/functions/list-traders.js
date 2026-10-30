const { json, authenticateRequest, sanitizeTrader } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { supabase, auth } = await authenticateRequest(body);

    if (auth.role === 'admin') {
      const { data, error } = await supabase
        .from('traders')
        .select('*')
        .order('display_name', { ascending: true });
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true, traders: (data || []).map(sanitizeTrader) });
    }

    const { data, error } = await supabase
      .from('traders')
      .select('*')
      .eq('id', auth.trader_id)
      .single();
    if (error) return json(400, { error: error.message });
    return json(200, { ok: true, traders: [sanitizeTrader(data)] });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};
