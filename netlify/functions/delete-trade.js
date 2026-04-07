const { json, validatePassword, getSupabaseAdmin } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    if (!validatePassword(body.password)) return json(401, { error: 'Invalid admin password' });
    if (!body.id) return json(400, { error: 'Trade id is required' });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('trades').delete().eq('id', body.id);
    if (error) return json(400, { error: error.message });

    return json(200, { ok: true, deletedId: body.id });
  } catch (error) {
    return json(500, { error: error.message || 'Internal server error' });
  }
};
