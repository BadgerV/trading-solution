const { json, authenticateRequest, hashPassword } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { supabase } = await authenticateRequest(body, { requireAdmin: true });
    if (!body.id) return json(400, { error: 'Trader id is required' });
    if (String(body.password || '').length < 6) return json(400, { error: 'temporary password must be at least 6 characters' });

    const { passwordHash, passwordSalt } = hashPassword(String(body.password));
    const { data, error } = await supabase
      .from('traders')
      .update({
        password_hash: passwordHash,
        password_salt: passwordSalt,
        must_change_password: true
      })
      .eq('id', body.id)
      .select('id')
      .single();
    if (error) return json(400, { error: error.message });

    return json(200, { ok: true, trader_id: data.id });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};
