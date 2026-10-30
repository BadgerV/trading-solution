const {
  json,
  authenticateRequest,
  normalizeUsername,
  hashPassword,
  validateTraderPayload,
  sanitizeTrader
} = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { supabase } = await authenticateRequest(body, { requireAdmin: true });
    const payload = body.trader || {};
    const validationError = validateTraderPayload(payload, { requirePassword: true });
    if (validationError) return json(400, { error: validationError });

    const username = normalizeUsername(payload.username);
    const displayName = String(payload.display_name || '').trim();
    const role = payload.role === 'admin' ? 'admin' : 'trader';
    const active = payload.active !== false;
    const { passwordHash, passwordSalt } = hashPassword(String(payload.password || ''));

    const { data, error } = await supabase
      .from('traders')
      .insert({
        username,
        display_name: displayName,
        role,
        active,
        password_hash: passwordHash,
        password_salt: passwordSalt,
        must_change_password: true
      })
      .select('*')
      .single();

    if (error) return json(400, { error: error.message });
    return json(200, { ok: true, trader: sanitizeTrader(data) });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};
