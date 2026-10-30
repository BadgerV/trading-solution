const { json, validateAdminPassword, getSupabaseAdmin, findTraderByUsername, verifyPassword, sanitizeTrader } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const mode = body.mode === 'admin' ? 'admin' : 'trader';
    const password = String(body.password || '');
    const username = String(body.username || '').trim();

    if (!password) return json(400, { error: 'Password is required' });

    if (mode === 'admin' && !username && validateAdminPassword(password)) {
      return json(200, {
        ok: true,
        session: {
          role: 'admin',
          auth_mode: 'admin',
          username: 'admin',
          display_name: 'Admin',
          trader_id: null,
          must_change_password: false,
          source: 'master-password'
        }
      });
    }

    const supabase = getSupabaseAdmin();
    const trader = await findTraderByUsername(supabase, username);
    if (!trader || !verifyPassword(password, trader.password_salt, trader.password_hash)) {
      return json(401, { error: 'Invalid username or password' });
    }
    if (!trader.active) return json(403, { error: 'This account is inactive' });
    if (mode === 'admin' && trader.role !== 'admin') return json(403, { error: 'Admin access is required' });

    await supabase.from('traders').update({ last_login_at: new Date().toISOString() }).eq('id', trader.id);
    const safeTrader = sanitizeTrader(trader);

    return json(200, {
      ok: true,
      session: {
        role: safeTrader.role,
        auth_mode: mode,
        username: safeTrader.username,
        display_name: safeTrader.display_name,
        trader_id: safeTrader.id,
        must_change_password: safeTrader.must_change_password,
        source: 'user-account'
      }
    });
  } catch (error) {
    return json(500, { error: error.message || 'Internal server error' });
  }
};
