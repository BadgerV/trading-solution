const { json, authenticateRequest, hashPassword, findTraderByUsername } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { supabase, auth } = await authenticateRequest(body);
    if (auth.type !== 'trader') return json(400, { error: 'Only user accounts can change password' });

    const currentPassword = String(body.current_password || '');
    const newPassword = String(body.new_password || '');
    const confirmPassword = String(body.confirm_password || '');
    if (!currentPassword) return json(400, { error: 'Current password is required' });
    if (newPassword.length < 6) return json(400, { error: 'New password must be at least 6 characters' });
    if (newPassword !== confirmPassword) return json(400, { error: 'New password and confirmation must match' });

    const trader = await findTraderByUsername(supabase, auth.username);
    if (!trader) return json(404, { error: 'Account not found' });
    const { passwordHash, passwordSalt } = hashPassword(newPassword);

    const { error } = await supabase
      .from('traders')
      .update({
        password_hash: passwordHash,
        password_salt: passwordSalt,
        must_change_password: false
      })
      .eq('id', trader.id);
    if (error) return json(400, { error: error.message });

    return json(200, { ok: true });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};
